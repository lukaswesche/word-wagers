import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import { getOrCreatePlayerId } from './playerId';
import Home from './Home';
import GameRoom from './GameRoom';
import type { RoomState } from './types';
import './App.css';

type Mode = 'dark' | 'light';
type A11y = 'standard' | 'high-contrast' | 'reduced-motion' | 'dyslexia';

function App() {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [mode, setMode] = useState<Mode>('dark');
  const [a11y, setA11y] = useState<A11y>('high-contrast');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playerIdRef = useRef<string>(getOrCreatePlayerId());

  useEffect(() => {
    const playerId = playerIdRef.current;
    const onConnect = () => {
      setConnected(true);
      socket.emit('hello', { playerId });
    };
    const onDisconnect = () => setConnected(false);
    const onRoomState = (state: RoomState) => setRoom(state);

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

  const leaveRoom = () => {
    socket.emit('leave-room', {}, () => setRoom(null));
  };

  const myId = playerIdRef.current;
  const a11yClass = a11y !== 'standard' ? ` a11y-${a11y === 'high-contrast' ? 'high-contrast' : a11y === 'reduced-motion' ? 'reduced-motion' : 'dyslexia'}` : '';
  const wrapperClass = `app-game theme-${mode}${a11yClass}`;

  return (
    <div className={wrapperClass}>
      {/* Corner controls */}
      <div className="corner-controls">
        {room && (
          <button
            type="button"
            className="corner-btn corner-btn-leave"
            onClick={leaveRoom}
            title="Leave room"
          >
            ← Leave
          </button>
        )}
        <button
          type="button"
          className="corner-btn"
          onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          type="button"
          className="corner-btn"
          onClick={() => setSettingsOpen(o => !o)}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {settingsOpen && (
        <div className="settings-popover">
          <div className="settings-popover-header">
            <span>Settings</span>
            <button className="settings-close" onClick={() => setSettingsOpen(false)}>✕</button>
          </div>
          <div className="settings-row">
            <label htmlFor="a11y-select">Accessibility</label>
            <select
              id="a11y-select"
              value={a11y}
              onChange={e => setA11y(e.target.value as A11y)}
            >
              <option value="standard">Standard</option>
              <option value="high-contrast">High contrast</option>
              <option value="reduced-motion">Reduce motion</option>
              <option value="dyslexia">Dyslexia-friendly</option>
            </select>
          </div>
          <div className="settings-row">
            <label>Connection</label>
            <span style={{ fontSize: '0.8rem', color: connected ? 'var(--correct)' : 'var(--red)' }}>
              {connected ? '● Online' : '● Offline'}
            </span>
          </div>
        </div>
      )}

      <main className={room ? 'game-main' : 'home-wrapper'}>
        {room ? <GameRoom room={room} myId={myId} /> : <Home />}
      </main>
    </div>
  );
}

export default App;
