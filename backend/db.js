const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';
let dbInstance = null;

// Promisify sqlite3 methods
function sqliteRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  if (dbType === 'postgres' || dbType === 'postgresql' || process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    console.log('Connecting to PostgreSQL database...');
    const client = await pool.connect();
    client.release();

    // Ensure tickets table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id             SERIAL PRIMARY KEY,
        ticket_id      VARCHAR(20) UNIQUE NOT NULL,
        vehicle_number VARCHAR(20) NOT NULL,
        vehicle_type   VARCHAR(10) NOT NULL CHECK(vehicle_type IN ('bike', 'car', 'truck')),
        entry_time     TIMESTAMP NOT NULL,
        exit_time      TIMESTAMP DEFAULT NULL,
        amount         NUMERIC(6,2) DEFAULT NULL,
        status         VARCHAR(10) NOT NULL DEFAULT 'parked' CHECK(status IN ('parked', 'exited'))
      )
    `);

    const pgSql = (sql) => {
      let index = 1;
      return sql.replace(/\?/g, () => `$${index++}`);
    };

    dbInstance = {
      type: 'postgres',
      async run(sql, params = []) {
        let querySql = pgSql(sql);
        if (querySql.trim().toUpperCase().startsWith('INSERT')) {
          querySql += ' RETURNING id';
        }
        const result = await pool.query(querySql, params);
        const insertId = result.rows[0] ? result.rows[0].id : null;
        return {
          lastID: insertId,
          changes: result.rowCount
        };
      },
      async get(sql, params = []) {
        const querySql = pgSql(sql);
        const result = await pool.query(querySql, params);
        return result.rows[0] || null;
      },
      async all(sql, params = []) {
        const querySql = pgSql(sql);
        const result = await pool.query(querySql, params);
        return result.rows;
      },
      async close() {
        await pool.end();
      }
    };
  } else if (dbType === 'mysql') {
    const mysql = require('mysql2/promise');
    const connectionParams = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    };

    console.log(`Connecting to MySQL database: ${connectionParams.database} on ${connectionParams.host}...`);
    const connection = await mysql.createConnection(connectionParams);

    // Ensure tickets table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id      VARCHAR(20) UNIQUE NOT NULL,
        vehicle_number VARCHAR(20) NOT NULL,
        vehicle_type   ENUM('bike','car','truck') NOT NULL,
        entry_time     DATETIME NOT NULL,
        exit_time      DATETIME DEFAULT NULL,
        amount         DECIMAL(6,2) DEFAULT NULL,
        status         ENUM('parked','exited') NOT NULL DEFAULT 'parked'
      )
    `);

    dbInstance = {
      type: 'mysql',
      async run(sql, params = []) {
        // Convert '?' syntax to mysql if needed (mysql2 supports '?' out of the box)
        const [result] = await connection.execute(sql, params);
        return {
          lastID: result.insertId,
          changes: result.affectedRows
        };
      },
      async get(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows[0] || null;
      },
      async all(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows;
      },
      async close() {
        await connection.end();
      }
    };
  } else {
    // Default SQLite
    const sqlite3 = require('sqlite3').verbose();
    const dbFile = path.resolve(__dirname, 'parking_lot.db');
    console.log(`Initializing SQLite database file: ${dbFile}...`);

    const db = new sqlite3.Database(dbFile);

    // Ensure tickets table exists (SQLite dialect)
    await sqliteRun(db, `
      CREATE TABLE IF NOT EXISTS tickets (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id      TEXT UNIQUE NOT NULL,
        vehicle_number TEXT NOT NULL,
        vehicle_type   TEXT NOT NULL CHECK(vehicle_type IN ('bike', 'car', 'truck')),
        entry_time     TEXT NOT NULL,
        exit_time      TEXT DEFAULT NULL,
        amount         REAL DEFAULT NULL,
        status         TEXT NOT NULL DEFAULT 'parked' CHECK(status IN ('parked', 'exited'))
      )
    `);

    dbInstance = {
      type: 'sqlite',
      async run(sql, params = []) {
        return sqliteRun(db, sql, params);
      },
      async get(sql, params = []) {
        return sqliteGet(db, sql, params);
      },
      async all(sql, params = []) {
        return sqliteAll(db, sql, params);
      },
      async close() {
        return new Promise((resolve, reject) => {
          db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    };
  }
  return dbInstance;
}

module.exports = {
  getDb: async () => {
    if (!dbInstance) {
      dbInstance = await initDatabase();
    }
    return dbInstance;
  }
};
