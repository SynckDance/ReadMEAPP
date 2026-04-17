-- ReadMEAPP — Phase 0 schema
-- Workspaces, members, desks, documents, highlights, notes, bucket, embeddings.
-- Embedding column sized for OpenAI text-embedding-3-large (3072 dims).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- =========================================================================
-- Users: shadow table keyed to auth.users
-- =========================================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_self_read" on public.users
  for select using (auth.uid() = id);
create policy "users_self_update" on public.users
  for update using (auth.uid() = id);

-- Auto-create public.users row when an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Workspaces + membership
-- =========================================================================
create type workspace_role as enum ('owner', 'editor', 'commenter', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index on public.workspace_members (user_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member(w uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id = w and user_id = auth.uid()
  );
$$;

create policy "workspaces_member_read" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspaces_owner_write" on public.workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "members_read_own_workspaces" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "members_owner_manage" on public.workspace_members
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- =========================================================================
-- Desks
-- =========================================================================
create type desk_visibility as enum ('private', 'workspace', 'shared');
create type desk_role as enum ('owner', 'editor', 'commenter', 'viewer');

create table public.desks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  description text,
  visibility desk_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on public.desks (workspace_id);

create table public.desk_members (
  desk_id uuid not null references public.desks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role desk_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (desk_id, user_id)
);

alter table public.desks enable row level security;
alter table public.desk_members enable row level security;

create or replace function public.can_read_desk(d uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.desks desk
    where desk.id = d
      and (
        desk.owner_id = auth.uid()
        or (desk.visibility = 'workspace' and public.is_workspace_member(desk.workspace_id))
        or exists (
          select 1 from public.desk_members dm
          where dm.desk_id = d and dm.user_id = auth.uid()
        )
      )
  );
$$;

create policy "desks_read" on public.desks
  for select using (public.can_read_desk(id));
create policy "desks_owner_write" on public.desks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "desk_members_read" on public.desk_members
  for select using (public.can_read_desk(desk_id));
create policy "desk_members_owner_manage" on public.desk_members
  for all using (
    exists (select 1 from public.desks d where d.id = desk_id and d.owner_id = auth.uid())
  );

-- =========================================================================
-- Documents + chunks
-- =========================================================================
create type document_source as enum ('pdf', 'epub', 'docx', 'url', 'paste');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploader_id uuid not null references public.users(id) on delete restrict,
  title text not null,
  source_type document_source not null,
  source_uri text,
  storage_path text,
  word_count integer,
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on public.documents (workspace_id);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  ord integer not null,
  page integer,
  text text not null,
  embedding vector(3072),
  created_at timestamptz not null default now(),
  unique (document_id, ord)
);

-- IVFFlat index — lists tuned after seed data; created at deploy time:
-- create index on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

create policy "documents_workspace_read" on public.documents
  for select using (public.is_workspace_member(workspace_id));
create policy "documents_workspace_write" on public.documents
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "chunks_inherit_doc" on public.document_chunks
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_workspace_member(d.workspace_id)
    )
  );

create table public.desk_documents (
  desk_id uuid not null references public.desks(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  added_by uuid not null references public.users(id),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (desk_id, document_id)
);

alter table public.desk_documents enable row level security;

create policy "desk_documents_read" on public.desk_documents
  for select using (public.can_read_desk(desk_id));
create policy "desk_documents_write" on public.desk_documents
  for all using (public.can_read_desk(desk_id))
  with check (public.can_read_desk(desk_id));

-- =========================================================================
-- Highlights + Notes (Notes carry a Yjs state blob — Phase 0.5 wiring)
-- =========================================================================
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  desk_id uuid references public.desks(id) on delete set null,
  user_id uuid not null references public.users(id),
  start_offset integer not null,
  end_offset integer not null,
  text text not null,
  color text not null default 'yellow',
  created_at timestamptz not null default now()
);

create index on public.highlights (document_id);
create index on public.highlights (desk_id);

alter table public.highlights enable row level security;

create policy "highlights_read" on public.highlights
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_workspace_member(d.workspace_id)
    )
  );
create policy "highlights_write" on public.highlights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  desk_id uuid references public.desks(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  highlight_id uuid references public.highlights(id) on delete set null,
  parent_id uuid references public.notes(id) on delete cascade,
  user_id uuid not null references public.users(id),
  body_md text not null default '',
  yjs_state bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.notes (desk_id);
create index on public.notes (document_id);

alter table public.notes enable row level security;

create policy "notes_read" on public.notes
  for select using (
    (desk_id is not null and public.can_read_desk(desk_id))
    or (
      document_id is not null
      and exists (
        select 1 from public.documents d
        where d.id = document_id and public.is_workspace_member(d.workspace_id)
      )
    )
  );
create policy "notes_write" on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================================
-- Outlines (cached)
-- =========================================================================
create table public.outlines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  model text not null,
  json jsonb not null,
  created_at timestamptz not null default now()
);

create index on public.outlines (document_id);

alter table public.outlines enable row level security;

create policy "outlines_read" on public.outlines
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_workspace_member(d.workspace_id)
    )
  );

-- =========================================================================
-- Knowledge Bucket
-- =========================================================================
create type bucket_kind as enum ('quote', 'claim', 'idea', 'question');

create table public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id),
  kind bucket_kind not null,
  body_md text not null,
  source_ref jsonb,
  tags text[] not null default '{}',
  embedding vector(3072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.bucket_items (workspace_id);
create index on public.bucket_items using gin (tags);

alter table public.bucket_items enable row level security;

create policy "bucket_read" on public.bucket_items
  for select using (public.is_workspace_member(workspace_id));
create policy "bucket_write" on public.bucket_items
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- =========================================================================
-- Suggestions / Ideas / Jobs / Events (light stubs, expanded later)
-- =========================================================================
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  range jsonb not null,
  original text not null,
  suggestion text not null,
  rationale text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;
create policy "suggestions_read" on public.suggestions
  for select using (
    exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  );
create policy "suggestions_write" on public.suggestions
  for all using (
    exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  );

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  desk_id uuid not null references public.desks(id) on delete cascade,
  user_id uuid not null references public.users(id),
  prompt text,
  body_md text not null,
  citations jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

alter table public.ideas enable row level security;
create policy "ideas_read" on public.ideas
  for select using (public.can_read_desk(desk_id));
create policy "ideas_write" on public.ideas
  for all using (public.can_read_desk(desk_id))
  with check (public.can_read_desk(desk_id));

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null,
  status text not null default 'queued',
  payload jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs are server-managed; no client RLS read/write by default.
alter table public.jobs enable row level security;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.users(id),
  kind text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index on public.events (workspace_id, created_at desc);

alter table public.events enable row level security;
create policy "events_read_members" on public.events
  for select using (public.is_workspace_member(workspace_id));
