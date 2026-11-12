# Voyage Fare

*See your whole trip, and know exactly what it really costs.*

A trip planner built around the budget. It replaces the paper notebook, not the itinerary app:
compare options by category, follow your coup de cœur, and always know what the trip costs —
per person, confirmed or still estimated, and who paid what.

**Status:** in the making. First usable version planned for 15 December 2026, V1 for 31 January 2027.

## Stack

- React + TypeScript (Vite)
- Supabase (Postgres, auth, row-level security) — budget and split rules live in the database
- Vitest + Testing Library

## Run it

```bash
npm install
npm run dev
```

```bash
npm test
```

## The budget engine

Every budget and split calculation lives in the database (`supabase/migrations/`), not in the
interface, so a number is computed in one place only. The rules come from the product spec:

- only the chosen option of an item counts;
- *confirmed* means booked or paid **and** an actual amount — everything else is *still estimated*;
- a missing amount stays empty (shown as a dash), it is never turned into 0;
- items are split equally by default, or "split between…" some travellers, per item or per day
  (a birthday day offered by the others), and housing can be split by room;
- who paid what gives each traveller a balance, settled in at most *travellers − 1* payments.

`tests/db/` runs these rules against a real Postgres in memory (PGlite) on a small made-up trip
whose expected numbers were worked out by hand. It also checks privacy: a trip is visible only to
its members, and the demo trip is public but read-only.

## Layout

- `src/styles/tokens.css` — the "Carnet" palette, fonts and spacing
- `src/lib/` — pure logic (money formatting, later the client for the database)
- `src/components/` — interface pieces
- `supabase/migrations/` — tables, budget engine, privacy rules
- `tests/db/` — tests of the budget, split and privacy rules
