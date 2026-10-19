const express = require('express');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { broadcast } = require('./events');
const { remainingMinutes, estimateMinutes } = require('../services/wait');
const { scheduleFor, canFinishBeforeServiceEnds } = require('../services/schedule');
const { createPickupOtp, decryptPickupOtp, otpMatches } = require('../services/pickupOtp');

const router = express.Router();

const STATUSES = ['PLACED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED'];
const ACTIVE = ['PLACED', 'PREPARING'];
const PAYMENT_METHODS = ['CASH', 'ONLINE'];
const ORDER_SELECT =
  'SELECT o.id, o.user_id, o.token_no, o.total_amount, o.status, o.prep_minutes, o.ready_stock_order, o.started_at, o.created_at, o.updated_at, u.name AS customer_name ' +
  'FROM orders o JOIN users u ON u.id = o.user_id';

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function preparedQuantityForLine(item, qty) {
  return Math.min(qty, Math.max(0, Number(item.prepared_quantity) || 0));
}

function cookingPrepMinutes(lines) {
  const cookingLines = lines.map(({ item, qty }) => ({
    item,
    qty: qty - preparedQuantityForLine(item, qty),
  })).filter((line) => line.qty > 0);
  if (!cookingLines.length) return 0;
  const longest = Math.max(...cookingLines.map(({ item }) => Number(item.prep_minutes)));
  const quantity = cookingLines.reduce((sum, line) => sum + line.qty, 0);
  return longest + Math.max(0, quantity - 1);
}

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: fallback });
}

// Cooking minutes still ahead of an order (all active orders when beforeId is not given).
// Only orders placed earlier (lower id) are counted, since they are cooked first.
async function queueMinutesAhead(beforeId, api = db) {
  const sql =
    "SELECT id, status, prep_minutes, started_at FROM orders WHERE status IN ('PLACED', 'PREPARING') AND ready_stock_order = 0 " +
    (beforeId ? ' AND id < ?' : '');
  const rows = await api.query(sql, beforeId ? [beforeId] : []);
  return rows.reduce((sum, o) => sum + remainingMinutes(o), 0);
}

async function getSchedule() {
  const [row] = await db.query("SELECT TIME_FORMAT(CURRENT_TIME(), '%H:%i') AS current_time_value");
  return scheduleFor(row.current_time_value);
}

// Validates cart lines against the menu and computes totals and prep time
async function buildLines(api, items) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'Your cart is empty');

  const lines = [];
  let total = 0;
  let totalQty = 0;
  let longest = 0;

  for (const line of items) {
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty < 1) throw httpError(400, 'Invalid quantity');

    const [item] = await api.query(
      'SELECT id, name, price, prep_minutes, is_available, stock_quantity, prepared_quantity FROM menu_items WHERE id = ?',
      [line.menu_item_id]
    );
    if (!item || !item.is_available) throw httpError(400, 'One of the items is not available');
    if (Number(item.stock_quantity) < qty) {
      throw httpError(400, `Only ${item.stock_quantity} ${item.name} left in stock`);
    }

    const price = Number(item.price);
    lines.push({ item, qty, price });
    total += price * qty;
    totalQty += qty;
    longest = Math.max(longest, Number(item.prep_minutes));
  }

  // Longest item takes the time, plus 1 minute for each extra portion
  const prepMinutes = longest + Math.max(0, totalQty - 1);
  return { lines, total, prepMinutes };
}

// Adds items, payment info, and the live wait estimate to each order
async function attachDetails(orders) {
  for (const o of orders) {
    o.items = await db.query(
      'SELECT menu_item_id, item_name, unit_price, quantity, prepared_quantity_reserved FROM order_items WHERE order_id = ?',
      [o.id]
    );
    const [pay] = await db.query('SELECT method, status FROM payments WHERE order_id = ?', [o.id]);
    o.payment_method = pay ? pay.method : '';
    o.payment_status = pay ? pay.status : '';
    o.estimated_minutes = ACTIVE.includes(o.status) && !o.ready_stock_order
      ? estimateMinutes(await queueMinutesAhead(o.id), remainingMinutes(o))
      : 0;
  }
  return orders;
}

async function getOrderDetails(id) {
  const [order] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  if (!order) return null;
  await attachDetails([order]);
  return order;
}

async function attachPickupOtp(order) {
  if (order.status !== 'READY') return order;
  const encrypted = await db.withTransaction(async (tx) => {
    const [row] = await tx.query(
      'SELECT status, pickup_otp_encrypted FROM orders WHERE id = ? FOR UPDATE',
      [order.id]
    );
    if (!row || row.status !== 'READY') return null;
    if (row.pickup_otp_encrypted) return row.pickup_otp_encrypted;

    const { encrypted: newOtp } = createPickupOtp();
    await tx.run(
      'UPDATE orders SET pickup_otp_encrypted = ? WHERE id = ? AND status = ? AND pickup_otp_encrypted IS NULL',
      [newOtp, order.id, 'READY']
    );
    return newOtp;
  });
  if (encrypted) order.pickup_otp = decryptPickupOtp(encrypted);
  return order;
}

// POST /api/orders/estimate  (preview the wait for the cart before placing it)
router.post('/estimate', requireAuth, async (req, res) => {
  try {
    const { lines, prepMinutes } = await buildLines(db, req.body.items);
    const cookingMinutes = cookingPrepMinutes(lines);
    if (cookingMinutes === 0) {
      return res.json({ estimated_minutes: 0 });
    }
    const queue = await queueMinutesAhead();
    const estimatedMinutes = estimateMinutes(queue, cookingMinutes || prepMinutes);
    res.json({ estimated_minutes: estimatedMinutes });
  } catch (err) {
    sendError(res, err, 'Could not estimate wait time');
  }
});

// GET /api/orders/schedule (canteen hours and today's current time)
router.get('/schedule', async (req, res) => {
  try {
    res.json(await getSchedule());
  } catch (err) {
    sendError(res, err, 'Could not load canteen hours');
  }
});

// GET /api/orders/mine  (logged-in student)
router.get('/mine', requireAuth, async (req, res) => {
  const orders = await db.query(
    `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC`,
    [req.user.id]
  );
  await attachDetails(orders);
  for (const order of orders) await attachPickupOtp(order);
  res.json(orders);
});

// GET /api/orders  (admin and kitchen, optional ?status=PLACED)
router.get('/', requireAdmin, async (req, res) => {
  const params = [];
  let where = '';
  if (STATUSES.includes(req.query.status)) {
    where = ' WHERE o.status = ?';
    params.push(req.query.status);
  }
  const orders = await db.query(`${ORDER_SELECT}${where} ORDER BY o.created_at DESC, o.id DESC`, params);
  res.json(await attachDetails(orders));
});

// GET /api/orders/:id  (owner or admin)
router.get('/:id', requireAuth, async (req, res) => {
  const order = await getOrderDetails(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ message: 'This is not your order' });
  }
  if (req.user.role !== 'admin') await attachPickupOtp(order);
  res.json(order);
});

// POST /api/orders  (place order, digital token, wait estimate, stock check)
router.post('/', requireAuth, async (req, res) => {
  const paymentMethod = req.body.payment_method || 'CASH';
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: 'Invalid payment method' });
  }

  try {
    const orderId = await db.withTransaction(async (tx) => {
      const { lines, total } = await buildLines(tx, req.body.items);
      const [clock] = await tx.query("SELECT TIME_FORMAT(CURRENT_TIME(), '%H:%i') AS current_time");
      const schedule = scheduleFor(clock.current_time);
      if (!schedule.ordering_open) {
        throw httpError(400, 'Ordering is closed. Preorders close at 12:00 noon; prepared food orders close at 2:00 p.m.');
      }
      const preparedReservations = lines.map(({ item, qty }) => preparedQuantityForLine(item, qty));
      const fullyPrepared = preparedReservations.every((quantity, index) => quantity === lines[index].qty);
      const readyStockOrder = fullyPrepared;
      const cookingMinutes = cookingPrepMinutes(lines);
      if (schedule.service_ordering && !fullyPrepared && !schedule.fresh_ordering_open) {
        throw httpError(400, 'Newly cooked food orders close at 1:40 p.m.; only prepared food can be ordered until 2:00 p.m.');
      }
      if (schedule.service_ordering && cookingMinutes > 0) {
        const queue = await queueMinutesAhead(undefined, tx);
        const estimatedMinutes = estimateMinutes(queue, cookingMinutes);
        if (!canFinishBeforeServiceEnds(clock.current_time, estimatedMinutes)) {
          throw httpError(400, 'The kitchen is at capacity for made-to-order food before 2:00 p.m. Please choose an item already marked prepared.');
        }
      }
      for (let index = 0; index < lines.length; index += 1) {
        const { item, qty } = lines[index];
        const stockReserved = await tx.run(
          'UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ? AND is_available = 1 AND stock_quantity >= ?',
          [qty, item.id, qty]
        );
        if (!stockReserved) throw httpError(409, `${item.name} no longer has enough stock. Please update your cart.`);

        const preparedQty = preparedReservations[index];
        if (preparedQty > 0) {
          const reserved = await tx.run(
            'UPDATE menu_items SET prepared_quantity = prepared_quantity - ? WHERE id = ? AND prepared_quantity >= ?',
            [preparedQty, item.id, preparedQty]
          );
          if (!reserved) throw httpError(409, `${item.name} was just ordered by someone else. Please update your cart.`);
        }
      }
      // Daily token sequence: 1, 2, 3... resets each day
      const [next] = await tx.query(
        'SELECT COALESCE(MAX(token_no), 0) + 1 AS next_token FROM orders WHERE DATE(created_at) = CURRENT_DATE'
      );

      const id = await tx.insert(
        'INSERT INTO orders (user_id, token_no, total_amount, status, prep_minutes, ready_stock_order, stock_reserved) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [req.user.id, next.next_token, total.toFixed(2), 'PLACED', cookingMinutes, readyStockOrder ? 1 : 0]
      );

      for (let index = 0; index < lines.length; index += 1) {
        const { item, qty, price } = lines[index];
        await tx.run(
          'INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, prepared_quantity_reserved) VALUES (?, ?, ?, ?, ?, ?)',
          [id, item.id, item.name, price.toFixed(2), qty, preparedReservations[index]]
        );
      }

      // ONLINE is simulated as paid instantly; CASH is paid at the counter
      const payStatus = paymentMethod === 'ONLINE' ? 'PAID' : 'PENDING';
      await tx.run(
        'INSERT INTO payments (order_id, method, amount, status) VALUES (?, ?, ?, ?)',
        [id, paymentMethod, total.toFixed(2), payStatus]
      );
      return id;
    });

    const order = await getOrderDetails(orderId);
    broadcast('order', order, order.user_id);
    res.status(201).json(order);
  } catch (err) {
    sendError(res, err, 'Could not place order');
  }
});

// PATCH /api/orders/:id/status  (admin and kitchen)
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  const existing = await getOrderDetails(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Order not found' });

  if (existing.status === 'COLLECTED' && status !== 'COLLECTED') {
    return res.status(400).json({ message: 'Delivered orders cannot be changed' });
  }
  if (existing.status === 'CANCELLED' && status !== 'CANCELLED') {
    return res.status(400).json({ message: 'Cancelled orders cannot be changed' });
  }
  if (status === 'PREPARING' && existing.status !== 'PLACED') {
    return res.status(400).json({ message: 'Only newly placed orders can be started' });
  }
  if (
    status === 'READY' &&
    existing.status !== 'PREPARING' &&
    !(existing.status === 'PLACED' && existing.ready_stock_order)
  ) {
    return res.status(400).json({ message: 'Only prepared or cooking orders can be marked ready' });
  }
  if (status === 'CANCELLED' && !['PLACED', 'PREPARING', 'READY'].includes(existing.status)) {
    return res.status(400).json({ message: 'Only active orders can be cancelled' });
  }

  if (status === 'COLLECTED') {
    return res.status(400).json({ message: 'Enter the student pickup OTP to confirm delivery' });
  }

  try {
    await db.withTransaction(async (tx) => {
      const [current] = await tx.query('SELECT status, stock_reserved FROM orders WHERE id = ? FOR UPDATE', [existing.id]);
      if (!current || current.status !== existing.status) {
        throw httpError(409, 'This order was updated by another staff member. Refresh and try again.');
      }

      if (status === 'CANCELLED') {
        if (current.stock_reserved) {
          for (const item of existing.items) {
            await tx.run(
              'UPDATE menu_items SET stock_quantity = stock_quantity + ? WHERE id = ?',
              [item.quantity, item.menu_item_id]
            );
            if (item.prepared_quantity_reserved > 0) {
              await tx.run(
                'UPDATE menu_items SET prepared_quantity = LEAST(prepared_quantity + ?, stock_quantity) WHERE id = ?',
                [item.prepared_quantity_reserved, item.menu_item_id]
              );
            }
          }
        }
        await tx.run("UPDATE payments SET status = 'REFUNDED' WHERE order_id = ? AND status = 'PAID'", [existing.id]);
      }

      const encrypted = status === 'READY' ? createPickupOtp().encrypted : null;
      await tx.run(
        'UPDATE orders SET status = ?, pickup_otp_encrypted = ?, started_at = CASE WHEN ? = ? AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, encrypted, status, 'PREPARING', existing.id]
      );
    });
  } catch (err) {
    return sendError(res, err, 'Could not update order status');
  }

  const updated = await getOrderDetails(existing.id);
  broadcast('order', updated, updated.user_id);
  res.json(updated);
});

// POST /api/orders/:id/verify-pickup (staff confirms handoff using the student's OTP)
router.post('/:id/verify-pickup', requireAdmin, async (req, res) => {
  const otp = req.body.otp;
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: 'Enter the 6-digit pickup OTP' });
  }

  try {
    await db.withTransaction(async (tx) => {
      const [order] = await tx.query(
        'SELECT id, status, stock_reserved, pickup_otp_encrypted FROM orders WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!order) throw httpError(404, 'Order not found');
      if (order.status !== 'READY' || !order.pickup_otp_encrypted) {
        throw httpError(400, 'This order is not waiting for pickup verification');
      }

      const actualOtp = decryptPickupOtp(order.pickup_otp_encrypted);
      if (!otpMatches(otp, actualOtp)) throw httpError(400, 'Incorrect pickup OTP');

      const items = await tx.query(
        'SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?',
        [order.id]
      );
      if (!order.stock_reserved) {
        for (const item of items) {
          await tx.run(
            'UPDATE menu_items SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?',
            [item.quantity, item.menu_item_id]
          );
        }
      }

      await tx.run(
        "UPDATE orders SET status = 'COLLECTED', pickup_otp_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [order.id]
      );
      await tx.run(
        "UPDATE payments SET status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'PENDING'",
        [order.id]
      );
    });

    const updated = await getOrderDetails(req.params.id);
    broadcast('order', updated, updated.user_id);
    res.json(updated);
  } catch (err) {
    sendError(res, err, 'Could not verify pickup');
  }
});

module.exports = router;
