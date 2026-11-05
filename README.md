# The Butler

A private, mobile-first web app for tasks, a weekly calendar, category history and manually
tracked money (BDT, Asia/Dhaka). Black theme with a red accent, after the Forma Health UI case study.

## Status

This is a **UI demo**. It runs entirely in the browser with sample data; refreshing resets it.

| Part | State |
| --- | --- |
| Home, Categories, Calendar, Finance, task editor, settings | Built (demo data) |
| Finance PIN lock | Built for the demo (PIN kept in memory only) |
| Client-side encryption (`src/lib/crypto`) | Written, not wired to a server yet |
| Domain logic: tasks, dates, money, ledger (`src/lib/domain`) | Written |
| Database schema with row-level security (`db/migrations`) | Written |
| Sign-in, sync, Telegram reminders, backups | Not built yet |

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Finance asks you to create a 6-digit PIN the first time.

## Checks

```bash
npm run typecheck
npm run lint
```
