# MUeRA

**Multitasking Universal Educational Responsive Assistant**

_Plan smarter. Learn easier. Stay ahead._

MUeRA is an AI academic companion for college students: deadlines, timetable,
attendance, study planning and a PDF learning assistant in one installable web app
(PWA). Built by **Team Pixel Clash** at Sharda University, Agra.

> **Repository note.** This is a preservation snapshot recovered from the project's
> hosting account on 14 Nov 2026.
>
> - The **frontend source** (`src/`, `public/`, configs) is the project state of
>   **25 Oct 2026** - the only editable frontend source stored on hosting.
> - The **AI backend is intentionally not included.** The PHP API and the
>   server-side AI route (provider keys, prompts and rate limiting) were removed
>   for this public snapshot. AI-powered screens in the UI say so instead of
>   pretending to work.
> - The current live app at https://muera.page.gd runs a newer frontend build whose
>   editable source is not on the hosting account and is not part of this snapshot.
>
> **Verified on 20 Nov 2026.** Dependency install, lint, type check, tests and the
> production build all pass on this snapshot. This package does not run the current app.

## Features (in this source)

- **Dashboard** - tasks and deadlines at a glance, with priorities.
- **Academic calendar** - assignments, quizzes, exams, classes and personal events.
- **Scanner** - photograph a notice or timetable; dated events are extracted for
  review before saving, with uncertain items flagged (needs the AI backend, not
  included here).
- **Timetable import** - weekly class timetable extraction with a review screen
  (AI backend not included).
- **AI study planner** - realistic study sessions from your deadlines, free time,
  subject difficulty and attendance (AI backend not included).
- **Attendance calculator** - per-subject tracking against your target percentage.
- **Learn (PDF assistant)** - summaries, revision notes, quizzes and flashcards from
  your own documents (AI backend not included). PDF text extraction runs locally in
  the browser.
- **Assistant chat** - answers about your schedule, attendance and documents (AI
  backend not included). Plain task/timetable commands are parsed locally in the
  browser.
- **Catch-up plan** - a short, encouraging 7-day recovery plan when you fall behind
  (AI backend not included).
- **Cloud sync** - sign in with Google; data saved per user in Supabase (Postgres
  with row-level security). Offline-first storage and sync design; configuration and
  runtime behavior are unverified in this snapshot.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, TanStack Router/Start + Query, Tailwind
  CSS 4, Radix/shadcn UI, PWA (service worker + manifest).
- **Data/auth:** Supabase (Google auth, Postgres with row-level security), using
  only the public anon key on the client.
- **AI:** in the live app, AI requests go through a small server-side backend (any
  OpenAI-compatible chat API) so provider keys never ship to the browser. That
  backend is **not** part of this public snapshot.

## Project structure

```
src/
  routes/        app screens (dashboard, calendar, scan, planner, learn,
                 attendance, assistant, settings)
  components/    shared UI (app shell, auth gate, task/timetable bits, ui kit)
  lib/           store, cloud sync, timetable/attendance logic, task commands,
                 tests
public/          PWA icons, manifest, service worker, robots
```

## Getting started (frontend)

1. Install dependencies: `bun install` (or `npm install`).
2. Create a free Supabase project and enable Google sign-in.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key.
4. Run the dev server: `bun dev` (or `npm run dev`).
5. Run the test suite: `npm test`.

AI-powered features need an AI backend, which is not included in this snapshot; in
this source they show a "not included" message.

### Development checks

- `npm test` runs the Vitest unit and component suite (jsdom + Testing Library).
- `npm run lint` runs ESLint; `npx tsc --noEmit` type-checks without building.
- GitHub Actions (`.github/workflows/ci.yml`) runs install, type-check, lint and
  tests on every push and pull request to `main`.

## Security and privacy

- No secrets, keys or user data in this repository. Client env uses only the public
  anon key; everything else stays server-side in the live deployment.
- The live app keeps per-user data isolated with Postgres row-level security. This
  snapshot contains no database setup and no AI backend.

## Team

**Team Pixel Clash** - Anam Khan (team lead), Aryan "Axel" Singh, Krishna Yadav,
Utkarsh Dhangar.

## Status and license

The live app is at https://muera.page.gd. This snapshot does not run the current
app; see the repository note above. No license has been chosen yet - all rights
remain with the team until one is added.
