import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bird, Cloud, Compass, Loader2, Rainbow, Sparkles, Users } from "lucide-react";
import Navbar from "./components/Navbar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import FeedView from "./components/FeedView.jsx";
import ProfileView from "./components/ProfileView.jsx";
import PublicProfileView from "./components/PublicProfileView.jsx";
import UserSearchModal from "./components/UserSearchModal.jsx";
import PublishSuccessModal from "./components/PublishSuccessModal.jsx";
import FloatingPenguinAgent from "./components/agent/FloatingPenguinAgent.jsx";
import { EnergyProvider, useEnergy } from "./energy/EnergyContext.jsx";
import { ToastProvider, useToast } from "./components/Toast.jsx";
import { FloatingClouds, Mode1View, Mode2View } from "./creation/CreateEngine.jsx";
import { AgentProvider, usePenguinAgent } from "./agent/AgentContext.jsx";
import { mergeFeedWithAgentSeeds } from "./agent/mockAgent.js";
import { deriveLatentTags, mergePublicAndLatentTags } from "./agent/latentTags.js";
import { supabase, isSupabaseConfigured } from "@/config/supabase";
import {
  addComment,
  deletePost,
  deletePrivateMedia,
  deletePrivateMediaMany,
  fetchComments,
  fetchPosts,
  fetchPrivateMedia,
  fetchPostsByUserId,
  fetchProfileById,
  getCurrentUserProfile,
  isFollowing,
  logout,
  mediaItemToBlob,
  publishPostToFeed,
  saveToPrivateMedia,
  toggleFollow,
  togglePostLike,
  updateProfile,
  uploadMediaBlob,
} from "@/services/api";

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function AppShell() {
  const [currentView, setCurrentView] = useState("home");
  const [lastCapture, setLastCapture] = useState(null);
  const [publishItem, setPublishItem] = useState(null);
  const [userEnergyBridge, setUserEnergyBridge] = useState({ energy: null, id: null });

  return (
    <EnergyProvider userEnergy={userEnergyBridge.energy} userId={userEnergyBridge.id}>
      <AgentProvider
        currentView={currentView}
        lastCapture={lastCapture}
        onNavigate={setCurrentView}
        onRequestPublish={(item) => {
          setLastCapture(item);
          setPublishItem(item);
        }}
      >
        <AppShellBody
          currentView={currentView}
          setCurrentView={setCurrentView}
          lastCapture={lastCapture}
          setLastCapture={setLastCapture}
          publishItem={publishItem}
          setPublishItem={setPublishItem}
          onUserEnergy={(energy, id) => setUserEnergyBridge({ energy, id })}
        />
      </AgentProvider>
    </EnergyProvider>
  );
}

function AppShellBody({
  currentView,
  setCurrentView,
  lastCapture,
  setLastCapture,
  publishItem,
  setPublishItem,
  onUserEnergy,
}) {
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [posts, setPosts] = useState(() => mergeFeedWithAgentSeeds([]));
  const [commentsMap, setCommentsMap] = useState({});
  const [privateMedia, setPrivateMedia] = useState([]);
  const [publishBatch, setPublishBatch] = useState(null);
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewingPosts, setViewingPosts] = useState([]);
  const [viewingFollowing, setViewingFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const { pushToast } = useToast();
  const agent = usePenguinAgent();

  useEffect(() => {
    onUserEnergy?.(user?.energy ?? null, user?.id ?? null);
  }, [user?.energy, user?.id, onUserEnergy]);

  const likedPosts = useMemo(() => posts.filter((p) => p.liked), [posts]);

  const refreshPosts = useCallback(async () => {
    const list = await fetchPosts();
    setPosts((prev) => {
      const likedById = new Map(prev.map((p) => [p.id, p.liked]));
      const badgeById = new Map(prev.filter((p) => p.agentBadge).map((p) => [p.id, p.agentBadge]));
      const mapped = list.map((p) => ({
        ...p,
        liked: likedById.get(p.id) ?? p.liked,
        agentBadge: badgeById.get(p.id) || p.agentBadge,
      }));
      return mergeFeedWithAgentSeeds(mapped);
    });
    return list;
  }, []);

  const refreshPrivate = useCallback(async () => {
    try {
      const list = await fetchPrivateMedia();
      setPrivateMedia(list);
      return list;
    } catch {
      setPrivateMedia([]);
      return [];
    }
  }, []);

  const socialScheduledRef = useRef(new Set());

  const injectAgentCommentsNow = useCallback(
    (post) => {
      if (!post?.id) return false;
      let injected = false;
      setCommentsMap((prev) => {
        const existing = prev[post.id] || [];
        if (existing.some((c) => c.isAgent)) return prev;
        const reactions = agent.triggerSocialAgents(post);
        if (!reactions?.length) return prev;
        injected = true;
        const seeded = reactions.map((r, i) => ({
          ...r.comment,
          id: `ai-c-${post.id}-${r.bot.id}`,
          createdAt: Date.now() + i,
        }));
        return {
          ...prev,
          [post.id]: [...existing, ...seeded].sort(
            (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
          ),
        };
      });
      return injected;
    },
    [agent],
  );

  const scheduleSocialAgents = useCallback(
    (post) => {
      if (!post?.id || socialScheduledRef.current.has(post.id)) return;
      socialScheduledRef.current.add(post.id);

      const reactions = agent.triggerSocialAgents(post);
      if (!reactions?.length) return;

      // Immediately available when opening the post; toasts still stagger
      injectAgentCommentsNow(post);

      reactions.forEach((r, i) => {
        const delay = r.delayMs ?? 1200 + i * 900;
        window.setTimeout(() => {
          if (r.badge) agent.pushBadge(r.badge);
          pushToast(`${r.bot?.nickname || "AI 企鹅"}顺着氛围标签来评论了！`);
          setPosts((prev) =>
            prev.map((p) =>
              p.id === post.id
                ? {
                    ...p,
                    likes: (p.likes || 0) + (r.likeBump || 0),
                    agentBadge: p.agentBadge || r.badge,
                    latentTags: p.latentTags || post.latentTags,
                  }
                : p,
            ),
          );
        }, delay);
      });

      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                comments: Math.max(p.comments || 0, reactions.length),
                agentBadge: p.agentBadge || reactions[0]?.badge,
                latentTags: p.latentTags || post.latentTags,
              }
            : p,
        ),
      );
    },
    [agent, pushToast, injectAgentCommentsNow],
  );

  /** Keep local AI bot comments when merging with remote DB comments */
  const mergeCommentsPreservingAgents = useCallback((postId, remoteList = []) => {
    setCommentsMap((prev) => {
      const existing = prev[postId] || [];
      const agentOnes = existing.filter((c) => c.isAgent);
      const remoteIds = new Set((remoteList || []).map((c) => c.id));
      const merged = [
        ...(remoteList || []),
        ...agentOnes.filter((c) => !remoteIds.has(c.id)),
      ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return { ...prev, [postId]: merged };
    });
  }, []);

  const onNeedComments = useCallback(
    async (postId, post) => {
      // Always show AI bots when opening (local-only; not in Supabase)
      if (post) injectAgentCommentsNow(post);
      else if (String(postId).startsWith("ai-post-")) {
        injectAgentCommentsNow({ id: postId });
      }

      if (String(postId).startsWith("ai-post-")) return;

      try {
        const list = await fetchComments(postId);
        mergeCommentsPreservingAgents(postId, list);
        // Re-inject after merge in case remote replace raced
        if (post) injectAgentCommentsNow(post);
      } catch (err) {
        console.error(err);
        if (post) injectAgentCommentsNow(post);
      }
    },
    [injectAgentCommentsNow, mergeCommentsPreservingAgents],
  );

  useEffect(() => {
    let cancelled = false;
    let bootTimer = window.setTimeout(() => {
      if (!cancelled) setBooting(false);
    }, 3500);

    (async () => {
      try {
        if (!isSupabaseConfigured) {
          if (!cancelled) {
            setPosts(mergeFeedWithAgentSeeds([]));
            setBooting(false);
          }
          return;
        }

        const [{ data: sessionData }, feed] = await withTimeout(
          Promise.all([
            supabase.auth.getSession().catch(() => ({ data: { session: null } })),
            fetchPosts().catch((err) => {
              console.error(err);
              return [];
            }),
          ]),
          3000,
          [{ data: { session: null } }, []],
        );

        if (cancelled) return;
        setPosts(mergeFeedWithAgentSeeds(feed || []));

        if (sessionData?.session) {
          const profile = await withTimeout(getCurrentUserProfile().catch(() => null), 2000, null);
          if (!cancelled && profile) {
            setUser(profile);
            await withTimeout(refreshPrivate().catch(() => []), 2000, []);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setPosts(mergeFeedWithAgentSeeds([]));
          pushToast("云端数据加载失败，已载入 AI 原住民演示帖", "error");
        }
      } finally {
        window.clearTimeout(bootTimer);
        if (!cancelled) setBooting(false);
      }
    })();

    if (!isSupabaseConfigured) {
      return () => {
        cancelled = true;
        window.clearTimeout(bootTimer);
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setPrivateMedia([]);
        return;
      }
      if (session) {
        const profile = await getCurrentUserProfile().catch(() => null);
        setUser(profile);
        if (profile) refreshPrivate().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(bootTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount
  }, []);

  const goHome = useCallback(() => setCurrentView("home"), [setCurrentView]);

  const requireAuth = useCallback(
    (action) => {
      if (!user) {
        setAuthOpen(true);
        pushToast("先登录才能使用完整魔法喔～");
        return false;
      }
      action?.();
      return true;
    },
    [user, pushToast],
  );

  const navigate = useCallback(
    (view) => {
      if (view === "profile" && !user) {
        setAuthOpen(true);
        pushToast("先登录再进入个人主页～");
        return;
      }
      if (view !== "user") setViewingProfile(null);
      setCurrentView(view);
    },
    [user, pushToast, setCurrentView],
  );

  const onToggleLike = useCallback(
    async (id) => {
      const target = posts.find((p) => p.id === id);
      if (!target) return;

      // Local-only for seeded AI posts
      if (String(id).startsWith("ai-post-") || target.isAgent) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  liked: !p.liked,
                  likes: p.liked ? Math.max(0, p.likes - 1) : p.likes + 1,
                }
              : p,
          ),
        );
        return;
      }

      const prevLiked = Boolean(target.liked);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                liked: !prevLiked,
                likes: prevLiked ? Math.max(0, p.likes - 1) : p.likes + 1,
              }
            : p,
        ),
      );

      try {
        const result = await togglePostLike(id, prevLiked);
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, liked: result.liked, likes: result.likes } : p)),
        );
      } catch (err) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  liked: prevLiked,
                  likes: prevLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
                }
              : p,
          ),
        );
        pushToast(err?.message || "点赞失败", "error");
      }
    },
    [posts, pushToast],
  );

  const onAddComment = useCallback(
    async (postId, text) => {
      if (!user) {
        setAuthOpen(true);
        pushToast("登录后才能评论喔～");
        return;
      }
      if (String(postId).startsWith("ai-post-")) {
        const comment = {
          id: crypto.randomUUID(),
          author: user.nickname,
          avatar: user.avatar,
          text,
          createdAt: Date.now(),
        };
        setCommentsMap((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comment],
        }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p)),
        );
        return;
      }
      try {
        const comment = await addComment(postId, text);
        setCommentsMap((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comment],
        }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p)),
        );
      } catch (err) {
        pushToast(err?.message || "评论发送失败", "error");
      }
    },
    [user, pushToast],
  );

  const onCaptureSuccess = useCallback(
    (item) => {
      setLastCapture(item);
      setPublishItem(item);
    },
    [setLastCapture, setPublishItem],
  );

  const savePrivate = useCallback(
    async (item) => {
      if (!user) {
        setAuthOpen(true);
        pushToast("登录后即可保存私密相册～");
        return;
      }
      setSaving(true);
      try {
        const blob = await mediaItemToBlob(item);
        const mediaUrl = await uploadMediaBlob(blob, item.type);
        const saved = await saveToPrivateMedia({
          mediaUrl,
          mediaType: item.type === "video" ? "video" : "photo",
        });
        setPrivateMedia((prev) => [saved, ...prev]);
        setPublishItem(null);
        const profile = await getCurrentUserProfile();
        if (profile) setUser(profile);
        pushToast("已保存至私密相册 ✦");
      } catch (err) {
        pushToast(err?.message || "保存失败", "error");
      } finally {
        setSaving(false);
      }
    },
    [pushToast, user, setPublishItem],
  );

  const isRemoteMediaUrl = (url) =>
    typeof url === "string" &&
    /^https?:\/\//i.test(url) &&
    !url.startsWith("blob:") &&
    !url.startsWith("data:");

  const publishToFeed = useCallback(
    async ({ item, items, title, description, tags, fromPrivate }) => {
      if (!user) {
        setAuthOpen(true);
        pushToast("登录后即可发布到社区～");
        return;
      }
      const queue = (items?.length ? items : item ? [item] : []).filter(Boolean);
      if (!queue.length) {
        pushToast("没有可发布的媒体", "error");
        return;
      }

      setSaving(true);
      try {
        const created = [];
        for (let i = 0; i < queue.length; i += 1) {
          const current = queue[i];
          const mediaType = current.type === "video" ? "video" : "photo";
          let mediaUrl = current.url;

          if (!isRemoteMediaUrl(mediaUrl)) {
            const blob = await mediaItemToBlob(current);
            mediaUrl = await uploadMediaBlob(blob, current.type);
          }

          const postTitle =
            queue.length > 1 ? `${title || "私密相册分享"}${queue.length > 1 ? ` · ${i + 1}` : ""}` : title;
          const publicTags = tags?.length ? tags : ["#云端变身"];
          const latent =
            current.latentTags?.length
              ? current.latentTags
              : deriveLatentTags(current.genPrompt || description || title, {
                  mode: current.mode,
                });
          const mergedTags = mergePublicAndLatentTags(publicTags, latent);

          const post = await publishPostToFeed({
            title: postTitle,
            description,
            tags: mergedTags,
            mediaUrl,
            mediaType,
          });
          created.push({
            ...post,
            genPrompt: current.genPrompt,
            latentTags: latent,
            tags: mergedTags,
          });

          if (!fromPrivate && !current.fromPrivate) {
            try {
              await saveToPrivateMedia({ mediaUrl, mediaType });
            } catch (privErr) {
              console.warn(privErr);
            }
          }
        }

        if (!fromPrivate) {
          try {
            await refreshPrivate();
          } catch {
            /* ignore */
          }
        }

        setPosts((prev) =>
          mergeFeedWithAgentSeeds([...created, ...prev.filter((p) => !created.some((c) => c.id === p.id))]),
        );
        setPublishItem(null);
        setPublishBatch(null);
        const profile = await getCurrentUserProfile().catch(() => null);
        if (profile) setUser(profile);
        pushToast(
          created.length > 1
            ? `已发布 ${created.length} 条到变身社区 ✦`
            : "已发布到变身社区！可在 Table Editor → posts 看到记录 ✦",
        );
        setCurrentView("feed");
        created.forEach((post) => scheduleSocialAgents(post));
      } catch (err) {
        console.error(err);
        if (!isSupabaseConfigured) {
          const localPosts = (items?.length ? items : [item]).map((current, i) => {
            const publicTags = tags?.length ? tags : ["#云端变身"];
            const latent =
              current.latentTags?.length
                ? current.latentTags
                : deriveLatentTags(current.genPrompt || description || title, {
                    mode: current.mode,
                  });
            return {
              id: crypto.randomUUID(),
              title: `${title}${items?.length > 1 ? ` · ${i + 1}` : ""}`,
              description,
              author: {
                id: user.id,
                nickname: user.nickname,
                avatar: user.avatar,
              },
              mediaUrl: current.url,
              mediaType: current.type === "video" ? "video" : "photo",
              tags: mergePublicAndLatentTags(publicTags, latent),
              genPrompt: current.genPrompt,
              latentTags: latent,
              likes: 0,
              comments: 0,
              liked: false,
              createdAt: Date.now(),
              _mine: true,
            };
          });
          setPosts((prev) => [...localPosts, ...prev]);
          setPublishItem(null);
          setPublishBatch(null);
          pushToast("演示模式：已本地显示（未写入云端）");
          setCurrentView("feed");
          localPosts.forEach((p) => scheduleSocialAgents(p));
          return;
        }
        pushToast(err?.message || "发布失败，请检查登录与 Storage 桶", "error");
      } finally {
        setSaving(false);
      }
    },
    [pushToast, user, refreshPrivate, scheduleSocialAgents, setCurrentView],
  );

  const openPublishFromPrivate = useCallback((items) => {
    if (!items?.length) return;
    setPublishBatch(items);
    setPublishItem(items[0]);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setPrivateMedia([]);
    setCurrentView("home");
    pushToast("已退出登录，传送门暂时关闭～");
  }, [pushToast, setCurrentView]);

  const handleDeletePost = useCallback(
    async (post) => {
      if (!post?.id) return;
      if (!user) {
        setAuthOpen(true);
        pushToast("登录后才能删除自己的帖子～");
        return;
      }
      if (String(post.id).startsWith("ai-post-")) {
        pushToast("AI 演示帖不能删除", "error");
        return;
      }
      const ok = window.confirm(`确定删除「${post.title || "这篇帖子"}」吗？删除后无法恢复。`);
      if (!ok) return;

      try {
        if (isSupabaseConfigured) {
          await deletePost(post.id);
        }
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setCommentsMap((prev) => {
          const next = { ...prev };
          delete next[post.id];
          return next;
        });
        socialScheduledRef.current.delete(post.id);
        pushToast("已删除帖子 ✦");
      } catch (err) {
        console.error(err);
        pushToast(err?.message || "删除失败", "error");
      }
    },
    [user, pushToast],
  );

  const handleDeletePrivate = useCallback(
    async (items) => {
      const list = (Array.isArray(items) ? items : items ? [items] : []).filter(Boolean);
      if (!list.length) return;
      if (!user) {
        setAuthOpen(true);
        pushToast("登录后才能管理私密相册～");
        return;
      }
      const label =
        list.length === 1
          ? list[0].type === "video" || list[0].mediaType === "video"
            ? "这段视频"
            : "这张图片"
          : `选中的 ${list.length} 项`;
      const ok = window.confirm(`确定从私密相册删除${label}吗？删除后无法恢复。`);
      if (!ok) return;

      const ids = list.map((m) => m.id).filter(Boolean);
      try {
        if (isSupabaseConfigured) {
          if (ids.length === 1) await deletePrivateMedia(ids[0]);
          else await deletePrivateMediaMany(ids);
        }
        const idSet = new Set(ids);
        setPrivateMedia((prev) => prev.filter((m) => !idSet.has(m.id)));
        pushToast(list.length > 1 ? `已删除 ${list.length} 项 ✦` : "已从私密相册删除 ✦");
      } catch (err) {
        console.error(err);
        pushToast(err?.message || "删除失败", "error");
      }
    },
    [user, pushToast],
  );

  const openUserProfile = useCallback(
    async (authorOrId) => {
      const id = typeof authorOrId === "string" ? authorOrId : authorOrId?.id;
      if (!id) return;

      if (user?.id && id === user.id) {
        setViewingProfile(null);
        setCurrentView("profile");
        return;
      }

      try {
        let profile = await fetchProfileById(id);
        if (!profile && authorOrId && typeof authorOrId === "object") {
          profile = {
            id,
            nickname: authorOrId.nickname || "旅人",
            avatar: authorOrId.avatar,
            bio: authorOrId.bio || "云端旅人 ✧",
            cover:
              authorOrId.cover ||
              "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80&auto=format&fit=crop",
            following: authorOrId.following ?? 0,
            followers: authorOrId.followers ?? 0,
            likesReceived: authorOrId.likesReceived ?? 0,
            isBot: Boolean(authorOrId.isBot || authorOrId.isAgent),
            role: authorOrId.role || "user",
          };
        }
        if (!profile) {
          pushToast("找不到该用户", "error");
          return;
        }

        const [postsOfUser, followed] = await Promise.all([
          fetchPostsByUserId(id).catch(() => posts.filter((p) => p.author?.id === id)),
          user ? isFollowing(id).catch(() => false) : Promise.resolve(false),
        ]);

        const merged = postsOfUser?.length ? postsOfUser : posts.filter((p) => p.author?.id === id);

        setViewingProfile(profile);
        setViewingPosts(merged);
        setViewingFollowing(Boolean(followed));
        setCurrentView("user");
        setSearchOpen(false);
      } catch (err) {
        console.error(err);
        pushToast(err?.message || "打开主页失败", "error");
      }
    },
    [user, posts, pushToast, setCurrentView],
  );

  const handleFollowToggle = useCallback(
    async (profile) => {
      if (!user) {
        setAuthOpen(true);
        pushToast("登录后才能关注喔～");
        return null;
      }
      if (!profile?.id) return null;
      setFollowBusy(true);
      try {
        const res = await toggleFollow(profile.id);
        if (res.me) setUser(res.me);
        if (res.profile) setViewingProfile(res.profile);
        setViewingFollowing(res.following);
        pushToast(res.following ? `已关注 ${profile.nickname}` : `已取消关注 ${profile.nickname}`);
        return res;
      } catch (err) {
        console.error(err);
        pushToast(err?.message || "关注失败", "error");
        return null;
      } finally {
        setFollowBusy(false);
      }
    },
    [user, pushToast],
  );

  const handleUpdateProfile = useCallback(
    async ({ nickname, bio, avatarBlob, coverBlob }) => {
      if (!user) {
        setAuthOpen(true);
        pushToast("请先登录");
        return false;
      }
      setProfileSaving(true);
      try {
        let avatarUrl;
        let coverUrl;

        if (avatarBlob) {
          if (isSupabaseConfigured) {
            avatarUrl = await uploadMediaBlob(avatarBlob, "photo");
          } else {
            avatarUrl = URL.createObjectURL(avatarBlob);
          }
        }
        if (coverBlob) {
          if (isSupabaseConfigured) {
            coverUrl = await uploadMediaBlob(coverBlob, "photo");
          } else {
            coverUrl = URL.createObjectURL(coverBlob);
          }
        }

        if (!isSupabaseConfigured) {
          setUser((prev) => ({
            ...prev,
            nickname: nickname || prev.nickname,
            bio: bio ?? prev.bio,
            avatar: avatarUrl || prev.avatar,
            cover: coverUrl || prev.cover,
          }));
          pushToast("演示模式：资料已更新（未写入云端）");
          return true;
        }

        const next = await updateProfile({
          nickname,
          bio,
          avatarUrl,
          coverUrl,
        });
        setUser(next);
        setPosts((prev) =>
          prev.map((p) =>
            p.author?.id === next.id
              ? {
                  ...p,
                  author: {
                    ...p.author,
                    nickname: next.nickname,
                    avatar: next.avatar,
                  },
                }
              : p,
          ),
        );
        pushToast("主页资料已保存 ✦");
        return true;
      } catch (err) {
        console.error(err);
        pushToast(err?.message || "保存资料失败", "error");
        return false;
      } finally {
        setProfileSaving(false);
      }
    },
    [user, pushToast],
  );

  if (booting) {
    return (
      <div className="relative flex min-h-screen items-center justify-center font-cute text-sky-800">
        <FloatingClouds />
        <div className="glass-card relative z-10 flex items-center gap-3 rounded-3xl px-6 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <span className="text-sm font-semibold">正在连接云端魔法库…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden font-cute text-sky-900">
      <FloatingClouds />
      <Navbar
        currentView={currentView}
        onNavigate={navigate}
        user={user}
        onAuthOpen={() => setAuthOpen(true)}
        onProfile={() => {
          setViewingProfile(null);
          navigate("profile");
        }}
        onSearchUsers={() => setSearchOpen(true)}
        agentStatus={agent.status}
        onOpenAgent={() => agent.setOpen(true)}
      />

      <main className="pb-28 sm:pb-10">
        {currentView === "home" && (
          <HomeLanding
            user={user}
            onCreate1={() => setCurrentView("create1")}
            onCreate2={() => setCurrentView("create2")}
            onFeed={() => setCurrentView("feed")}
            onAuth={() => setAuthOpen(true)}
          />
        )}

        {currentView === "create1" && (
          <Mode1View
            onHome={goHome}
            onAddMedia={() => {}}
            onCaptureSuccess={onCaptureSuccess}
            onAskAgent={() => agent.askAgentOpinion("create1")}
          />
        )}

        {currentView === "create2" && (
          <Mode2View
            onHome={goHome}
            onAddMedia={() => {}}
            onCaptureSuccess={onCaptureSuccess}
            onAskAgent={() => agent.askAgentOpinion("create2")}
            onOptimizePrompt={agent.optimizePrompt}
            registerPromptSetter={agent.registerPromptSetter}
          />
        )}

        {currentView === "feed" && (
          <FeedView
            posts={posts}
            commentsMap={commentsMap}
            onToggleLike={onToggleLike}
            onAddComment={onAddComment}
            onNeedComments={onNeedComments}
            onOpenAuthor={openUserProfile}
            onTrySame={(post) => {
              requireAuth(() => {
                setCurrentView("create1");
                pushToast(`同款灵感已就绪：${post.tags?.[0] || "变身"}`);
              });
            }}
          />
        )}

        {currentView === "user" && (
          <PublicProfileView
            profile={viewingProfile}
            posts={viewingPosts}
            isOwn={Boolean(user && viewingProfile?.id === user.id)}
            following={viewingFollowing}
            followBusy={followBusy}
            onBack={() => {
              setViewingProfile(null);
              setCurrentView("feed");
            }}
            onFollowToggle={handleFollowToggle}
            onOpenPost={(post) => {
              setCurrentView("feed");
              // slight delay so feed mounts then user can open — or keep simple toast
              pushToast(`可在社区中打开「${post.title}」查看详情`);
            }}
            onOpenOwnProfile={() => {
              setViewingProfile(null);
              setCurrentView("profile");
            }}
          />
        )}

        {currentView === "profile" && (
          <ProfileView
            user={user}
            posts={posts}
            privateMedia={privateMedia}
            likedPosts={likedPosts}
            agentBadges={agent.badges}
            onLogout={handleLogout}
            onOpenPost={() => setCurrentView("feed")}
            onPublishPrivate={openPublishFromPrivate}
            onDeletePost={handleDeletePost}
            onDeletePrivate={handleDeletePrivate}
            onUpdateProfile={handleUpdateProfile}
            profileSaving={profileSaving}
          />
        )}
      </main>

      <UserSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectUser={(u) => openUserProfile(u)}
      />

      <FloatingPenguinAgent suppress={Boolean(publishItem) || authOpen || profileSaving || searchOpen} />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={async (u) => {
          setUser(u);
          try {
            await refreshPosts();
            await refreshPrivate();
          } catch (err) {
            console.error(err);
          }
        }}
      />

      <PublishSuccessModal
        open={Boolean(publishItem)}
        item={publishItem}
        batchItems={publishBatch}
        busy={saving}
        defaultExpand={Boolean(publishItem?.fromPrivate)}
        hideSavePrivate={Boolean(publishItem?.fromPrivate)}
        onClose={() => {
          if (saving) return;
          setPublishItem(null);
          setPublishBatch(null);
        }}
        onSavePrivate={(item) => {
          if (!user) {
            setAuthOpen(true);
            pushToast("登录后即可保存私密相册～");
            return;
          }
          savePrivate(item);
        }}
        onPublish={(payload) => {
          if (!user) {
            setAuthOpen(true);
            pushToast("登录后即可发布到社区～");
            return;
          }
          publishToFeed(payload);
        }}
      />
    </div>
  );
}

function HomeLanding({ onCreate1, onCreate2, onFeed, onAuth, user }) {
  const { energy, maxEnergy, secondsUntilNext, isFull } = useEnergy();
  return (
    <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-4xl flex-col items-center justify-center px-4 py-12 animate-fadeIn">
      <header className="mb-10 text-center">
        <div className="mb-4 flex items-center justify-center gap-3 text-sky-500">
          <Cloud className="h-8 w-8 animate-floaty" />
          <Rainbow className="h-9 w-9" />
          <Bird className="h-9 w-9 animate-floaty" style={{ animationDelay: "0.8s" }} />
        </div>
        <h1
          className="text-4xl font-bold tracking-wide text-sky-800 drop-shadow-sm sm:text-5xl md:text-6xl"
          style={{ textShadow: "0 4px 0 rgba(255,255,255,0.55)" }}
        >
          ChromaPenguin-Live
        </h1>
        <p className="mt-4 text-base text-sky-700/80 sm:text-lg">
          梦幻云端变身站·实时AIGC小程序
        </p>
        <p className="mt-2 text-sm font-semibold text-sky-600">
          {user ? `你好，${user.nickname}！` : ""}
          体力 {energy}/{maxEnergy}
          {!isFull ? ` · ${secondsUntilNext}s 后恢复下一格` : " · 已满 ✦"}
        </p>
      </header>

      <div className="glass-card w-full max-w-xl space-y-4 rounded-3xl p-6 shadow-soft sm:p-8">
        <button
          type="button"
          onClick={onCreate1}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-sky-300 via-sky-400 to-pink-300
            px-6 py-4 text-lg font-semibold text-white shadow-cloud transition hover:scale-[1.02] active:scale-[0.98]"
        >
          <Bird className="h-5 w-5" />
          咕咕嘎嘎大作战
        </button>
        <button
          type="button"
          onClick={onCreate2}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-white/70 px-6 py-4 text-lg font-semibold text-sky-800
            shadow-md ring-1 ring-white/80 transition hover:scale-[1.02] hover:bg-white"
        >
          <Compass className="h-5 w-5" />
          探索其他变身
        </button>
        <button
          type="button"
          onClick={onFeed}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-white/70 px-6 py-4 text-lg font-semibold text-sky-800
            shadow-md ring-1 ring-white/80 transition hover:scale-[1.02] hover:bg-white"
        >
          <Users className="h-5 w-5" />
          逛逛变身社区
        </button>
        {!user && (
          <button
            type="button"
            onClick={onAuth}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-sky-300/80
              bg-sky-50/50 px-6 py-3 text-sm font-semibold text-sky-700 transition hover:bg-white/80"
          >
            <Sparkles className="h-4 w-4" />
            登录后同步相册与体力值
          </button>
        )}
      </div>
    </section>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
