#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# One-command launcher for FlowChat.
#
# With Nix: runs inside `nix develop` (Flask deps + nodejs), bootstrapping the
# frontend ES-module dependencies on first run.
#
# Without Nix: prefers an existing `.venv`; otherwise errors with setup guidance
# (see README for the venv setup).

if ! command -v nix >/dev/null 2>&1; then
  if [ -x ".venv/bin/python3" ]; then
    exec .venv/bin/python3 backend/app.py
  fi
  echo "error: nix not found and no .venv present." >&2
  echo "       Set up Python deps (see README 'Without Nix') or install Nix." >&2
  exit 1
fi

NIX_DEV=(nix --extra-experimental-features 'nix-command flakes' develop --command)

# Bootstrap frontend ES-module deps on first run (npm lives in the devShell).
# --omit=dev skips puppeteer's Chromium download (hundreds of MB, unused at runtime).
if [ ! -d frontend/node_modules ]; then
  "${NIX_DEV[@]}" bash -c 'cd frontend && npm install --omit=dev'
fi

exec "${NIX_DEV[@]}" python3 backend/app.py
