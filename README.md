# FlowChat

A non-linear LLM chat canvas: messages are nodes in a flowchart, so you can
branch, merge, rewire, and regenerate conversations instead of being stuck in a
single thread.

- **Backend**: Python / Flask (SSE streaming + model catalog).
- **Frontend**: vanilla JS/HTML/CSS + [jsPlumb Community Edition](https://jsplumbtoolkit.com/) (MIT).

## Features

| Feature | Description | How to use |
| --- | --- | --- |
| Conversation nodes | User inputs and LLM responses are cards on a canvas | Type in the chat bar and click **Send** |
| Connect nodes | Wire cards into a conversation graph | Drag from a node's bottom handle to another node's top handle |
| Streaming responses | Responses render as Markdown with syntax highlighting, streamed live | Send a message; the reply streams into its node |
| Quote & branch | Select text on a node to branch a new response off that quote | Select text on a node, then click **Send** (optionally type a message first) |
| Highlight tracing | Overlapping quotes merge into one highlight per area | Hover a highlight to trace its branch down the graph |
| Regenerate (cascade) | Re-run an LLM response and everything downstream | Click the 🗘 button on a user-input node |
| Replicate node | Duplicate a node while keeping its upstream context | Right-click a node → **Replicate Node** |
| Create connected node | Add an empty node wired to the selected node | Right-click a node → **Create Connected Node** |
| Delete node / edge | Remove cards or connections | Right-click a node → **Delete Node**, or click a connection line to delete it |
| Fold / expand | Collapse tall nodes to keep the canvas tidy | Click the ▾/▸ toggle in a node header |
| Model selection | Global default model plus a per-node override | Toolbar dropdown for the default; each node has its own dropdown |
| Inspector panel | Read a node's full content in a side panel | Select a node, then click **Inspector** in the toolbar |
| Pan / zoom + minimap | Navigate large flows | Drag the empty canvas to pan, scroll to zoom; minimap in the top-right |
| Export / import | Persist the whole flow as JSON | Toolbar **Export** / **Import** buttons |

## Installation

Prerequisites: **Python 3** and **Node.js** (or [Nix](https://nixos.org/)).

```sh
# backend dependencies
nix develop                          # or: pip install -r backend/requirements.txt

# frontend ES-module dependencies (no build step)
(cd frontend && npm install)
```

Set your API keys in `backend/.env` (copy `backend/.env.example` first):

```
OPENAI_API_KEY=          # direct OpenAI models (e.g. gpt-4o)
OPENCODE_GO_API_KEY=     # OpenCode Go subscription models
```

Models are namespaced by provider: `openai/<id>` and `opencode-go/<id>`. The
backend routes each OpenCode Go model through the correct protocol
(`chat/completions`, `responses`, or `messages`) automatically.

## Running (local)

```sh
nix develop              # provides Python (Flask, openai, httpx, dotenv) + Node.js
(cd frontend && npm install)   # downloads jsPlumb CE, marked, dompurify, highlight.js
python backend/app.py          # serves the UI + API on http://localhost:8000
```

Without Nix, install the Python deps from `backend/requirements.txt` and run
`python backend/app.py`; the frontend only needs `npm install` to fetch its
ES-module dependencies (served statically by Flask — no build step).

## Deployment

Coming soon.

## License notes

FlowChat depends only on permissively-licensed libraries (Flask BSD-3, openai
Apache-2.0, httpx BSD-3, jsPlumb CE MIT, marked MIT, DOMPurify Apache-2.0/MPL,
highlight.js BSD-3).
