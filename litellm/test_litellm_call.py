import sys

from openai import OpenAI


BASE_URL = "http://localhost:4000"
API_KEY = "sk-1234"
MODEL = "gpt-5.4-mini"


def main() -> int:
    client = OpenAI(
        base_url=f"{BASE_URL}/v1",
        api_key=API_KEY,
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": "Reply with a short sentence confirming the model name you used.",
                }
            ],
        )
    except Exception as error:
        print(f"Request failed: {error}", file=sys.stderr)
        return 1

    message = response.choices[0].message.content
    print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())