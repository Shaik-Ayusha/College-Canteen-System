const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { MENU_EDIT_CUTOFF, timeToMinutes } = require('../services/schedule');

const router = express.Router();

function validateItem(body) {
  if (!body.name || !String(body.name).trim()) return 'Name is required';
  if (body.price === undefined || body.price === '' || isNaN(Number(body.price)) || Number(body.price) < 0) {
    return 'A valid price is required';
  }
  if (body.prep_minutes !== undefined && (isNaN(Number(body.prep_minutes)) || Number(body.prep_minutes) < 0)) {
    return 'Prep time must be a number of minutes';
  }
  if (body.stock_quantity !== undefined && (isNaN(Number(body.stock_quantity)) || Number(body.stock_quantity) < 0)) {
    return 'Stock must be 0 or more';
  }
  return null;
}

function itemValues(body) {
  return [
    String(body.name).trim(),
    body.description || '',
    body.category || 'General',
    Number(body.price).toFixed(2),
    Math.round(Number(body.prep_minutes) || 5),
    Math.max(0, Math.round(Number(body.stock_quantity) || 0)),
    body.is_available ? 1 : 0,
  ];
}

async function menuEditClosed() {
  const [row] = await db.query("SELECT TIME_FORMAT(CURRENT_TIME(), '%H:%i') AS current_time");
  return timeToMinutes(row.current_time) >= timeToMinutes(MENU_EDIT_CUTOFF);
}

function sameMenuDefinition(body, existing) {
  return String(body.name).trim() === existing.name &&
    String(body.description || '') === String(existing.description || '') &&
    String(body.category || 'General') === existing.category &&
    Number(body.price) === Number(existing.price) &&
    Math.round(Number(body.prep_minutes) || 5) === Number(existing.prep_minutes);
}

// GET /api/menu  (public)
router.get('/', async (req, res) => {
  const items = await db.query(
    'SELECT id, name, description, category, price, prep_minutes, stock_quantity, prepared_quantity, IF(cooked_quantity_date = CURRENT_DATE, cooked_today_quantity, 0) AS cooked_today_quantity, cooked_quantity_date, is_available FROM menu_items ORDER BY category, name'
  );
  res.json(items);
});

// POST /api/menu  (admin)
router.post('/', requireAdmin, async (req, res) => {
  if (await menuEditClosed()) {
    return res.status(400).json({ message: 'Menu items can only be added before 11:00 a.m.' });
  }
  const error = validateItem(req.body);
  if (error) return res.status(400).json({ message: error });

  const id = await db.insert(
    'INSERT INTO menu_items (name, description, category, price, prep_minutes, stock_quantity, prepared_quantity, is_available) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    itemValues(req.body)
  );
  res.status(201).json({ id });
});

// PUT /api/menu/:id  (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  const error = validateItem(req.body);
  if (error) return res.status(400).json({ message: error });

  if (await menuEditClosed()) {
    const [existing] = await db.query(
      'SELECT name, description, category, price, prep_minutes FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    if (existing && !sameMenuDefinition(req.body, existing)) {
      return res.status(400).json({ message: 'Food details can only be changed before 11:00 a.m.; stock and availability can still be updated.' });
    }
  }

  await db.run(
    'UPDATE menu_items SET name = ?, description = ?, category = ?, price = ?, prep_minutes = ?, stock_quantity = ?, is_available = ? WHERE id = ?',
    [...itemValues(req.body), req.params.id]
  );
  res.json({ message: 'Item updated' });
});

// POST /api/menu/:id/prepared (record newly cooked servings)
router.post('/:id/prepared', requireAdmin, async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'Enter the number of servings just cooked' });
  }

  try {
    const changed = await db.run(
      'UPDATE menu_items SET prepared_quantity = prepared_quantity + ?, cooked_today_quantity = IF(cooked_quantity_date = CURRENT_DATE, cooked_today_quantity + ?, ?), cooked_quantity_date = CURRENT_DATE WHERE id = ? AND is_available = 1 AND stock_quantity - prepared_quantity >= ?',
      [quantity, quantity, quantity, req.params.id, quantity]
    );
    if (!changed) {
      const [item] = await db.query('SELECT id, stock_quantity, prepared_quantity, is_available FROM menu_items WHERE id = ?', [req.params.id]);
      if (!item) return res.status(404).json({ message: 'Menu item not found' });
      if (!item.is_available) return res.status(400).json({ message: 'Enable this menu item before adding cooked servings' });
      return res.status(400).json({ message: 'Cooked servings exceed the stock remaining for this item' });
    }
    const [item] = await db.query(
      'SELECT id, prepared_quantity, IF(cooked_quantity_date = CURRENT_DATE, cooked_today_quantity, 0) AS cooked_today_quantity FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update cooked servings' });
  }
});

module.exports = router;
