import os

from openai import OpenAI

from .registry import GO_BASE_URL

_client = None


def get_client():
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.environ["OPENCODE_GO_API_KEY"],
            base_url=GO_BASE_URL,
        )
    return _client


def stream(*, model, system_prompt, user_content):
    stream = get_client().responses.create(
        model=model,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        stream=True,
    )
    for event in stream:
        if getattr(event, "type", None) == "response.output_text.delta":
            delta = getattr(event, "delta", None)
            if delta:
                yield delta
