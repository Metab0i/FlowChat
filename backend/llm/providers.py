import httpx

from . import openai_provider, opencode_chat, opencode_messages, opencode_responses
from .registry import GO_BASE_URL, get_protocol

DETECT_MODEL = "deepseek-v4-pro"


def _opencode_detect(api_key):
    body = {
        "model": DETECT_MODEL,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
        "stream": False,
    }
    response = httpx.post(
        f"{GO_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=30,
    )
    if response.status_code in (401, 403):
        raise RuntimeError("invalid key")
    if response.status_code >= 400:
        raise RuntimeError(f"OpenCode Go error {response.status_code}")
    return True


def _opencode_list_models(api_key):
    response = httpx.get(f"{GO_BASE_URL}/models", timeout=30)
    response.raise_for_status()
    data = response.json()
    return [entry["id"] for entry in data.get("data", [])]


def _opencode_stream(api_key, model, system_prompt, user_content):
    protocol = get_protocol(model)
    if protocol == "responses":
        adapter = opencode_responses
    elif protocol == "messages":
        adapter = opencode_messages
    else:
        adapter = opencode_chat
    yield from adapter.stream(
        api_key=api_key,
        model=model,
        system_prompt=system_prompt,
        user_content=user_content,
    )


PROVIDERS = [
    {
        "id": "opencode-go",
        "name": "OpenCode Go",
        "detect": _opencode_detect,
        "list_models": _opencode_list_models,
        "stream": _opencode_stream,
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "detect": openai_provider.detect,
        "list_models": openai_provider.list_models,
        "stream": openai_provider.stream,
    },
]


def get_provider(provider_id):
    for provider in PROVIDERS:
        if provider["id"] == provider_id:
            return provider
    raise RuntimeError(f"Unknown provider: {provider_id}")


def detect_key(api_key):
    """Identify which provider accepts the given key and list its models."""
    errors = []
    for provider in PROVIDERS:
        try:
            provider["detect"](api_key)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{provider['name']}: {exc}")
            continue

        try:
            models = provider["list_models"](api_key)
        except Exception as exc:  # noqa: BLE001
            models = []
            errors.append(f"{provider['name']} models: {exc}")

        return {"provider": provider["id"], "models": models, "errors": errors}

    return {"provider": None, "error": "; ".join(errors) or "unrecognized key"}
