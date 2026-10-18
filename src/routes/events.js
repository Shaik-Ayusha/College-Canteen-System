// Real-time updates using Server-Sent Events (SSE).
// Students receive updates about their own orders; admins receive all orders.
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const clients = new Set();

// GET /api/events?token=...
router.get('/', (req, res) => {
  let user;
  try {
    user = jwt.verify(req.query.token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).end();
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const client = { res, userId: user.id, role: user.role };
  clients.add(client);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(client);
  });
});

function broadcast(event, data, ownerUserId) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client.role === 'admin' || client.userId === ownerUserId) {
      client.res.write(payload);
    }
  }
}

module.exports = { router, broadcast };
