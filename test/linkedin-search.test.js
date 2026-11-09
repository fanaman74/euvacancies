'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchParams, parseJobs } = require('../src/linkedin-search');

test('LinkedIn filters are constrained and correctly encoded', () => {
  const { params, start, limit } = searchParams({ keywords: 'analyst & policy', location: 'Brussels', seconds: '900', sortBy: 'DD', workType: '2', expLevel: '1,4,bad', easyApply: 'true', start: '-1', limit: '999' });
  assert.equal(params.get('keywords'), 'analyst & policy');
  assert.equal(params.get('f_TPR'), 'r900');
  assert.equal(params.get('f_E'), '1,4');
  assert.equal(params.get('f_WT'), '2');
  assert.equal(params.get('f_AL'), 'true');
  assert.equal(start, 0); assert.equal(limit, 60);
});

test('guest cards decode text and accept only LinkedIn job links', () => {
  const html = `<li><div data-entity-urn="urn:li:jobPosting:123"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/a-123?track=1"></a><h3 class="base-search-card__title">Research &amp; policy</h3><h4 class="base-search-card__subtitle">Agency</h4><span class="job-search-card__location">Brussels</span><time datetime="2026-11-09">1 hour ago</time></div></li><li><a class="base-card__full-link" href="https://evil.example/jobs/view/123"></a><h3 class="base-search-card__title">Invalid</h3></li>`;
  const jobs = parseJobs(html);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].title, 'Research & policy');
  assert.equal(jobs[0].link, 'https://www.linkedin.com/jobs/view/a-123');
  assert.equal(jobs[0].company, 'Agency'); assert.equal(jobs[0].location, 'Brussels');
});
