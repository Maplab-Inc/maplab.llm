import time
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="https://maplab--maplab-vllm-serve.modal.run/v1/",
)

MODEL = "llama-70B"
TEST_PROMPT = "Write me a story with exactly 500 words"

async def benchmark_streaming():
    print("\n--- Streaming Mode Benchmark ---\n")

    start_time = time.time()
    first_token_time = None
    token_count = 0

    stream = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": TEST_PROMPT}],
        max_tokens=1000,
        temperature=0.0,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            token_count += 1
            if first_token_time is None:
                first_token_time = time.time()

    end_time = time.time()

    print(f"Prefill → First Token: {first_token_time - start_time:.3f}s")
    print(f"Total Response Time: {end_time - start_time:.3f}s")
    print(f"Tokens Generated: {token_count}")
    if first_token_time:
        tps = token_count / (end_time - first_token_time)
        print(f"Streaming Throughput: {tps:.2f} tokens/sec")


async def benchmark_non_streaming():
    print("\n--- Non-Streaming Mode Benchmark ---\n")

    start_time = time.time()
    completion = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": TEST_PROMPT}],
        max_tokens=1000,
        temperature=0.0,
        stream=False,
    )
    end_time = time.time()

    total_latency = end_time - start_time
    output = completion.choices[0].message.content

    print(f"Total Latency: {total_latency:.3f}s")
    print(f"Output: {output!r}")
    print(f"Tokens Returned: {len(output.split())}")


async def main():
    await benchmark_streaming()
    await benchmark_non_streaming()

if __name__ == "__main__":
    asyncio.run(main())
