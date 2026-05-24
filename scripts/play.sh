#!/usr/bin/env bash
# One-command launch: build client, start the codename server in playtest mode,
# bring up the Cloudflare Tunnel. The tunnel forwards your stable URL
# (e.g. codename.yourdomain.com) to localhost:3001.
#
# First-time setup required. See HANDOFF.md "Stable URL via Cloudflare Tunnel".
#
# Usage:
#   ./scripts/play.sh
#
# Override the tunnel name if you used a different one during setup:
#   CODENAME_TUNNEL=mytunnel ./scripts/play.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TUNNEL_NAME="${CODENAME_TUNNEL:-codename}"
PORT=3001

red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }

# ─── pre-flight ───

if ! command -v node >/dev/null 2>&1; then
  red "Node.js not installed. Install Node 22+ first (see HANDOFF.md)."
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  red "cloudflared not installed."
  red "Install with: brew install cloudflared"
  exit 1
fi

if ! cloudflared tunnel list 2>/dev/null | awk 'NR>1{print $2}' | grep -qx "$TUNNEL_NAME"; then
  red "Cloudflare Tunnel '$TUNNEL_NAME' not found on this machine."
  red "First-time setup required. See HANDOFF.md \"Stable URL via Cloudflare Tunnel\"."
  red "(If your tunnel has a different name, set CODENAME_TUNNEL=<name>.)"
  exit 1
fi

# ─── install + build ───

if [ ! -d "$ROOT/server/node_modules" ]; then
  blue "Installing server deps..."
  (cd "$ROOT/server" && npm install)
fi

if [ ! -d "$ROOT/client/node_modules" ]; then
  blue "Installing client deps..."
  (cd "$ROOT/client" && npm install)
fi

blue "Building client..."
(cd "$ROOT/client" && npm run build)

# ─── start server in background ───

blue "Starting game server (playtest mode)..."
(cd "$ROOT/server" && npm run playtest) &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    blue "Shutting down server (pid $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

blue "Waiting for server on localhost:$PORT..."
for i in $(seq 1 60); do
  if curl -sf "http://localhost:$PORT" >/dev/null 2>&1; then
    green "Server ready."
    break
  fi
  sleep 0.5
  if [ "$i" -eq 60 ]; then
    red "Server failed to start within 30 seconds."
    exit 1
  fi
done

# ─── tunnel in foreground (Ctrl-C kills both via trap) ───

green ""
green "================================================================"
green "  Starting Cloudflare Tunnel: $TUNNEL_NAME"
green "  Your configured hostname is now live."
green "  Share that URL with friends. Press Ctrl-C to stop everything."
green "================================================================"
green ""
cloudflared tunnel run "$TUNNEL_NAME"
