type Props = {
  code: string;
};

function RoomHeader({ code }: Props) {
  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {});
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '2px solid #333',
        borderRadius: '0.5rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>Room code</p>
      <h2
        style={{
          margin: '0.25rem 0',
          fontSize: '3rem',
          letterSpacing: '0.25em',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {code}
      </h2>
      <button
        onClick={copyCode}
        style={{
          padding: '0.25rem 0.75rem',
          fontSize: '0.875rem',
          border: '1px solid #ccc',
          background: '#fff',
          borderRadius: '0.25rem',
          cursor: 'pointer',
        }}
      >
        Copy code
      </button>
    </div>
  );
}

export default RoomHeader;
