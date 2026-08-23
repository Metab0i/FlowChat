from openai import OpenAI

from .registry import GO_BASE_URL


def _client(api_key):
    return OpenAI(api_key=api_key, base_url=GO_BASE_URL)


def stream(*, api_key, model, system_prompt, user_content):
    stream = _client(api_key).responses.create(
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
