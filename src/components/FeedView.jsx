import { useMemo, useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { HOT_TAGS } from "../mockData.js";
import { useToast } from "./Toast.jsx";
import {
  formatLatentLabel,
  parseLatentTagsFromPost,
  visibleTagsOnly,
} from "../agent/latentTags.js";

function PostCard({ post, onOpen, onTrySame, onToggleLike, onOpenAuthor }) {
  return (
    <article
      className="group relative break-inside-avoid overflow-hidden rounded-3xl bg-white/55 shadow-soft
        ring-1 ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-cloud"
    >
      <button type="button" className="block w-full text-left" onClick={() => onOpen(post)}>
        <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]">
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} className="h-full w-full object-cover" muted playsInline />
          ) : (
            <img
              src={post.mediaUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          )}
          {post.isAgent && (
            <span className="absolute left-2 top-2 rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              AI 原住民
            </span>
          )}
          {post.agentBadge && (
            <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-sky-800 shadow">
              {post.agentBadge.emoji} {post.agentBadge.label}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sky-950/70 to-transparent p-3 pt-10">
            <h3 className="line-clamp-2 text-sm font-bold text-white">{post.title}</h3>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAuthor?.(post.author);
          }}
          className="shrink-0 transition hover:scale-105"
          title={`查看 ${post.author?.nickname || "用户"} 的主页`}
        >
          <img src={post.author.avatar} alt="" className="h-8 w-8 rounded-xl object-cover ring-2 ring-white" />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAuthor?.(post.author);
            }}
            className="truncate text-left text-xs font-semibold text-sky-800 hover:underline"
          >
            {post.author.nickname}
          </button>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-sky-600">
            <button
              type="button"
              onClick={() => onToggleLike(post.id)}
              className="inline-flex items-center gap-1 transition hover:scale-110"
            >
              <Heart
                className={`h-3.5 w-3.5 heart-pop ${post.liked ? "fill-rose-500 text-rose-500" : ""}`}
              />
              {post.likes}
            </button>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.comments}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onTrySame(post)}
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl
          bg-gradient-to-r from-sky-400 to-pink-300 px-4 py-2 text-sm font-bold text-white shadow-cloud
          opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105"
      >
        一键变身同款
      </button>
    </article>
  );
}

function PostDetailModal({
  post,
  comments,
  onClose,
  onToggleLike,
  onAddComment,
  onOpenAuthor,
}) {
  const [text, setText] = useState("");
  if (!post) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 animate-fadeIn sm:p-6">
      <button type="button" className="absolute inset-0 bg-sky-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl shadow-soft lg:flex-row">
        <div className="relative min-h-[240px] flex-1 bg-sky-900/10 lg:min-h-[520px]">
          <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="flex w-full flex-col lg:w-[380px]">
          <div className="flex items-start gap-3 border-b border-white/50 p-4">
            <button
              type="button"
              onClick={() => onOpenAuthor?.(post.author)}
              className="shrink-0 transition hover:scale-105"
            >
              <img src={post.author.avatar} alt="" className="h-11 w-11 rounded-2xl object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpenAuthor?.(post.author)}
                className="font-bold text-sky-800 hover:underline"
              >
                {post.author.nickname}
              </button>
              <p className="mt-1 text-sm text-sky-700/80">{post.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {visibleTagsOnly(post.tags).map((t) => (
                  <span key={t} className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                    {t}
                  </span>
                ))}
              </div>
              {parseLatentTagsFromPost(post).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] font-semibold text-sky-500/80">氛围印记</span>
                  {parseLatentTagsFromPost(post).map((t) => (
                    <span
                      key={`@${t}`}
                      className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] text-sky-600/70 ring-1 ring-sky-100/80"
                      title="隐含标签 · AI 原住民会顺着它评论"
                    >
                      {formatLatentLabel(t)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-xl bg-white/80 p-2 text-sky-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 border-b border-white/50 px-4 py-3">
            <button
              type="button"
              onClick={() => onToggleLike(post.id)}
              className="flex items-center gap-1.5 rounded-2xl bg-white/70 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:scale-105"
            >
              <Heart className={`h-4 w-4 heart-pop ${post.liked ? "fill-rose-500 text-rose-500" : ""}`} />
              点赞 {post.likes}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-2xl bg-white/70 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:scale-105"
            >
              <Bookmark className="h-4 w-4" />
              收藏
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {(comments || []).length === 0 && (
              <p className="text-center text-sm text-sky-600/70">还没有评论，来当第一条小精灵吧～</p>
            )}
            {(comments || []).map((c) => (
              <div key={c.id} className="flex gap-2 animate-fadeIn">
                <img src={c.avatar} alt="" className="h-8 w-8 rounded-xl" />
                <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm">
                  <p className="font-semibold text-sky-800">
                    {c.author}
                    {c.isAgent && (
                      <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">
                        AI
                      </span>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap text-sky-700/90">{c.text}</p>
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-white/50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              onAddComment(post.id, text.trim());
              setText("");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="写下你的魔法感想…"
              className="flex-1 rounded-2xl bg-white/80 px-3 py-2 text-sm outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300"
            />
            <button type="submit" className="rounded-2xl bg-sky-400 p-2.5 text-white shadow transition hover:scale-105">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function FeedView({
  posts,
  commentsMap,
  onToggleLike,
  onAddComment,
  onNeedComments,
  onTrySame,
  onOpenAuthor,
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [active, setActive] = useState(null);
  const { pushToast } = useToast();

  const openPost = (post) => {
    setActive(post);
    onNeedComments?.(post.id, post);
  };

  const openAuthor = (author) => {
    setActive(null);
    onOpenAuthor?.(author);
  };

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const q = query.trim().toLowerCase();
      const hitQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.nickname.toLowerCase().includes(q);
      const hitT = !tag || p.tags?.includes(tag);
      return hitQ && hitT;
    });
  }, [posts, query, tag]);

  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 py-6 animate-fadeIn sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-sky-800 sm:text-3xl">变身社区</h2>
          <p className="mt-1 text-sm text-sky-700/70">看看大家都用魔法变成了什么～</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索作品、作者、咒语…"
            className="w-full rounded-2xl border-0 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-sky-900 shadow outline-none ring-1 ring-white/80 focus:ring-2 focus:ring-sky-300"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTag("")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition hover:scale-105
            ${!tag ? "bg-sky-400 text-white" : "bg-white/70 text-sky-700"}`}
        >
          全部
        </button>
        {HOT_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t === tag ? "" : t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition hover:scale-105
              ${tag === t ? "bg-gradient-to-r from-sky-300 to-pink-300 text-white" : "bg-white/70 text-sky-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card flex h-48 flex-col items-center justify-center rounded-3xl text-sky-600">
          <Sparkles className="mb-2 h-8 w-8 opacity-60" />
          没有找到相关作品，换个咒语再试试～
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {filtered.map((post) => (
            <div key={post.id} className="mb-4">
              <PostCard
                post={post}
                onOpen={openPost}
                onOpenAuthor={openAuthor}
                onTrySame={(p) => {
                  onTrySame?.(p);
                  pushToast(`已准备同款灵感：「${p.title}」`);
                }}
                onToggleLike={(id) => {
                  onToggleLike(id);
                  pushToast("点赞成功 ✦");
                }}
              />
            </div>
          ))}
        </div>
      )}

      <PostDetailModal
        post={active ? posts.find((p) => p.id === active.id) || active : null}
        comments={active ? commentsMap[active.id] || [] : []}
        onClose={() => setActive(null)}
        onOpenAuthor={openAuthor}
        onToggleLike={(id) => {
          onToggleLike(id);
          pushToast("点赞成功 ✦");
        }}
        onAddComment={(id, text) => {
          onAddComment(id, text);
          pushToast("评论已送达云端～");
        }}
      />
    </section>
  );
}
