from typing import Any, List, Literal, Union
from pydantic import Field
import modal
from openai import BaseModel
import fastapi

#modal deploy ./inference/vllm_inference.py

vllm_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "vllm==0.6.6.post1", "fastapi[standard]")
MODELS_DIR = "/llama-70B"
MODEL_NAME = "meta-llama/Llama-3.3-70B-Instruct"

try:
    volume = modal.Volume.lookup("llama-70B", create_if_missing=False)
except modal.exception.NotFoundError:
    raise Exception("Download models first with modal run download_llama.py")

app = modal.App("maplab-vllm", image=vllm_image)

N_GPU = 2  # tip: for best results, first upgrade to more powerful GPUs, and only then increase GPU count
TOKEN = "super-secret-token"  # auth token. for production use, replace with a modal.Secret

MINUTES = 60  # seconds
HOURS = 60 * MINUTES

class Message(BaseModel):
    role: Union[Literal["system"], Literal["user"], Literal["assistant"]]
    content: str
class ChatRequest(BaseModel):
    model: str
    messages: List[Message]
    stream: bool = Field(default=False)

def get_model_config(engine):
    import asyncio

    try:  # adapted from vLLM source -- https://github.com/vllm-project/vllm/blob/507ef787d85dec24490069ffceacbd6b161f4f72/vllm/entrypoints/openai/api_server.py#L235C1-L247C1
        event_loop = asyncio.get_running_loop()
    except RuntimeError:
        event_loop = None

    if event_loop is not None and event_loop.is_running():
        # If the current is instanced by Ray Serve,
        # there is already a running event loop
        model_config = event_loop.run_until_complete(engine.get_model_config())
    else:
        # When using single vLLM without engine_use_ray
        model_config = asyncio.run(engine.get_model_config())

    return model_config

# create a fastAPI app that uses vLLM's OpenAI-compatible router
web_app = fastapi.FastAPI(
    title=f"OpenAI-compatible {MODEL_NAME} server",
    description="Run an OpenAI-compatible LLM server with vLLM on modal.com 🚀",
    version="0.0.1",
    docs_url="/docs",
)

@app.function(
    image=vllm_image,
    gpu=modal.gpu.A100(size="80GB",count=N_GPU),
    container_idle_timeout=5 * MINUTES,
    timeout=24 * HOURS,
    allow_concurrent_inputs=1000,
    volumes={MODELS_DIR: volume},
)
@modal.asgi_app()
def serve():
    import json
    import vllm.entrypoints.openai.api_server as api_server
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.engine.async_llm_engine import AsyncLLMEngine
    from vllm.entrypoints.logger import RequestLogger
    from vllm.entrypoints.openai.serving_chat import OpenAIServingChat
    from vllm.usage.usage_lib import UsageContext
    from vllm.entrypoints.openai.serving_completion import (
            OpenAIServingCompletion
        )
    from vllm.entrypoints.openai.protocol import ChatCompletionRequest
    from vllm.entrypoints.openai.serving_engine import BaseModelPath
    from fastapi import Request
    
    volume.reload()  # ensure we have the latest version of the weights

    # security: CORS middleware for external requests
    http_bearer = fastapi.security.HTTPBearer(
        scheme_name="Bearer Token",
        description="See code for authentication details.",
    )
    web_app.add_middleware(
        fastapi.middleware.cors.CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # security: inject dependency on authed routes
    async def is_authenticated(api_key: str = fastapi.Security(http_bearer)):
        if api_key.credentials != TOKEN:
            raise fastapi.HTTPException(
                status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return {"username": "authenticated_user"}

    # router = fastapi.APIRouter(dependencies=[fastapi.Depends(is_authenticated)])
    router = fastapi.APIRouter()

    # wrap vllm's router in auth router
    router.include_router(api_server.router)
    # add authed vllm to our fastAPI app
    web_app.include_router(router)

    engine_args = AsyncEngineArgs(
        model=MODELS_DIR + "/" + MODEL_NAME,
        tensor_parallel_size=N_GPU,
        gpu_memory_utilization=0.90,
        max_model_len=10000,
        trust_remote_code=True,
        enforce_eager=True,  # capture the graph for faster inference, but slower cold starts (30s > 20s)
    )

    engine = AsyncLLMEngine.from_engine_args(
        engine_args, usage_context=UsageContext.OPENAI_API_SERVER
    )
    
    web_app.state.engine_client = engine

    model_config = get_model_config(engine)

    request_logger = RequestLogger(max_log_len=4096)

    base_model_paths = [
        BaseModelPath(name=MODEL_NAME.split("/")[1], model_path=MODEL_NAME)
    ]

    api_server.chat = lambda s: OpenAIServingChat(
        engine,
        model_config=model_config,
        base_model_paths=base_model_paths,
        response_role="assistant",
        lora_modules=[],
        prompt_adapters=[],
        request_logger=request_logger,
        enable_auto_tools=True,
        chat_template_content_format="auto",
        tool_parser="llama3_json",
        chat_template=None
    )
    api_server.completion = lambda s: OpenAIServingCompletion(
        engine,
        model_config=model_config,
        base_model_paths=base_model_paths,
        lora_modules=[],
        prompt_adapters=[],
        request_logger=request_logger,
    )
    
    @router.post("/v1/api/chat")
    async def ollama_chat(request: Request):
        json_data = await request.json() 
        print("Request>>>>>>", json_data)
        data = ChatCompletionRequest(**json_data)
        try:
            response = await api_server.chat(web_app.state.engine_client).create_chat_completion(data)

            print("Main response>>>", response)

            if hasattr(response, 'error') and response.error or not hasattr(response, 'choices') or not response.choices:
                print("Error response>>>", response)
                return response

            choice = response.choices[0]
            message_data = choice.message

            content = message_data.content if message_data.content else ""

            tool_calls = []
            if message_data.tool_calls:
                for tool_call in message_data.tool_calls:
                    function_name = tool_call.function.name if tool_call.function else ""
                    function_id = tool_call.id if tool_call.id else ""
                    function_type = tool_call.type if tool_call.type else ""
                    arguments = tool_call.function.arguments if tool_call.function and tool_call.function.arguments else ""

                    if isinstance(arguments, str):
                        try:
                            arguments = json.loads(arguments)
                        except json.JSONDecodeError:
                            arguments = {}  # Default to empty dictionary if JSON decoding fails

                    tool_calls.append({
                        "id": function_id,
                        "type": function_type,
                        "function": {
                            "name": function_name,
                            "arguments": arguments
                        }
                    })

            response = {
                "message": {
                    "role": message_data.role,
                    "content": content,
                    "tool_calls": tool_calls,
                }
            }

            print("Formated response>>>", response)

            return response
        
        except Exception as e:
            print(f"Error during processing: {str(e)}")
            return {"error": True, "message": "An error occurred during processing."}

    # Add the router to the app
    web_app.include_router(router)

    return web_app