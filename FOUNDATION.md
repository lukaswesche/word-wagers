# Game Design Foundation

## 1. Concept

A word-association party game for two competing teams. A shared board of 25 words sits between them. Each team has a Captain. Captains run an **escalating auction** — *"my team can find N words from a single one-word hint"* — until one Captain challenges the other's claim. The challenged Captain must then deliver: pick exactly N words, give one hint, and their team must guess all of them.

Think *Codenames* meets the bidding round of *Contract Bridge*.

---

## 2. Players & Roles

- **Minimum players:** 4 (two teams of two)
- **Scales up:** larger teams supported, no fixed upper limit
- **Per team:**
  - **1 Captain** — sees the board, runs the bidding, will eventually give the hint and pick the target words
  - **1+ Guessers** — see the board, will interpret the hint and identify the words

Captains are assigned before the round begins.

---

## 3. Setup

- A board of **25 words** is generated and shown to everyone simultaneously
- Both teams enter a **silent study period**
  - No talking, gesturing, or signaling — within teams or across teams
  - Each player privately examines the words and considers associations

---

## 4. Game Flow

### Phase 1 — Study
Silent. Everyone reads the 25 words.

### Phase 2 — Bidding Auction *(Captains only)*

1. The opening Captain (A) makes a claim:
   *"With a one-word hint, my team can identify **N** of these words."*
2. The opposing Captain (B) has two options:
   - **Raise** — claim a higher number: *"My team could get N + 1."*
   - **Challenge** — declare: *"You cannot deliver on that hint."*
3. If B raises, A faces the same two options. The auction alternates.
4. Bidding ends the moment one Captain challenges.
5. The Captain whose last bid was challenged becomes **the Performer**, locked in at that bid size N.

### Phase 3 — Selection & Hint *(Performer)*

The Performer:
1. Privately selects exactly **N words** from the board (their target set)
2. Announces a **single-word hint** intended to connect those N words

### Phase 4 — Guessing *(Performer's team)*

The Performer's Guessers must identify all **N target words** from the 25, based only on the hint.

### Phase 5 — Resolution

- **Win:** Guessers identify all N target words correctly → Performer's team wins
- **Lose:** Any incorrect guess → Performer's team loses → Challenging team wins

---

## 5. Core Rules Summary

| Rule | Value |
|---|---|
| Words on board | 25 |
| Hint length | 1 word |
| Bid escalation | strictly increasing |
| Win condition | all N targets identified |
| Lose condition | any wrong guess |
| Communication during study | none |
| Communication during bidding | Captains only |

### Lobby & teams *(settled)*
- Two teams: **Red** and **Blue**. Players **self-assign** in the lobby.
- **Lobby shows no board and no captain assignment.** Just team membership.
- **Start condition:** 4+ players seated with ≥2 per team. Anyone can click Start once the condition is met.
- **At game start, the server does (in this order):**
  1. Generates 25 random words for the board
  2. Randomly picks one player per team as that team's **Captain**
  3. Performs the **coin flip** to pick which Captain opens bidding
- Captain assignment is **fixed for the game** — it does not re-roll if a player disconnects mid-game (we may revisit later).

### Bidding rules *(settled)*
- **Opening bid floor:** the opening Captain must bid **≥ 2**.
- **No passing:** the opening Captain cannot pass — they must bid or the game can't start.
- **Raise increment:** any higher number is valid (e.g. 3 → 6 is allowed, no fixed +1 rule).
- **Challenge:** instead of raising, the other Captain may declare *"you cannot deliver"* — locking the previous bidder in as the **Performer** at their last bid count.

### Guessing rules *(settled)*
- **Guessers** = all players on the Performer's team **except the Performer themselves**.
- **Selection is collaborative.** Any eligible guesser can click/unclick words on the board; the selection is shared and visible to everyone in the room.
- **All-at-once submission.** Guessers pick exactly N words, then any of them clicks Submit. There is no per-word sequential commitment.
- **Resolution:** all N guesses match the Performer's targets → Performer's team wins. Any wrong guess → Performer's team loses (and the challenging team wins).
- **Reveal:** after submission, the board shows the Performer's targets, the team's guesses (correct in green, wrong in red), and any missed targets.

### Play again *(settled)*
- Anyone in the room can click "Play again" from the resolved screen.
- **Teams are preserved.** Captains are re-rolled randomly, a new board is generated, the coin flip happens again.

---

## 6. Open Design Questions

These are gaps in the current spec. Each one needs a decision before the game is fully playable.

### Bidding mechanics
*Opening bid floor (2), raise increment (free), and no-passing rule are settled — see §5.*
- **Self-challenge / fold:** Can a Captain back down from their own bid mid-auction? (Probably no — it would let them dodge by always raising and then folding.)

### Hint validity *(the classic Codenames-style questions)*
- Must the hint be a real word in a specified language?
- Allowed: proper nouns? Numbers? Hyphenated words? Made-up words?
- Can the hint word itself appear on the board?
- Homophones / shared roots with board words — allowed?

### Selection
- Does the Performer pick their N target words **before** or **after** announcing the hint?
  - *Before* = harder, more honest
  - *After* = easier, lets the Captain optimize to the hint
  - *(Current implementation: submitted together in one step — Performer picks N words AND types the hint, then submits both.)*
- Are the target words revealed at the end? **Yes — always revealed on the resolution screen**, regardless of win/lose.

### Guessing
*All-at-once collaborative selection is settled — see §5.*
- Can Guessers talk to each other while guessing? *(Honor system for now — not enforced by software.)*
- Can the Performer react (face, sounds, "hot/cold") during guessing? *(Honor system for now.)*

### Match structure
- One round per game, or best-of-N?
- If multi-round: same Captain each round, or rotate? Same team opens, or alternate?
- Cumulative scoring across rounds, or simple match record?

### Timing
- Length of study phase?
- Per-turn clock during bidding?
- Time limit on Performer's selection?
- Time limit on guessing?

### Edge cases
- What if a Captain immediately challenges the opening bid with no raise?
- What if a Captain proposes an absurd bid (e.g. "all 25")?
- What if the Performer's hint is judged invalid by the other team? Who arbitrates?

---

## 7. Inspirations

- **Codenames** — the 25-word board, the one-word hint, the team-with-captain structure
- **Contract Bridge / Spades** — the bidding auction where the winner has to deliver
- **Wavelength / Just One** — cooperative interpretation of hints under constraint

The novel mechanic here is the **auction-driven role assignment**: in Codenames both teams play in parallel, but here the auction decides which single team carries the round, and how aggressive their challenge will be.

---

## 8. Architecture & Hosting

### Multiplayer model

**Kahoot-style room codes.** One person clicks "Create room" and gets a short code (e.g., `BLUE`, `4729`). They share the code socially — text, voice chat, in person. Other players visit the site, enter the code, and join that room.

The "host" of a room is purely a **social role** — they create the room and invite people. They do **not** host the server. All game state lives on the actual server.

### Where the server runs

| Phase | Host | How players connect |
|---|---|---|
| Development | Node.js on the home Mac | Local network only (`http://<local-ip>:5173`) |
| Early playtesting | Home Mac + Cloudflare Tunnel | Public URL generated by `cloudflared tunnel --url http://localhost:3001` — free, no port forwarding, no static IP |
| Eventual production | Deferred (likely Cloudflare, Fly.io, or similar) | TBD — don't commit until there's a playable game worth shipping |

### Tech stack

**Server (in `server/`):**
- Node.js (LTS, v22+) — runtime
- Express — HTTP server
- Socket.IO — websocket layer with built-in "rooms" primitive that maps directly onto the room-code model
- TypeScript — catches message-shape mismatches at edit time
- `tsx` — runs `.ts` files directly with hot reload in dev

**Client (in `client/`):**
- Vite — dev server + bundler
- React — UI framework
- TypeScript
- `socket.io-client` — matched client library

### Repository layout

```
codename/
├── FOUNDATION.md
├── server/             # Node + Express + Socket.IO
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
└── client/             # Vite + React
    ├── package.json
    ├── vite.config.ts
    └── src/
        └── App.tsx
```

### Why this stack

| Concern | Decision | Reason |
|---|---|---|
| Real-time transport | Socket.IO over WebSockets | Rooms built in; handles reconnection; mature |
| Frontend framework | React | Largest ecosystem; help readily available |
| Bundler / dev server | Vite | Fast, modern, minimal config |
| Language | TypeScript | Catches a class of bugs that JS lets through |
| Hosting (dev) | Home Mac | Free, full control, fine for prototyping |
| Hosting (prod) | Deferred | Decide once there's a real audience |

### Hidden-info safety

A consequence of running everything through a central server: the Performer's target words are stored **only** on the server. Even though one player creates the room, that player gets no special data access — the server is the source of truth, and each client sees only what the server chooses to send them. The room creator cannot peek at the other team's secrets.

---

## 9. What Comes Next

Rules captured. Architecture decided. Implementation in progress along this path:

1. **Done:** Rules captured (§1–§5)
2. **Done:** Architecture decided (§8)
3. **In progress:** Scaffold project, get the room-code lobby working (no game logic yet)
4. Build study → bidding → hint → guess phases on top of the lobby
5. Resolve open design questions (§6) as they come up in implementation, rather than all upfront
6. Playtest with remote friends via Cloudflare Tunnel
7. Decide on a production hosting target once playtesting is going well

---

## 10. Working Name

Directory is `codename` — placeholder. Real name TBD.
