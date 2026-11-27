-- Shared stage plots. Everything goes through the app's server routes with
-- the service role key; the browser never talks to this table directly.

create table public.plots (
  id text primary key check (id ~ '^[A-HJ-NP-Za-km-np-z2-9]{10}$'),
  -- sha-256 of the edit token, hex. The token itself is never stored.
  edit_token_hash text not null check (length(edit_token_hash) = 64),
  band text not null default '' check (length(band) <= 80),
  data jsonb not null,
  -- sha-256 of the creator's address + a server secret, for rate limiting only
  creator_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plots_creator_recent on public.plots (creator_hash, created_at desc);

-- Row level security on, with no policies: the anon and authenticated roles
-- can't read or write anything. Only the service role (server) can.
alter table public.plots enable row level security;
revoke all on public.plots from anon, authenticated;
