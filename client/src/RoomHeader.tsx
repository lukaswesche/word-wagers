type Props = { code: string };

function RoomHeader({ code }: Props) {
  const copy = () => navigator.clipboard.writeText(code).catch(() => {});

  return (
    <div className="room-code-card">
      <p className="room-code-label">Room code</p>
      <h2 className="room-code-value">{code}</h2>
      <button className="room-code-copy" onClick={copy}>
        Copy
      </button>
    </div>
  );
}

export default RoomHeader;
