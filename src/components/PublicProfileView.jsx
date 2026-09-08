import { useEffect, useState } from "react";
import { ArrowLeft, Heart, UserPlus, UserMinus, Users } from "lucide-react";

/**
 * Public profile of another user (or bot). Shows their published posts + follow.
 */
export default function PublicProfileView({
  profile,
  posts = [],
  isOwn = false,
  following = false,
  followBusy = false,
  onBack,
  onFollowToggle,
  onOpenPost,
  onOpenOwnProfile,
}) {
  const [localFollowing, setLocalFollowing] = useState(following);
  const [followers, setFollowers] = useState(profile?.followers ?? 0);

  useEffect(() => {
    setLocalFollowing(following);
  }, [following, profile?.id]);

  useEffect(() => {
    setFollowers(profile?.followers ?? 0);
  }, [profile?.followers, profile?.id]);

  if (!profile) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center text-sky-700">
        <p>找不到这位旅人…</p>
        <button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-sky-500 underline">
          返回
        </button>
      </section>
    );
  }

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-6 animate-fadeIn sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-2xl bg-white/70 px-3 py-2 text-sm font-semibold text-sky-800 shadow"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      <div className="overflow-hidden rounded-3xl bg-white/40 shadow-soft ring-1 ring-white/60 backdrop-blur-md">
        <div
          className="h-36 bg-cover bg-center sm:h-48"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(125,211,252,0.25), rgba(249,168,212,0.35)), url(${profile.cover})`,
          }}
        />
        <div className="relative px-5 pb-5 sm:px-8">
          <img
            src={profile.avatar}
            alt=""
            className="-mt-12 h-24 w-24 rounded-3xl object-cover shadow-cloud ring-4 ring-white"
          />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-sky-800">
                {profile.nickname}
                {profile.isBot && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-600">
                    AI 原住民
                  </span>
                )}
              </h2>
              <p className="mt-0.5 break-all font-mono text-[11px] text-sky-500/90">ID · {profile.id}</p>
              <p className="mt-2 max-w-xl text-sm text-sky-700/80">{profile.bio}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-sky-800">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4 text-sky-500" />
                  关注 {profile.following ?? 0}
                </span>
                <span>粉丝 {followers}</span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-4 w-4 text-rose-400" />
                  获赞 {profile.likesReceived ?? 0}
                </span>
              </div>
            </div>

            {isOwn ? (
              <button
                type="button"
                onClick={onOpenOwnProfile}
                className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-sky-700 shadow"
              >
                打开我的主页
              </button>
            ) : (
              <button
                type="button"
                disabled={followBusy}
                onClick={async () => {
                  const res = await onFollowToggle?.(profile);
                  if (res && typeof res.following === "boolean") {
                    setLocalFollowing(res.following);
                    if (typeof res.profile?.followers === "number") {
                      setFollowers(res.profile.followers);
                    } else {
                      setFollowers((n) => Math.max(0, n + (res.following ? 1 : -1)));
                    }
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold text-white shadow transition hover:scale-105 disabled:opacity-60 ${
                  localFollowing
                    ? "bg-sky-500/90"
                    : "bg-gradient-to-r from-sky-400 to-pink-300"
                }`}
              >
                {localFollowing ? (
                  <>
                    <UserMinus className="h-4 w-4" />
                    已关注
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    关注
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className="mt-6 text-lg font-bold text-sky-800">发布的作品 ({posts.length})</h3>
      {posts.length === 0 ? (
        <div className="glass-card mt-3 flex h-40 items-center justify-center rounded-3xl text-sm text-sky-600">
          还没有公开作品～
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {posts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPost?.(p)}
              className="group overflow-hidden rounded-3xl bg-white/55 text-left shadow ring-1 ring-white/60 transition hover:-translate-y-1 hover:shadow-soft"
            >
              {p.mediaType === "video" ? (
                <video src={p.mediaUrl} className="aspect-square w-full object-cover" muted />
              ) : (
                <img src={p.mediaUrl} alt="" className="aspect-square w-full object-cover transition group-hover:scale-105" />
              )}
              <p className="truncate px-2 py-2 text-xs font-semibold text-sky-800">{p.title}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
