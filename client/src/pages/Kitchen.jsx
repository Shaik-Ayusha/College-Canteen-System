import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';
import { minutesSince } from '../utils.js';

const NEXT = {
  PLACED: { label: 'Start cooking', status: 'PREPARING' },
  PREPARING: { label: 'Mark ready', status: 'READY' },
};

const COLUMNS = [
  ['PLACED', 'New (waiting)'],
  ['PREPARING', 'Cooking'],
  ['READY', 'Ready for pickup'],
];

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [pickupCodes, setPickupCodes] = useState({});
  const [, setTick] = useState(0); // re-renders every 30 seconds so "min ago" stays current

  const load = useCallback(
    () =>
      api('/orders')
        .then((all) =>
          setOrders(
            all
              .filter((o) => ['PLACED', 'PREPARING', 'READY'].includes(o.status))
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          )
        )
        .catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      load();
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  useLiveUpdates(() => load());

  async function advance(id, status) {
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function verifyPickup(id) {
    try {
      await api(`/orders/${id}/verify-pickup`, {
        method: 'POST',
        body: { otp: pickupCodes[id] || '' },
      });
      setPickupCodes((codes) => ({ ...codes, [id]: '' }));
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      {error && <p className="error">{error}</p>}
      <div className="kitchen-board">
        {COLUMNS.map(([status, title]) => {
          const list = orders.filter((o) => o.status === status);
          return (
            <div key={status} className="kcol">
              <h2>{title}</h2>
              {list.length === 0 && <p className="muted">Nothing here</p>}
              {list.map((o) => {
                const waited = minutesSince(o.created_at);
                const cookingMinutes = o.started_at ? minutesSince(o.started_at) : 0;
                const late = o.status === 'PREPARING' && cookingMinutes > o.prep_minutes;
                return (
                  <div key={o.id} className={`kcard ${status.toLowerCase()} ${late ? 'late' : ''}`}>
                    <div className="row">
                      <span className="ktoken">#{o.token_no}</span>
                      <span className="muted">{late ? 'Late · ' : ''}{waited} min ago</span>
                    </div>
                    <ul>
                      {o.items.map((item, i) => {
                        const toCook = item.quantity - Number(item.prepared_quantity_reserved || 0);
                        return (
                          <li key={i}>
                            {item.item_name} × {item.quantity}
                            {item.prepared_quantity_reserved > 0 &&
                              ` · ${item.prepared_quantity_reserved} already cooked${toCook > 0 ? `, ${toCook} to cook` : ''}`}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="muted">
                      {o.customer_name} · prep about {o.prep_minutes} min
                      {o.status === 'PREPARING' && ` · cooking ${cookingMinutes} min`}
                    </div>
                    {NEXT[status] && (
                      <button
                        className="btn full"
                        onClick={() => advance(o.id, status === 'PLACED' && o.ready_stock_order ? 'READY' : NEXT[status].status)}
                      >
                        {status === 'PLACED' && o.ready_stock_order ? 'Confirm ready for pickup' : NEXT[status].label}
                      </button>
                    )}
                    {status === 'READY' && (
                      <div className="actions">
                        <input
                          aria-label={`Pickup OTP for order ${o.token_no}`}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Student's 6-digit OTP"
                          value={pickupCodes[o.id] || ''}
                          onChange={(event) => setPickupCodes((codes) => ({
                            ...codes,
                            [o.id]: event.target.value.replace(/\D/g, '').slice(0, 6),
                          }))}
                        />
                        <button
                          className="btn full"
                          disabled={(pickupCodes[o.id] || '').length !== 6}
                          onClick={() => verifyPickup(o.id)}
                        >
                          Verify OTP & deliver
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
