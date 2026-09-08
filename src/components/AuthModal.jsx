import { useState } from "react";
import { Cloud, Sparkles, X } from "lucide-react";
import { useToast } from "./Toast.jsx";
import { loginWithEmail, signUpWithEmail } from "@/services/api";

export default function AuthModal({ open, onClose, onLogin }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const { pushToast } = useToast();

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      pushToast("把邮箱和密码咒语都写上喔～", "error");
      return;
    }
    if (tab === "register" && !nickname.trim()) {
      pushToast("取一个好听的昵称吧～", "error");
      return;
    }

    setBusy(true);
    try {
      const profile =
        tab === "login"
          ? await loginWithEmail(email.trim(), password)
          : await signUpWithEmail(email.trim(), password, nickname.trim());

      if (!profile) {
        pushToast("注册成功！请先到邮箱确认后再登录～");
        onClose();
        return;
      }

      onLogin(profile);
      pushToast(tab === "login" ? "欢迎回来，魔法旅人！" : "注册成功，体力值已充能～");
      onClose();
    } catch (err) {
      if (err?.code === "EMAIL_CONFIRM_REQUIRED") {
        pushToast(err.message);
        setTab("login");
        onClose();
        return;
      }
      pushToast(err?.message || "传送门打不开，请稍后再试", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <button type="button" className="absolute inset-0 bg-sky-900/30 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />
      <div className="glass-card relative z-10 w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-soft sm:p-8">
        <Cloud className="pointer-events-none absolute -right-4 -top-2 h-20 w-20 text-white/50 animate-floaty" />
        <Sparkles className="pointer-events-none absolute bottom-6 left-4 h-8 w-8 text-pink-300/70 animate-floaty" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-2xl bg-white/80 p-2 text-sky-700 shadow"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-2xl font-bold text-sky-800">云端传送门</h2>
        <p className="mb-5 text-sm text-sky-700/70">登录后可保存作品、发布社区与消耗体力值</p>

        <div className="mb-5 flex gap-2">
          {[
            { id: "login", label: "邮箱登录" },
            { id: "register", label: "邮箱注册" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              disabled={busy}
              className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition
                ${tab === t.id ? "bg-gradient-to-r from-sky-300 to-pink-300 text-white shadow" : "bg-white/60 text-sky-800"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {tab === "register" && (
            <label className="block text-sm font-medium text-sky-800">
              昵称
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="云端小企鹅"
                disabled={busy}
                className="mt-1.5 w-full rounded-2xl border-0 bg-white/80 px-4 py-3 text-sky-900 shadow-inner outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
              />
            </label>
          )}
          <label className="block text-sm font-medium text-sky-800">
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sky.magic"
              disabled={busy}
              className="mt-1.5 w-full rounded-2xl border-0 bg-white/80 px-4 py-3 text-sky-900 shadow-inner outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
            />
          </label>
          <label className="block text-sm font-medium text-sky-800">
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
              className="mt-1.5 w-full rounded-2xl border-0 bg-white/80 px-4 py-3 text-sky-900 shadow-inner outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-3xl bg-gradient-to-r from-sky-400 to-pink-300 py-3.5 text-base font-semibold text-white shadow-cloud transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "传送中…" : tab === "login" ? "登录" : "注册"}
          </button>
        </form>
      </div>
    </div>
  );
}
