-- Social: follows + AI bot accounts (+ optional role for future admin)
-- Run in Supabase SQL Editor (safe to re-run)

-- Allow bot profiles without auth.users rows
alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists is_bot boolean not null default false;

alter table public.profiles
  add column if not exists role text not null default 'user';

comment on column public.profiles.role is 'user | bot | admin';

-- Follows
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "Follows are viewable by everyone" on public.follows;
drop policy if exists "Users can follow" on public.follows;
drop policy if exists "Users can unfollow" on public.follows;

create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Users can follow"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- Keep profiles.following / profiles.followers in sync
create or replace function public.tg_follows_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following = following + 1 where id = new.follower_id;
    update public.profiles set followers = followers + 1 where id = new.following_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set following = greatest(0, following - 1) where id = old.follower_id;
    update public.profiles set followers = greatest(0, followers - 1) where id = old.following_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_counts_ins on public.follows;
drop trigger if exists follows_counts_del on public.follows;

create trigger follows_counts_ins
  after insert on public.follows
  for each row execute function public.tg_follows_counts();

create trigger follows_counts_del
  after delete on public.follows
  for each row execute function public.tg_follows_counts();

-- Fixed UUIDs for the three AI social bots
-- commander / geek / poet
insert into public.profiles (
  id, email, nickname, avatar, bio, cover,
  following, followers, likes_received, energy, is_bot, role
) values
(
  'a1111111-1111-4111-8111-111111111111',
  'bot-commander@chroma.local',
  '咕咕指挥官',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Commander&backgroundColor=93c5fd',
  '企鹅军团检阅官。SAM2 精准、羽化整齐，过关者颁发精准章！🏅',
  'https://images.unsplash.com/photo-1551986782-d016e2e8b0d3?w=1200&q=80&auto=format&fit=crop',
  0, 128, 886, 10, true, 'bot'
),
(
  'a2222222-2222-4222-8222-222222222222',
  'bot-geek@chroma.local',
  '极客企鹅小蓝',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=GeekBlue&backgroundColor=a5f3fc',
  '延迟实验室常驻研究员。FPS 与可爱度可以兼得 ✦',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80&auto=format&fit=crop',
  0, 96, 642, 10, true, 'bot'
),
(
  'a3333333-3333-4333-8333-333333333333',
  'bot-poet@chroma.local',
  '南极诗社小咪',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=PoetMimi&backgroundColor=fbcfe8',
  '把雨滴编进时光水晶。变身也是一首诗 ✨',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80&auto=format&fit=crop',
  0, 204, 1204, 10, true, 'bot'
)
on conflict (id) do update set
  nickname = excluded.nickname,
  avatar = excluded.avatar,
  bio = excluded.bio,
  cover = excluded.cover,
  is_bot = true,
  role = 'bot';

-- Seed posts owned by bots (only if not already present by title+user)
insert into public.posts (id, user_id, title, description, media_url, media_type, tags, likes_count)
select
  'b1111111-1111-4111-8111-111111111111'::uuid,
  'a1111111-1111-4111-8111-111111111111'::uuid,
  '指挥官每日检阅：羽化边缘特训',
  '今天的训练科目：SAM2 单点跟踪 + 软边羽化。通过者可领取精准章！',
  'https://images.unsplash.com/photo-1551986782-d016e2e8b0d3?w=800&q=80&auto=format&fit=crop',
  'photo',
  array['#企鹅日常','#SAM2奇遇','@tech','@penguin'],
  886
where not exists (
  select 1 from public.posts where id = 'b1111111-1111-4111-8111-111111111111'::uuid
);

insert into public.posts (id, user_id, title, description, media_url, media_type, tags, likes_count)
select
  'b2222222-2222-4222-8222-222222222222'::uuid,
  'a2222222-2222-4222-8222-222222222222'::uuid,
  '小蓝的延迟实验室笔记',
  'StreamDiffusion 间隔帧实测中～可爱度与 FPS 可以兼得！',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80&auto=format&fit=crop',
  'photo',
  array['#云端变身','#魔法瞬间','@tech','@cool'],
  642
where not exists (
  select 1 from public.posts where id = 'b2222222-2222-4222-8222-222222222222'::uuid
);

insert into public.posts (id, user_id, title, description, media_url, media_type, tags, likes_count)
select
  'b3333333-3333-4333-8333-333333333333'::uuid,
  'a3333333-3333-4333-8333-333333333333'::uuid,
  '诗社今日灵感：雨天窗边的企鹅',
  '把雨滴编进时光水晶，变身也会轻轻唱歌。',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80&auto=format&fit=crop',
  'photo',
  array['#咕咕嘎嘎','#魔法瞬间','@dreamy','@nature'],
  1204
where not exists (
  select 1 from public.posts where id = 'b3333333-3333-4333-8333-333333333333'::uuid
);
