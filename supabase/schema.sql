-- ECES Bayanihan: database tables for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run. Safe to run twice.

create table if not exists school (
  id int primary key check (id = 1),
  body jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists auth (
  id text primary key,
  salt bytea not null,
  digest bytea not null
);
create table if not exists sessions (
  hash text primary key,
  id text not null,
  expires bigint not null
);
create index if not exists sessions_id on sessions (id);
create index if not exists sessions_expires on sessions (expires);
create table if not exists files (
  id text primary key,
  owner text not null,
  name text not null,
  mime text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create table if not exists evidence_views (
  session_hash text not null,
  stamp text not null,
  primary key (session_hash, stamp)
);
create table if not exists rate_hits (
  key text primary key,
  n int not null,
  window_end bigint not null
);

-- Lock every table to the public API. Only the server function (which connects directly) can read or write.
-- With row level security on and no policies, the public "anon" key sees nothing.
alter table school enable row level security;
alter table auth enable row level security;
alter table sessions enable row level security;
alter table files enable row level security;
alter table evidence_views enable row level security;
alter table rate_hits enable row level security;
revoke all on school, auth, sessions, files, evidence_views, rate_hits from anon, authenticated;

-- The last 300 saved versions of the school record are kept, so a bad change can be rolled back and nothing can be quietly rewritten.
create table if not exists school_history (
  n bigserial primary key,
  saved_at timestamptz not null default now(),
  body jsonb not null
);
alter table school_history enable row level security;
revoke all on school_history from anon, authenticated;
create or replace function keep_school_history() returns trigger language plpgsql as $$
declare k bigint;
begin
  insert into school_history (body) values (new.body) returning n into k;
  delete from school_history where n <= k - 300;
  return new;
end $$;
drop trigger if exists school_history_keep on school;
create trigger school_history_keep after insert or update on school for each row execute function keep_school_history();
