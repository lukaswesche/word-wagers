import { useEffect, useState } from 'react';

/**
 * Re-render this component on a regular interval. Returns the current
 * Date.now() value, which can be used to compute elapsed time, remaining
 * time, etc. against server-provided timestamps.
 *
 * Use intervalMs=100 for smooth countdowns, larger for less work.
 */
export function useTick(intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
