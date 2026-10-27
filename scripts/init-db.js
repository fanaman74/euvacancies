'use strict';

require('dotenv').config();
const { initDb, closeDb } = require('../src/db');

(async () => {
  try {
    await initDb();
    console.log('Database schema is ready.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
