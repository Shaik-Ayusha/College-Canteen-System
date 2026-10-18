const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: 'Name, email and a password of 6+ characters are required' });
  }
  const exists = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) return res.status(409).json({ message: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const id = await db.insert(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, 'student']
  );
  const user = { id, name, email, role: 'student' };
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const [row] = await db.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
    [email]
  );
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ token: signToken(user), user });
});

module.exports = router;
