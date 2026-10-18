import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';

function ActiveOrderReadyNotifications() {
  const navigate = useNavigate();
  const [readyQueue, setReadyQueue] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [permissionError, setPermissionError] = useState('');
  const notifiedOrders = useRef(new Set());
  const loadingOrders = useRef(new Set());
  const notification = readyQueue[0] || null;

  useEffect(() => {
    if (!notification) return undefined;
    function dismissOnEscape(event) {
      if (event.key === 'Escape') {
        setReadyQueue((queue) => queue.slice(1));
      }
    }
    window.addEventListener('keydown', dismissOnEscape);
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [notification]);

  const queueReadyOrder = useCallback(async (order) => {
    if (
      order.status !== 'READY' ||
      notifiedOrders.current.has(order.id) ||
      loadingOrders.current.has(order.id)
    ) return;
    loadingOrders.current.add(order.id);
    let readyOrder = order;
    if (!readyOrder.pickup_otp) {
      try {
        readyOrder = await api(`/orders/${order.id}`);
      } catch (error) {
        console.error('Could not load pickup OTP:', error);
        setPermissionError('Your order is ready, but its pickup code could not be loaded. Open My orders to try again.');
        loadingOrders.current.delete(order.id);
        return;
      }
    }
    if (!readyOrder.pickup_otp) {
      setPermissionError('Your order is ready, but no pickup code was found. Please contact canteen staff.');
      loadingOrders.current.delete(order.id);
      return;
    }
    notifiedOrders.current.add(order.id);
    loadingOrders.current.delete(order.id);
    setReadyOrders((orders) => [
      ...orders.filter((item) => item.id !== order.id),
      { ...readyOrder, token: order.token_no },
    ]);
    setReadyQueue((queue) => [...queue, {
      id: order.id,
      token: order.token_no,
      otp: readyOrder.pickup_otp,
    }]);
    setPermissionError('');

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification('Your order is ready!', {
          body: `Order #${order.token_no} is ready. Show your pickup code in the canteen website.`,
          tag: `canteen-order-${order.id}`,
        });
        browserNotification.onclick = () => {
          window.focus();
          navigate('/orders');
          setReadyQueue((queue) => queue.filter((item) => item.id !== order.id));
          browserNotification.close();
        };
      } catch (error) {
        console.error('Could not show browser notification:', error);
        setPermissionError('The in-app pickup alert is active, but the browser notification could not be shown.');
      }
    }
  }, [navigate]);

  const loadReadyOrders = useCallback(async () => {
    try {
      const orders = await api('/orders/mine');
      setPermissionError('');
      const ready = orders.filter((order) => order.status === 'READY' && order.pickup_otp);
      setReadyOrders(ready);
      for (const order of orders) {
        if (order.status === 'READY') await queueReadyOrder(order);
      }
    } catch (error) {
      console.error('Could not check for ready orders:', error);
      setPermissionError('Could not check order status. Please refresh the page or open My orders.');
    }
  }, [queueReadyOrder]);

  useEffect(() => {
    loadReadyOrders();
    const timer = setInterval(loadReadyOrders, 10000);
    return () => clearInterval(timer);
  }, [loadReadyOrders]);

  useLiveUpdates(queueReadyOrder);

  async function enableBrowserNotifications() {
    if (!('Notification' in window)) {
      setPermissionError('Browser notifications are not supported here. Keep this page open to see pickup alerts.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPermissionError('Browser alerts are enabled for future orders.');
      } else if (permission === 'denied') {
        setPermissionError('Notifications are blocked by your browser. You can allow them in browser settings.');
      } else {
        setPermissionError('Notifications were not enabled. You can try again when your next order is ready.');
      }
    } catch (error) {
      console.error('Could not enable browser notifications:', error);
      setPermissionError('Could not enable browser alerts. Please check your browser settings.');
    }
  }

  if (!notification && !permissionError) return null;

  return (
    <>
      {notification && (
        <div className="ready-modal-backdrop">
          <section className="ready-modal" role="alertdialog" aria-modal="true" aria-labelledby="ready-modal-title" aria-describedby="ready-modal-message">
            <button
              className="ready-modal-close"
              aria-label="Close notification"
              onClick={() => setReadyQueue((queue) => queue.slice(1))}
            >
              ×
            </button>
            <span className="ready-modal-icon" aria-hidden="true">✓</span>
            <span className="ready-modal-eyebrow">PICKUP TIME</span>
            <h2 id="ready-modal-title">Your order is ready!</h2>
            <p id="ready-modal-message">
              Order <strong>#{notification.token}</strong> is ready. Show this pickup code to the staff:
            </p>
            <strong className="pickup-otp">{notification.otp}</strong>
            <button
              className="btn ready-modal-action"
              onClick={() => {
                navigate('/orders');
                setReadyQueue((queue) => queue.slice(1));
                setPermissionError('');
              }}
            >
              View my order
            </button>
            {'Notification' in window && Notification.permission === 'default' && (
              <button className="ready-notice-enable" onClick={enableBrowserNotifications}>
                Turn on desktop alerts for next time
              </button>
            )}
          </section>
        </div>
      )}
      {readyOrders.length > 0 && (
        <div className="ready-orders-banner" role="status" aria-live="polite">
          <div className="ready-orders-banner-copy">
            <strong>Your order is ready for pickup</strong>
            {readyOrders.map((order) => (
              <span key={order.id}>
                Order #{order.token_no} · Pickup OTP <b>{order.pickup_otp}</b>
              </span>
            ))}
          </div>
          <button className="btn small" onClick={() => navigate('/orders')}>My orders</button>
        </div>
      )}
      {permissionError && (
        <div className="ready-notice" role="status" aria-live="polite">
          <div className="ready-notice-copy">
            <span className="ready-notice-feedback">{permissionError}</span>
          </div>
          <button
            className="ready-notice-dismiss"
            aria-label="Dismiss message"
            onClick={() => setPermissionError('')}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default function OrderReadyNotifications() {
  const { user } = useAuth();
  if (!user || user.role !== 'student') return null;
  return <ActiveOrderReadyNotifications key={user.id} />;
}
