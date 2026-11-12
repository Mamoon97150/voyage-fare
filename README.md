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

## Layout

- `src/styles/tokens.css` — the "Carnet" palette, fonts and spacing
- `src/lib/` — pure logic (money formatting, later the client for the database)
- `src/components/` — interface pieces
