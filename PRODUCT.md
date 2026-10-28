# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People searching for direct-entry jobs in EU institutions and agencies — contract agents, assistants and administrators — who want the current openings without reading several weekly roundups or chasing duplicate listings.

## Product Purpose

Turn the weekly euemployment.eu vacancy roundups into one clean, searchable register. Each role is linked to the agency's own application page, with salary, grade, duty station and deadline attached. Success means a visitor can understand the current market and open the right application in seconds.

## Positioning

A deduplicated, source-linked vacancy register rather than another feed. The same role repeated across four weekly editions occupies one record, and every record points back to the agency and the edition it came from.

## Operating Context

The source publishes weekly roundups. The app checks them every morning at 09:00 Europe/London, stores all roles in PostgreSQL, and keeps closed roles for reference. Visitors usually scan by category, location or deadline, then leave the site to apply at the agency.

## Capabilities and Constraints

- Daily automated sync, manual protected sync endpoint, health endpoint and JSON API.
- Unique fingerprint per vacancy; repeated editions update one row.
- Search, category, location and status filters; deadline sorting; closing-soon states.
- Data is dependent on WordPress block markup from euemployment.eu.
- Current stack: Node.js, Express, EJS, PostgreSQL, Railway.

## Brand Commitments

The redesign is explicitly pinned to the visual language of eujust.online: warm paper, near-black ink, neon blue, hard rules, archival case-file typography and evidence-first language. Preserve the independent, source-first position.

## Evidence on Hand

Live data from eight weekly editions, currently 52 unique roles, 12 open at the time of the redesign. All facts are in the Railway PostgreSQL database. Do not invent jobs, salaries, locations or application links.

## Product Principles

- Source first: the agency's vacancy page is the authority.
- One role, one record.
- Make the deadline impossible to miss.
- Keep the interface legible before it is expressive.
- Never hide that this is an independent reading aid.

## Accessibility & Inclusion

Keyboard-operable filters and links, visible focus states, semantic table markup, responsive card fallback on small screens, and respect for reduced motion.
