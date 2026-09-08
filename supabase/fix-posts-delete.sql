-- 必须执行：否则前端「删除」只会在本地消失，刷新后又回来
-- Supabase Dashboard → SQL Editor → Run

drop policy if exists "Authors can delete own posts" on public.posts;

create policy "Authors can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);
