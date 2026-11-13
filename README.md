# Voyage Fare

*See your whole trip, and know exactly what it really costs.*

A trip planner built around the budget. It replaces the paper notebook, not the itinerary app:
compare options by category, follow your coup de cœur, and always know what the trip costs —
per person, confirmed or still estimated, and who paid what.

**Status:** in the making. Accounts, creating a trip, places, items, tickets with their legs, the
always-visible budget bar, and changing or deleting anything work today (build 2, done 13 Nov 2026).
Next: comparing options, statuses and currencies. First usable version planned for 15 December 2026,
V1 for 31 January 2027.

## Stack

- React + TypeScript (Vite), React Router
- Supabase (Postgres, auth, row-level security) — budget and split rules live in the database
- Vitest + Testing Library; PGlite (Postgres in memory) for the database tests
- Look: "illustrated carnet" — hand-drawn cards (roughjs), pen-and-wash sketches, Lora + Inter + Caveat

## Run it

```bash
cp .env.example .env.local   # then fill in the Supabase project URL and publishable key
npm install
npm run dev
```

```bash
npm test        # database rules + screens
npm run lint
npm run build
```

The same three checks run on GitHub on every push (`.github/workflows/checks.yml`). They need no
secrets: the database tests use an in-memory Postgres, the screen tests a fake Supabase.

## The budget engine

Every budget and split calculation lives in the database (`supabase/migrations/`), not in the
interface, so a number is computed in one place only. The rules come from the product spec:

- only the chosen option of an item counts;
- *confirmed* means booked or paid **and** an actual amount — everything else is *still estimated*;
- a missing amount stays empty (shown as a dash), it is never turned into 0;
- items are split equally by default, or "split between…" some travellers, per item or per day
  (a birthday day offered by the others), and housing can be split by room;
- a ticket is one item with one price and 1 or 2 legs: a round trip is counted once;
- who paid what gives each traveller a balance, settled in at most *travellers − 1* payments.

Every change made from the app is one step in the database (create a trip with its travellers,
add an item with its price, a ticket with its legs, delete a place with its items): all or nothing.

`tests/db/` runs these rules against a real Postgres in memory (PGlite) on a small made-up trip
whose expected numbers were worked out by hand. It also checks privacy: a trip is visible only to
its members, nobody else can change it, and the demo trip is public but read-only.

## Layout

- `src/pages/` — the screens (sign in, your trips, new trip, a trip)
- `src/components/` — interface pieces (hand-drawn card, budget bar, item and ticket forms…)
- `src/lib/` — logic without screens: money (formatting and reading amounts), what the trip view
  shows, the queries to the database, the database types
- `src/styles/tokens.css` — the "Carnet" palette, fonts and spacing
- `public/illustrations/` — the sketches and the hand-drawn compass
- `supabase/migrations/` — tables, budget engine, privacy rules, the one-step changes
- `tests/db/` — tests of the budget, split, privacy and change rules
- `design/` — mockups and the original illustrations
