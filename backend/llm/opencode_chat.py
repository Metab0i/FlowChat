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
    stream = get_client().chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        stream=True,
    )
    for chunk in stream:
        choices = getattr(chunk, "choices", None)
        if not choices:
            continue
        delta = getattr(choices[0], "delta", None)
        content = getattr(delta, "content", None) if delta else None
        if content:
            yield content
