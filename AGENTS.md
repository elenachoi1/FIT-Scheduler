# FIT Scheduler — notes for coding agents

## What this is
A When2meet-style group scheduler. Plain HTML/CSS/JavaScript (ES modules) with **no build step and no npm dependencies**.
Data, sign-in and live updates come from Supabase. Hosted on GitHub Pages from the `main` branch root.

Live site: https://elenachoi1.github.io/FIT-Scheduler/

## Run it
- Dev server: `npm run dev` (serves the folder at http://localhost:8000 with `python3 -m http.server`)
- The dev server must listen on a local port. If the sandbox blocks it, ask for permission to run it outside the sandbox.
- Syntax check: `npm run check`
- There is no bundler: edit a file, then refresh the browser.

## Files
- `index.html`: entry point; loads `app.js` as a module
- `app.js`: all screens (sign-in, dashboard, group, new event, event), the hash router (`#/group/:id`, `#/event/:id`, `#/join/:code`) and Supabase calls
- `recommend.js`: pure best-time recommendation function (no DOM, no Supabase); keep it testable
- `styles.css`: theme variables at the top (`:root` is dark PRISM style, `html[data-theme="light"]` is light)
- `config.js`: Supabase URL and **publishable** key. These are public by design. Never add a `service_role` or secret key anywhere in this repo.
- `supabase/schema.sql`: tables, Row Level Security policies, RPCs (`create_group`, `join_group`) and the realtime publication. If you change the schema, update this file, and tell the user to run the change in the Supabase SQL Editor.
- `privacy.html`: privacy policy page (linked from the Google OAuth consent screen; keep it published)
- `logo.png`, `favicon.png`: FIT logo assets

## Conventions
- All times are New York wall-clock times (`America/New_York`). Slots are stored as `"YYYY-MM-DD_minuteOfDay"` strings.
- Escape user text with `esc()` before inserting it into HTML.
- Keep the PRISM look: dark theme, Inter font, violet/indigo accents (`#8b5cf6`, `#6366f1`).
- UI text is in English.
