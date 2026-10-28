# EU EMPLOYMENT — The Vacancy Register

A source-first, deduplicated register of EU institution and agency vacancies, synced from
[euemployment.eu/category/vacancies](https://euemployment.eu/category/vacancies/) every
morning at **09:00 Europe/London**.

The interface is an evidence-file editorial system — warm paper, near-black ink, hot pink,
archival rules, case-file typography and direct source links — redesigned in the visual
language of [eujust.online](https://www.eujust.online/).

**Live site:** https://the-vacancy-desk-production.up.railway.app  
**Railway project:** https://railway.com/project/dcef819b-6f0a-4b5e-8c13-69301eb1d1af

## What it does

- Loads the eight most recent vacancy roundups from the public WordPress REST API.
- Splits weekly roundups into individual jobs (contract agents, assistants, administrators).
- Extracts agency, duty station, country, grade, contract type, salary, deadline, contract
  possibility and the direct agency application link.
- Stores everything in PostgreSQL.
- Fingerprints each role from **title + agency + duty station + grade**. A role repeated in
  four weekly roundups becomes one row, not four. Rows record the source editions they
  appeared in and the last time they were seen.
- Serves a responsive, filterable vacancy register and JSON API. All roles are paginated
  10 per page; closed roles stay in the ledger for reference and are shown with a closed status.
- Presents four source-linked category doors, a case-file table, a latest-files docket and a
  plain-language method note. The visual world is documented in [DESIGN.md](DESIGN.md).

## Stack

| Layer | Choice |
| --- | --- |
| Web | Node.js 20+, Express 5, EJS |
| Database | PostgreSQL (`pg`) |
| Scraper | Built-in `fetch`, Cheerio, WordPress REST API with category-page HTML fallback |
| Scheduler | `node-cron`, pinned to `Europe/London` |
| Styling | Hand-written CSS, no build step |
| Host | Railway (Railpack) + Railway Postgres |

## Local development

Requirements: Node.js 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env    # point DATABASE_URL at your Postgres
npm run db:init
npm run sync            # import the current roundups
npm run dev             # http://localhost:3000 (or PORT from .env)
```

Useful commands:

```bash
npm test                # parser/unit tests
npm run sync            # manual sync against the configured database
npm run db:init         # create/upgrade tables and indexes
npm start               # production start
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | PostgreSQL connection string. Railway injects this from the Postgres service. |
| `PORT` | `3000` | HTTP port. |
| `SYNC_TIMEZONE` | `Europe/London` | Timezone for the daily cron. |
| `SYNC_CRON` | `0 9 * * *` | Five-field cron expression. |
| `EU_CATEGORY_URL` | `https://euemployment.eu/category/vacancies/` | HTML fallback category page. |
| `EU_CATEGORY_ID` | `749` | WordPress category ID. |
| `EU_POSTS_PER_PAGE` | `30` | Roundups fetched per sync. |
| `SYNC_SECRET` | unset | Enables `POST /api/sync` when set. |

Railway production values used by this project:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3000
SYNC_TIMEZONE=Europe/London
SYNC_SECRET=<random secret>
```

## Deduplication

Each job receives a SHA-256 fingerprint:

```text
sha256(normalised(title) + normalised(agency) + normalised(city) + normalised(country) + normalised(grade))
```

The fingerprint is a `UNIQUE` column. On every sync:

1. All parsed rows are sorted oldest edition to newest.
2. Existing fingerprints are loaded in one query.
3. New fingerprints are inserted.
4. A repeat in a later edition updates the existing row and appends the edition ID.
5. A repeat in an older edition never overwrites newer data.
6. `times_seen` counts **distinct source editions**, not sync runs.

The last 52 unique roles came from 92 job occurrences across 8 editions; 40 repeat rows
were collapsed. Re-running the sync inserts zero new rows.

`sync_runs` keeps the audit trail: posts scanned, jobs found, inserted, updated, duplicates
skipped, duration, status and per-post counts in `meta`.

## Daily sweep

`node-cron` runs `0 9 * * *` in `Europe/London`. Railway containers run in UTC, so the
timezone is pinned explicitly. The app also runs a sync at boot if the ledger is empty or
the last successful sync is more than 20 hours old. A PostgreSQL advisory lock prevents
two overlapping syncs if the service ever runs more than one replica.

The UI shows the last successful sweep and the next scheduled run.

## Routes

| Route | Description |
| --- | --- |
| `GET /` | Vacancy ledger. |
| `GET /healthz` | Database health check. |
| `GET /api/jobs` | All jobs, stats, last sync and next run. |
| `GET /api/sync` | Sync/schedule status. |
| `POST /api/sync` | Manual sync. Requires `Authorization: Bearer $SYNC_SECRET`. |

Manual sync example:

```bash
curl -X POST https://the-vacancy-desk-production.up.railway.app/api/sync \
  -H "Authorization: Bearer $SYNC_SECRET"
```

## Railway deployment

The project is deployed as two services in one Railway project:

- `the-vacancy-desk` — this Node app
- `Postgres` — Railway PostgreSQL with a persistent volume

The app uses Railway's private network (`postgres.railway.internal`), so no public database
proxy is required. The temporary development proxy used during setup has been removed; the
database is not exposed to the internet.

To deploy a change:

```bash
railway link --project euemployment
railway service link the-vacancy-desk
railway up --detach --yes -m "Describe the change"
railway deployment list --service the-vacancy-desk --json
```

Wait for the newest deployment to reach `SUCCESS`, then verify `/healthz` and `/api/jobs`.

## Source behaviour and limits

- The parser targets the current WordPress block markup. If the source changes its layout,
  update `src/parser.js` and add a fixture test.
- Dates without a year are assigned to the edition year, rolling forward to the next year
  when the deadline is clearly in the past.
- Salaries are the source's estimated net monthly figures. The site links to the agency's
  vacancy page for authoritative details.
- The site is independent and not affiliated with euemployment.eu or any EU institution.
  Vacancy data and application links belong to their respective sources.

# euvacancies
