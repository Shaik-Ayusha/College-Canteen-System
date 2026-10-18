import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import OrderCard from '../components/OrderCard.jsx';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api('/orders/mine').then(setOrders).catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000); // keeps wait estimates current
    return () => clearInterval(timer);
  }, [load]);

  useLiveUpdates(() => load());

  return (
    <section>
      <h2>My orders</h2>
      {error && <p className="error">{error}</p>}
      {orders.length === 0 && <p className="muted">You have not placed any orders yet.</p>}
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </section>
  );
}
