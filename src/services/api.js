import { supabase, isSupabaseConfigured } from "@/config/supabase";

const DEFAULT_AVATAR = (seed) =>
  `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed || "ChromaPenguin")}&backgroundColor=bae6fd`;

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80&auto=format&fit=crop";

function demoProfile(email, nickname) {
  const nick = nickname || email.split("@")[0] || "云端旅人";
  return {
    id: `demo-${encodeURIComponent(email.trim().toLowerCase())}`,
    nickname: nick,
    email: email.trim(),
    avatar: DEFAULT_AVATAR(nick),
    bio: "演示模式旅人（未配置 Supabase）✧",
    cover: DEFAULT_COVER,
    following: 12,
    followers: 88,
    likesReceived: 256,
    energy: 10,
  };
}

function mapProfile(row, email) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname || "云端旅人",
    email: row.email || email || "",
    avatar: row.avatar || DEFAULT_AVATAR(row.nickname || row.id),
    bio: row.bio || "在云朵里收集变身魔法的小旅人 ✧",
    cover: row.cover || DEFAULT_COVER,
    following: row.following ?? 0,
    followers: row.followers ?? 0,
    likesReceived: row.likes_received ?? 0,
    energy: row.energy ?? 10,
    isBot: Boolean(row.is_bot),
    role: row.role || (row.is_bot ? "bot" : "user"),
  };
}

function mapPost(row) {
  const author = row.profiles || {};
  const commentCount = Array.isArray(row.comments)
    ? row.comments[0]?.count ?? 0
    : row.comments?.count ?? row.comments_count ?? 0;
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const latentTags = tags
    .map((t) => String(t))
    .filter((t) => t.startsWith("@"))
    .map((t) => t.slice(1));

  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    author: {
      id: author.id || row.user_id,
      nickname: author.nickname || "匿名旅人",
      avatar: author.avatar || DEFAULT_AVATAR(author.nickname || row.user_id),
    },
    mediaUrl: row.media_url,
    mediaType: row.media_type === "video" ? "video" : "photo",
    tags,
    latentTags,
    likes: row.likes_count ?? 0,
    comments: Number(commentCount) || 0,
    liked: Boolean(row.liked),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapComment(row) {
  const author = row.profiles || {};
  return {
    id: row.id,
    author: author.nickname || "匿名旅人",
    avatar: author.avatar || DEFAULT_AVATAR(author.nickname || row.user_id),
    text: row.content || row.text || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

async function requireUserId() {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!session?.user) {
    throw new Error("请先登录后再发布（右上角登录；需邮箱已确认）");
  }
  return session.user;
}

async function bumpEnergy(delta) {
  try {
    const user = await requireUserId();
    const { data } = await supabase.from("profiles").select("energy").eq("id", user.id).maybeSingle();
    const next = Math.max(0, Math.min(10, (data?.energy ?? 10) + delta));
    await supabase.from("profiles").update({ energy: next }).eq("id", user.id);
    return next;
  } catch {
    return null;
  }
}

/** Auth & Profile */

export async function loginWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    if (!email?.trim() || !password) throw new Error("请填写邮箱和密码");
    return demoProfile(email);
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    const msg = error.message || "";
    if (/confirm|not confirmed|Email not confirmed/i.test(msg)) {
      throw new Error(
        "邮箱还没确认：请到邮箱点确认链接；或打开 Supabase → Authentication → Users，点该用户右侧 Confirm / 验证邮箱后再登录",
      );
    }
    if (/Invalid login credentials/i.test(msg)) {
      throw new Error("邮箱或密码不对。若刚注册失败过，账号可能已存在——请用原密码登录，或换邮箱重新注册");
    }
    throw error;
  }

  const profile = await getCurrentUserProfile();
  if (profile) return profile;

  // Session exists but profile row missing — create a minimal one
  const user = data.user;
  const nickname = email.split("@")[0] || "云端旅人";
  const { error: insertErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      nickname,
      avatar: DEFAULT_AVATAR(nickname),
      bio: "在云朵里收集变身魔法的小旅人 ✧",
      cover: DEFAULT_COVER,
      following: 0,
      followers: 0,
      likes_received: 0,
      energy: 10,
    },
    { onConflict: "id" },
  );
  if (insertErr) throw insertErr;
  return getCurrentUserProfile();
}

export async function signUpWithEmail(email, password, nickname) {
  if (!isSupabaseConfigured) {
    if (!email?.trim() || !password) throw new Error("请填写邮箱和密码");
    return demoProfile(email, nickname);
  }
  const nick = (nickname || email.split("@")[0] || "云端旅人").trim();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { nickname: nick },
    },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message || "")) {
      throw new Error("该邮箱已注册，请切换到「邮箱登录」");
    }
    throw error;
  }
  if (!data.user) throw new Error("注册失败，请稍后再试");

  // Supabase: duplicate email often returns user with empty identities
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("该邮箱已注册（profiles 里可能已有记录），请直接登录");
  }

  // Profile row is normally created by DB trigger on auth.users.
  // Only upsert when we already have a session (RLS needs auth.uid()).
  if (data.session) {
    const { error: upsertErr } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email || email.trim(),
        nickname: nick,
        avatar: DEFAULT_AVATAR(nick),
        bio: "在云朵里收集变身魔法的小旅人 ✧",
        cover: DEFAULT_COVER,
        following: 0,
        followers: 0,
        likes_received: 0,
        energy: 10,
      },
      { onConflict: "id" },
    );
    if (upsertErr) console.warn("[signUp] profile upsert skipped:", upsertErr.message);
  }

  // Email confirmation enabled → no session yet; account + profile already exist
  if (!data.session) {
    const err = new Error(
      "账号已创建，但需要邮箱确认才能登录。请：① 查收确认邮件，或 ② Authentication → Providers → Email 关闭 Confirm email，再到 Users 里 Confirm 该用户",
    );
    err.code = "EMAIL_CONFIRM_REQUIRED";
    throw err;
  }

  const profile = await getCurrentUserProfile();
  if (profile) return profile;

  return mapProfile(
    {
      id: data.user.id,
      email: data.user.email || email.trim(),
      nickname: nick,
      avatar: DEFAULT_AVATAR(nick),
      bio: "在云朵里收集变身魔法的小旅人 ✧",
      cover: DEFAULT_COVER,
      following: 0,
      followers: 0,
      likes_received: 0,
      energy: 10,
    },
    email.trim(),
  );
}

export async function getCurrentUserProfile() {
  if (!isSupabaseConfigured) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return mapProfile(data, user.email);
}

/** Update nickname / bio / avatar / cover for current user */
export async function updateProfile({ nickname, bio, avatarUrl, coverUrl }) {
  if (!isSupabaseConfigured) {
    return {
      nickname: (nickname || "").trim() || "云端旅人",
      bio: bio ?? "",
      avatar: avatarUrl,
      cover: coverUrl,
    };
  }

  const user = await requireUserId();
  await ensureProfileRow(user);

  const patch = {};
  if (nickname != null) {
    const nick = String(nickname).trim();
    if (!nick) throw new Error("账号名称不能为空");
    if (nick.length > 32) throw new Error("账号名称最多 32 字");
    patch.nickname = nick;
  }
  if (bio != null) {
    patch.bio = String(bio).slice(0, 160);
  }
  if (avatarUrl) patch.avatar = avatarUrl;
  if (coverUrl) patch.cover = coverUrl;

  if (!Object.keys(patch).length) {
    return getCurrentUserProfile();
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    const msg = error.message || "";
    if (/row-level security|RLS|policy/i.test(msg)) {
      throw new Error("更新资料被拒绝（profiles RLS）：请确认已登录");
    }
    throw new Error(`更新资料失败：${msg}`);
  }
  return mapProfile(data, user.email);
}

export async function logout() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Posts & Comments */

export async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      user_id,
      title,
      description,
      media_url,
      media_type,
      tags,
      likes_count,
      created_at,
      profiles:user_id (
        id,
        nickname,
        avatar
      ),
      comments (count)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapPost);
}

/** Delete own post (requires RLS: Authors can delete own posts) */
export async function deletePost(postId) {
  if (!postId) throw new Error("缺少帖子 ID");
  if (String(postId).startsWith("ai-post-")) {
    throw new Error("演示帖不能删除");
  }

  if (!isSupabaseConfigured) return { id: postId };

  const user = await requireUserId();

  // Must .select() — without DELETE RLS, Supabase returns no error but 0 rows
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    const msg = error.message || "";
    if (/row-level security|RLS|policy|permission|403/i.test(msg)) {
      throw new Error("删除被拒绝：请在 Supabase SQL Editor 执行 supabase/fix-posts-delete.sql");
    }
    throw new Error(`删除失败：${msg}`);
  }

  if (!data?.length) {
    throw new Error(
      "删除未写入云端（常见原因：未开通删帖策略）。请打开 Supabase → SQL Editor，运行项目里的 supabase/fix-posts-delete.sql 后再删一次",
    );
  }

  return { id: data[0].id };
}

export async function togglePostLike(postId, currentLiked) {
  const delta = currentLiked ? -1 : 1;
  const { data, error } = await supabase.rpc("bump_post_likes", {
    p_post_id: postId,
    p_delta: delta,
  });

  if (!error && typeof data === "number") {
    return { likes: data, liked: !currentLiked };
  }

  // Fallback if RPC not deployed yet
  const { data: row, error: readErr } = await supabase
    .from("posts")
    .select("likes_count")
    .eq("id", postId)
    .single();
  if (readErr) throw readErr || error;

  const next = Math.max(0, (row?.likes_count ?? 0) + delta);
  const { data: updated, error: updateErr } = await supabase
    .from("posts")
    .update({ likes_count: next })
    .eq("id", postId)
    .select("likes_count")
    .single();
  if (updateErr) throw updateErr;

  return { likes: updated.likes_count, liked: !currentLiked };
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      id,
      post_id,
      user_id,
      content,
      created_at,
      profiles:user_id (
        id,
        nickname,
        avatar
      )
    `,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapComment);
}

export async function addComment(postId, text) {
  const user = await requireUserId();
  const content = String(text || "").trim();
  if (!content) throw new Error("评论不能为空");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
    })
    .select(
      `
      id,
      post_id,
      user_id,
      content,
      created_at,
      profiles:user_id (
        id,
        nickname,
        avatar
      )
    `,
    )
    .single();

  if (error) throw error;
  return mapComment(data);
}

async function ensureProfileRow(user, nicknameHint) {
  const nick =
    nicknameHint ||
    user.user_metadata?.nickname ||
    (user.email ? user.email.split("@")[0] : "") ||
    "云端旅人";

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing?.id) return existing.id;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email || "",
      nickname: nick,
      avatar: DEFAULT_AVATAR(nick),
      bio: "在云朵里收集变身魔法的小旅人 ✧",
      cover: DEFAULT_COVER,
      following: 0,
      followers: 0,
      likes_received: 0,
      energy: 10,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(`资料同步失败：${error.message}（请确认 profiles 表与 RLS 已按 schema.sql 建好）`);
  }
  return user.id;
}

function friendlyStorageError(err) {
  const msg = err?.message || String(err || "");
  if (/Bucket not found|not found/i.test(msg)) {
    return "找不到相册桶 chroma-media：请到 Supabase → Storage 确认已创建公开桶";
  }
  if (/row-level security|RLS|policy|not authorized|403/i.test(msg)) {
    return "上传被拒绝（Storage 权限）：请重新执行 schema.sql 中的 storage 策略，并确认已登录";
  }
  if (/JWT|session|Auth session missing|not authenticated/i.test(msg)) {
    return "登录状态失效，请重新登录后再发布";
  }
  return msg || "媒体上传失败";
}

/** Media & Upload */

export async function uploadMediaBlob(blob, fileType) {
  const user = await requireUserId();
  await ensureProfileRow(user);

  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("媒体文件为空，请重新拍摄后再发布");
  }

  const isVideo = fileType === "video";
  const ext = isVideo ? "webm" : "jpg";
  const contentType = blob.type || (isVideo ? "video/webm" : "image/jpeg");
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from("chroma-media").upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (uploadErr) throw new Error(friendlyStorageError(uploadErr));

  const { data } = supabase.storage.from("chroma-media").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("无法获取媒体公开地址");
  return data.publicUrl;
}

/** Convert capture item (dataURL / objectURL / blob) into a Blob for upload */
export async function mediaItemToBlob(item) {
  if (!item) throw new Error("没有可上传的媒体");
  if (item.blob instanceof Blob) return item.blob;

  const url = item.url;
  if (!url) throw new Error("媒体地址无效");

  if (url.startsWith("data:")) {
    const res = await fetch(url);
    return res.blob();
  }

  const res = await fetch(url);
  return res.blob();
}

export async function publishPostToFeed({ title, description, tags, mediaUrl, mediaType }) {
  const user = await requireUserId();
  await ensureProfileRow(user);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: title || "未命名魔法",
      description: description || "",
      tags: Array.isArray(tags) ? tags : [],
      media_url: mediaUrl,
      media_type: mediaType === "video" ? "video" : "photo",
      likes_count: 0,
    })
    .select(
      `
      id,
      user_id,
      title,
      description,
      media_url,
      media_type,
      tags,
      likes_count,
      created_at,
      profiles:user_id (
        id,
        nickname,
        avatar
      ),
      comments (count)
    `,
    )
    .single();

  if (error) {
    const msg = error.message || "";
    if (/foreign key|profiles/i.test(msg)) {
      throw new Error("发帖失败：用户资料 profiles 缺失，请重新登录一次后再试");
    }
    if (/row-level security|RLS|policy/i.test(msg)) {
      throw new Error("发帖被拒绝（posts 表 RLS）：请确认已登录，并重新执行 schema.sql 策略");
    }
    throw new Error(`发帖失败：${msg}`);
  }
  return mapPost(data);
}

export async function saveToPrivateMedia({ mediaUrl, mediaType }) {
  const user = await requireUserId();
  await ensureProfileRow(user);
  const { data, error } = await supabase
    .from("private_media")
    .insert({
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType === "video" ? "video" : "photo",
    })
    .select("*")
    .single();

  if (error) throw new Error(`私密相册保存失败：${error.message}`);
  return {
    id: data.id,
    url: data.media_url,
    type: data.media_type === "video" ? "video" : "photo",
    mediaUrl: data.media_url,
    mediaType: data.media_type === "video" ? "video" : "photo",
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
  };
}

export async function fetchPrivateMedia() {
  const user = await requireUserId();
  const { data, error } = await supabase
    .from("private_media")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    url: row.media_url,
    type: row.media_type === "video" ? "video" : "photo",
    mediaUrl: row.media_url,
    mediaType: row.media_type === "video" ? "video" : "photo",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }));
}

/** Delete one private album item (owner only) */
export async function deletePrivateMedia(mediaId) {
  if (!mediaId) throw new Error("缺少媒体 ID");

  if (!isSupabaseConfigured) return { id: mediaId };

  const user = await requireUserId();

  const { data, error } = await supabase
    .from("private_media")
    .delete()
    .eq("id", mediaId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    const msg = error.message || "";
    if (/row-level security|RLS|policy/i.test(msg)) {
      throw new Error("删除被拒绝：请确认已登录，并已执行 schema.sql 中的 private_media 删除策略");
    }
    throw new Error(`删除失败：${msg}`);
  }

  if (!data?.length) {
    throw new Error("删除未写入云端，请刷新后重试");
  }

  return { id: data[0].id };
}

/** Delete multiple private album items */
export async function deletePrivateMediaMany(mediaIds = []) {
  const ids = [...new Set((mediaIds || []).filter(Boolean))];
  if (!ids.length) return { ids: [] };

  if (!isSupabaseConfigured) return { ids };

  const user = await requireUserId();

  const { data, error } = await supabase
    .from("private_media")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error(`批量删除失败：${error.message || error}`);
  }

  if (!data?.length) {
    throw new Error("删除未写入云端，请刷新后重试");
  }

  return { ids: data.map((r) => r.id) };
}

/* ========== Social: search / follow / public profile ========== */

const LOCAL_FOLLOWS_KEY = "chroma-local-follows-v1";

function readLocalFollows() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FOLLOWS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalFollows(map) {
  try {
    localStorage.setItem(LOCAL_FOLLOWS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function botProfilesFallback() {
  return [
    {
      id: "a1111111-1111-4111-8111-111111111111",
      nickname: "咕咕指挥官",
      avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Commander&backgroundColor=93c5fd",
      bio: "企鹅军团检阅官。SAM2 精准、羽化整齐！🏅",
      cover: DEFAULT_COVER,
      following: 0,
      followers: 128,
      likesReceived: 886,
      energy: 10,
      isBot: true,
      role: "bot",
    },
    {
      id: "a2222222-2222-4222-8222-222222222222",
      nickname: "极客企鹅小蓝",
      avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=GeekBlue&backgroundColor=a5f3fc",
      bio: "延迟实验室常驻研究员 ✦",
      cover: DEFAULT_COVER,
      following: 0,
      followers: 96,
      likesReceived: 642,
      energy: 10,
      isBot: true,
      role: "bot",
    },
    {
      id: "a3333333-3333-4333-8333-333333333333",
      nickname: "南极诗社小咪",
      avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=PoetMimi&backgroundColor=fbcfe8",
      bio: "把雨滴编进时光水晶 ✨",
      cover: DEFAULT_COVER,
      following: 0,
      followers: 204,
      likesReceived: 1204,
      energy: 10,
      isBot: true,
      role: "bot",
    },
  ];
}

/** Search by nickname (fuzzy) or exact user id */
export async function searchUsers(query, { limit = 20 } = {}) {
  const q = String(query || "").trim();
  if (!q) return [];

  if (!isSupabaseConfigured) {
    const bots = botProfilesFallback();
    const lower = q.toLowerCase();
    return bots.filter(
      (u) => u.nickname.toLowerCase().includes(lower) || u.id.toLowerCase().includes(lower),
    );
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

  let req = supabase
    .from("profiles")
    .select("*")
    .order("followers", { ascending: false })
    .limit(limit);

  if (isUuid) {
    req = req.or(`id.eq.${q},nickname.ilike.%${q}%`);
  } else {
    req = req.ilike("nickname", `%${q}%`);
  }

  const { data, error } = await req;
  if (error) throw new Error(`搜索失败：${error.message}`);
  return (data || []).map((row) => mapProfile(row));
}

export async function fetchProfileById(userId) {
  if (!userId) return null;

  if (!isSupabaseConfigured) {
    return botProfilesFallback().find((u) => u.id === userId) || null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return mapProfile(data);
}

export async function fetchPostsByUserId(userId) {
  if (!userId) return [];

  if (!isSupabaseConfigured) {
    const { AI_BOT_SEED_POSTS } = await import("../agent/mockAgent.js");
    return AI_BOT_SEED_POSTS.filter((p) => p.author?.id === userId);
  }

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      user_id,
      title,
      description,
      media_url,
      media_type,
      tags,
      likes_count,
      created_at,
      profiles:user_id (
        id,
        nickname,
        avatar
      ),
      comments (count)
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapPost);
}

export async function isFollowing(targetUserId) {
  if (!targetUserId) return false;

  if (!isSupabaseConfigured) {
    const map = readLocalFollows();
    return Boolean(map[`demo-local:${targetUserId}`]);
  }

  let user;
  try {
    user = await requireUserId();
  } catch {
    return false;
  }

  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

/** Follow or unfollow. Returns { following, profile, me } */
export async function toggleFollow(targetUserId) {
  if (!targetUserId) throw new Error("缺少目标用户");

  if (!isSupabaseConfigured) {
    const me = "demo-local";
    if (targetUserId === me) throw new Error("不能关注自己");
    const map = readLocalFollows();
    const key = `${me}:${targetUserId}`;
    const nowFollowing = !map[key];
    if (nowFollowing) map[key] = true;
    else delete map[key];
    writeLocalFollows(map);
    const profile = await fetchProfileById(targetUserId);
    if (profile) {
      profile.followers = Math.max(0, (profile.followers || 0) + (nowFollowing ? 1 : -1));
    }
    return { following: nowFollowing, profile, me: null };
  }

  const user = await requireUserId();
  if (user.id === targetUserId) throw new Error("不能关注自己");

  const already = await isFollowing(targetUserId);

  if (already) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    if (error) throw new Error(`取消关注失败：${error.message}`);
  } else {
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        /* ignore */
      } else if (/row-level security|RLS|policy|relation.*follows|does not exist/i.test(error.message || "")) {
        throw new Error("关注失败：请先在 Supabase 执行 supabase/social-follows-bots.sql");
      } else {
        throw new Error(`关注失败：${error.message}`);
      }
    }
  }

  const [profile, me] = await Promise.all([fetchProfileById(targetUserId), getCurrentUserProfile()]);
  return { following: !already, profile, me };
}
