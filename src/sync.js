'use strict';

const { load } = require('cheerio');
const { getPool, query } = require('./db');
const { parsePost, cleanText } = require('./parser');

const CATEGORY_URL = process.env.EU_CATEGORY_URL || 'https://euemployment.eu/category/vacancies/';
const CATEGORY_ID = process.env.EU_CATEGORY_ID || '749';
const API_URL = process.env.EU_API_URL || 'https://euemployment.eu/wp-json/wp/v2/posts';
const SYNC_LOCK_ID = 748_397_001;

const FETCH_HEADERS = {
  'user-agent': 'EUEmploymentVacancyDesk/1.0 (+https://euemployment.eu/category/vacancies/)',
  accept: 'application/json, text/html;q=0.9',
};

let inFlight = null;

async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const response = await fetch(url, {
    ...options,
    headers: { ...FETCH_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response;
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
  return response.json();
}

function normalisePost(post) {
  if (!post || !post.id || !post.date || !post.content) return null;
  return {
    id: Number(post.id),
    date: post.date,
    modified: post.modified || post.date,
    slug: post.slug || '',
    link: post.link || '',
    title: post.title,
    content: post.content,
  };
}

async function fetchViaCategoryPage() {
  const response = await fetchWithTimeout(CATEGORY_URL, { headers: { accept: 'text/html' } }, 30_000);
  const html = await response.text();
  const $ = load(html);
  const links = [];
  $('article a[href], h2 a[href], h3 a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href') || '';
    if (!/^https:\/\/euemployment\.eu\/[a-z0-9-]+\/?$/i.test(href)) return;
    if (/\/category\/|\/tag\/|\/author\//i.test(href)) return;
    if (!links.includes(href)) links.push(href);
  });

  const posts = [];
  for (const link of links.slice(0, 12)) {
    try {
      const postResponse = await fetchWithTimeout(link, { headers: { accept: 'text/html' } }, 30_000);
      const postHtml = await postResponse.text();
      const $post = load(postHtml);
      const title = cleanText($post('h1').first().text() || $post('title').text());
      const contentEl = $post('.entry-content').first();
      if (!contentEl.length || !title) continue;
      const date = $post('time[datetime]').first().attr('datetime')
        || $post('meta[property="article:published_time"]').attr('content')
        || new Date().toISOString();
      const slug = link.replace(/\/$/, '').split('/').pop();
      posts.push({
        id: Math.abs([...slug].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)),
        date,
        modified: date,
        slug,
        link,
        title: { rendered: title },
        content: { rendered: contentEl.html() || '' },
      });
    } catch (error) {
      console.warn(`[sync] fallback could not read ${link}: ${error.message}`);
    }
  }
  return posts;
}

async function fetchVacancyPosts() {
  const url = new URL(API_URL);
  url.searchParams.set('categories', CATEGORY_ID);
  url.searchParams.set('per_page', process.env.EU_POSTS_PER_PAGE || '30');
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('_fields', 'id,date,modified,slug,link,title,content,excerpt');

  try {
    const payload = await fetchJson(url);
    if (!Array.isArray(payload)) throw new Error('Unexpected WordPress API response');
    return payload.map(normalisePost).filter(Boolean);
  } catch (error) {
    console.warn(`[sync] WordPress API unavailable (${error.message}); trying category page`);
    const posts = await fetchViaCategoryPage();
    if (!posts.length) throw new Error('No vacancy posts could be loaded from either source');
    return posts;
  }
}

function toRow(job) {
  return {
    fingerprint: job.fingerprint,
    contentHash: job.contentHash,
    title: job.title,
    agency: job.agency,
    agencyShort: job.agencyShort,
    locationCity: job.locationCity,
    locationCountry: job.locationCountry,
    countryCode: job.countryCode,
    flag: job.flag,
    contractType: job.contractType,
    grade: job.grade,
    category: job.category,
    salarySummary: job.salarySummary,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    deadlineDate: job.deadlineDate,
    deadlineText: job.deadlineText,
    indefiniteContract: job.indefiniteContract,
    applyUrl: job.applyUrl,
    sourcePostId: job.sourcePostId,
    sourcePostTitle: job.sourcePostTitle,
    sourcePostUrl: job.sourcePostUrl,
    sourcePublishedAt: job.sourcePublishedAt,
  };
}

const UPSERT_SQL = `
  INSERT INTO jobs (
    fingerprint, content_hash, title, agency, agency_short, location_city, location_country,
    country_code, flag, contract_type, grade, category, salary_summary, salary_min, salary_max,
    deadline_date, deadline_text, indefinite_contract, apply_url, source_post_id, source_post_title,
    source_post_url, source_published_at, edition_ids, raw
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21, $22, $23, ARRAY[$20]::bigint[], $24::jsonb
  )
  ON CONFLICT (fingerprint) DO UPDATE SET
    content_hash = EXCLUDED.content_hash,
    title = EXCLUDED.title,
    agency = EXCLUDED.agency,
    agency_short = EXCLUDED.agency_short,
    location_city = EXCLUDED.location_city,
    location_country = EXCLUDED.location_country,
    country_code = EXCLUDED.country_code,
    flag = EXCLUDED.flag,
    contract_type = EXCLUDED.contract_type,
    grade = EXCLUDED.grade,
    category = EXCLUDED.category,
    salary_summary = EXCLUDED.salary_summary,
    salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max,
    deadline_date = EXCLUDED.deadline_date,
    deadline_text = EXCLUDED.deadline_text,
    indefinite_contract = EXCLUDED.indefinite_contract,
    apply_url = EXCLUDED.apply_url,
    source_post_id = EXCLUDED.source_post_id,
    source_post_title = EXCLUDED.source_post_title,
    source_post_url = EXCLUDED.source_post_url,
    source_published_at = EXCLUDED.source_published_at,
    edition_ids = CASE
      WHEN EXCLUDED.source_post_id = ANY(jobs.edition_ids) THEN jobs.edition_ids
      ELSE array_append(jobs.edition_ids, EXCLUDED.source_post_id)
    END,
    times_seen = CASE
      WHEN EXCLUDED.source_post_id = ANY(jobs.edition_ids) THEN jobs.times_seen
      ELSE jobs.times_seen + 1
    END,
    last_seen_at = now(),
    raw = EXCLUDED.raw
  WHERE EXCLUDED.source_published_at >= jobs.source_published_at
`;

async function upsertJob(job) {
  const row = toRow(job);
  await query(UPSERT_SQL, [
    row.fingerprint,
    row.contentHash,
    row.title,
    row.agency,
    row.agencyShort,
    row.locationCity,
    row.locationCountry,
    row.countryCode,
    row.flag,
    row.contractType,
    row.grade,
    row.category,
    row.salarySummary,
    row.salaryMin,
    row.salaryMax,
    row.deadlineDate,
    row.deadlineText,
    row.indefiniteContract,
    row.applyUrl,
    row.sourcePostId,
    row.sourcePostTitle,
    row.sourcePostUrl,
    row.sourcePublishedAt,
    JSON.stringify(row),
  ]);
}

async function touchJob(fingerprint) {
  await query('UPDATE jobs SET last_seen_at = now() WHERE fingerprint = $1', [fingerprint]);
}

async function recordEdition(job) {
  await query(
    `UPDATE jobs SET
       edition_ids = CASE
         WHEN $2::bigint = ANY(edition_ids) THEN edition_ids
         ELSE array_append(edition_ids, $2::bigint)
       END,
       times_seen = CASE
         WHEN $2::bigint = ANY(edition_ids) THEN times_seen
         ELSE times_seen + 1
       END,
       source_post_id = CASE
         WHEN source_published_at IS NULL OR source_published_at <= $5::timestamptz THEN $2::bigint
         ELSE source_post_id
       END,
       source_post_title = CASE
         WHEN source_published_at IS NULL OR source_published_at <= $5::timestamptz THEN $3
         ELSE source_post_title
       END,
       source_post_url = CASE
         WHEN source_published_at IS NULL OR source_published_at <= $5::timestamptz THEN $4
         ELSE source_post_url
       END,
       source_published_at = CASE
         WHEN source_published_at IS NULL OR source_published_at <= $5::timestamptz THEN $5::timestamptz
         ELSE source_published_at
       END,
       last_seen_at = now()
     WHERE fingerprint = $1`,
    [job.fingerprint, job.sourcePostId, job.sourcePostTitle, job.sourcePostUrl, job.sourcePublishedAt],
  );
}

async function runSync({ trigger = 'manual' } = {}) {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const startedAt = Date.now();
    const lockClient = await getPool().connect();
    let runId = null;
    let lockHeld = false;
    try {
      const lockResult = await lockClient.query('SELECT pg_try_advisory_lock($1) AS locked', [SYNC_LOCK_ID]);
      lockHeld = Boolean(lockResult.rows[0]?.locked);
      if (!lockHeld) {
        return { status: 'busy', message: 'Another sync is already running.' };
      }

      const runResult = await lockClient.query(
        "INSERT INTO sync_runs (trigger, status) VALUES ($1, 'running') RETURNING id",
        [trigger],
      );
      runId = runResult.rows[0].id;

      const posts = await fetchVacancyPosts();
      const parsed = [];
      const postSummaries = [];

      for (const post of posts) {
        const jobs = parsePost(post);
        postSummaries.push({
          id: post.id,
          date: post.date,
          title: cleanText(post.title?.rendered || post.title || ''),
          jobs: jobs.length,
        });
        for (const job of jobs) parsed.push(job);
      }

      // Oldest occurrence first, so the newest edition wins on upsert.
      parsed.sort((a, b) => new Date(a.sourcePublishedAt) - new Date(b.sourcePublishedAt));

      const uniqueFingerprints = [...new Set(parsed.map((job) => job.fingerprint))];
      const existingResult = uniqueFingerprints.length
        ? await query(
          'SELECT fingerprint, content_hash, source_published_at FROM jobs WHERE fingerprint = ANY($1::text[])',
          [uniqueFingerprints],
        )
        : { rows: [] };
      const existing = new Map(existingResult.rows.map((row) => [row.fingerprint, row]));

      let inserted = 0;
      let updated = 0;
      let duplicatesSkipped = 0;
      const duplicateExamples = [];

      for (const job of parsed) {
        const prior = existing.get(job.fingerprint);
        if (!prior) {
          await upsertJob(job);
          inserted += 1;
          existing.set(job.fingerprint, {
            fingerprint: job.fingerprint,
            content_hash: job.contentHash,
            source_published_at: job.sourcePublishedAt,
          });
          continue;
        }

        const priorDate = prior.source_published_at ? new Date(prior.source_published_at).toISOString() : '';
        const incomingIsNewer = !priorDate || new Date(job.sourcePublishedAt) >= new Date(priorDate);

        if (!incomingIsNewer) {
          await touchJob(job.fingerprint);
          duplicatesSkipped += 1;
          continue;
        }

        if (prior.content_hash === job.contentHash) {
          // Record the edition without inflating the count on repeated syncs.
          await recordEdition(job);
          duplicatesSkipped += 1;
          if (duplicateExamples.length < 8) {
            duplicateExamples.push({ title: job.title, agency: job.agencyShort, edition: job.sourcePublishedAt.slice(0, 10) });
          }
          existing.set(job.fingerprint, {
            fingerprint: job.fingerprint,
            content_hash: job.contentHash,
            source_published_at: job.sourcePublishedAt,
          });
        } else {
          await upsertJob(job);
          updated += 1;
          existing.set(job.fingerprint, {
            fingerprint: job.fingerprint,
            content_hash: job.contentHash,
            source_published_at: job.sourcePublishedAt,
          });
        }
      }

      const durationMs = Date.now() - startedAt;
      const meta = {
        uniqueJobs: uniqueFingerprints.length,
        posts: postSummaries,
        duplicateExamples,
      };

      await query(
        `UPDATE sync_runs SET status = 'success', finished_at = now(), duration_ms = $2,
          posts_scanned = $3, jobs_found = $4, inserted = $5, updated = $6,
          duplicates_skipped = $7, meta = $8::jsonb
         WHERE id = $1`,
        [runId, durationMs, posts.length, parsed.length, inserted, updated, duplicatesSkipped, JSON.stringify(meta)],
      );

      const summary = {
        status: 'success',
        runId,
        postsScanned: posts.length,
        jobsFound: parsed.length,
        uniqueJobs: uniqueFingerprints.length,
        inserted,
        updated,
        duplicatesSkipped,
        durationMs,
      };
      console.log('[sync]', summary);
      return summary;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      console.error('[sync] failed', error);
      if (runId) {
        await query(
          `UPDATE sync_runs SET status = 'failed', finished_at = now(), duration_ms = $2, error = $3
           WHERE id = $1`,
          [runId, durationMs, String(error.message || error).slice(0, 2000)],
        ).catch(() => {});
      }
      throw error;
    } finally {
      if (lockHeld) {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [SYNC_LOCK_ID]).catch(() => {});
      }
      lockClient.release();
      inFlight = null;
    }
  })();

  return inFlight;
}

async function getLastSync() {
  const result = await query(
    `SELECT id, trigger, status, started_at, finished_at, duration_ms, posts_scanned, jobs_found,
            inserted, updated, duplicates_skipped, error
     FROM sync_runs
     ORDER BY started_at DESC
     LIMIT 1`,
  );
  return result.rows[0] || null;
}

module.exports = { runSync, fetchVacancyPosts, getLastSync, CATEGORY_URL };
