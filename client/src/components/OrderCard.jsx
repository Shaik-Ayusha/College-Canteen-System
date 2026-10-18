import { STATUS_LABEL, money } from '../utils.js';

export default function OrderCard({ order, showCustomer = false, children }) {
  let eta = null;
  if (order.status === 'PLACED' && order.ready_stock_order) {
    eta = <p className="eta">Prepared food order received. Staff will confirm when it is ready for pickup.</p>;
  } else if (order.status === 'PLACED' || order.status === 'PREPARING') {
    eta = (
      <p className="eta">
        Estimated wait: about {order.estimated_minutes} min. Staff will notify you when it is ready.
      </p>
    );
  } else if (order.status === 'READY') {
    eta = (
      showCustomer
        ? <p className="eta">Order is ready. Ask the student to show their pickup OTP.</p>
        : (
          <div className="pickup-code" role="status">
            <span>Ready for pickup · show this code to staff</span>
            <strong>{order.pickup_otp || 'Loading code…'}</strong>
          </div>
        )
    );
  }

  return (
    <article className="order-card">
      <div className="token">
        <span>Token</span>
        <strong>#{order.token_no}</strong>
      </div>
      <div className="order-body">
        <div className="row">
          <span className="muted">{new Date(order.created_at).toLocaleString()}</span>
          <span className={`badge ${order.status}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        {showCustomer && <p><strong>{order.customer_name}</strong></p>}
        {eta}
        <ul>
          {order.items.map((item, i) => (
            <li key={i}>{item.item_name} × {item.quantity}</li>
          ))}
        </ul>
        <div className="row">
          <span className="muted">{order.payment_method} · {order.payment_status}</span>
          <strong>{money(order.total_amount)}</strong>
        </div>
        {children && <div className="actions">{children}</div>}
      </div>
    </article>
  );
}
