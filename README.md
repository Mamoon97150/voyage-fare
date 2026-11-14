# Voyage Fare

_See your whole trip, and know exactly what it really costs._

A trip planner built around the budget, for the organizer of a group trip (2–6 people, several
stops). It replaces the notebook or spreadsheet next to the itinerary app, not the itinerary app:
compare options, follow your coup de cœur, and always know what the trip costs — per person,
**confirmed or still estimated** — and who owes whom.

**Status:** V1 in the making. Builds 0–6 done (14 Nov 2026); build 7 (ready to go online) next;
V1 with testers planned for 15 January 2027. A real trip (Colombia & Panama, 4 travellers) was
rebuilt in it and reconciles to the cent with the bank statement.

## What it does

- **Your trips → a trip**: places as numbered sheets, day by day, tickets between places, and the
  budget always visible on top (your share or the whole trip).
- **Compare**: options per decision (stays, flights, activities, food), cheapest / fastest, coup de
  cœur, statuses chosen → booked → paid, prices in any currency with the rate saved.
- **Budget and Who paid**: by category, by place, everyone's share; balances and the fewest
  payments to settle up; what's left to pay, soonest first.
- **Split rules**: equal by default, "who it's for" per line, a day offered by the others, a stay
  split by room, "each paid their own share".
- **Build 6**: invitations by link (tied to a traveller), daily estimates (~30 € a day each), a
  route map, agency packages (one line that covers flights and hotels), payments in parts
  (deposit, balance, instalments, reminders).

## Decisions that shape the code

- **Every number is computed in the database** (`supabase/migrations/`), never in the interface:
  one place, one answer, tested.
- _Confirmed_ = booked or paid **and** a real amount; everything else is _still estimated_. A
  missing amount is a dash, never 0.
- A booked line counts at its full price: paying it in parts changes what's left, not the budget.
- Privacy by row-level security: a trip is visible only to its members; the demo trip is public
  and read-only; invitations are links tied to a traveller.
- Look "illustrated carnet": hand-drawn cards (roughjs), Lora + Inter + Caveat, the "Carnet"
  palette. Every colour, text size and radius is a variable in `src/styles/tokens.css`. Rules:
  one piece of tape per screen, no side bars, red only for over budget.

## Stack

- React 19 + TypeScript (Vite), React Router — a single-page app
- Supabase (Postgres, auth, row-level security)
- Leaflet + OpenStreetMap for the route map
- Vitest + Testing Library; PGlite (Postgres in memory) for the database tests

## Run it

```bash
cp .env.example .env.local   # then fill in the Supabase project URL and publishable key
npm install
npm run dev
```

```bash
npm test             # database rules + screens (~340 tests)
npm run lint
npm run build
npm run test:smoke   # the app's real queries against the Supabase project, as the demo user
npm run types        # after a migration: regenerate src/lib/database.types.ts from Supabase
```

Tests, lint and build run on GitHub on every push (`.github/workflows/checks.yml`) with no
secrets. The smoke test needs `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` in `.env.local`, creates a
trip, goes through every kind of change, then deletes what it made.

## Layout

- `src/pages/` — the screens; their tests sit next to them (`*.test.tsx`, one file per feature)
- `src/components/` — interface pieces; `trip/`, `compare/`, `settings/` group them by screen
- `src/lib/` — logic without screens: money, what each screen shows (`tripView`, `moneyPages`,
  `options`, `route`), `useTrip`; `lib/data/` the queries, one file per area, re-exported by
  `lib/trips.ts`; `database.types.ts` is generated
- `src/styles/` — `tokens.css` (palette, type, spacing, radii), then one file per area, loaded in
  order by `src/index.css`
- `src/test/` — fakes and helpers for the screen tests
- `supabase/migrations/` — tables, budget engine, privacy rules, one-step changes
- `tests/db/` — budget, split, payments, privacy rules on a small made-up trip worked out by hand;
  `tests/smoke/` — real queries; `tests/seed/` — the Colombia trip
- `design/mockups/` — every mockup, newest first in `index.html`
