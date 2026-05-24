# Project Handoff — codename

> Read this end-to-end and you'll have full context on the project and a working dev environment in ~10 min. For deeper design background, read [FOUNDATION.md](FOUNDATION.md) after.

---

## TL;DR

A multiplayer word-association party game — **Codenames meets contract-bridge bidding**. Web app, Node/Socket.IO server, Vite/React/TypeScript client. **A complete round is playable end-to-end** (lobby → bidding → hint → guessing → resolution → play again). Built for local dev; remote playtesting via Cloudflare Tunnel.

---

## The game in 60 seconds

Two teams of 2+ share a board of 25 words. Captains run an **escalating auction**:

> *Captain A:* "My team can identify **3** of these words from a single one-word hint."
> *Captain B:* "We could get **4**."
> *Captain A:* "We could get **5**."
> *Captain B:* "You can't." → **challenge**

The challenged captain becomes the **Performer**: they secretly pick N words on the board and give a one-word hint. Their team (without the performer) must identify all N targets to win the round.

Full rules and the design log are in [FOUNDATION.md](FOUNDATION.md).

The game is a novel mashup of **Codenames** (25-word board, one-word hints, captains) and **25 Words or Less** (bidding auction, but bids on clue-word count). No published game we could find combines them this way.

---

## Where we are right now

| Area | Status | Notes |
|---|---|---|
| Game rules captured | Done | FOUNDATION.md §1–§5 |
| Architecture decided | Done | FOUNDATION.md §8 |
| Project scaffolded | Done | `server/` + `client/` |
| Hello-world connection | Done | |
| Room-code lobby | Done | Kahoot-style codes, live player list |
| Team assignment + start condition | Done | Self-pick Red/Blue, 4+ players w/ ≥2 per team |
| Static board (25 random words) | Done | Generated at game start |
| Bidding loop | Done | Coin flip → bid (≥2) → raise (any higher) → challenge |
| Performer screen | Done | Secret target selection + one-word hint |
| Guessing | Done | Collaborative shared selection, all-at-once submit |
| Resolution + play again | Done | Winner banner, revealed board, replay same teams |
| **Reconnection** | **Done** | Refresh restores your seat. Disconnected players shown grayed out |
| **Remote playtesting** | **Done** | `npm run playtest` + Cloudflare Tunnel |
| Match structure (best-of-N, scoring) | Later | Currently each round is independent |
| UI polish, mobile, animations | Later | |
| Open design questions | Mostly answered | FOUNDATION.md §6 has the remaining ones |

---

## Stack

| Layer | Choice |
|---|---|
| Server runtime | Node.js v22 LTS (via nvm) |
| Server | Express + Socket.IO |
| Server lang | TypeScript, run with `tsx` |
| Client build | Vite |
| Client UI | React + TypeScript |
| Client→server | `socket.io-client` (same-origin via Vite proxy in dev) |
| Identity | UUID in `localStorage` (survives refresh; lets you reconnect to your seat) |
| Remote playtesting | Cloudflare Tunnel (one URL, no port forwarding) |

---

## Get it running on your machine

macOS steps below. Linux is the same. Windows needs WSL or minor adjustments.

### 1. Install Node 22

```bash
# nvm (if you don't already have a Node version manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Open a fresh terminal, then:
nvm install 22
nvm alias default 22
node --version   # should print v22.x.x
```

Make sure Node is **≥ 22.12** — Vite requires it.

### 2. Get the project files

Ask Lukas to share via Git repo (preferred) or zip. **Never commit `node_modules/`.**

Unzip / clone to `~/Documents/codename` (or anywhere — paths below use that).

### 3. Install dependencies

```bash
cd ~/Documents/codename/server && npm install
cd ../client && npm install
```

### 4. Run it (two terminals)

**Terminal 1 — server:**
```bash
cd ~/Documents/codename/server
npm run dev
# expect: "server listening on http://localhost:3001"
```

**Terminal 2 — client:**
```bash
cd ~/Documents/codename/client
npm run dev
# expect: a URL like "http://localhost:5173"
```

Open the client URL in your browser. The Vite dev server proxies socket.io traffic to the Node server automatically — no CORS config needed, no URL coordination.

### 5. Verify the full round works

Open 4 browser tabs (use incognito for tabs 2–4 so each has its own `localStorage`).

1. Tab 1: name → **Create** → 4-letter code shown
2. Tabs 2–4: name + code → **Join**
3. Each tab clicks **Red** or **Blue** — get 2 per team
4. Any tab clicks **Start game** → board appears, captains chosen at random, coin flip picks opening team
5. Captain bids (≥2) → other captain raises or challenges → loop until challenge
6. Performer clicks N words (others can't see), types one-word hint, submits
7. Two non-captain teammates on the performer's team collaborate — clicks are shared across both tabs — then submit
8. Resolution: winner banner, board reveals correct/wrong/missed
9. **Play again** → back to bidding with new captains, new board, same teams

**Test reconnection:** in the middle of any phase, refresh any tab. Your seat, team, captain status, bidding turn — all restored. The other tabs briefly show you as `(offline)`, then back to normal.

---

## Stable URL via Cloudflare Tunnel (for remote playtesting)

A **named Cloudflare Tunnel** binds a fixed URL (e.g. `codename.yourdomain.com`) to your local server. The URL is stable across reboots and works from anywhere — no port forwarding, no static IP, free.

The actual server still runs on your Mac. The URL only works while your Mac is on AND `./scripts/play.sh` is running.

### One-time setup (~15 minutes)

**1. Buy a domain at Cloudflare Registrar.**
Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up (free) → Registrar → search for a domain. Cloudflare sells at cost (no markup, ~$10/yr for most `.com`s). Domains bought here have DNS preconfigured — skip the "move nameservers" hassle.

If you already own a domain elsewhere: add it to Cloudflare ("Add a site"), update nameservers at your registrar to Cloudflare's, wait for propagation (~minutes).

**2. Install cloudflared.**
```bash
brew install cloudflared
```

**3. Log in.** Opens a browser. Authorize the domain you bought/added.
```bash
cloudflared tunnel login
```

**4. Create the named tunnel.** Outputs a UUID and writes credentials to `~/.cloudflared/<UUID>.json`.
```bash
cloudflared tunnel create codename
```

**5. Route DNS to the tunnel.** Replace with your actual hostname.
```bash
cloudflared tunnel route dns codename codename.yourdomain.com
```

This creates a CNAME in Cloudflare DNS that points your subdomain at the tunnel. Verify in the Cloudflare dashboard → DNS → Records.

**6. Write the tunnel config.** Tells cloudflared where to forward traffic.
```bash
# Find the UUID from the create step (or run: cloudflared tunnel list)
UUID=<paste-tunnel-uuid-here>

cat > ~/.cloudflared/config.yml <<EOF
tunnel: codename
credentials-file: $HOME/.cloudflared/$UUID.json
ingress:
  - service: http://localhost:3001
EOF
```

Setup complete. From here on, `./scripts/play.sh` does everything.

### Going live (every session)

```bash
cd ~/Documents/codename
./scripts/play.sh
```

The script:
1. Installs deps if missing
2. Builds the client
3. Starts the server in playtest mode (serves the built client + handles socket.io)
4. Waits for the server to be ready
5. Starts the named tunnel — your URL is now live
6. Ctrl-C cleanly stops both

Share `https://codename.yourdomain.com` with your friends.

### Running on a different Mac

The tunnel credentials live in `~/.cloudflared/`. To run from a different machine:

**Option A (recommended):** copy `~/.cloudflared/cert.pem`, `~/.cloudflared/config.yml`, and the `~/.cloudflared/<UUID>.json` to the new machine, then run `./scripts/play.sh` there.

**Option B:** repeat steps 2–6 above on the new machine, using a *different* tunnel name (e.g. `codename-laptop`). Run with `CODENAME_TUNNEL=codename-laptop ./scripts/play.sh`. Caveat: a hostname can only be routed to one tunnel at a time, so you'd re-route DNS each time you switch machines.

For most cases, copy the credentials (Option A) and just run on whichever Mac is convenient.

### When you change code

In playtest mode there's no HMR — the script always rebuilds the client before starting. For active dev, use the regular `npm run dev` setup (two terminals); switch to `./scripts/play.sh` only when you want to test live with remote friends.

---

## Project layout

```
codename/
├── FOUNDATION.md          # Game rules + architecture decisions (deep context)
├── HANDOFF.md             # This file
├── server/
│   ├── package.json       # scripts: dev, start, playtest
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts       # Express + Socket.IO + all event handlers
│       ├── rooms.ts       # RoomManager: identity, phases, transitions
│       ├── words.ts       # Wordlist + pickRandomWords()
│       └── types.ts       # Shared types
└── client/
    ├── package.json
    ├── vite.config.ts     # /socket.io proxy → localhost:3001
    └── src/
        ├── App.tsx        # Top-level: connection, emits hello, routes Home/GameRoom
        ├── GameRoom.tsx   # Phase router: lobby → bidding → performing → guessing → resolved
        ├── Home.tsx       # Create/Join screen
        ├── Lobby.tsx      # Team selector + Start button (no board, no captains)
        ├── Bidding.tsx    # Captain cards, bid history, bid/challenge controls
        ├── Performing.tsx # Performer picks N words + types hint + submits
        ├── Guessing.tsx   # Collaborative selection, shared across teammates
        ├── Resolved.tsx   # Winner banner, revealed board, play again
        ├── Board.tsx      # 5×5 grid; modes: read-only / selectable / reveal
        ├── RoomHeader.tsx # Room code display + copy button
        ├── socket.ts      # Same-origin socket.io client
        ├── playerId.ts    # UUID in localStorage
        ├── types.ts       # Shared types
        ├── index.css      # Minimal reset
        └── App.css        # Empty (component styles are inline)
```

---

## Socket protocol

All client→server events use an ack callback `(response: AckResponse) => void`. All server→client broadcasts use `room-state` with the full `RoomState`.

### Client → Server

| Event | Payload | When |
|---|---|---|
| `hello` | `{ playerId }` | Sent on every socket connect (incl. reconnects). Server identifies the player and restores their room if they had one. |
| `create-room` | `{ name }` | Home screen |
| `join-room` | `{ code, name }` | Home screen |
| `set-team` | `{ team: 'red' \| 'blue' \| null }` | Lobby |
| `start-game` | `{}` | Lobby |
| `place-bid` | `{ count }` | Bidding (captain whose turn it is) |
| `challenge` | `{}` | Bidding (captain whose turn it is) |
| `submit-targets-and-hint` | `{ targets: string[]; hint: string }` | Performing (performer only) |
| `toggle-guess` | `{ word }` | Guessing (eligible guessers only) |
| `submit-guesses` | `{}` | Guessing (eligible guessers only) |
| `play-again` | `{}` | Resolved |

### Server → Client

| Event | Payload | When |
|---|---|---|
| `room-state` | `RoomState` (full snapshot) | After any state change; sent to all sockets in the room |

`RoomState` shape lives in `types.ts` on both sides. Key fields: `phase`, `players` (each with `id`, `name`, `team`, `connected`), `captains`, `bidding`, `performing`, `guessing`, `resolution`, `words`.

**Hidden info:** the Performer's secret target words live only on the server until resolution. They're never in the broadcast `RoomState` until the round resolves.

---

## Identity model (how reconnection works)

The server uses two layers of identity:

- **`playerId`** — stable UUID generated client-side, stored in `localStorage`. This is *you*. Survives refreshes, browser closes, etc.
- **`socketId`** — the current websocket connection. Ephemeral; changes on every connect.

Server maintains `socketToPlayer: Map<socketId, playerId>` and `playerToRoom: Map<playerId, code>`. Each player record in a room tracks its current `socketId` (null when disconnected).

**Flow:**
1. Client connects, sends `hello { playerId }`
2. Server: `socketToPlayer.set(socketId, playerId)`. If `playerId` is in a room, update that player's `socketId` and broadcast room-state to the room.
3. All subsequent events: server looks up `playerId` from `socketId`, then does business logic by `playerId`.
4. On disconnect: clear `socketToPlayer`, set the player's `socketId` to null, broadcast (others see `(offline)`).

Players are **never auto-removed**. A disconnected captain stays the captain — their team is stuck until they reconnect. (We can add idle-timeout cleanup later if needed.)

---

## Key decisions and why

### Central server, not P2P
Hidden info (the performer's target words) needs a neutral host. P2P with a player-as-host means the host could peek.

### "Host" is a social role
Room creator is just whoever clicks Create first. They get a code and share it socially. The server is yours.

### `localStorage` UUID for identity
No sign-up flow. No accounts. Just a random UUID that survives refreshes. Trust model: anyone with access to your browser is "you" — fine for a casual party game.

### Same origin
Vite proxies `/socket.io` in dev; the Node server serves the built client in playtest mode. Either way, browser sees client and socket.io as same origin. No CORS, no URL coordination.

### Random captain at game start
Originally was "first to join each team." Changed to random at start time so the lobby doesn't have a rush-to-join-first dynamic. Aligns with the coin-flip mechanic for opening team.

### All-at-once collaborative guessing
Guessers (everyone on performer's team except the performer) share a selection state. Any of them can click/unclick. Any can submit. Simpler than sequential one-at-a-time, and since "any wrong = lose" makes order irrelevant.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EBADENGINE` warnings on `npm install` | Node < 22.12. `nvm use 22` |
| Vite: "Cannot find native binding" / `@rolldown/binding-darwin-arm64` | Stale install. In `client/`: `rm -rf node_modules package-lock.json && npm install` |
| `EADDRINUSE` on 3001 or 5173 | Something else is on that port. `lsof -i :3001`, then kill |
| Client header says "Reconnecting…" forever | Server isn't running, or browser can't reach it. Check `npm run dev` in `server/` is live |
| Browser shows blank page in playtest mode | Did you `npm run build` in `client/` first? The server reads from `client/dist` |
| Cloudflare Tunnel URL gives "service unavailable" | The tunnel forwards to `localhost:3001`. Make sure the server is running with `npm run playtest` |
| Reconnection makes me a different player | You cleared `localStorage`, or you're in a different browser. Each browser has its own `playerId`. |
| TypeScript errors | `npx tsc --noEmit` in `server/`, `npx tsc -b --noEmit` in `client/` |

---

## How to share files with this doc

**Git + GitHub (recommended once you have two contributors):**
```bash
cd ~/Documents/codename
git init
git add .
git commit -m "WIP: full round playable + reconnection + playtest mode"
# Create a private repo on github.com, then:
git remote add origin <repo-url>
git push -u origin main
```

Server has a `.gitignore`. Client's Vite template included one. Verify both exclude `node_modules/`.

**Zip (quick & dirty):**
```bash
cd ~/Documents
zip -r codename.zip codename -x "*/node_modules/*" "*/dist/*" "*/.DS_Store"
```
