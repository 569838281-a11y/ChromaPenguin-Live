import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { usePenguinAgent } from "../../agent/AgentContext.jsx";

function PenguinOrb({ thinking }) {
  return (
    <div className={`relative h-14 w-14 sm:h-16 sm:w-16 ${thinking ? "animate-softPulse" : "animate-penguin-bob"}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-300 via-sky-400 to-pink-300 shadow-cloud" />
      <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-white/90">
        <span className="select-none text-2xl sm:text-3xl" aria-hidden>
          🐧
        </span>
      </div>
      {thinking && (
        <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-white animate-softPulse" />
      )}
    </div>
  );
}

function AgentBadgeChip({ badge }) {
  if (!badge) return null;
  const tone =
    badge.tone === "pink"
      ? "from-pink-200 to-rose-200 text-rose-800"
      : badge.tone === "cyan"
        ? "from-cyan-200 to-sky-200 text-sky-800"
        : "from-sky-200 to-blue-200 text-sky-900";
  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2.5 py-1 text-[11px] font-bold shadow ${tone}`}
    >
      <span>{badge.emoji}</span>
      {badge.label}
    </span>
  );
}

export default function FloatingPenguinAgent({ suppress = false }) {
  const {
    meta,
    open,
    setOpen,
    status,
    hint,
    messages,
    quickActions,
    deepseekOn,
    sendUserMessage,
    runQuickAction,
  } = usePenguinAgent();
  const [draft, setDraft] = useState("");
  const [hintVisible, setHintVisible] = useState(true);
  const listRef = useRef(null);
  const thinking = status === "thinking";

  useEffect(() => {
    if (suppress) setOpen(false);
  }, [suppress, setOpen]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, thinking]);

  useEffect(() => {
    setHintVisible(true);
    const t = setTimeout(() => setHintVisible(false), 4800);
    return () => clearTimeout(t);
  }, [hint]);

  if (suppress) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim() || thinking) return;
    sendUserMessage(draft);
    setDraft("");
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[55] flex flex-col items-end gap-3 sm:bottom-8 sm:right-6">
      {open && (
        <div className="pointer-events-auto w-[min(100vw-1.5rem,22rem)] origin-bottom-right animate-fadeIn">
          <div className="glass-card flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-3xl shadow-soft ring-1 ring-white/70">
            <header className="flex items-center gap-3 border-b border-white/50 bg-gradient-to-r from-sky-200/70 to-pink-200/50 px-4 py-3">
              <PenguinOrb thinking={thinking} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-sky-900">{meta.name}</p>
                <p className="text-[11px] font-semibold text-sky-700/80">
                  {thinking
                    ? "企鹅正在思考中..."
                    : deepseekOn
                      ? "在线 · DeepSeek 已接通"
                      : "在线 · 本地模式（可配置 DeepSeek）"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white/80 p-2 text-sky-700 shadow transition hover:scale-105"
                aria-label="关闭对话"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow
                      ${
                        m.role === "user"
                          ? "rounded-br-md bg-gradient-to-r from-sky-400 to-pink-300 text-white"
                          : "rounded-bl-md bg-white/85 text-sky-900"
                      }`}
                  >
                    <p className="whitespace-pre-wrap">
                      {m.text}
                      {m.typing ? <span className="ml-0.5 inline-block animate-softPulse">▍</span> : null}
                    </p>
                    <AgentBadgeChip badge={m.badge} />
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold text-sky-700 animate-fadeIn">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-sky-400" />
                  企鹅正在思考中...
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-white/50 px-3 py-2.5">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {quickActions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={thinking}
                    onClick={() => runQuickAction(a.id)}
                    className="shrink-0 rounded-full bg-sky-100/90 px-2.5 py-1 text-[11px] font-semibold text-sky-800
                      shadow-sm transition hover:scale-[1.03] hover:bg-white disabled:opacity-50"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="跟咕咕说点什么…"
                  disabled={thinking}
                  className="flex-1 rounded-2xl bg-white/85 px-3 py-2 text-sm text-sky-900 outline-none ring-1 ring-sky-100
                    focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={thinking || !draft.trim()}
                  className="rounded-2xl bg-sky-400 p-2.5 text-white shadow transition hover:scale-105 disabled:opacity-50"
                  aria-label="发送"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-auto relative flex flex-col items-end gap-2">
        <div
          className={`max-w-[12.5rem] rounded-2xl bg-white/90 px-3 py-2 text-[11px] font-semibold text-sky-800 shadow-cloud
            transition-all duration-500
            ${hintVisible && !open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        >
          <span className="mr-1 inline-flex text-sky-400">
            <MessageCircle className="h-3 w-3" />
          </span>
          {hint}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full transition hover:scale-105 active:scale-95"
          aria-label={open ? "收起企鹅助手" : "打开企鹅助手"}
        >
          <PenguinOrb thinking={thinking} />
        </button>
      </div>
    </div>
  );
}
