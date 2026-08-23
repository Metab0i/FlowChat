from . import providers
from .registry import GO_BASE_URL, get_protocol  # noqa: F401


def parse_model_ref(model):
    """Split a model reference like "opencode-go/kimi-k3" into provider + id.

    A bare id is treated as a direct OpenAI model.
    """
    if "/" not in model:
        return "openai", model
    provider, _, model_id = model.partition("/")
    return provider, model_id


def generate(*, model, api_key, system_prompt, user_content):
    provider_id, model_id = parse_model_ref(model)
    provider = providers.get_provider(provider_id)
    yield from provider["stream"](
        api_key=api_key,
        model=model_id,
        system_prompt=system_prompt,
        user_content=user_content,
    )


def detect_key(api_key):
    return providers.detect_key(api_key)
