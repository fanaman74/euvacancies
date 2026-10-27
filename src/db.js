'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool, types } = require('pg');

// Keep PostgreSQL DATE values as YYYY-MM-DD strings. Parsing them into JS Dates
// shifts the day when the process runs in a non-UTC timezone (e.g. Europe/London).
types.setTypeParser(1082, (value) => value);

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Attach a Postgres database or provide a connection string.');
  }
  const needsSsl = /proxy\.rlwy\.net|sslmode=require/i.test(connectionString);
  pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX || 6),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (error) => {
    console.error('[db] idle client error', error);
  });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withClient(handler) {
  const client = await getPool().connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await query(schema);
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, withClient, initDb, closeDb };
