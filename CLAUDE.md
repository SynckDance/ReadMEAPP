# CLAUDE.md

Project: **ReadMEAPP** — research reader with Desks and a Knowledge Bucket.
Separate project from Recipra. Do not mix them.

## Source of truth

- **Design doc:** `docs/design.md` — product scope, data model, phase plan, decisions.
- **README:** quick start + layout map.

## Decisions already locked

- Both web (Next.js 14 App Router) and iOS (Capacitor 8) from day one.
- Multi-user with teams; Desks can be private, workspace-visible, or shared.
- **Embeddings:** OpenAI `text-embedding-3-large` (3072 dims). Voyage `voyage-3` is the benchmarked upgrade path — switch only if the 200-paper research eval shows ≥5% recall@10 lift.
- **Collab editing:** Yjs CRDT per-note, persisted as `bytea` in `public.notes.yjs_state`.
- **PDF rendering:** hybrid — `pdf.js` on web, native PDFKit on iOS via a Capacitor plugin. Shared highlight model: `{page, rects[], text, anchors}`.
- **Offline:** Desk-first. Cache active Desk's docs, highlights, notes (Yjs), outline. AI features require network. Web uses IndexedDB; iOS uses SQLite.
- **Pricing:** Personal Free / Personal Pro / Team Free / Team Pro. iOS = IAP via StoreKit, web = Stripe, unified server-side entitlements.

## Tech + conventions

- `@supabase/ssr` is the auth pattern. See `src/lib/supabase/{server,client,middleware}.ts`. Don't reimplement.
- RLS is on for every table with user data. If you add a table, add policies. `is_workspace_member()` and `can_read_desk()` are the two helper predicates.
- Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Never reference these from client components.
- All Claude calls go through `/api/ai/*` server routes (not yet scaffolded). Use prompt caching on document text and Desk context — these are reused across many calls and caching is the cost story.
- Default model: **Claude Sonnet 4.6** for interactive features (outline, grammar, ask-the-doc). **Claude Opus 4.7** for idea discovery + idea generation.

## What NOT to do

- Do not add backwards-compat shims, TODO-style stubs, or feature flags for hypothetical future work.
- Do not write comments explaining what the code does — only leave comments for non-obvious WHYs.
- Do not build Android yet; deferred.
- Do not add TTS, social feed, or reference-manager features. Out of scope.
- Do not commit `.env.local` or any secret.

## Phase order — don't skip

0 → 0.5 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Phase 0.5 (PDF, Yjs, offline, billing scaffolding) comes *before* Reader MVP because the reader depends on the hybrid PDF and Yjs layers.

## Running

```bash
npm install
npm run dev              # web at localhost:3000
npm run typecheck
npm run cap:sync         # rebuild + push to iOS
npm run cap:open:ios     # Xcode
```

Schema lives in `supabase/migrations/`. Apply via Supabase dashboard SQL editor or `supabase db push`.
