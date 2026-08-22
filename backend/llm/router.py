import os

import httpx

from . import openai_provider, opencode_chat, opencode_messages, opencode_responses
from .registry import GO_BASE_URL, get_protocol


def parse_model_ref(model):
    """Split a model reference like "opencode-go/kimi-k3" into provider + id.

    A bare id is treated as a direct OpenAI model.
    """
    if "/" not in model:
        return "openai", model
    provider, _, model_id = model.partition("/")
    return provider, model_id


def resolve_adapter(provider, model_id):
    if provider == "opencode-go":
        protocol = get_protocol(model_id)
        if protocol == "responses":
            return opencode_responses
        if protocol == "messages":
            return opencode_messages
        return opencode_chat
    return openai_provider


def generate(*, model, system_prompt, user_content):
    provider, model_id = parse_model_ref(model)
    adapter = resolve_adapter(provider, model_id)
    yield from adapter.stream(
        model=model_id, system_prompt=system_prompt, user_content=user_content
    )


def list_models():
    models = []
    errors = []

    if os.getenv("OPENAI_API_KEY"):
        try:
            ids = openai_provider.list_models()
            models.extend(
                {
                    "id": f"openai/{model_id}",
                    "provider": "openai",
                    "protocol": "chat",
                    "label": model_id,
                }
                for model_id in ids
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"OpenAI models: {exc}")

    if os.getenv("OPENCODE_GO_API_KEY"):
        try:
            response = httpx.get(f"{GO_BASE_URL}/models")
            response.raise_for_status()
            data = response.json()
            for entry in data.get("data", []):
                model_id = entry["id"]
                models.append(
                    {
                        "id": f"opencode-go/{model_id}",
                        "provider": "opencode-go",
                        "protocol": get_protocol(model_id),
                        "label": model_id,
                    }
                )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"OpenCode Go models: {exc}")

    return {"models": models, "errors": errors}
