import { useEffect, useState } from 'react';

/**
 * Current time in ms, refreshed every `intervalMs`. Use this instead of calling
 * Date.now() during render, so "x minutes ago" labels keep ticking and renders
 * stay pure.
 */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

export default useNow;
