'use strict';

require('dotenv').config();
const { initDb, closeDb } = require('../src/db');
const { runSync } = require('../src/sync');

(async () => {
  try {
    await initDb();
    const result = await runSync({ trigger: 'cli' });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
