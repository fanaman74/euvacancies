# Design — EU EMPLOYMENT / The Vacancy Register

<!-- impeccable:design-schema 1 -->

## World

An evidence file laid on a warm paper desk. The page behaves like a public register: ruled
edges, file numbers, taped cards, stamps, source annotations and plain-language method notes.
The reference is **eujust.online**: paper `#ece6d8`, ink `#171412`, hot pink `#ff2d7a`,
hairline rules and a hard-offset archival card system. The design is not a replica of the
reference's content or layout; it translates that material world to a vacancy register.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#ece6d8` | Page ground |
| `--paper-hi` | `#f8f2e5` | Cards, ledger sheets |
| `--paper-lo` | `#ddd4c0` | Closed / recessive fills |
| `--ink` | `#171412` | Type, rules, dark panels |
| `--pink` | `#ff2d7a` | Marker, active category, signal |
| `--pink-deep` | `#e00059` | Links, stamps, small text on paper |
| `--blue` | `#2146ff` | Contract-agent data accent |
| `--lime` | `#d7ef55` | Assistant data accent |
| `--periwinkle` | `#b9c6ff` | Administrator data accent |
| `--mint` | `#b9efd2` | Open status |

Colour strategy: committed paper/ink field with one hot-pink signal. Category accents are
limited to data marks, tags and small bars so the archival world stays coherent.

## Type

- Display: **Archivo Black** — 400 weight, tight `.062em` negative tracking, 0.88 line-height.
- Body: **Archivo** — 400/700/750, 17px base.
- Data and labels: **IBM Plex Mono** — 6–9px, uppercase, tracked `.04–.14em`.
- Headline scale: hero `clamp(3.15rem, 7.35vw, 8.15rem)`; section `clamp(2.8rem, 5.3vw, 6rem)`.
- Never set body copy below 13px. Micro labels are metadata, never primary information.

## Layout

- Page wrap: `min(100%, 1480px)`, gutter `clamp(18px, 4.5vw, 72px)`.
- Fixed hairline page edges at 9px; fixed grain overlay at 16%.
- Sticky masthead, black ticker rail, 84px desktop / 68px mobile.
- Section rhythm: generous paper pauses between border-ruled field sections.
- Hero: oversized display thesis, a dotted map field, a tilted paper dossier on the right.
- Register: a full-width ledger sheet first, followed by the category doors in a 2×2 matrix.
- Docket: near-black field with three tilted case cards.
- Close: near-black CTA with a monumental statement and a circular source seal.

## Components

- **Ledger sheet** — paper-hi, 2px ink border, hard ink shadow, tape corners, inset hairline.
- **Dossier / case card** — paper-hi or pink, 2px ink border, offset pink/ink shadow, tape,
  mono top line, ruled separation, ghost numeral.
- **Category door** — 2×2 button cards, 330px min height, icon disc, outlined numeral,
  ghost abbreviation; active state is hot pink.
- **Filter bar** — paper sheet with search, square-tab filters and mono selects.
- **Table** — compact archival ledger; ink header, dashed row rules, data chips, direct apply.
- **Pagination** — ten rows per page, numbered paper tabs with a hot-pink active tab and mono arrows.
- **Chips** — rectangular, 1px ink border, uppercase mono; category fills contract pink,
  assistant lime, administrator periwinkle; status fills are semantic.
- **Seal** — circular SVG text path, used once in the close; no repeated badge clutter.

## Motion

One authored entrance: hero meta, title and body rise in sequence with a `0.8s` exponential
ease-out. Card and category hovers lift and de-rotate. The CTA seal rotates slowly. All motion
is disabled under `prefers-reduced-motion`.

## Responsive

- 1180px: masthead compresses, hero type scales, table columns tighten.
- 980px: one-column hero, category and section heads stack.
- 820px: table rows become case cards; filters stack; footer becomes two columns.
- 480px: hero first line locks to one line, category filters lose counts, footer compacts.
