'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePost,
  parseDeadline,
  parseContract,
  parseLocation,
  fingerprintFor,
} = require('../src/parser');

test('deadline parsing keeps the source year and rolls forward when needed', () => {
  const postDate = new Date('2026-10-24T19:31:50Z');
  assert.equal(parseDeadline('26 October', postDate).date, '2026-10-26');
  assert.equal(parseDeadline('4 November (14:00 Ljubljana time)', postDate).date, '2026-11-04');
  assert.equal(parseDeadline('30 September 2026.', postDate).date, '2026-09-30');
  assert.equal(parseDeadline('5 January', new Date('2026-12-30T10:00:00Z')).date, '2027-01-05');
  assert.equal(parseDeadline('Open until filled', postDate).date, null);
});

test('contract and grade extraction handles contract agents, assistants and administrators', () => {
  const contractAgent = parseContract('Expert – Cloud Solutions (Contract Agent FG IV)', '', '');
  assert.equal(contractAgent.category, 'Contract Agents');
  assert.equal(contractAgent.contractType, 'Contract Agent');
  assert.equal(contractAgent.grade, 'FG IV');

  const assistant = parseContract('Operational Specialist (Assistant AST 4)', '', '');
  assert.equal(assistant.category, 'Assistants');
  assert.equal(assistant.contractType, 'Assistant');
  assert.equal(assistant.grade, 'AST 4');

  const temporary = parseContract('Administrative Assistant | TEMPORARY AGENT AST/SC 2 | ELA', '', '');
  assert.equal(temporary.category, 'Assistants');
  assert.equal(temporary.contractType, 'Temporary Agent');
  assert.equal(temporary.grade, 'AST/SC 2');

  const administrator = parseContract('IT Service Officer – Demand Management (AD 5 – AD 7)', '', '');
  assert.equal(administrator.category, 'Administrators');
  assert.equal(administrator.contractType, 'Administrator');
  assert.equal(administrator.grade, 'AD 5–7');
});

test('location parsing normalises city names and country codes', () => {
  assert.deepEqual(parseLocation('Copenhagen, Denmark', null), {
    city: 'Copenhagen',
    country: 'Denmark',
    code: 'DK',
  });
  assert.deepEqual(parseLocation('The Hague', null), {
    city: 'The Hague',
    country: 'Netherlands',
    code: 'NL',
  });
  assert.deepEqual(parseLocation('Frankfurt am Main', null), {
    city: 'Frankfurt',
    country: 'Germany',
    code: 'DE',
  });
});

test('roundup post is split into jobs with metadata, chips and apply links', () => {
  const html = `
    <p>Intro copy that should not become a vacancy.</p>
    <h2>Contract Agents (FG III – FG IV)</h2>
    <h3>🇩🇰 Expert – Cloud Solutions (Contract Agent FG IV)</h3>
    <p><strong>Agency:</strong> European Environment Agency (EEA)</p>
    <p><strong>Location:</strong> Copenhagen, Denmark</p>
    <p><strong>Deadline:</strong> 26 October</p>
    <p><strong>Indefinite Contract Possibility:</strong> ✅ Yes</p>
    <p>Single local: ~€4,750 | ~€5,290</p>
    <p>👉 <a href="https://jobs.eea.europa.eu/jobs/expert-cloud-solutions-141">View Details &amp; Apply at EEA</a></p>
    <h2>Assistants (AST 1 – AST 4)</h2>
    <h3>🇸🇰 Operational Specialist (Assistant AST 4)</h3>
    <p>Deadline: 30 October | Place of employment: Bratislava<br>Single local: ~EUR 3,710<br>Indefinite contract possibility: ✅<br>Apply: <a href="https://agencies-network.europa.eu/operational-specialist-elaast202610">Apply</a></p>
  `;
  const jobs = parsePost({
    id: 123,
    date: '2026-10-24T19:31:50',
    link: 'https://euemployment.eu/example/',
    title: { rendered: 'Example roundup' },
    content: { rendered: html },
  });

  assert.equal(jobs.length, 2);
  const [cloud, operational] = jobs;
  assert.equal(cloud.title, 'Expert – Cloud Solutions');
  assert.equal(cloud.agencyShort, 'EEA');
  assert.equal(cloud.locationCity, 'Copenhagen');
  assert.equal(cloud.countryCode, 'DK');
  assert.equal(cloud.deadlineDate, '2026-10-26');
  assert.equal(cloud.grade, 'FG IV');
  assert.equal(cloud.category, 'Contract Agents');
  assert.equal(cloud.indefiniteContract, true);
  assert.match(cloud.applyUrl, /jobs\.eea\.europa\.eu/);
  assert.match(cloud.salarySummary, /€4,750–€5,290/);

  assert.equal(operational.category, 'Assistants');
  assert.equal(operational.grade, 'AST 4');
  assert.equal(operational.locationCity, 'Bratislava');
  assert.equal(operational.countryCode, 'SK');
  assert.match(operational.applyUrl, /agencies-network\.europa\.eu/);
  assert.ok(operational.fingerprint);
  assert.ok(operational.contentHash);
});

test('fingerprints collapse a job repeated with a fuller duty-station label', () => {
  const base = {
    title: 'Expert on Consumer Protection',
    agency: 'European Insurance and Occupational Pensions Authority',
    locationCountry: 'Germany',
    grade: 'AD 6',
  };
  const short = fingerprintFor({ ...base, locationCity: 'Frankfurt' });
  const long = fingerprintFor({ ...base, locationCity: 'Frankfurt am Main' });
  assert.equal(short, long);
});
