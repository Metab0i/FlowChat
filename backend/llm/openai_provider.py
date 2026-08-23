from openai import OpenAI


def _client(api_key):
    return OpenAI(api_key=api_key)


def detect(api_key):
    list_models(api_key)
    return True


def list_models(api_key):
    response = _client(api_key).models.list()
    return [m.id for m in response.data]


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
