import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomManager } from './rooms.js';
import { registerMiniGame } from './minigame.js';
import type {
  AckResponse,
  ChallengePayload,
  CreateRoomPayload,
  HelloPayload,
  JoinRoomPayload,
  PlaceBidPayload,
  LeaveRoomPayload,
  PlayAgainPayload,
  SendTauntPayload,
  SetTeamNamePayload,
  SetTeamPayload,
  StartGamePayload,
  SubmitGuessesPayload,
  SubmitTargetsAndHintPayload,
  ToggleGuessPayload,
} from './types.js';

const PORT = Number(process.env.PORT ?? 3001);
const DEV_CLIENT_ORIGIN = 'http://localhost:5173';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

// Serve the built client whenever a build exists. SERVE_CLIENT=true forces it
// on; SERVE_CLIENT=false forces it off (handy while iterating on the dev
// placeholder); unset auto-detects.
const hasClientBuild = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
const SERVE_CLIENT =
  process.env.SERVE_CLIENT === 'true' ||
  (process.env.SERVE_CLIENT !== 'false' && hasClientBuild);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  // When the server also serves the client, socket.io requests are same-origin
  // and no CORS config is needed. Otherwise (dev with separate Vite), Vite
  // proxies /socket.io to us so they're also same-origin from the browser's
  // perspective. Allow the Vite origin as a safety net for direct dev use.
  cors: SERVE_CLIENT ? undefined : { origin: DEV_CLIENT_ORIGIN },
});

// When a server-side timer fires (e.g., turn timeout), RoomManager invokes
// this callback so the new state gets broadcast even though no client event
// triggered the change.
const rooms = new RoomManager((room) => {
  io.to(room.code).emit('room-state', rooms.toRoomState(room));
  console.log(`timeout in room ${room.code}: ${room.resolution?.reason}`);
});

registerMiniGame(io);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

function requireIdentified(socketId: string): string | null {
  return rooms.getPlayerIdBySocket(socketId);
}

io.on('connection', (socket) => {
  console.log(`socket connected: ${socket.id}`);

  socket.on(
    'hello',
    (payload: HelloPayload, ack?: (response: AckResponse<{ inRoom: boolean }>) => void) => {
      const playerId = payload?.playerId?.trim();
      if (!playerId) {
        ack?.({ ok: false, error: 'playerId is required' });
        return;
      }
      const room = rooms.identify(playerId, socket.id);
      if (room) {
        socket.join(room.code);
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
        console.log(`re-identified ${playerId} into room ${room.code}`);
      } else {
        console.log(`identified ${playerId} (no active room)`);
      }
      ack?.({ ok: true, inRoom: room !== null });
    },
  );

  socket.on(
    'create-room',
    (
      payload: CreateRoomPayload,
      ack: (response: AckResponse<{ code: string }>) => void,
    ) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified — refresh the page' });

      const name = payload?.name?.trim();
      if (!name) return ack({ ok: false, error: 'Name is required' });

      try {
        const room = rooms.createRoom(name, playerId, socket.id);
        socket.join(room.code);
        ack({ ok: true, code: room.code });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
        console.log(`room created: ${room.code} by ${name}`);
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'join-room',
    (payload: JoinRoomPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified — refresh the page' });

      const name = payload?.name?.trim();
      const code = payload?.code?.trim().toUpperCase();
      if (!name) return ack({ ok: false, error: 'Name is required' });
      if (!code) return ack({ ok: false, error: 'Code is required' });

      try {
        const room = rooms.joinRoom(code, name, playerId, socket.id);
        if (!room) return ack({ ok: false, error: 'Room not found' });
        socket.join(room.code);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
        console.log(`${name} joined room ${room.code}`);
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'set-team',
    (payload: SetTeamPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const team = payload?.team ?? null;
        if (team !== null && team !== 'red' && team !== 'blue') {
          return ack({ ok: false, error: 'Invalid team' });
        }
        const room = rooms.setPlayerTeam(playerId, team);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'start-game',
    (_payload: StartGamePayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const room = rooms.startGame(playerId);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
        console.log(
          `game started in room ${room.code} (opens: ${room.bidding?.openingTeam})`,
        );
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'place-bid',
    (payload: PlaceBidPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const count = Number(payload?.count);
        if (!Number.isFinite(count)) {
          return ack({ ok: false, error: 'Bid must be a number' });
        }
        const room = rooms.placeBid(playerId, count);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'challenge',
    (_payload: ChallengePayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const room = rooms.challenge(playerId);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'submit-targets-and-hint',
    (
      payload: SubmitTargetsAndHintPayload,
      ack: (response: AckResponse) => void,
    ) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const targets = Array.isArray(payload?.targets) ? payload.targets : [];
        const hint = typeof payload?.hint === 'string' ? payload.hint : '';
        const room = rooms.submitTargetsAndHint(playerId, targets, hint);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'toggle-guess',
    (payload: ToggleGuessPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const word = typeof payload?.word === 'string' ? payload.word : '';
        if (!word) return ack({ ok: false, error: 'Word is required' });
        const room = rooms.toggleGuess(playerId, word);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'submit-guesses',
    (_payload: SubmitGuessesPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const room = rooms.submitGuesses(playerId);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'play-again',
    (_payload: PlayAgainPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const room = rooms.playAgain(playerId);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'set-team-name',
    (payload: SetTeamNamePayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const team = payload?.team;
        const name = payload?.name;
        if (team !== 'red' && team !== 'blue') return ack({ ok: false, error: 'Invalid team' });
        const room = rooms.setTeamName(playerId, team, name);
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'send-taunt',
    (payload: SendTauntPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      try {
        const room = rooms.sendTaunt(playerId, payload?.message ?? '');
        ack({ ok: true });
        io.to(room.code).emit('room-state', rooms.toRoomState(room));
        console.log(`taunt sent in room ${room.code} by ${playerId}`);
      } catch (e) {
        ack({ ok: false, error: errorMessage(e) });
      }
    },
  );

  socket.on(
    'leave-room',
    (_payload: LeaveRoomPayload, ack: (response: AckResponse) => void) => {
      const playerId = requireIdentified(socket.id);
      if (!playerId) return ack({ ok: false, error: 'Not identified' });
      const code = rooms.getRoomByPlayerId(playerId)?.code;
      if (code) socket.leave(code);
      const room = rooms.leaveRoom(playerId);
      ack({ ok: true });
      if (room) io.to(room.code).emit('room-state', rooms.toRoomState(room));
      console.log(`${playerId} left room ${code ?? '?'}`);
    },
  );

  socket.on('disconnect', (reason) => {
    const room = rooms.handleSocketDisconnect(socket.id);
    if (room) {
      io.to(room.code).emit('room-state', rooms.toRoomState(room));
    }
    console.log(`socket disconnected: ${socket.id} (${reason})`);
  });
});

if (SERVE_CLIENT) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log(`serving client from ${CLIENT_DIST}`);
} else {
  app.get('/', (_req, res) => {
    res.send(
      'codename server is running (dev mode — client at http://localhost:5173). ' +
        'No build found at client/dist — run `npm --prefix client run build` to serve from this port.',
    );
  });
}

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
