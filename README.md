# ReadMEAPP

> A research reader with a Desk and a Knowledge Bucket.

Read long documents. Highlight, outline, and think. Build a **Desk** of
ongoing study across a pile of works. Fill a **Knowledge Bucket** with
ideas, quotes, claims, and questions that persist across every session.

- **Full design:** [`docs/design.md`](docs/design.md)
- **Status:** Phase 0 (foundations). Scaffold only.

## Stack

- **Next.js 14** (App Router), TypeScript, Tailwind
- **Supabase** — Postgres + pgvector + Auth + Storage + Realtime
- **Capacitor 8 / iOS** — same build ships to App Store
- **Anthropic SDK** — Claude Sonnet 4.6 (interactive) / Opus 4.7 (discovery, generation)
- **OpenAI embeddings** — `text-embedding-3-large` (3072 dims)
- **Yjs** (Phase 0.5) — CRDT for collaborative notes

## Quick start

```bash
# 1. Install deps
npm install

# 2. Create a Supabase project and copy its URL + anon key
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# ANTHROPIC_API_KEY, OPENAI_API_KEY.

# 3. Apply the schema
#    Supabase dashboard → SQL editor → paste supabase/migrations/0001_init.sql
#    (or: supabase db push after `supabase link`)

# 4. Run
npm run dev
```

Open http://localhost:3000.

## iOS

```bash
npx cap add ios      # first time only
npm run cap:sync
npm run cap:open:ios # opens Xcode
```

See `capacitor.config.ts` for bundle id (`com.synckdance.readmeapp`).

## Layout

```
src/
  app/
    (app)/              # auth-gated
      layout.tsx
      library/          # Phase 1
      desks/            # Phase 3
      bucket/           # Phase 4
    auth/callback/      # Supabase OAuth + magic link return
    login/              # sign-in (email OTP + Google + Apple)
    layout.tsx
    page.tsx            # landing
  lib/
    supabase/           # server + browser + middleware clients
  middleware.ts         # refreshes session, gates /library /desks /bucket
supabase/
  migrations/
    0001_init.sql       # workspaces, desks, documents, highlights,
                        # notes, bucket, outlines, ideas, jobs, events
docs/
  design.md             # full product + data-model + phased plan
```

## Phase plan (abridged)

| Phase | Scope |
|---|---|
| 0 | Repo, auth, workspaces, RLS, Capacitor shell ← **you are here** |
| 0.5 | Hybrid PDF, Yjs, offline cache, billing scaffold |
| 1 | Ingest + Reader MVP + highlights + notes |
| 2 | Outline + Compose + grammar suggestions |
| 3 | Desks (CRUD, sharing, presence) |
| 4 | Bucket + embeddings + semantic search + idea discovery |
| 5 | Idea generation + export |
| 6 | Offline hardening + iOS polish |
| 7 | App Store submission |

Full detail in `docs/design.md`.

## License

TBD.
