# FlowChat

A non-linear LLM chat canvas: messages are nodes in a flowchart, so you can
branch, merge, rewire, and regenerate conversations instead of being stuck in a
single thread.

- **Backend**: Python / Flask (SSE streaming + model catalog).
- **Frontend**: vanilla JS/HTML/CSS + [jsPlumb Community Edition](https://jsplumbtoolkit.com/) (MIT).

## Features

- User-input and LLM-response nodes on a zoomable, pannable canvas with a minimap.
- Drag from a node's bottom handle to another node's top handle to connect them.
- Streaming responses with Markdown + syntax highlighting.
- Replicate a node (keeps its upstream context), create a connected node, delete nodes/edges.
- Regenerate an LLM response from its owning user-input node (cascade down the branch).
- Global default model + per-node model selection (persisted in `localStorage`).
- Export / import the whole flow as JSON.

## Providers

Set keys in `backend/.env` (see `backend/.env.example`):

```
OPENAI_API_KEY=          # direct OpenAI models (e.g. gpt-4o)
OPENCODE_GO_API_KEY=     # OpenCode Go subscription models
```

Models are namespaced by provider: `openai/<id>` and `opencode-go/<id>`. The
backend routes each OpenCode Go model through the correct protocol
(`chat/completions`, `responses`, or `messages`) automatically.

## Running (with Nix flakes)

```sh
nix develop          # provides Python (Flask, openai, httpx, dotenv) + Node.js
(cd frontend && npm install)   # downloads jsPlumb CE, marked, dompurify, highlight.js
python backend/app.py          # serves the UI + API on http://localhost:8000
```

Without Nix, install the Python deps from `backend/requirements.txt` and run
`python backend/app.py`; the frontend only needs `npm install` to fetch its
ES-module dependencies (served statically by Flask — no build step).

## Project layout

```
flake.nix            dev shell (Python + Node)
backend/
  app.py             Flask app: serves frontend + /models + /generate (SSE)
  system_prompt.md   branched-conversation system prompt
  llm/               model registry + per-protocol streaming adapters
frontend/
  index.html         import map -> node_modules ES modules
  styles.css
  src/               vanilla JS modules (jsPlumb, markdown, pan/zoom, ...)
```

## License notes

FlowChat depends only on permissively-licensed libraries (Flask BSD-3, openai
Apache-2.0, httpx BSD-3, jsPlumb CE MIT, marked MIT, DOMPurify Apache-2.0/MPL,
highlight.js BSD-3). It is an independent implementation, not a fork.
