// Creates the default admin account and sample menu items.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function seed() {
  const admins = await db.query('SELECT id FROM users WHERE email = ?', ['admin@canteen.com']);
  if (!admins.length) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.insert(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Canteen Admin', 'admin@canteen.com', hash, 'admin']
    );
    console.log('Admin created: admin@canteen.com / admin123');
  }

  const [count] = await db.query('SELECT COUNT(*) AS total FROM menu_items');
  if (Number(count.total) === 0) {
    // [name, description, category, price, prep time in minutes, stock quantity]
    const items = [
      ['Samosa', 'Crispy potato-filled pastry', 'Snacks', 15, 5, 60],
      ['Veg Sandwich', 'Grilled with fresh veggies', 'Snacks', 40, 6, 40],
      ['Masala Dosa', 'With sambar and chutney', 'Meals', 60, 10, 30],
      ['Veg Thali', 'Rice, roti, dal, sabzi, sweet', 'Meals', 90, 12, 25],
      ['Chicken Biryani', 'Fragrant basmati rice', 'Meals', 130, 20, 20],
      ['Tea', 'Hot masala chai', 'Beverages', 10, 3, 100],
      ['Cold Coffee', 'Chilled and creamy', 'Beverages', 50, 4, 50],
      ['Chocolate Brownie', 'Warm and fudgy', 'Desserts', 35, 2, 30],
    ];
    for (const [name, description, category, price, prep, stock] of items) {
      await db.insert(
        'INSERT INTO menu_items (name, description, category, price, prep_minutes, stock_quantity, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, description, category, Number(price).toFixed(2), prep, stock, 1]
      );
    }
    console.log(`Inserted ${items.length} sample menu items`);
  }

  console.log('Seeding complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
