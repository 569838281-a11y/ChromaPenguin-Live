import { useEffect, useMemo, useState } from "react";
import { Lock, Share2, X } from "lucide-react";
import { deriveLatentTags, formatLatentLabel } from "../agent/latentTags.js";

export default function PublishSuccessModal({
  open,
  item,
  batchItems = null,
  busy = false,
  defaultExpand = false,
  hideSavePrivate = false,
  onClose,
  onSavePrivate,
  onPublish,
}) {
  const [expand, setExpand] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("#云端变身");

  const batch = batchItems?.length ? batchItems : item ? [item] : [];
  const preview = batch[0] || item;
  const count = batch.length;

  const latentPreview = useMemo(() => {
    if (!preview) return [];
    if (preview.latentTags?.length) return preview.latentTags;
    return deriveLatentTags(preview.genPrompt || "", { mode: preview.mode });
  }, [preview]);

  useEffect(() => {
    if (!open || !preview) return;
    setExpand(Boolean(defaultExpand || hideSavePrivate));
    setTitle(
      count > 1
        ? `私密相册分享（${count}）`
        : preview.type === "photo"
          ? "我的魔法瞬间"
          : "我的时光水晶",
    );
    setDescription(count > 1 ? `从私密相册一次分享 ${count} 个作品～` : "");
    setTags("#云端变身");
  }, [open, preview?.id, count, defaultExpand, hideSavePrivate]);

  if (!open || !preview) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <button
        type="button"
        className="absolute inset-0 bg-sky-900/30 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div className="glass-card relative z-10 w-full max-w-lg rounded-3xl p-6 shadow-soft">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-2xl bg-white/80 p-2 text-sky-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-2xl font-bold text-sky-800">
          {hideSavePrivate ? "从私密相册发布" : "创作成功 ✦"}
        </h3>
        <p className="mt-1 text-sm text-sky-700/70">
          {expand
            ? count > 1
              ? `将把选中的 ${count} 个作品发布到变身社区`
              : "填写标题后点「一键发布到社区」"
            : "可先存私密相册，或发布到变身社区（需已登录）"}
        </p>

        <div className="mt-4 overflow-hidden rounded-3xl bg-sky-100/50 ring-1 ring-white/70">
          {preview.type === "video" ? (
            <video src={preview.url} className="max-h-52 w-full object-contain" controls />
          ) : (
            <img src={preview.url} alt="" className="max-h-52 w-full object-contain" />
          )}
        </div>
        {count > 1 && (
          <p className="mt-2 text-center text-xs font-semibold text-sky-600">
            预览第 1 项 · 共 {count} 项将一并发布
          </p>
        )}
        {latentPreview.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-sky-500">隐含氛围（发布后 AI 会读）</span>
            {latentPreview.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-sky-600/80 ring-1 ring-sky-100"
              >
                {formatLatentLabel(t)}
              </span>
            ))}
          </div>
        )}

        {!expand ? (
          <div className={`mt-5 grid gap-3 ${hideSavePrivate ? "" : "sm:grid-cols-2"}`}>
            {!hideSavePrivate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSavePrivate(preview)}
                className="flex items-center justify-center gap-2 rounded-3xl bg-white/80 py-3.5 text-sm font-semibold text-sky-800 shadow transition hover:scale-[1.02] disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                {busy ? "上传中…" : "保存至私密相册"}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setExpand(true)}
              className="flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-sky-400 to-pink-300 py-3.5 text-sm font-semibold text-white shadow-cloud transition hover:scale-[1.02] disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              发布到变身社区
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3 animate-fadeIn">
            <label className="block text-sm font-medium text-sky-800">
              标题
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                className="mt-1 w-full rounded-2xl bg-white/80 px-3 py-2.5 outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium text-sky-800">
              描述
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={busy}
                placeholder="说说这次变身的小故事…"
                className="mt-1 w-full rounded-2xl bg-white/80 px-3 py-2.5 outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
              />
            </label>
            <label className="block text-sm font-medium text-sky-800">
              公开标签（空格分隔）
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={busy}
                placeholder="#企鹅日常 #SAM2奇遇"
                className="mt-1 w-full rounded-2xl bg-white/80 px-3 py-2.5 outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onPublish({
                  item: preview,
                  items: batch,
                  title: title.trim() || "未命名魔法",
                  description: description.trim() || "分享一次云端变身～",
                  tags: tags
                    .split(/\s+/)
                    .map((t) => t.trim())
                    .filter(Boolean),
                  fromPrivate: Boolean(hideSavePrivate || preview.fromPrivate),
                })
              }
              className="w-full rounded-3xl bg-gradient-to-r from-sky-400 to-pink-300 py-3.5 text-sm font-bold text-white shadow-cloud transition hover:scale-[1.02] disabled:opacity-60"
            >
              {busy
                ? "正在发布…"
                : count > 1
                  ? `一键发布 ${count} 项到社区`
                  : "一键发布到社区"}
            </button>
            {!hideSavePrivate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setExpand(false)}
                className="w-full rounded-2xl py-2 text-sm font-semibold text-sky-600 hover:bg-white/50 disabled:opacity-50"
              >
                返回
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
