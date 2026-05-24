import { useEffect, useState } from 'react';

/**
 * Subscribe to a server-issued deadline (Unix ms) and re-render every ~100ms
 * with the seconds remaining until it expires.
 *
 * Returns null when no deadline is set, otherwise an integer in [0, ∞).
 */
export function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
