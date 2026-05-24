import { io, type Socket } from 'socket.io-client';

// No explicit URL: connects to the same origin the page was served from.
// In dev, Vite's proxy forwards /socket.io to the Node server (see vite.config.ts).
// In playtest mode, the Node server serves both the client and socket.io directly.
export const socket: Socket = io({
  autoConnect: false,
});
