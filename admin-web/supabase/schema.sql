create table if not exists public.users (
  id text primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  role text not null,
  photo_path text
);

create table if not exists public.reports (
  id text primary key,
  created_at timestamptz not null default now(),
  issue text not null,
  details text not null default '',
  reporter_name text not null,
  reporter_email text not null,
  destination text not null,
  distance_km text not null default '',
  fare text not null default '',
  latitude text not null default '',
  longitude text not null default '',
  photo_path text
);

alter table public.users enable row level security;
alter table public.reports enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tri-fare-uploads', 'tri-fare-uploads', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false;
