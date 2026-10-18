const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/stats  (today's dashboard numbers)
router.get('/stats', requireAdmin, async (req, res) => {
  const [totals] = await db.query(
    `SELECT COUNT(*) AS total_orders,
            COALESCE(SUM(CASE WHEN status <> 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN status IN ('PLACED', 'PREPARING', 'READY') THEN 1 ELSE 0 END), 0) AS active
       FROM orders
      WHERE DATE(created_at) = CURRENT_DATE`
  );
  const top = await db.query(
    `SELECT oi.item_name, SUM(oi.quantity) AS qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) = CURRENT_DATE AND o.status <> 'CANCELLED'
      GROUP BY oi.item_name
      ORDER BY qty DESC
      LIMIT 5`
  );

  res.json({
    totalOrders: Number(totals.total_orders),
    revenue: Number(totals.revenue),
    active: Number(totals.active),
    topItems: top.map((t) => ({ item_name: t.item_name, qty: Number(t.qty) })),
  });
});

module.exports = router;
