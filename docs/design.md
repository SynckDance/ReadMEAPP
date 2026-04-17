# Research Reader App — Design Doc

**Status:** Design draft (v0.1)
**Branch:** `claude/readme-app-design-7MT1Y`
**Working name:** TBD (not Recipra — that's a separate, shipped product)
**Code repo:** `synckdance/ReadMEAPP` (design doc currently hosted in the
Recipra repo; will migrate once the ReadMEAPP repo is set up)

This is a separate project from Recipra.

---

## 1. Product scope

A reader + notes + idea-discovery tool for researchers who work across long
documents and large reading piles.

### Core (v1)

- **Ingest** — upload or link long documents (PDF, EPUB, DOCX, HTML, URL, paste).
- **Reader** — clean long-form reader with inline highlights and margin notes.
- **Grammar / clarity suggestions** — Claude-powered inline edits on user-authored
  text (notes, drafts), not on source documents.
- **Structure / outline** — auto-generated outline of a document showing flow,
  section summaries, and comprehension checkpoints.
- **Notes** — block-level notes anchored to highlights; free-form notes at doc
  and Desk level.

### Advanced (v2)

- **Desk** — a persistent study space. A Desk holds multiple documents, notes,
  outlines, and open questions for one research thread. Lives across sessions.
- **Knowledge Bucket** — tagged, searchable store of extracted thoughts, quotes,
  and claims across all Desks.
- **Idea discovery** — semantic search + clustering across a pile of works to
  surface themes, contradictions, and gaps.
- **Idea generation** — Claude proposes research directions grounded in the
  user's Desk + Bucket contents (with citations).
- **Researcher system architecture** — opinionated workflow: Intake → Read →
  Annotate → Synthesize → Generate → Export (paper draft, slide outline, lit
  review skeleton).

### Non-goals (v1)

- Reference management (Zotero-style). We integrate with exports, not replace.
- Social/feed features. Private-by-default; teams only.
- TTS / audio. Out of scope unless a user explicitly requests it later.

---

## 2. Platforms

**Both day one.**

- **Web** — Next.js 14 App Router. Primary surface for long reading sessions.
- **iOS** — Capacitor wrapper of the same Next.js build, shipped to App Store.
  Same stack as Recipra, so release pipeline is already proven.
- **Android** — deferred. Capacitor supports it; we'll add when there's demand.

Shared codebase; responsive layouts scale from phone to desktop. Desktop gets
the three-pane reader (outline / doc / notes); mobile collapses to a single
pane with a segmented control.

---

## 3. Users and teams

Multi-user with team-shared Desks.

- **Account** — email + OAuth (Google, Apple).
- **Workspace** — a team. Users can belong to multiple workspaces.
- **Roles (per workspace):** `owner`, `editor`, `commenter`, `viewer`.
- **Personal mode** — a workspace of one. Same schema.
- **Desk sharing** — scope is the Desk, not the whole workspace. A user can
  have private Desks and shared Desks in the same workspace.
- **Presence** — realtime cursors + highlight indicators on shared Desks
  (Supabase Realtime). v1 ships read-only presence; collaborative editing of
  notes is v1.5.

---

## 4. Data model

Tables (Supabase / Postgres). All tables have `id uuid`, `created_at`,
`updated_at`, and `deleted_at` (soft delete) unless noted.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Auth identities | `email`, `display_name`, `avatar_url` |
| `workspaces` | Teams | `name`, `slug`, `owner_id` |
| `workspace_members` | Membership + role | `workspace_id`, `user_id`, `role` |
| `documents` | Ingested source docs | `workspace_id`, `uploader_id`, `title`, `source_type` (pdf/epub/url/paste), `source_uri`, `storage_path`, `word_count`, `language` |
| `document_chunks` | Text chunks for retrieval | `document_id`, `ord`, `text`, `page`, `embedding vector(1536)` |
| `desks` | Study spaces | `workspace_id`, `owner_id`, `name`, `description`, `visibility` (private/workspace/shared) |
| `desk_members` | Per-desk sharing | `desk_id`, `user_id`, `role` |
| `desk_documents` | Docs on a desk | `desk_id`, `document_id`, `added_by`, `pinned` |
| `highlights` | User highlights | `document_id`, `desk_id`, `user_id`, `start_offset`, `end_offset`, `text`, `color` |
| `notes` | Anchored + free-form notes | `desk_id`, `document_id?`, `highlight_id?`, `user_id`, `body_md`, `parent_id?` |
| `outlines` | Cached auto-outlines | `document_id`, `model`, `json` (sections/summaries) |
| `bucket_items` | Knowledge Bucket entries | `workspace_id`, `user_id`, `kind` (quote/claim/idea/question), `body_md`, `source_ref` (doc/highlight/note), `tags text[]`, `embedding vector(1536)` |
| `suggestions` | Grammar/clarity suggestions | `note_id`, `range`, `original`, `suggestion`, `rationale`, `status` (pending/accepted/rejected) |
| `ideas` | Generated research ideas | `desk_id`, `prompt`, `body_md`, `citations jsonb`, `status` |
| `jobs` | Async work (ingest, embed, outline, discover) | `kind`, `status`, `payload`, `result`, `error` |
| `events` | Audit + realtime feed | `workspace_id`, `actor_id`, `kind`, `payload` |

**Indexes:** `embedding` uses pgvector IVFFlat or HNSW; btree on
`(workspace_id, created_at)`, `(desk_id, created_at)`, `(document_id, ord)`.

**RLS:** every table filters by workspace membership; Desk-scoped tables
additionally filter by `desk_members` when `visibility = 'shared'`.

---

## 5. Core surfaces (UI)

### 5.1 Library
Grid of documents in the current workspace. Filters: desk, tag, unread,
uploader. Primary actions: upload, paste URL, open.

### 5.2 Reader (3-pane desktop, 1-pane mobile)
- **Left:** Outline (collapsible sections, jump links, comprehension checks).
- **Center:** Document body. Selection toolbar → highlight, note, ask.
- **Right:** Notes + suggestions for the current doc on the current desk.

### 5.3 Desk
- Header: name, members, visibility.
- Tabs: **Reading** (docs pinned to desk), **Notes** (all notes on desk),
  **Outline** (synthesis across docs), **Ideas** (generated), **Bucket**
  (filtered to desk tags).

### 5.4 Knowledge Bucket
Global view across all Desks in the workspace. Faceted: kind, tag, source,
author. Semantic search box runs over embeddings.

### 5.5 Compose
A writing surface where Claude grammar/clarity suggestions appear. Used for
notes and for exportable artifacts (lit review skeleton, paper draft).

---

## 6. Claude API surfaces

Using `@anthropic-ai/sdk` (already in deps). Default model: Claude Sonnet 4.6
for interactive features; Opus 4.7 for idea generation / discovery.
**Prompt caching** on document text and Desk context — these are reused across
many calls, so caching is mandatory for cost.

| Surface | Trigger | Input | Output |
|---|---|---|---|
| Outline | On ingest + on demand | Full doc text (cached) | JSON: sections, summaries, key claims, comprehension questions |
| Grammar/clarity | Debounced on Compose | Note draft + style prefs | Ranged suggestions with rationale |
| Ask-the-doc | User selects text + asks | Selection + doc chunks (cached) | Grounded answer with citations |
| Idea discovery | On Desk demand | Desk doc summaries + bucket items (cached) | Themes, contradictions, gaps |
| Idea generation | User clicks "propose research directions" | Desk context (cached) + seed prompt | Ranked ideas with citations + novelty notes |
| Export | User clicks export | Desk + selected bucket items | Lit review / outline / paper skeleton |

All Claude calls go through a server route (`/api/ai/*`) that enforces
workspace scope and rate limits.

---

## 7. Retrieval layer

- **Chunking:** ~500-token chunks, 50-token overlap; preserves page + section.
- **Embeddings:** **OpenAI `text-embedding-3-large`** (3072 dims). Chosen for
  quality + ubiquity + low cost. pgvector column `vector(3072)`.
  Upgrade path: re-embed into Voyage `voyage-3` if our research-domain eval
  shows a meaningful lift (>5% recall@10 on our test set).
- **Search:**
  - Within-doc: chunk search for ask-the-doc.
  - Across-desk: chunk + bucket-item search for idea discovery.
  - Across-workspace: bucket-item search only (privacy: docs don't leak across desks unless pinned).
- **Reranking:** Claude-based rerank on top-20 for answer-generation calls.

---

## 8. Phased build order

**Phase 0 — foundations (week 1)**
- Repo scaffold, Supabase project, auth (email + Google + Apple), workspace model, RLS policies, Capacitor iOS shell.

**Phase 0.5 — platform plumbing (weeks 2–3)**
- Hybrid PDF layer (pdf.js + PDFKit Capacitor plugin, shared highlight model).
- Yjs note infrastructure (per-note doc, Supabase Realtime transport, IndexedDB + SQLite local persistence).
- Offline sync scaffold (Desk cache, outbox, conflict rules).
- Billing scaffold (Stripe + StoreKit, entitlements table).

**Phase 1 — Reader MVP (weeks 4–5)**
- Document ingest (PDF + paste + URL), storage, chunking job, reader UI, highlights (round-tripping across web + iOS), notes (Yjs).

**Phase 2 — Outline + Compose (week 6)**
- Auto-outline job, 3-pane reader, Compose surface, grammar suggestions.

**Phase 3 — Desk (weeks 7–8)**
- Desk CRUD, desk-document pinning, desk-scoped notes, sharing + roles, realtime presence.

**Phase 4 — Bucket + Discovery (weeks 9–10)**
- Bucket CRUD + tagging, OpenAI embedding pipeline, semantic search, idea discovery.
- Voyage eval gate: run bake-off; switch if ≥5% recall@10 lift.

**Phase 5 — Idea generation + Export (week 11)**
- Idea generation surface with citations, export templates.

**Phase 6 — Offline hardening + iOS polish (week 12)**
- Offline Desk coverage audit, conflict UX, PencilKit highlights on iOS.

**Phase 7 — App Store submission (week 13)**
- Capacitor release build, privacy manifest, IAP products, App Store review.

Names get locked before Phase 1 ships — domain, USPTO screen, App Store name
reservation.

---

## 9. Decisions

1. **Embedding provider — OpenAI `text-embedding-3-large`.** Pragmatic default:
   cheap, fast, wide tooling, pgvector-friendly. We'll benchmark Voyage
   `voyage-3` on a 200-paper research eval before Phase 4 and switch if it
   wins by a meaningful margin.
2. **Collab editing — full CRDT (Yjs).** Notes are a Yjs doc per note, persisted
   as binary in Postgres and streamed over Supabase Realtime or a Hocuspocus
   server. Presence + cursors come for free from Yjs awareness.
3. **PDF rendering — hybrid.** `pdf.js` on web; native **PDFKit** on iOS via a
   Capacitor plugin. Both emit a shared selection/highlight model
   (`{page, rects[], text, anchors}`) so highlights round-trip between
   platforms.
4. **Pricing — free + paid on both personal and team.**
   - *Personal Free:* 1 workspace, 10 docs, 1 Desk, bucket capped.
   - *Personal Pro:* unlimited docs/Desks, full AI features.
   - *Team Free:* up to 3 members, 1 shared Desk.
   - *Team Pro:* unlimited members/Desks, admin controls, SSO later.
   - iOS purchases go through Apple IAP (required for digital goods on iOS).
     Web purchases go through Stripe. Entitlements unified server-side.
5. **Offline — yes, Desk-first offline.** Capacitor caches: the active Desk's
   pinned docs, highlights, notes, and outline. Notes are editable offline
   (Yjs sync resumes on reconnect). AI features require network. Bucket
   search works offline on cached items only.
6. **Name — open.** Repo is currently `synckdance/ReadMEAPP`. Shipping name
   will be screened separately (USPTO + domain + App Store). Candidates to
   re-screen: Noterra, Parchwise, plus any new entrants.

## 9.1 Implications of these decisions

- **Timeline extends ~3 weeks.** CRDT + offline + hybrid PDF + dual-rail
  billing each add real work. Revised estimate: 13 weeks to App Store
  submission instead of 10.
- **New dependencies:** `yjs`, `y-indexeddb` (web offline), `@capacitor-community/sqlite` (iOS offline), `pdfjs-dist` (web), custom Capacitor PDFKit plugin (iOS), `stripe` (web billing), StoreKit via Capacitor (iOS IAP).
- **New schema:** `notes.yjs_state bytea`, `entitlements` table, `offline_sync_log`.
- **New Phase 0.5** added below for plumbing before Reader MVP.

---

## 10. Stack summary

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind, Framer Motion, Zustand.
- **Mobile:** Capacitor 8 (iOS).
- **Backend:** Supabase (Postgres + pgvector + Auth + Storage + Realtime).
- **AI:** `@anthropic-ai/sdk` (Claude Sonnet 4.6 / Opus 4.7), prompt caching on doc + desk context.
- **Embeddings:** OpenAI `text-embedding-3-large` (3072 dims); Voyage `voyage-3` as benchmarked upgrade path.
- **Collab:** Yjs + Supabase Realtime (or Hocuspocus) for CRDT notes.
- **Offline:** IndexedDB (web) + SQLite (iOS via Capacitor) for Desk cache + Yjs persistence.
- **Billing:** Stripe (web) + StoreKit via Capacitor (iOS IAP), unified server-side entitlements.
- **Infra:** Vercel (web), EAS/Xcode Cloud (iOS), Supabase managed.

---

*Next step after sign-off: name screening (USPTO + domain + App Store), then Phase 0 scaffold in a new repo.*
