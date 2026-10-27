'use strict';

const cron = require('node-cron');
const { runSync } = require('./sync');

const TIMEZONE = process.env.SYNC_TIMEZONE || 'Europe/London';
const SCHEDULE = process.env.SYNC_CRON || '0 9 * * *';

let task = null;

function startScheduler() {
  if (task) return task;
  task = cron.schedule(
    SCHEDULE,
    async () => {
      try {
        await runSync({ trigger: 'cron' });
      } catch (error) {
        console.error('[scheduler] daily sync failed', error);
      }
    },
    {
      timezone: TIMEZONE,
      name: 'daily-vacancy-sync',
      noOverlap: true,
    },
  );
  console.log(`[scheduler] daily sync armed for ${SCHEDULE} ${TIMEZONE}`);
  return task;
}

function getScheduleInfo() {
  const next = task?.getNextRun?.() || null;
  return {
    expression: SCHEDULE,
    timezone: TIMEZONE,
    nextRun: next instanceof Date && !Number.isNaN(next.valueOf()) ? next : null,
  };
}

function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { startScheduler, stopScheduler, getScheduleInfo, TIMEZONE, SCHEDULE };
