# FlowChat

A non-linear LLM chat canvas: messages are nodes in a flowchart, so you can
branch, merge, rewire, and regenerate conversations instead of being stuck in a
single thread.

- **Backend**: Python / Flask (SSE streaming + model catalog).
- **Frontend**: vanilla JS/HTML/CSS + [jsPlumb Community Edition](https://jsplumbtoolkit.com/) (MIT).

## Features

### Messages & nodes

| Feature | Description | How to use |
| --- | --- | --- |
| Conversation nodes | User inputs and LLM responses are cards on a canvas | Type in the chat bar and click **Send** |
| Streaming responses | Responses render as Markdown with syntax highlighting, streamed live | Send a message; the reply streams into its node |
| Edit node text | Change a user-input message inline | Double-click the body of a user-input node |
| Refresh response | Re-run a single LLM response using its upstream context | Click 🗘 on an LLM node's header (confirms first if it has highlights) |
| Generate response | Create and generate an LLM reply for a user-input that has none | Click 🗘 on a user-input node with no outgoing LLM |
| Model selection | Global default model plus a per-node override | Toolbar dropdown for the default; each node has its own dropdown |

### Node management

| Feature | Description | How to use |
| --- | --- | --- |
| Replicate node | Duplicate a node while keeping its upstream context | Right-click a node → **Replicate Node** |
| Create connected node | Add an empty node wired to the selected node | Right-click a node → **Create Connected Node** |
| Delete a node | Remove a card (and its connections) | Right-click a node → **Delete Node**, or press **Delete**/**Backspace** (Shift-click to multi-select) |

### Connections & branching

| Feature | Description | How to use |
| --- | --- | --- |
| Connect nodes | Wire cards into a conversation graph | Drag from a node's bottom handle to another node's top handle |
| Quote & branch | Select text on a node to branch a new response off that quote | Select text, then click **Send** (optionally type a message first) |
| Highlight tracing | Overlapping quotes merge into one highlight per area | Hover a highlight to trace its branch down the graph |
| Delete a connection | Remove an edge/association between cards | Click the connection line |

### Navigation

| Feature | Description | How to use |
| --- | --- | --- |
| Pan | Move around the canvas | Drag the empty canvas |
| Zoom | Scale the canvas in and out | Scroll |
| Minimap | Overview of the whole flow | Top-right corner of the canvas |
| Inspector panel | Read a node's full content in a side panel | Select a node and click **Inspector**, or double-click a node |
| Fold / expand | Collapse tall nodes to keep the canvas tidy | Click the ▾/▸ toggle in a node header |

### Persistence

| Feature | Description | How to use |
| --- | --- | --- |
| Export | Save the whole flow as JSON | Toolbar **Export** button |
| Import | Load a flow from JSON | Toolbar **Import** button |

## Installation

Prerequisites: **Python 3** and **Node.js** — or [Nix](https://nixos.org/), which
provides both via the flake devShell.

With Nix, no separate install is needed (npm is available inside `nix develop`):

```sh
nix develop -c bash -c 'cd frontend && npm install --omit=dev'
```

Without Nix:

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
(cd frontend && npm install --omit=dev)
```

No server-side configuration is required. API keys are entered in the browser
and kept there — the Flask server is a stateless pass-through that never
persists or logs them.

On first launch you'll be prompted for an API key. FlowChat auto-detects the
provider (OpenCode Go or OpenAI, with more providers pluggable later), and you
can add multiple keys per provider. Manage keys, the base prompt, and
personalities anytime via the ⚙ settings panel in the top-right corner.

Models are namespaced by provider: `openai/<id>` and `opencode-go/<id>`. The
backend routes each OpenCode Go model through the correct protocol
(`chat/completions`, `responses`, or `messages`) automatically.

## Running (local)

### With Nix (recommended)

Enable flakes once (skip if already enabled). On NixOS, add to
`/etc/nixos/configuration.nix`:

```nix
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

then `sudo nixos-rebuild switch`. Without a system change, prefix `nix` commands with
`--extra-experimental-features 'nix-command flakes'`.

Then, from the repo root:

```sh
./run.sh
```

`run.sh` bootstraps the frontend ES-module dependencies on first run (npm lives in
`nix develop`) and serves the UI + API on http://localhost:8000. Override the port with
`PORT=9000 ./run.sh`.

### Without Nix

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
(cd frontend && npm install --omit=dev)
python backend/app.py
```

### Via `nix run`

```sh
nix run .#
```

starts the Flask server. Note: `frontend/node_modules` is gitignored and not vendored
into the store, so the frontend's npm-based modules won't load from the `nix run` store
copy — use `./run.sh` (which runs from the live checkout) for the full UI.

> **Security:** the dev server binds `0.0.0.0` (reachable on your LAN) and is stateless —
> API keys are entered in the browser and never persisted server-side.

## Deployment

Coming soon.

## License notes

FlowChat depends only on permissively-licensed libraries (Flask BSD-3, openai
Apache-2.0, httpx BSD-3, jsPlumb CE MIT, marked MIT, DOMPurify Apache-2.0/MPL,
highlight.js BSD-3).
