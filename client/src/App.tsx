import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import { getOrCreatePlayerId } from './playerId';
import Home from './Home';
import GameRoom from './GameRoom';
import type { RoomState } from './types';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const playerIdRef = useRef<string>(getOrCreatePlayerId());

  useEffect(() => {
    const playerId = playerIdRef.current;

    const onConnect = () => {
      setConnected(true);
      socket.emit('hello', { playerId });
    };
    const onDisconnect = () => {
      setConnected(false);
    };
    const onRoomState = (state: RoomState) => {
      setRoom(state);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', onRoomState);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-state', onRoomState);
      socket.disconnect();
    };
  }, []);

  const myId = playerIdRef.current;

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        maxWidth: '40rem',
        margin: '0 auto',
      }}
    >
      <header
        style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <h1 style={{ margin: 0 }}>codename</h1>
        <span
          style={{
            fontSize: '0.875rem',
            color: connected ? '#0a8a3a' : '#aa0000',
          }}
        >
          {connected ? 'Connected' : 'Reconnecting…'}
        </span>
      </header>

      {room ? <GameRoom room={room} myId={myId} /> : <Home />}
    </main>
  );
}

export default App;
