from typing import List, Literal, Union
from pydantic import Field
import modal
from openai import BaseModel
import fastapi
import os

#modal deploy ./vllm_inference.py

vllm_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "vllm==0.6.6.post1", "fastapi[standard]")
MODEL_NAME = "llama-70B" #available models: (1) llama-8B-wattai; (2) llama-70B
MODELS_DIR = f"/{MODEL_NAME}"
BASE_MDOEL = f"{MODELS_DIR}/meta-llama/Llama-3.3-70B-Instruct" #models directories: (1) watt-ai/watt-tool-8B; (2) meta-llama/Llama-3.3-70B-Instruct
MODEL_FINETUNED_NAME = "finetune-volume-large" #lora adapters: (1) finetune-volume; (2) finetune-volume-large
LORA_ADAPTER_DIR = f"/{MODEL_FINETUNED_NAME}"

try:
    volume = modal.Volume.from_name(MODEL_NAME, create_if_missing=False)
    finetuned_volume = modal.Volume.from_name(MODEL_FINETUNED_NAME, create_if_missing=False)
except modal.exception.NotFoundError:
    raise Exception("Download models first with modal run download_llama.py")

app = modal.App("maplab-vllm", image=vllm_image)

N_GPU = 4 
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
    gpu=f"A100-80GB:{N_GPU}",
    scaledown_window=5 * MINUTES,
    timeout=1 * HOURS,
    allow_concurrent_inputs=1000,
    volumes={MODELS_DIR: volume, LORA_ADAPTER_DIR: finetuned_volume},
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
    from vllm.entrypoints.openai.serving_engine import (
        BaseModelPath,
        LoRAModulePath
        )
    from vllm.entrypoints.openai.protocol import ChatCompletionRequest
    from fastapi import Request
    
    volume.reload()  # ensure we have the latest version of the weights
    finetuned_volume.reload()  # ensure we have the latest version of the weights

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
    
    os.environ["VLLM_ALLOW_LONG_MAX_MODEL_LEN"] = "1"

    engine_args = AsyncEngineArgs(
        model=BASE_MDOEL,
        tensor_parallel_size=N_GPU,
        gpu_memory_utilization=0.93,
        max_model_len=None,
        trust_remote_code=True,
        enable_lora=True,
        max_loras=1,
        max_lora_rank=32,
        enforce_eager=False,
        #pipeline_parallel_size = 4,
        enable_chunked_prefill=True,
        enable_prefix_caching=True,
        max_num_batched_tokens=16192
    )

    engine = AsyncLLMEngine.from_engine_args(
        engine_args, usage_context=UsageContext.OPENAI_API_SERVER
    )
    
    web_app.state.engine_client = engine

    model_config = get_model_config(engine)

    request_logger = RequestLogger(max_log_len=4096)

    base_model_paths = [
    BaseModelPath(
        name=MODEL_NAME.split("/")[1] if "/" in MODEL_NAME else MODEL_NAME,
        model_path=MODELS_DIR + "/" + MODEL_NAME
        )
    ]

    api_server.chat = lambda s: OpenAIServingChat(
        engine,
        model_config=model_config,
        base_model_paths=base_model_paths,
        response_role="assistant",
        lora_modules=[    
           LoRAModulePath(
               name="overpass",
               path=LORA_ADAPTER_DIR + "/" + MODEL_NAME
           )],
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
        #lora_modules=[    
        #    LoRAModulePath(
        #        name="overpass",
        #        path=LORA_ADAPTER_DIR + "/" + MODEL_NAME,
        #        base_model_name= MODEL_NAME.split("/")[1] if "/" in MODEL_NAME else MODEL_NAME,
        #    )],
        prompt_adapters=[],
        request_logger=request_logger,
    )
    
    # Add the router to the app
    web_app.include_router(router)

    return web_app