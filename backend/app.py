import json
import os
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

from llm import detect_key, generate
from llm.sse import format_chunk, format_done, format_error

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
SYSTEM_PROMPT_PATH = BASE_DIR / "system_prompt.md"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")

TITLE_SYSTEM_PROMPT = (
    "You are a title generator. Given a message, write a very concise title "
    "(at most 5 words) that summarizes it. Reply with only the title, with no "
    "quotes, no trailing punctuation, and no extra text."
)


def _require_api_key(data):
    api_key = (data or {}).get("api_key")
    if not api_key:
        raise RuntimeError("missing api_key")
    return api_key


@app.route("/")
def index():
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/defaults/system-prompt", methods=["GET"])
def default_system_prompt_route():
    if SYSTEM_PROMPT_PATH.exists():
        return Response(
            SYSTEM_PROMPT_PATH.read_text(encoding="utf-8"),
            mimetype="text/markdown",
        )
    return "", 404


@app.route("/detect", methods=["POST"])
def detect_route():
    data = request.get_json(force=True)
    api_key = (data or {}).get("api_key")
    if not api_key:
        return jsonify({"provider": None, "error": "missing api_key"}), 400
    return jsonify(detect_key(api_key))


@app.route("/generate", methods=["POST"])
def generate_route():
    data = request.get_json(force=True)
    model = (data or {}).get("model")
    api_key = (data or {}).get("api_key")
    system_prompt = (data or {}).get("system_prompt", "")
    conversation = (data or {}).get("conversation")
    user_content = json.dumps({"conversation": conversation})

    if not api_key:
        return jsonify({"error": "missing api_key"}), 400

    def stream():
        try:
            for content in generate(
                model=model,
                api_key=api_key,
                system_prompt=system_prompt,
                user_content=user_content,
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


@app.route("/title", methods=["POST"])
def title_route():
    data = request.get_json(force=True)
    model = (data or {}).get("model")
    api_key = (data or {}).get("api_key")
    content = (data or {}).get("content", "")
    user_content = json.dumps({"content": content})

    if not api_key:
        return jsonify({"title": "", "error": "missing api_key"}), 400

    try:
        parts = []
        for chunk in generate(
            model=model,
            api_key=api_key,
            system_prompt=TITLE_SYSTEM_PROMPT,
            user_content=user_content,
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
