alter table marketplace_nodes
  add column if not exists public_key text,
  add column if not exists trusted boolean not null default false,
  add column if not exists last_seen_at timestamptz;

alter table service_listings
  add column if not exists origin_url text;

create table federation_inbox (
  event_id uuid primary key,
  sender text not null,
  event_type text not null,
  response_payload jsonb not null,
  received_at timestamptz not null default now()
);

create table remote_bookings (
  id uuid primary key,
  source_node_url text not null,
  source_booking_id uuid not null,
  listing_id uuid not null references service_listings(id),
  agreed_price_minor integer not null check (agreed_price_minor >= 0),
  currency char(3) not null check (currency = upper(currency)),
  status text not null check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_node_url, source_booking_id)
);

create index remote_bookings_source_idx
  on remote_bookings (source_node_url, created_at desc);
