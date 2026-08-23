import json

import httpx

from .registry import GO_BASE_URL

MAX_TOKENS = 10000


def stream(*, api_key, model, system_prompt, user_content):
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    body = {
        "model": model,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_content}],
        "max_tokens": MAX_TOKENS,
        "stream": True,
    }

    with httpx.Client(timeout=None) as client:
        with client.stream(
            "POST", f"{GO_BASE_URL}/messages", headers=headers, json=body
        ) as response:
            if response.status_code != 200:
                raise RuntimeError(
                    f"OpenCode Go messages error {response.status_code}: "
                    f"{response.read().decode('utf-8', 'replace')}"
                )

            for line in response.iter_lines():
                if not line or not line.startswith("data:"):
                    continue
                payload = line[len("data:"):].strip()
                if not payload:
                    continue
                try:
                    parsed = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                if (
                    parsed.get("type") == "content_block_delta"
                    and parsed.get("delta", {}).get("type") == "text_delta"
                    and parsed["delta"].get("text")
                ):
                    yield parsed["delta"]["text"]
