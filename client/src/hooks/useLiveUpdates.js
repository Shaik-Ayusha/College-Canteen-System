import { useEffect, useRef } from 'react';
import { getToken } from '../api.js';

// Calls onOrder whenever the server pushes an order change (Server-Sent Events)
export function useLiveUpdates(onOrder) {
  const latest = useRef(onOrder);
  latest.current = onOrder;

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;
    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    source.addEventListener('order', (event) => latest.current(JSON.parse(event.data)));
    return () => source.close();
  }, []);
}
