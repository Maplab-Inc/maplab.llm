import os
import sys

from openai import OpenAI


BASE_URL = os.environ.get("LITELLM_BASE_URL", "https://llm.maplab.ai/")
API_KEY = os.environ["LITELLM_API_KEY"]
MODEL = os.environ.get("LITELLM_MODEL", "mapgears_ai")


def main() -> int:
    client = OpenAI(
        base_url=f"{BASE_URL}/v1",
        api_key=API_KEY,
    )

    try:
        response = client.chat.completions.with_raw_response.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": "Reply with OK.",
                }
            ],
        )
    except Exception as error:
        print(f"Request failed: {error}", file=sys.stderr)
        return 1

    parsed = response.parse()
    message = parsed.choices[0].message.content
    print(f"Requested model: {MODEL}")
    print(f"Response model: {parsed.model}")
    print(f"LiteLLM model group: {response.headers.get('x-litellm-model-group')}")
    print(f"LiteLLM model id: {response.headers.get('x-litellm-model-id')}")
    print(f"Assistant reply: {message}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())