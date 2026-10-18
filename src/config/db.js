require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'canteen_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// Builds the same small API (query / insert / run) on top of any connection.
function makeApi(exec) {
  return {
    async query(sql, params = []) {
      const [rows] = await exec(sql, params);
      return rows;
    },
    async insert(sql, params = []) {
      const [result] = await exec(sql, params);
      return result.insertId;
    },
    async run(sql, params = []) {
      const [result] = await exec(sql, params);
      return result.affectedRows;
    },
  };
}

const db = makeApi((sql, params) => pool.query(sql, params));

// Runs fn(tx) inside a transaction: commits on success, rolls back on error.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = makeApi((sql, params) => conn.query(sql, params));
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { query: db.query, insert: db.insert, run: db.run, withTransaction };
