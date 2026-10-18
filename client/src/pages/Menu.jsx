import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { money } from '../utils.js';

function getFoodImage(item) {
  const text = `${item.name} ${item.category}`.toLowerCase();
  if (/tea|chai/.test(text)) return 'photo-1576092768241-dec231879fc3';
  if (/coffee|beverage|drink/.test(text)) return 'photo-1461023058943-07fcbe16d735';
  if (/dessert|brownie|cake|sweet|ice cream/.test(text)) return 'photo-1606313564200-e75d5e30476c';
  if (/samosa/.test(text)) return 'photo-1601050690597-df0568f70950';
  if (/sandwich/.test(text)) return 'photo-1525351484163-7529414344d8';
  if (/burger|fries/.test(text)) return 'photo-1568901346375-23c9450c58cd';
  if (/dosa/.test(text)) return 'photo-1668236543090-82eba5ee5976';
  if (/biryani|rice/.test(text)) return 'photo-1589302168068-964664d93dc0';
  if (/thali|meal|lunch|dinner/.test(text)) return 'photo-1504674900247-0877df9cc836';
  return 'photo-1512621776951-a57141f2eefd';
}

const fallbackFoodImage = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=85';

export default function Menu() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState({}); // { [menuItemId]: quantity }
  const [estimate, setEstimate] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [payment, setPayment] = useState('CASH');
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0); // changes every 30 seconds to refresh the estimate

  useEffect(() => {
    const refreshCanteen = () => {
      api('/menu').then(setMenu).catch((e) => setMessage(e.message));
      api('/orders/schedule').then(setSchedule).catch((e) => setMessage(e.message));
    };
    refreshCanteen();
    const timer = setInterval(refreshCanteen, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const items = Object.entries(cart).map(([id, quantity]) => ({ menu_item_id: Number(id), quantity }));
  const itemsKey = JSON.stringify(items);

  // Ask the server for the wait estimate whenever the cart changes (or every 30 seconds)
  useEffect(() => {
    if (!items.length) {
      setEstimate(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api('/orders/estimate', { method: 'POST', body: { items } })
        .then((r) => setEstimate(r.estimated_minutes))
        .catch((e) => {
          setEstimate(null);
          setMessage(e.message);
        });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, tick]);

  const change = (id, delta) =>
    setCart((c) => {
      const next = { ...c };
      const qty = (c[id] || 0) + delta;
      const menuItem = menu.find((item) => item.id === Number(id));
      if (delta > 0 && menuItem && qty > availableQuantity(menuItem)) return c;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const lines = Object.entries(cart).map(([id, qty]) => {
    const m = menu.find((x) => x.id === Number(id));
    return {
      id: Number(id),
      name: m ? m.name : 'Item',
      qty,
      sub: m ? Number(m.price) * qty : 0,
      stockQuantity: m ? availableQuantity(m) : 0,
      preparedQuantity: m ? Number(m.prepared_quantity) : 0,
      prepMinutes: m ? Number(m.prep_minutes) : 0,
    };
  });
  const total = lines.reduce((sum, l) => sum + l.sub, 0);
  const categories = ['All', ...new Set(menu.map((m) => m.category))];
  const visible = menu.filter((m) =>
    m.is_available &&
    (category === 'All' || m.category === category)
  );
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  function availableQuantity(item) {
    return schedule?.service_ordering && !schedule.fresh_ordering_open
      ? Number(item?.prepared_quantity) || 0
      : Number(item?.stock_quantity) || 0;
  }

  async function placeOrder() {
    if (!schedule?.ordering_open) return setMessage('Ordering is closed. Preorders close at 12:00 p.m.; prepared food orders close at 2:00 p.m.');
    if (!items.length) return setMessage('Add some items first');
    try {
      await api('/orders', { method: 'POST', body: { items, payment_method: payment } });
      setCart({});
      navigate('/orders');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="layout menu-layout">
      <section className="menu-content">
        <header className="menu-hero">
          <div className="menu-hero-copy">
            <div className="menu-hero-topline">
              <span className="menu-eyebrow">THE CAMPUS LUNCH CLUB</span>
              <span className="menu-count"><span className="menu-count-dot" />{cartCount ? `${cartCount} in your order` : `${visible.length} dishes today`}</span>
            </div>
            <h1>Lunch that fits<br /><em>your day.</em></h1>
            <p>
              {schedule?.service_ordering
                ? 'Pick from what’s already cooked, or order something fresh while the kitchen is open.'
                : 'Choose your favourites now. The kitchen will prepare your preorder for lunch.'}
            </p>
            <div className="menu-hero-foot">
              <span className="hero-clock-mark" aria-hidden="true">◷</span>
              <span><small>CANTEEN LUNCH HOURS</small><strong>{schedule ? `${formatTime(schedule.service_start)} – ${formatTime(schedule.service_end)}` : '12:00 noon – 2:00 p.m.'}</strong><em>Preorder before {schedule ? formatTime(schedule.ordering_cutoff) : '12:00 noon'}</em></span>
            </div>
          </div>
          <div className="menu-hero-photo">
            <img
              src="https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1100&q=85"
              alt="A freshly plated biryani lunch"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = fallbackFoodImage;
              }}
            />
            <div className="hero-photo-shade" />
            <div className="hero-photo-label"><span>MADE FRESH</span><strong>for your midday pause</strong></div>
            <div className="hero-photo-stamp"><span>GOOD FOOD</span><strong>GOOD<br />MOOD</strong></div>
          </div>
        </header>
        {schedule && (
          <div className="service-strip" aria-label="Canteen ordering schedule">
            <div><span className="service-step">01</span><span><small>PREORDER</small><strong>Before {formatTime(schedule.ordering_cutoff)}</strong></span></div>
            <div><span className="service-step">02</span><span><small>LUNCH SERVICE</small><strong>{formatTime(schedule.service_start)} – {formatTime(schedule.service_end)}</strong></span></div>
            <div><span className="service-step">03</span><span><small>MADE TO ORDER</small><strong>Until {formatTime(schedule.fresh_ordering_end)}</strong></span></div>
          </div>
        )}
        <div className="menu-section-heading">
          <div>
            <span className="menu-eyebrow">A LITTLE SOMETHING FOR EVERYONE</span>
            <h2>Today’s menu</h2>
          </div>
          <span className="menu-result-count">{visible.length} {visible.length === 1 ? 'dish' : 'dishes'}</span>
        </div>
        <div className="chips">
          {categories.map((c) => (
            <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid menu-grid">
          {visible.map((m) => (
            <article className="card item menu-item" key={m.id}>
              <div className="food-art">
                <img
                  src={`https://images.unsplash.com/${getFoodImage(m)}?auto=format&fit=crop&w=900&q=85`}
                  alt={`${m.name}, freshly prepared food`}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = fallbackFoodImage;
                  }}
                />
                <span className="food-category">{m.category}</span>
              </div>
              <div className="menu-item-content">
                <div className="menu-item-title">
                  <h3>{m.name}</h3>
                  <span className={`stock-badge ${(schedule?.service_ordering ? Number(m.prepared_quantity) : Number(m.stock_quantity)) > 0 ? 'in-stock' : 'sold-out'}`}>
                    {schedule?.service_ordering
                      ? (Number(m.prepared_quantity) > 0
                        ? `${m.prepared_quantity} cooked`
                        : schedule.fresh_ordering_open && Number(m.stock_quantity) > 0
                          ? 'Made to order'
                          : 'Not cooked yet')
                      : (Number(m.stock_quantity) > 0
                        ? (Number(m.prepared_quantity) > 0 ? `${m.prepared_quantity} cooked` : 'Available')
                        : 'Sold out')}
                  </span>
                </div>
                <p className="menu-description">{m.description || 'A freshly prepared canteen favourite.'}</p>
                <div className="menu-item-meta">
                  <span>◷ {m.prep_minutes} min</span>
                  {(schedule?.service_ordering ? Number(m.prepared_quantity) : Number(m.stock_quantity)) > 0 &&
                    <span>{schedule?.service_ordering
                      ? `${m.prepared_quantity} cooked${schedule.fresh_ordering_open && Number(m.stock_quantity) > Number(m.prepared_quantity) ? ` · more can be cooked (${m.prep_minutes} min)` : ''}`
                      : `${m.stock_quantity} left today${Number(m.prepared_quantity) > 0 ? ` · ${m.prepared_quantity} already cooked` : ''}`}</span>}
                </div>
                <div className="menu-item-footer">
                  <strong className="menu-price">{money(m.price)}</strong>
                  {cart[m.id] ? (
                    <div className="menu-quantity" aria-label={`${m.name} quantity`}>
                      <button className="qty" aria-label={`Remove one ${m.name}`} onClick={() => change(m.id, -1)}>−</button>
                      <strong>{cart[m.id]}</strong>
                      <button className="qty" aria-label={`Add one ${m.name}`} disabled={cart[m.id] >= availableQuantity(m)} onClick={() => change(m.id, 1)}>+</button>
                    </div>
                  ) : (
                    <button className="btn menu-add" disabled={!schedule?.ordering_open || availableQuantity(m) <= 0} onClick={() => change(m.id, 1)}>
                      <span aria-hidden="true">+</span> Add
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {visible.length === 0 && <div className="menu-empty">Nothing on the menu in this category right now. Try another one.</div>}
        </div>
      </section>

      <aside className="card cart">
        <div className="cart-heading">
          <div>
            <span className="cart-eyebrow">A GOOD CHOICE</span>
            <h2>Your order</h2>
          </div>
          <span className="cart-count">{String(cartCount).padStart(2, '0')}</span>
        </div>
        <div className="cart-service-note">
          <span aria-hidden="true">✳</span>
          <p>Made for lunch, served from <strong>12 noon to 2 p.m.</strong></p>
        </div>
        {schedule && (
          <p className="cart-ordering-note">
            {schedule.service_ordering
              ? `Cooked servings are available until ${formatTime(schedule.service_end)}. Fresh orders close at ${formatTime(schedule.fresh_ordering_end)} when kitchen capacity allows.`
              : `Place your preorder before ${formatTime(schedule.ordering_cutoff)}. Staff will notify you when it is ready.`}
          </p>
        )}
        {schedule && !schedule.ordering_open && (
          <p className="muted">Ordering is closed for today. Please come back tomorrow.</p>
        )}
        {lines.length === 0 && (
          <div className="cart-empty">
            <span className="cart-empty-icon" aria-hidden="true">＋</span>
            <strong>Your lunch starts here</strong>
            <p>Add something tasty from today’s menu. Your order will show up here.</p>
          </div>
        )}
        {lines.map((l) => (
          <div className="line" key={l.id}>
            <span>{l.name}</span>
            <span>
              <button className="qty" onClick={() => change(l.id, -1)}>−</button> {l.qty}{' '}
              <button className="qty" aria-label={`Add one ${l.name}`} disabled={l.qty >= l.stockQuantity} onClick={() => change(l.id, 1)}>+</button>
            </span>
            <span>{money(l.sub)}</span>
          </div>
        ))}
        <div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div>
        {estimate !== null && (
          <p className="muted">
            {schedule?.service_ordering
              ? `Estimated kitchen wait: about ${estimate} min. Prepared orders are faster; staff confirm when every order is ready for pickup.`
              : `Estimated kitchen wait: about ${estimate} min. Staff will notify you when your order is actually ready.`}
          </p>
        )}
        <label>
          Payment
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="CASH">Pay at counter (cash)</option>
            <option value="ONLINE">Pay online (simulated)</option>
          </select>
        </label>
        <button className="btn full cart-submit" onClick={placeOrder} disabled={!schedule?.ordering_open || !items.length}>
          Place order <span aria-hidden="true">→</span>
        </button>
        {message && <p className="error">{message}</p>}
      </aside>
    </div>
  );
}

function formatTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  if (hours === 12 && minutes === 0) return '12:00 noon';
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
