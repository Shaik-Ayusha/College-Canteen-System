require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});

// REST API and live-update endpoints
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/events', require('./routes/events').router);

// React frontend (built with `npm run build`)
const clientDir = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDir));

// Any other page URL returns the React app, so direct links like /orders work
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const index = path.join(clientDir, 'index.html');
  if (!fs.existsSync(index)) {
    return res.status(404).send('The frontend is not built yet. Run "npm run build" first.');
  }
  res.sendFile(index);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Canteen system running at http://localhost:${PORT}`);
});
