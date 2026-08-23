from openai import OpenAI

from .registry import GO_BASE_URL


def _client(api_key):
    return OpenAI(api_key=api_key, base_url=GO_BASE_URL)


def stream(*, api_key, model, system_prompt, user_content):
    stream = _client(api_key).chat.completions.create(
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
