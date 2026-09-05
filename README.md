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

Prerequisites: **Python 3** and **Node.js**.

> Prefer the [one-command launcher](#running-local) below — it creates the venv,
> installs backend deps, and bootstraps the frontend automatically on first run.
> The steps here are only what you'd do by hand.

There are two install modes:

- **Runtime only** (what `run.sh` uses): `npm install --omit=dev`. This deliberately
  skips dev-only packages such as **Puppeteer** and its ~300 MB Chromium download.
- **Development / testing**: a full `npm install` (no `--omit=dev`). This installs
  Puppeteer (a devDependency) and everything needed to run the test suite.

### Standard setup (Python + Node)

```sh
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
(cd frontend && npm install)            # dev/test install (Puppeteer downloads Chrome)
# or, for runtime only:
(cd frontend && npm install --omit=dev)
```

On standard Linux/macOS, Puppeteer's `npm install` downloads a Chromium that runs out of the box.

### Optional: Nix / NixOS

FlowChat also ships a [flake](https://nixos.wiki/wiki/Flakes). On NixOS (or if you prefer Nix),
no separate Python/Node install is needed — both come from the devShell:

```sh
nix develop -c bash -c 'cd frontend && npm install'   # dev/test install (incl. Puppeteer)
# or, for runtime only:
nix develop -c bash -c 'cd frontend && npm install --omit=dev'
```

Inside `nix develop` the devShell sets `PUPPETEER_EXECUTABLE_PATH` to Nix's Chromium and
`PUPPETEER_SKIP_DOWNLOAD=1`, so Puppeteer runs against the Nix-provided browser instead of
downloading a Debian-built Chrome (which won't run on NixOS). On macOS the devShell keeps the
auto-download fallback.

### Runtime dependencies

- **Python**: `flask`, `flask-cors`, `openai`, `httpx` (see `backend/requirements.txt`).
- **Frontend runtime**: jsPlumb, marked, DOMPurify, highlight.js (`frontend/package.json`
  `dependencies`).
- **Frontend dev**: Puppeteer (`frontend/package.json` `devDependencies`) — only needed to run
  the test suite.

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

### One command (recommended)

From the repo root, run the launcher. It auto-creates the venv, installs backend
deps, bootstraps the frontend's runtime modules on first run, and serves the UI +
API on http://localhost:8000.

- **Linux / macOS:** `./run.sh`
- **Windows:** `.\run.ps1` (if PowerShell blocks it, use
  `powershell -ExecutionPolicy Bypass -File run.ps1`)

`run.sh` detects whether you're on NixOS and, if so, runs inside `nix develop`;
on any other OS it uses a plain Python venv + npm. Override the port with
`PORT=9000 ./run.sh` (Linux/macOS) or `$env:PORT=9000; .\run.ps1` (Windows).

### Manual run (no launcher)

```sh
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
(cd frontend && npm install --omit=dev)
python backend/app.py
```

### Optional: run with Nix

**On NixOS** the launcher handles this for you automatically. To run manually,
first enable flakes (skip if already enabled) — on NixOS add to
`/etc/nixos/configuration.nix`:

```nix
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

then `sudo nixos-rebuild switch`. Without a system change, prefix `nix` commands with
`--extra-experimental-features 'nix-command flakes'`.

Then, from the repo root:

```sh
nix develop -c bash -c 'cd frontend && npm install --omit=dev && cd .. && python3 backend/app.py'
```

or via the flake app:

```sh
nix run .#
```

Note: `nix run .#` starts only the Flask server; `frontend/node_modules` is gitignored
and not vendored into the store, so the frontend's npm-based modules won't load from the
`nix run` store copy — use `./run.sh` (which runs from the live checkout) for the full UI.

> **Security:** the dev server binds `0.0.0.0` (reachable on your LAN) and is stateless —
> API keys are entered in the browser and never persisted server-side.

## Testing

The frontend has an end-to-end suite driven by **Puppeteer** (a `devDependency`), using Node's
built-in test runner. The tests spawn the real Flask backend on a free port and drive the real UI
in headless Chromium; the LLM endpoints (`/detect`, `/generate`, `/title`) are mocked in the
browser, so no API key or network access to a provider is needed.

**Standard setup:**

```sh
source .venv/bin/activate                # Windows: .venv\Scripts\activate
(cd frontend && npm install)             # installs Puppeteer; downloads Chrome on first run
(cd frontend && npm test)
```

**With Nix:**

```sh
nix develop -c bash -c 'cd frontend && npm install && npm test'
```

Inside the devShell, Puppeteer uses Nix's Chromium (no separate Chrome download).

Notes:

- Tests run from `frontend/` via `npm test` (which runs `node --test "tests/*.test.js"`).
- A small, production-safe test hook is exposed only when the page is loaded with `?test=1`;
  the normal app URL is unaffected.
- These are in-browser Puppeteer tests — the backend's LLM-proxy routes are mocked, so backend
  API coverage is out of scope here. The real Flask server is only exercised for static serving
  and `/defaults/*`.

## Deployment

Coming soon.

## License notes

FlowChat depends only on permissively-licensed libraries (Flask BSD-3, openai
Apache-2.0, httpx BSD-3, jsPlumb CE MIT, marked MIT, DOMPurify Apache-2.0/MPL,
highlight.js BSD-3).
