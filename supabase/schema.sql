-- ChromaPenguin-Live schema (safe to re-run)

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nickname text not null default '云端旅人',
  avatar text,
  bio text default '在云朵里收集变身魔法的小旅人 ✧',
  cover text,
  following int not null default 0,
  followers int not null default 0,
  likes_received int not null default 0,
  energy int not null default 10,
  created_at timestamptz not null default now()
);

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1), '云端旅人'),
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=' || coalesce(new.raw_user_meta_data->>'nickname', new.id::text)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Community posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  media_url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  tags text[] not null default '{}',
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

-- Comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments (post_id);

-- Private album
create table if not exists public.private_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  created_at timestamptz not null default now()
);

create index if not exists private_media_user_id_idx on public.private_media (user_id);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('chroma-media', 'chroma-media', true)
on conflict (id) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.private_media enable row level security;

-- Drop old policies so this script can be re-run safely
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Posts are viewable by everyone" on public.posts;
drop policy if exists "Authenticated users can create posts" on public.posts;
drop policy if exists "Authors can update own posts" on public.posts;
drop policy if exists "Authors can delete own posts" on public.posts;

drop policy if exists "Comments are viewable by everyone" on public.comments;
drop policy if exists "Authenticated users can comment" on public.comments;

drop policy if exists "Private media: owner read" on public.private_media;
drop policy if exists "Private media: owner insert" on public.private_media;
drop policy if exists "Private media: owner delete" on public.private_media;

drop policy if exists "Public read chroma-media" on storage.objects;
drop policy if exists "Auth upload chroma-media" on storage.objects;
drop policy if exists "Owner update chroma-media" on storage.objects;
drop policy if exists "Owner delete chroma-media" on storage.objects;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Authenticated users can create posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Authors can update own posts"
  on public.posts for update using (auth.uid() = user_id);

create policy "Authors can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

create or replace function public.bump_post_likes(p_post_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  update public.posts
  set likes_count = greatest(0, likes_count + coalesce(p_delta, 0))
  where id = p_post_id
  returning likes_count into new_count;
  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.bump_post_likes(uuid, int) to anon, authenticated;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Private media: owner read"
  on public.private_media for select using (auth.uid() = user_id);

create policy "Private media: owner insert"
  on public.private_media for insert with check (auth.uid() = user_id);

create policy "Private media: owner delete"
  on public.private_media for delete using (auth.uid() = user_id);

create policy "Public read chroma-media"
  on storage.objects for select
  using (bucket_id = 'chroma-media');

create policy "Auth upload chroma-media"
  on storage.objects for insert
  with check (bucket_id = 'chroma-media' and auth.role() = 'authenticated');

create policy "Owner update chroma-media"
  on storage.objects for update
  using (bucket_id = 'chroma-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner delete chroma-media"
  on storage.objects for delete
  using (bucket_id = 'chroma-media' and auth.uid()::text = (storage.foldername(name))[1]);

-- Social follows + AI bot accounts: also run social-follows-bots.sql
-- (follows table, count triggers, three bot profiles & seed posts)
