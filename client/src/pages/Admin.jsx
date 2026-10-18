import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';
import OrderCard from '../components/OrderCard.jsx';
import { NEXT_STATUSES, STATUS_LABEL, money } from '../utils.js';

const ACTION_LABEL = {
  PREPARING: 'Start cooking',
  READY: 'Mark ready',
  COLLECTED: 'Mark delivered',
  CANCELLED: 'Cancel',
};
const FILTERS = ['ALL', 'PLACED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED'];
const EMPTY_ITEM = {
  item_id: null, name: '', category: 'General', price: '',
  prep_minutes: 5, stock_quantity: 50, prepared_quantity: 0, description: '', is_available: 1,
};

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [form, setForm] = useState(EMPTY_ITEM);
  const [cookQuantities, setCookQuantities] = useState({});
  const [pickupCodes, setPickupCodes] = useState({});
  const [error, setError] = useState('');

  const loadStats = useCallback(() => api('/admin/stats').then(setStats).catch((e) => setError(e.message)), []);
  const loadMenu = useCallback(() => api('/menu').then(setMenu).catch((e) => setError(e.message)), []);
  const loadOrders = useCallback(
    () => api(filter === 'ALL' ? '/orders' : `/orders?status=${filter}`).then(setOrders).catch((e) => setError(e.message)),
    [filter]
  );
  const refreshOrders = useCallback(() => {
    loadStats();
    loadOrders();
  }, [loadStats, loadOrders]);

  useEffect(() => { loadMenu(); }, [loadMenu]);
  useEffect(() => { refreshOrders(); }, [refreshOrders]);
  useLiveUpdates(() => refreshOrders());

  async function setStatus(id, status) {
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      refreshOrders();
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
      refreshOrders();
    } catch (e) {
      setError(e.message);
    }
  }

  function editItem(m) {
    setForm({
      item_id: m.id, name: m.name, category: m.category, price: m.price,
      prep_minutes: m.prep_minutes, stock_quantity: m.stock_quantity,
      description: m.description || '', is_available: m.is_available,
    });
  }

  async function toggleItem(m) {
    try {
      await api(`/menu/${m.id}`, { method: 'PUT', body: { ...m, is_available: m.is_available ? 0 : 1 } });
      loadMenu();
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveItem(e) {
    e.preventDefault();
    const body = {
      name: form.name, category: form.category, price: form.price,
      prep_minutes: form.prep_minutes, stock_quantity: form.stock_quantity,
      description: form.description, is_available: form.is_available,
    };
    try {
      if (form.item_id) await api(`/menu/${form.item_id}`, { method: 'PUT', body });
      else await api('/menu', { method: 'POST', body });
      setForm(EMPTY_ITEM);
      setError('');
      loadMenu();
    } catch (err) {
      setError(err.message);
    }
  }

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function addCookedServings(item) {
    const quantity = Number(cookQuantities[item.id]);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Enter a positive whole number of cooked servings.');
      return;
    }
    try {
      await api(`/menu/${item.id}/prepared`, { method: 'POST', body: { quantity } });
      setCookQuantities((quantities) => ({ ...quantities, [item.id]: '' }));
      setError('');
      loadMenu();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      {error && <p className="error">{error}</p>}

      <p className="muted">Finalize food details by 11:00 a.m. The canteen serves from 12:00 noon to 2:00 p.m. Staff can update cooked servings, stock, and availability during service.</p>

      {stats && (
        <div className="stats">
          <div className="card stat"><span>Orders today</span><strong>{stats.totalOrders}</strong></div>
          <div className="card stat"><span>Active orders</span><strong>{stats.active}</strong></div>
          <div className="card stat"><span>Revenue today</span><strong>{money(stats.revenue)}</strong></div>
          <div className="card stat">
            <span>Top items today</span>
            {stats.topItems.length
              ? <ol>{stats.topItems.map((t) => <li key={t.item_name}>{t.item_name}: {t.qty}</li>)}</ol>
              : <p className="muted">No sales yet</p>}
          </div>
        </div>
      )}

      <div className="stats">
        <div className="card stat">
          <span>Cooked today</span>
          <strong>{menu.reduce((total, item) => total + Number(item.cooked_today_quantity || 0), 0)} servings</strong>
        </div>
        <div className="card stat">
          <span>Ready for students</span>
          <strong>{menu.reduce((total, item) => total + Number(item.prepared_quantity || 0), 0)} servings</strong>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>Orders</h2>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'ALL' ? 'All' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          {orders.length === 0 && <p className="muted">No orders.</p>}
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} showCustomer>
              {o.status === 'READY' ? (
                <>
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
                    className="btn small"
                    disabled={(pickupCodes[o.id] || '').length !== 6}
                    onClick={() => verifyPickup(o.id)}
                  >
                    Verify OTP & deliver
                  </button>
                </>
              ) : (o.status === 'PLACED' && o.ready_stock_order
                ? ['READY', 'CANCELLED']
                : NEXT_STATUSES[o.status] || []
              ).map((s) => (
                <button key={s} className={`btn small ${s === 'CANCELLED' ? 'danger' : ''}`} onClick={() => setStatus(o.id, s)}>
                  {s === 'READY' && o.ready_stock_order ? 'Confirm ready for pickup' : ACTION_LABEL[s]}
                </button>
              ))}
            </OrderCard>
          ))}
        </div>

        <div className="card">
          <h2>Menu items</h2>
          <form className="menu-form" onSubmit={saveItem}>
            <input placeholder="Item name" value={form.name} onChange={setField('name')} required />
            <input placeholder="Category" value={form.category} onChange={setField('category')} required />
            <input type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={setField('price')} required />
            <input type="number" min="0" placeholder="Prep minutes" value={form.prep_minutes} onChange={setField('prep_minutes')} />
            <input type="number" min="0" placeholder="Stock" value={form.stock_quantity} onChange={setField('stock_quantity')} />
            <input placeholder="Description" value={form.description} onChange={setField('description')} />
            <button className="btn" type="submit">{form.item_id ? 'Update item' : 'Add item'}</button>
            {form.item_id && (
              <button className="btn ghost" type="button" onClick={() => setForm(EMPTY_ITEM)}>Cancel edit</button>
            )}
          </form>

          {menu.map((m) => (
            <div key={m.id} className={`item-row ${m.is_available ? '' : 'off'}`}>
              <div className="row">
                <span>
                  <strong>{m.name}</strong>{' '}
                  <span className="muted">
                    {m.category} · {money(m.price)} · {m.prep_minutes} min · {m.stock_quantity} in stock ·
                    {' '}                    cooked today {m.cooked_today_quantity} ·
                    {' '}{m.prepared_quantity} ready to order
                  </span>
                </span>
                <span className="actions">
                  <input
                    type="number"
                    min="1"
                    max={Math.max(0, Number(m.stock_quantity) - Number(m.prepared_quantity))}
                    aria-label={`Newly cooked servings for ${m.name}`}
                    placeholder="Cooked qty"
                    value={cookQuantities[m.id] || ''}
                    onChange={(event) => setCookQuantities((quantities) => ({
                      ...quantities,
                      [m.id]: event.target.value,
                    }))}
                  />
                  <button
                    className="btn small"
                    disabled={!m.is_available || Number(m.stock_quantity) <= Number(m.prepared_quantity)}
                    onClick={() => addCookedServings(m)}
                  >
                    Add cooked
                  </button>
                  <button className="btn small ghost" onClick={() => editItem(m)}>Edit</button>
                  <button className={`btn small ${m.is_available ? 'danger' : ''}`} onClick={() => toggleItem(m)}>
                    {m.is_available ? 'Disable' : 'Enable'}
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
