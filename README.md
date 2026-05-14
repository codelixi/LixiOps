# LixiOps

Business Operating System enforcing an 11-stage workflow with four non-negotiable rules:

1. **No Project Without Deal** — projects can only spawn from `CLOSED_WON` leads
2. **No Invoice Without Project** — invoices must be tied to a project
3. **No Work Without Assignment** — tasks moving to `in_progress` need an assignee
4. **No Communication Outside Context** — comments are polymorphic and entity-scoped

The 11 stages: **Lead → Qualified → Proposal → Negotiation → Closed Won → Client → Project → Execution → Invoice → Payment → Retention**.

## Stack

- **Server**: Express 5 · Prisma · PostgreSQL · Zod · Socket.io · JWT
- **Client**: React 19 · Vite · TypeScript · Tailwind 4 · Framer Motion · Recharts
- **Realtime**: Socket.io with JWT auth and entity-room subscriptions
- **Storage**: local FS for dev (S3-ready abstraction in `server/src/lib/storage.ts`)
- **PDF**: html2canvas + jspdf, lazy-loaded on demand

## Repo layout

```
LixiOps/
├── client/          # React app
├── server/          # Express API + Prisma + Socket.io
├── .github/workflows/ci.yml
└── package.json     # npm workspaces orchestrator
```

## Local development

### Prerequisites
- Node 20+
- PostgreSQL 15+
- (Optional) Stripe test keys for portal payments

### Setup

```bash
# 1. Install dependencies (root, covers both workspaces)
npm install

# 2. Configure server env
cp server/.env.example server/.env
# Edit server/.env — fill in DATABASE_URL, JWT_SECRET (32+ chars), JWT_REFRESH_SECRET (32+ chars), ENCRYPTION_KEY (exactly 32)

# 3. Push the schema to your database
cd server && npx prisma db push && cd ..

# 4. Start both apps
npm run dev
```

The client runs at `http://localhost:5173`, the server at `http://localhost:4000`.

## Testing

### Smoke suite (Playwright)

```bash
cd client
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive
```

The suite covers public routes and auth guards. Workflow-loop tests (lead → invoice → payment) need a seeded user — add those once you have a `prisma/seed.ts`.

### Typecheck-only (no run)

```bash
# Server
cd server && npx tsc --noEmit

# Client
cd client && npx tsc --noEmit
```

## Production build

```bash
npm run build
```

This builds both workspaces. Output:
- `client/dist/` — static SPA, serve from any CDN
- `server/dist/` — Node app, run with `node dist/index.js`

## Deploy

### Server
1. Provision Postgres (any managed provider — Render, Fly, Neon, Supabase, etc.)
2. Set environment variables (see `server/src/lib/env.ts` — Zod schema is the source of truth):
   - `DATABASE_URL` — connection string
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` — both 32+ chars
   - `ENCRYPTION_KEY` — exactly 32 chars
   - `CORS_ORIGIN` — your production client URL (e.g. `https://app.codelixi.com`)
   - `NODE_ENV=production`
   - Stripe keys if portal payments are enabled
3. Run schema migration: `npx prisma db push` (or `migrate deploy` in production)
4. Boot: `node dist/index.js`

The env loader will **refuse to start** if `JWT_SECRET` looks like a dev value or `CORS_ORIGIN` is localhost in production.

### Client
1. Build: `cd client && npm run build`
2. Serve `client/dist/` from any static host (Vercel, Netlify, Cloudflare Pages, S3+CloudFront)
3. Set `VITE_API_URL` at build time to your server URL (e.g. `https://api.codelixi.com/api/v1`)

### File uploads
Default storage is local filesystem under `server/uploads/`. For production, swap `LocalFsAdapter` for an S3 adapter in `server/src/lib/storage.ts` — the `StorageAdapter` interface is already defined for it.

## CI

GitHub Actions runs typecheck + build on every PR (`.github/workflows/ci.yml`). The full e2e suite runs only on `main` pushes or PRs with the `run-e2e` label, since it needs a Postgres service.

## Architecture notes

### Workflow enforcement
The four rules are enforced at the API layer (Zod validation + business-rule checks in each route), not the UI. Frontend guidance hides invalid options, but a misbehaving client can't bypass them.

### Realtime
Socket.io is initialized in `server/src/index.ts` with JWT auth. Clients auto-join `user:<userId>` on connect and can subscribe to `entity:<TYPE>:<ID>` rooms for live comment streams. The emit helpers live in `server/src/lib/realtime.ts`.

Events are used as **cache invalidators** — clients refetch on the matching event rather than receiving full payloads. Keeps the wire surface small.

### Action Engine
The rule scanner (`server/src/services/actionEngine.ts`) runs every 5 minutes:
1. Scans for trigger conditions (overdue invoices, stale leads, past-due projects, due-soon milestones)
2. Looks up active `ActionRule` rows matching the trigger
3. Dispatches based on `actionType`: `NOTIFY_USER`, `NOTIFY_ROLE`, `EMAIL`, `CREATE_TASK`, `ESCALATE`, `WEBHOOK`
4. Records each fire in `ScheduledAction` for idempotency + observability

The `/ai-engine` UI exposes rules + custom rule creation + a layer-2 insights view that synthesizes patterns across surfaces.

### Audit
Every privileged write goes through `server/src/lib/audit.ts` which fire-and-forgets to `AuditLog`. The CEO can view the log at `/audit` with cursor pagination.

## License

Internal — CodeLixi.
