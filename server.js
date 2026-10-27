'use strict';

require('dotenv').config();

const path = require('node:path');
const express = require('express');
const compression = require('compression');
const { initDb, query, getPool } = require('./src/db');
const { runSync, getLastSync } = require('./src/sync');
const { startScheduler, getScheduleInfo, TIMEZONE } = require('./src/scheduler');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(compression());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  etag: true,
}));

const CATEGORY_CLASS = {
  'Contract Agents': 'contract',
  Assistants: 'assistant',
  Administrators: 'administrator',
};

function todayInLondon() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseDateOnly(value) {
  if (!value) return null;
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
}

function daysUntil(value, today) {
  const target = parseDateOnly(value);
  const base = parseDateOnly(today);
  if (!target || !base) return null;
  return Math.round((target - base) / 86_400_000);
}

function deadlineStatus(job, today) {
  if (!job.deadline_date) return 'rolling';
  const days = daysUntil(job.deadline_date, today);
  if (days < 0) return 'closed';
  if (days === 0) return 'today';
  if (days <= 7) return 'soon';
  return 'open';
}

function deadlineLabel(job, today) {
  if (!job.deadline_date) return 'Rolling';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateOnly(job.deadline_date));
}

function relativeDeadline(job, today) {
  if (!job.deadline_date) return 'Open until filled';
  const days = daysUntil(job.deadline_date, today);
  if (days < -1) return `${Math.abs(days)} days ago`;
  if (days === -1) return 'Closed yesterday';
  if (days === 0) return 'Last day to apply';
  if (days === 1) return 'Closes tomorrow';
  return `${days} days left`;
}

function moneyShort(value) {
  if (value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (number >= 1000) {
    const compact = (number / 1000).toFixed(1).replace(/\.0$/, '');
    return `€${compact}k`;
  }
  return `€${Math.round(number)}`;
}

function salaryShort(job) {
  if (job.salary_min && job.salary_max && Number(job.salary_max) > Number(job.salary_min)) {
    return `${moneyShort(job.salary_min)}–${moneyShort(job.salary_max)}`;
  }
  if (job.salary_min) return moneyShort(job.salary_min);
  return 'Not listed';
}

function formatSyncTime(date, timezone = TIMEZONE) {
  if (!date) return 'Not yet';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

function formatEditionDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function loadSiteData() {
  const today = todayInLondon();
  const [jobsResult, statsResult, editionResult, lastSyncResult, lastSuccessResult] = await Promise.all([
    query(
      `SELECT id, fingerprint, title, agency, agency_short, location_city, location_country, country_code,
              flag, contract_type, grade, category, salary_summary, salary_min, salary_max,
              deadline_date, deadline_text, indefinite_contract, apply_url, source_post_id,
              source_post_title, source_post_url, source_published_at, first_seen_at, last_seen_at, times_seen
       FROM jobs
       ORDER BY CASE
                  WHEN deadline_date IS NULL THEN 1
                  WHEN deadline_date >= $1::date THEN 0
                  ELSE 1
                END,
                deadline_date ASC NULLS LAST,
                source_published_at DESC NULLS LAST,
                title ASC`,
      [today],
    ),
    query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE deadline_date IS NULL OR deadline_date >= $1::date)::int AS open,
              COUNT(*) FILTER (WHERE deadline_date >= $1::date AND deadline_date <= $1::date + 7)::int AS closing,
              COUNT(DISTINCT country_code)::int AS countries,
              COUNT(DISTINCT source_post_id)::int AS editions,
              COUNT(*) FILTER (WHERE deadline_date < $1::date)::int AS closed
       FROM jobs`,
      [today],
    ),
    query(
      `SELECT source_post_id, source_post_title, source_post_url, source_published_at, COUNT(*)::int AS jobs
       FROM jobs
       WHERE source_post_id IS NOT NULL
       GROUP BY source_post_id, source_post_title, source_post_url, source_published_at
       ORDER BY source_published_at DESC
       LIMIT 1`,
    ),
    getLastSync(),
    query(
      `SELECT id, finished_at, duration_ms, posts_scanned, jobs_found, inserted, updated, duplicates_skipped
       FROM sync_runs WHERE status = 'success'
       ORDER BY finished_at DESC NULLS LAST LIMIT 1`,
    ),
  ]);

  const jobs = jobsResult.rows.map((job) => {
    const status = deadlineStatus(job, today);
    return {
      ...job,
      status,
      statusLabel: status === 'closed'
        ? 'Closed'
        : status === 'today'
          ? 'Closes today'
          : status === 'soon'
            ? 'Closing soon'
            : status === 'rolling'
              ? 'Rolling'
              : 'Open',
      categoryClass: CATEGORY_CLASS[job.category] || 'other',
      deadlineLabel: deadlineLabel(job, today),
      deadlineRelative: relativeDeadline(job, today),
      salaryShort: salaryShort(job),
      searchText: [
        job.title,
        job.agency,
        job.agency_short,
        job.location_city,
        job.location_country,
        job.grade,
        job.contract_type,
        job.category,
      ].join(' ').toLowerCase(),
    };
  });

  const stats = statsResult.rows[0];
  const latestEdition = editionResult.rows[0] || null;
  const lastSync = lastSyncResult;
  const lastSuccess = lastSuccessResult.rows[0] || null;
  const schedule = getScheduleInfo();

  const categoryCounts = {
    all: jobs.length,
    contract: jobs.filter((job) => job.category === 'Contract Agents').length,
    assistant: jobs.filter((job) => job.category === 'Assistants').length,
    administrator: jobs.filter((job) => job.category === 'Administrators').length,
  };

  const latestCategoryCounts = latestEdition
    ? {
      contract: jobs.filter((job) => job.source_post_id === latestEdition.source_post_id && job.category === 'Contract Agents').length,
      assistant: jobs.filter((job) => job.source_post_id === latestEdition.source_post_id && job.category === 'Assistants').length,
      administrator: jobs.filter((job) => job.source_post_id === latestEdition.source_post_id && job.category === 'Administrators').length,
    }
    : { contract: 0, assistant: 0, administrator: 0 };

  const locations = [...new Map(
    jobs
      .filter((job) => job.location_country)
      .map((job) => [job.location_country, { country: job.location_country, code: job.country_code, flag: job.flag }]),
  ).values()].sort((a, b) => a.country.localeCompare(b.country));

  const liveJobs = jobs.filter((job) => job.status !== 'closed');
  const categoryOpenCounts = {
    all: liveJobs.length,
    contract: liveJobs.filter((job) => job.category === 'Contract Agents').length,
    assistant: liveJobs.filter((job) => job.category === 'Assistants').length,
    administrator: liveJobs.filter((job) => job.category === 'Administrators').length,
  };
  const latestId = latestEdition ? String(latestEdition.source_post_id) : '';
  const featuredJobs = liveJobs
    .filter((job) => latestId && String(job.source_post_id) === latestId)
    .slice(0, 3);
  for (const job of liveJobs) {
    if (featuredJobs.length >= 3) break;
    if (!featuredJobs.includes(job)) featuredJobs.push(job);
  }

  const checkDate = lastSuccess?.finished_at ? new Date(lastSuccess.finished_at) : null;
  const lastCheckDay = checkDate
    ? new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: '2-digit' }).format(checkDate)
    : '—';
  const lastCheckMonth = checkDate
    ? new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, month: 'short', year: 'numeric' }).format(checkDate)
    : 'not yet';

  return {
    today,
    jobs,
    featuredJobs: featuredJobs.slice(0, 3),
    lastCheckDay,
    lastCheckMonth,
    stats,
    latestEdition,
    lastSync,
    lastSuccess,
    schedule,
    categoryCounts,
    categoryOpenCounts,
    latestCategoryCounts,
    locations,
    formatSyncTime,
    formatEditionDate,
    safeJson,
    categoryClass: CATEGORY_CLASS,
  };
}

app.get('/', async (req, res, next) => {
  try {
    const data = await loadSiteData();
    res.render('index', {
      ...data,
      pageTitle: 'EU EMPLOYMENT — The Vacancy Register',
      pageDescription: 'A source-linked, deduplicated register of EU institution and agency vacancies, checked every morning at 09:00 Europe/London.',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/healthz', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get('/api/jobs', async (req, res, next) => {
  try {
    const data = await loadSiteData();
    res.json({
      updatedAt: new Date().toISOString(),
      stats: data.stats,
      latestEdition: data.latestEdition,
      lastSync: data.lastSync,
      nextSync: data.schedule.nextRun,
      count: data.jobs.length,
      jobs: data.jobs,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/sync', async (req, res, next) => {
  try {
    const data = await loadSiteData();
    res.json({
      lastSync: data.lastSync,
      lastSuccess: data.lastSuccess,
      nextRun: data.schedule.nextRun,
      schedule: { expression: data.schedule.expression, timezone: data.schedule.timezone },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/sync', async (req, res, next) => {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    res.status(404).json({ error: 'Manual sync endpoint is disabled. Set SYNC_SECRET to enable it.' });
    return;
  }
  const authorization = req.get('authorization') || '';
  if (authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const result = await runSync({ trigger: 'manual' });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).render('404', { pageTitle: 'Page not found — EU EMPLOYMENT' });
});

app.use((error, req, res, next) => {
  console.error('[server]', error);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(500).render('error', {
    pageTitle: 'Wire interrupted — EU EMPLOYMENT',
    message: isProduction ? 'The vacancy desk could not reach its database. Please try again shortly.' : error.message,
  });
});

async function boot() {
  await initDb();
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM jobs');
  const lastSuccess = await query(
    "SELECT finished_at FROM sync_runs WHERE status = 'success' ORDER BY finished_at DESC NULLS LAST LIMIT 1",
  );
  const lastFinished = lastSuccess.rows[0]?.finished_at ? new Date(lastSuccess.rows[0].finished_at).getTime() : 0;
  const stale = !lastFinished || Date.now() - lastFinished > 20 * 60 * 60 * 1000;

  startScheduler();

  if (rows[0].count === 0 || stale) {
    console.log('[boot] vacancy ledger is empty or stale; starting a sync');
    runSync({ trigger: 'startup' }).catch((error) => console.error('[boot] initial sync failed', error));
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] The Vacancy Desk listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] daily sync ${getScheduleInfo().expression} ${getScheduleInfo().timezone}`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received; shutting down`);
    server.close(async () => {
      const { closeDb } = require('./src/db');
      await closeDb().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch(async (error) => {
  console.error('[boot] fatal', error);
  await getPool().end().catch(() => {});
  process.exit(1);
});
