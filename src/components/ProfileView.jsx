import { useEffect, useMemo, useState } from "react";
import { Check, Heart, Image as ImageIcon, Pencil, Share2, Trash2, Users } from "lucide-react";
import ProfileEditModal from "./ProfileEditModal.jsx";

export default function ProfileView({
  user,
  posts,
  privateMedia,
  likedPosts,
  agentBadges = [],
  onOpenPost,
  onLogout,
  onPublishPrivate,
  onDeletePost,
  onDeletePrivate,
  onUpdateProfile,
  profileSaving = false,
}) {
  const [tab, setTab] = useState("published");
  const [selected, setSelected] = useState(() => new Set());
  const [deletingId, setDeletingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const myPublished = useMemo(
    () => posts.filter((p) => p.author.id === user?.id || p._mine),
    [posts, user],
  );

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  if (!user) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center text-sky-700">
        请先登录，才能打开个人魔法小屋喔～
      </section>
    );
  }

  const tabs = [
    { id: "published", label: "我的发布", count: myPublished.length },
    { id: "private", label: "私密相册", count: privateMedia.length },
    { id: "liked", label: "我的喜欢", count: likedPosts.length },
  ];

  const gridItems =
    tab === "published"
      ? myPublished.map((p) => ({
          id: p.id,
          url: p.mediaUrl,
          type: p.mediaType,
          title: p.title,
          post: p,
        }))
      : tab === "private"
        ? privateMedia.map((m) => ({
            id: m.id,
            url: m.url || m.mediaUrl,
            type: m.type || m.mediaType,
            title: (m.type || m.mediaType) === "video" ? "私密视频" : "私密照片",
            privateItem: m,
          }))
        : likedPosts.map((p) => ({
            id: p.id,
            url: p.mediaUrl,
            type: p.mediaType,
            title: p.title,
            post: p,
          }));

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = privateMedia.filter((m) => selected.has(m.id));

  const handlePublishSelected = () => {
    if (!selectedItems.length) return;
    onPublishPrivate?.(
      selectedItems.map((m) => ({
        id: m.id,
        url: m.url || m.mediaUrl,
        type: m.type || m.mediaType || "photo",
        fromPrivate: true,
      })),
    );
    setSelected(new Set());
  };

  const handleDelete = async (post) => {
    if (!post || deletingId) return;
    setDeletingId(post.id);
    try {
      await onDeletePost?.(post);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePrivateItem = async (item) => {
    if (!item || deletingId) return;
    setDeletingId(item.id);
    try {
      await onDeletePrivate?.(item.privateItem || item);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSelectedPrivate = async () => {
    if (!selectedItems.length || deletingId) return;
    setDeletingId("batch");
    try {
      await onDeletePrivate?.(selectedItems);
      setSelected(new Set());
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveProfile = async (payload) => {
    const ok = await onUpdateProfile?.(payload);
    if (ok !== false) setEditOpen(false);
  };

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-6 animate-fadeIn sm:px-6">
      <div className="overflow-hidden rounded-3xl bg-white/40 shadow-soft ring-1 ring-white/60 backdrop-blur-md">
        <div
          className="h-36 bg-cover bg-center sm:h-48"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(125,211,252,0.25), rgba(249,168,212,0.35)), url(${user.cover})`,
          }}
        />
        <div className="relative px-5 pb-5 sm:px-8">
          <img
            src={user.avatar}
            alt=""
            className="-mt-12 h-24 w-24 rounded-3xl object-cover shadow-cloud ring-4 ring-white"
          />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-sky-800">{user.nickname}</h2>
              <p className="mt-0.5 break-all font-mono text-[11px] text-sky-500/90" title="数据库用户 ID">
                ID · {user.id}
              </p>
              <p className="mt-2 max-w-xl text-sm text-sky-700/80">{user.bio}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-sky-800">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4 text-sky-500" />
                  关注 {user.following}
                </span>
                <span>粉丝 {user.followers}</span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-4 w-4 text-rose-400" />
                  获赞 {user.likesReceived}
                </span>
              </div>
              {agentBadges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {agentBadges.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-100 to-pink-100
                        px-2.5 py-1 text-xs font-bold text-sky-800 shadow-sm ring-1 ring-white/80"
                    >
                      <span>{b.emoji}</span>
                      {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-400 to-pink-300 px-4 py-2 text-sm font-semibold text-white shadow transition hover:scale-105"
              >
                <Pencil className="h-4 w-4" />
                编辑主页
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-sky-700 shadow transition hover:scale-105"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition
              ${
                tab === t.id
                  ? "bg-gradient-to-r from-sky-300 to-pink-300 text-white shadow"
                  : "bg-white/70 text-sky-800 hover:bg-white"
              }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === "private" && privateMedia.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/60 px-4 py-3 shadow-soft ring-1 ring-white/70">
          <p className="text-sm text-sky-800">
            {selected.size > 0
              ? `已选中 ${selected.size} 项，可发布到变身社区`
              : "点选相册中的作品，再发布到社区"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSelected(selected.size === privateMedia.length ? new Set() : new Set(privateMedia.map((m) => m.id)))
              }
              className="rounded-2xl bg-white/90 px-3 py-2 text-xs font-semibold text-sky-700 shadow"
            >
              {selected.size === privateMedia.length ? "取消全选" : "全选"}
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || deletingId === "batch"}
              onClick={handlePublishSelected}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-400 to-pink-300 px-4 py-2
                text-xs font-bold text-white shadow-cloud transition hover:scale-[1.02] disabled:opacity-40"
            >
              <Share2 className="h-3.5 w-3.5" />
              发布选中到社区
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || deletingId === "batch"}
              onClick={handleDeleteSelectedPrivate}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2
                text-xs font-bold text-white shadow transition hover:scale-[1.02] hover:bg-rose-600 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除选中
            </button>
          </div>
        </div>
      )}

      {tab === "published" && myPublished.length > 0 && (
        <p className="mt-4 text-xs font-semibold text-sky-600/80">悬停作品右上角可删除自己发布的帖子</p>
      )}

      <div className="mt-5 pb-24">
        {gridItems.length === 0 ? (
          <div className="glass-card flex h-44 flex-col items-center justify-center rounded-3xl text-sky-600">
            <ImageIcon className="mb-2 h-8 w-8 opacity-50" />
            这里还空空的，去创作或点赞一些魔法吧～
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {gridItems.map((item) => {
              const isPrivate = tab === "private";
              const isPublished = tab === "published";
              const isSelected = selected.has(item.id);
              const busy = deletingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-3xl bg-white/55 shadow transition
                    ${isSelected ? "ring-4 ring-sky-400" : "ring-1 ring-white/60"}
                    hover:-translate-y-1 hover:shadow-soft`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isPrivate) toggleSelect(item.id);
                      else if (item.post) onOpenPost?.(item.post);
                    }}
                    className="block w-full text-left"
                  >
                    {item.type === "video" ? (
                      <video src={item.url} className="aspect-square w-full object-cover" muted />
                    ) : (
                      <img
                        src={item.url}
                        alt=""
                        className="aspect-square w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                    <p className="truncate px-2 py-2 text-left text-xs font-semibold text-sky-800">{item.title}</p>
                  </button>

                  {isPublished && item.post && (
                    <button
                      type="button"
                      disabled={busy}
                      title="删除帖子"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.post);
                      }}
                      className="absolute right-2 top-2 rounded-xl bg-rose-500/90 p-2 text-white shadow
                        opacity-100 transition hover:bg-rose-600 disabled:opacity-50
                        sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {isPrivate && (
                    <>
                      <span
                        className={`pointer-events-none absolute left-2 top-2 flex h-7 w-7 items-center justify-center
                          rounded-full shadow ${isSelected ? "bg-sky-400 text-white" : "bg-white/90 text-sky-500"}`}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : null}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        title="删除"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePrivateItem(item);
                        }}
                        className="absolute right-2 top-2 z-10 rounded-xl bg-rose-500/90 p-2 text-white shadow
                          opacity-100 transition hover:bg-rose-600 disabled:opacity-50
                          sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPublishPrivate?.([
                            {
                              id: item.id,
                              url: item.url,
                              type: item.type || "photo",
                              fromPrivate: true,
                            },
                          ]);
                        }}
                        className="absolute bottom-10 right-2 rounded-xl bg-gradient-to-r from-sky-400 to-pink-300 px-2.5 py-1.5
                          text-[10px] font-bold text-white shadow opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        发布
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ProfileEditModal
        open={editOpen}
        user={user}
        busy={profileSaving}
        onClose={() => !profileSaving && setEditOpen(false)}
        onSave={handleSaveProfile}
      />
    </section>
  );
}
