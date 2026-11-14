create table accounts (
  id uuid primary key,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  email text not null check (length(trim(email)) between 3 and 320),
  created_at timestamptz not null default now()
);

create unique index accounts_email_unique_idx on accounts (lower(email));

create table bookings (
  id uuid primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  listing_id uuid not null references service_listings(id),
  status text not null check (
    status in ('proposed', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired')
  ),
  agreed_price_minor integer not null check (agreed_price_minor >= 0),
  currency char(3) not null check (currency = upper(currency)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_account_created_idx on bookings (account_id, created_at desc);

create table booking_events (
  id uuid primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  from_state text check (
    from_state is null or from_state in ('proposed', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired')
  ),
  to_state text not null check (
    to_state in ('proposed', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired')
  ),
  occurred_at timestamptz not null default now(),
  unique (booking_id, sequence)
);

insert into marketplace_nodes (id, canonical_url, display_name, protocol_version, inbox_url)
values (
  '10000000-0000-4000-8000-000000000001',
  'http://localhost:3000/nodes/local',
  'Local Community Market',
  '0.0.1-draft',
  'http://localhost:3000/federation/inbox'
)
on conflict (id) do nothing;

insert into service_listings (
  id, node_id, title, description, price_minor, currency, status
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Community garden consultation',
    'A fictional one-hour planning session for a shared growing space.',
    4500,
    'GBP',
    'published'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Event sound technician',
    'A fictional half-day sound setup and operating service.',
    12000,
    'GBP',
    'published'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Bicycle maintenance workshop',
    'A fictional small-group workshop covering essential bicycle repairs.',
    3000,
    'GBP',
    'published'
  )
on conflict (id) do nothing;
