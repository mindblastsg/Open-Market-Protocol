create table marketplace_nodes (
  id uuid primary key,
  canonical_url text not null unique,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  protocol_version text not null,
  inbox_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_listings (
  id uuid primary key,
  node_id uuid not null references marketplace_nodes(id),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  price_minor integer not null check (price_minor >= 0),
  currency char(3) not null check (currency = upper(currency)),
  status text not null check (status in ('draft', 'published', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_listings_node_status_idx on service_listings (node_id, status);
