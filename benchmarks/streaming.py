import asyncio
import time
from openai import AsyncOpenAI

# --- Config ---
client = AsyncOpenAI(
    base_url="https://maplab--maplab-vllm-serve.modal.run/v1",
)

MODEL = "llama-70B"
PROMPT = "Write a short story about a cat who discovers a hidden garden."

MAX_TOKENS = 200
TEMPERATURE = 0.7

# --- Streaming Function ---
async def stream_tokens():
    print("\n--- Streaming Tokens ---\n")
    start_time = time.time()
    first_token_time = None
    token_count = 0

    stream = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT}],
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        stream=True,
    )

    # Stream tokens as they arrive
    async for chunk in stream:
        delta = chunk.choices[0].delta.content  # attribute, not dict
        if delta:
            print(delta, end="", flush=True)
            token_count += 1
            if first_token_time is None:
                first_token_time = time.time()

    end_time = time.time()
    print("\n\n--- Stats ---")
    if first_token_time:
        print(f"Prefill → First Token: {first_token_time - start_time:.3f}s")
    print(f"Total Streaming Time: {end_time - start_time:.3f}s")
    print(f"Tokens Generated: {token_count}")
    if first_token_time:
        tps = token_count / (end_time - first_token_time)
        print(f"Streaming Throughput: {tps:.2f} tokens/sec")


# --- Main ---
if __name__ == "__main__":
    asyncio.run(stream_tokens())
