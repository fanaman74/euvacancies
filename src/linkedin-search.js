'use strict';

const cheerio = require('cheerio');
const cache = new Map();
const TTL = 60_000;

function searchParams(query) {
  const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const seconds = Math.min(31_536_000, Math.max(1, Number.parseInt(query.seconds, 10) || 3600));
  const start = Math.min(990, Math.max(0, Number.parseInt(query.start, 10) || 0));
  const limit = Math.min(60, Math.max(10, Number.parseInt(query.limit, 10) || 25));
  const params = new URLSearchParams({ sortBy: query.sortBy === 'R' ? 'R' : 'DD', f_TPR: `r${seconds}` });
  const keywords = text(query.keywords), location = text(query.location);
  if (keywords) params.set('keywords', keywords);
  if (location) params.set('location', location);
  if (['1', '2', '3'].includes(query.workType)) params.set('f_WT', query.workType);
  const levels = text(query.expLevel, 20).split(',').filter(v => /^[1-6]$/.test(v));
  if (levels.length) params.set('f_E', [...new Set(levels)].join(','));
  if (query.easyApply === 'true') params.set('f_AL', 'true');
  return { params, start, limit };
}

function parseJobs(html) {
  const $ = cheerio.load(html), jobs = [];
  $('li').each((_, item) => {
    const el = $(item), title = el.find('.base-search-card__title').first().text().trim();
    const rawLink = el.find('a.base-card__full-link').first().attr('href');
    if (!title || !rawLink) return;
    let link;
    try {
      const url = new URL(rawLink, 'https://www.linkedin.com');
      if (url.protocol !== 'https:' || !/(^|\.)linkedin\.com$/.test(url.hostname) || !/^\/jobs\/view\//.test(url.pathname)) return;
      link = `https://www.linkedin.com${url.pathname}`;
    } catch { return; }
    const timeEl = el.find('time').first();
    const time = timeEl.text().trim() || 'Recently';
    jobs.push({ id: el.find('[data-entity-urn]').first().attr('data-entity-urn') || link, title,
      company: el.find('.base-search-card__subtitle').first().text().trim() || 'Not specified',
      location: el.find('.job-search-card__location').first().text().trim() || 'Not specified',
      time, datetime: timeEl.attr('datetime') || '', link, isUltraRecent: /minute|min|1 hour|2 hour/i.test(time) });
  });
  return jobs;
}

async function linkedinSearch(req, res) {
  const { params, start, limit } = searchParams(req.query);
  const directUrl = `https://www.linkedin.com/jobs/search/?${params}`;
  const key = `${params}&start=${start}&limit=${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return res.json({ ...cached.result, cached: true });
  try {
    const offsets = Array.from({ length: Math.ceil(limit / 10) }, (_, i) => start + i * 10);
    const pages = await Promise.all(offsets.map(async offset => {
      const pageParams = new URLSearchParams(params); pageParams.set('start', String(offset));
      const response = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${pageParams}`, {
        headers: { 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(12000), redirect: 'error',
      });
      if (!response.ok) throw new Error(`LinkedIn returned HTTP ${response.status}`);
      return parseJobs(await response.text());
    }));
    const seen = new Set();
    const jobs = pages.flat().filter(job => !seen.has(job.id) && seen.add(job.id)).slice(0, limit);
    const result = { success: true, jobs, count: jobs.length, directUrl, hasMore: pages.at(-1).length >= 10, cached: false };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), result });
    res.json(result);
  } catch (error) {
    console.error('[LinkedIn search]', error.message);
    res.status(502).json({ success: false, error: 'LinkedIn search is currently unavailable. Open the search on LinkedIn or try again later.', directUrl });
  }
}

module.exports = { linkedinSearch, parseJobs, searchParams };
