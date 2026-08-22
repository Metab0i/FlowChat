import json
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory

from llm import generate, list_models
from llm.sse import format_chunk, format_done, format_error

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
SYSTEM_PROMPT_PATH = BASE_DIR / "system_prompt.md"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


def load_system_prompt():
    if SYSTEM_PROMPT_PATH.exists():
        return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    return ""


SYSTEM_PROMPT = load_system_prompt()

TITLE_SYSTEM_PROMPT = (
    "You are a title generator. Given a message, write a very concise title "
    "(at most 5 words) that summarizes it. Reply with only the title, with no "
    "quotes, no trailing punctuation, and no extra text."
)


@app.route("/")
def index():
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/generate", methods=["POST"])
def generate_route():
    data = request.get_json(force=True)
    model = data.get("model")
    conversation = data.get("conversation")
    user_content = json.dumps({"conversation": conversation})

    def stream():
        try:
            for content in generate(
                model=model, system_prompt=SYSTEM_PROMPT, user_content=user_content
            ):
                yield format_chunk(content)
            yield format_done()
        except Exception as exc:  # noqa: BLE001
            yield format_error(str(exc))

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.route("/models", methods=["GET"])
def models_route():
    return jsonify(list_models())


@app.route("/title", methods=["POST"])
def title_route():
    data = request.get_json(force=True)
    model = data.get("model")
    content = data.get("content", "")
    user_content = json.dumps({"content": content})

    try:
        parts = []
        for chunk in generate(
            model=model, system_prompt=TITLE_SYSTEM_PROMPT, user_content=user_content
        ):
            parts.append(chunk)
        title = "".join(parts).strip()
        title = title.replace('"', "").strip()
        return jsonify({"title": title})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"title": "", "error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, threaded=True)
