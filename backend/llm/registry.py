GO_BASE_URL = "https://opencode.ai/zen/go/v1"

# Models served through the OpenAI Responses API (/v1/responses).
RESPONSES_MODELS = {
    "grok-4.5",
    "gpt-5.6-luna",
    "muse-spark-1.2-contributor",
}

# Models served through the Anthropic-style Messages API (/v1/messages).
MESSAGES_MODELS = {
    "minimax-m3",
    "minimax-m2.7",
    "minimax-m2.5",
    "qwen3.8-max",
    "qwen3.7-max",
    "qwen3.7-plus",
    "qwen3.6-plus",
    "qwen3.5-plus",
}


def get_protocol(model_id):
    """Return the protocol a given OpenCode Go model is served through."""
    if model_id in RESPONSES_MODELS:
        return "responses"
    if model_id in MESSAGES_MODELS:
        return "messages"
    return "chat"
