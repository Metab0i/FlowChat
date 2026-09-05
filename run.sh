#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# One-command launcher for FlowChat (Linux/macOS).  Windows users: use run.ps1.
#
# On NixOS we run inside `nix develop` (Flask deps + nodejs), since that is the
# natural environment there.  On any other OS we use a plain Python venv + npm,
# creating and bootstrapping everything automatically on first run.

NIX_DEV=(nix --extra-experimental-features 'nix-command flakes' develop --command)

# --- NixOS: use the flake devShell -----------------------------------------
if [ -f /etc/NIXOS ] || command -v nixos-version >/dev/null 2>&1; then
  # Bootstrap frontend ES-module deps on first run (npm lives in the devShell).
  # --omit=dev skips puppeteer + its Chromium download (hundreds of MB, unused at
  # runtime).  For development/testing use a full `npm install` instead — see README
  # "Testing" — which installs Puppeteer (devDependency).
  if [ ! -d frontend/node_modules ]; then
    "${NIX_DEV[@]}" bash -c 'cd frontend && npm install --omit=dev'
  fi
  exec "${NIX_DEV[@]}" python3 backend/app.py
fi

# --- Non-NixOS: standard Python venv + npm ---------------------------------

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 not found." >&2
  echo "       Install Python 3 (https://www.python.org/downloads/) then re-run ./run.sh." >&2
  exit 1
fi

# Ensure a working venv (create it if missing, recreate if stale/broken).
ensure_venv() {
  if [ ! -x .venv/bin/python3 ]; then
    python3 -m venv .venv || {
      echo "error: failed to create .venv." >&2
      echo "       On Debian/Ubuntu you may need: sudo apt install python3-venv python3-pip" >&2
      echo "       (or the equivalent ensurepip package on your distro)." >&2
      exit 1
    }
  fi
  # Recreate a stale/broken venv (e.g. interpreter upgraded since creation).
  if ! .venv/bin/python3 -c 'pass' >/dev/null 2>&1; then
    echo "note: .venv appears broken, recreating it." >&2
    rm -rf .venv
    python3 -m venv .venv || {
      echo "error: failed to recreate .venv." >&2
      exit 1
    }
  fi
}
ensure_venv

# Install/refresh backend deps (idempotent).
.venv/bin/pip install -q -r backend/requirements.txt

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm not found." >&2
  echo "       Install Node.js + npm (https://nodejs.org/) then re-run ./run.sh." >&2
  exit 1
fi

# Bootstrap frontend runtime deps on first run (--omit=dev skips puppeteer).
if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install --omit=dev)
fi

exec .venv/bin/python3 backend/app.py
