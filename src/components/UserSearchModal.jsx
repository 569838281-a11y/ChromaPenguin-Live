import { useEffect, useState } from "react";
import { Search, UserRound, X } from "lucide-react";

export default function UserSearchModal({ open, onClose, onSelectUser }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError("");
      return undefined;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const { searchUsers } = await import("../services/api.js");
        const list = await searchUsers(q);
        if (!cancelled) setResults(list);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setError(err?.message || "搜索失败");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-20 animate-fadeIn sm:pt-28">
      <button type="button" className="absolute inset-0 bg-sky-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white/95 shadow-soft">
        <div className="flex items-center gap-2 border-b border-sky-100 px-4 py-3">
          <Search className="h-4 w-4 text-sky-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索账号名称或完整用户 ID…"
            className="flex-1 bg-transparent text-sm text-sky-900 outline-none placeholder:text-sky-400"
          />
          <button type="button" onClick={onClose} className="rounded-xl bg-sky-50 p-2 text-sky-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {busy && <p className="py-6 text-center text-sm text-sky-600">查找中…</p>}
          {!busy && error && <p className="py-6 text-center text-sm text-rose-500">{error}</p>}
          {!busy && !error && query.trim() && results.length === 0 && (
            <p className="py-6 text-center text-sm text-sky-600">没有找到匹配的旅人</p>
          )}
          {!busy && !query.trim() && (
            <p className="py-6 text-center text-sm text-sky-500">
              试试搜「咕咕指挥官」「小蓝」「小咪」或粘贴用户 ID
            </p>
          )}
          <ul className="space-y-2">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onSelectUser?.(u)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-sky-50/80 px-3 py-2.5 text-left transition hover:bg-sky-100"
                >
                  <img src={u.avatar} alt="" className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-sky-900">
                      {u.nickname}
                      {u.isBot && (
                        <span className="ml-1.5 rounded-full bg-sky-200/80 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                          AI
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[10px] text-sky-500">ID · {u.id}</p>
                    <p className="mt-0.5 text-[11px] text-sky-600">
                      关注 {u.following} · 粉丝 {u.followers}
                    </p>
                  </div>
                  <UserRound className="h-4 w-4 shrink-0 text-sky-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
