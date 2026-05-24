import { useState } from 'react';
import { socket } from './socket';
import type { AckResponse } from './types';

function Home() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createRoom = () => {
    if (!name.trim()) {
      setError('Enter a name first');
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit(
      'create-room',
      { name: name.trim() },
      (response: AckResponse<{ code: string }>) => {
        setBusy(false);
        if (!response.ok) setError(response.error);
      },
    );
  };

  const joinRoom = () => {
    if (!name.trim()) {
      setError('Enter a name first');
      return;
    }
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setBusy(true);
    setError(null);
    socket.emit(
      'join-room',
      { name: name.trim(), code: joinCode.trim() },
      (response: AckResponse) => {
        setBusy(false);
        if (!response.ok) setError(response.error);
      },
    );
  };

  return (
    <section>
      <label style={{ display: 'block', marginBottom: '1.5rem' }}>
        <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alice"
          maxLength={20}
          style={inputStyle}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Create a room</h2>
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: 0 }}>
            You'll get a code to share with friends.
          </p>
          <button onClick={createRoom} disabled={busy} style={buttonStyle}>
            Create
          </button>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Join a room</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={6}
            style={{ ...inputStyle, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          />
          <button onClick={joinRoom} disabled={busy} style={buttonStyle}>
            Join
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: '#aa0000', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  padding: '0.5rem 0.75rem',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '1rem',
  border: '1px solid #ccc',
  borderRadius: '0.25rem',
};

const cardStyle: React.CSSProperties = {
  padding: '1rem',
  border: '1px solid #ccc',
  borderRadius: '0.5rem',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '1rem',
  border: '1px solid #333',
  borderRadius: '0.25rem',
  background: '#333',
  color: '#fff',
  cursor: 'pointer',
};

export default Home;
