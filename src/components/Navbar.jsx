import {
  Bird,
  Compass,
  Home,
  LogIn,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import EnergyBar from "./EnergyBar.jsx";

const NAV = [
  { id: "home", label: "首页", icon: Home },
  { id: "create1", label: "咕咕嘎嘎大作战", icon: Bird },
  { id: "create2", label: "探索变身", icon: Compass },
  { id: "feed", label: "变身社区", icon: Users },
];

export default function Navbar({
  currentView,
  onNavigate,
  user,
  onAuthOpen,
  onProfile,
  onSearchUsers,
  agentStatus = "online",
  onOpenAgent,
}) {
  const thinking = agentStatus === "thinking";

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/35 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="group flex shrink-0 items-center gap-2 rounded-2xl px-2 py-1 transition hover:bg-white/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 to-pink-300 text-white shadow-cloud">
            <Bird className="h-5 w-5" />
          </span>
          <span
            className="hidden text-lg font-bold tracking-wide text-sky-800 sm:inline"
            style={{ fontFamily: '"Comic Neue", Fredoka, cursive' }}
          >
            ChromaPenguin-Live
          </span>
        </button>

        <nav className="mx-auto hidden items-center gap-1 md:flex">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = currentView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition-all
                  ${
                    active
                      ? "bg-gradient-to-r from-sky-300 to-pink-300 text-white shadow"
                      : "text-sky-800/80 hover:bg-white/60 hover:scale-[1.03]"
                  }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSearchUsers}
            className="flex items-center gap-1.5 rounded-2xl bg-white/75 px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow transition hover:scale-[1.03] sm:px-3"
            title="查找用户"
          >
            <Search className="h-3.5 w-3.5 text-sky-500" />
            <span className="hidden sm:inline">找旅人</span>
          </button>

          <EnergyBar />

          <button
            type="button"
            onClick={onOpenAgent}
            className="hidden items-center gap-2 rounded-2xl bg-white/75 px-3 py-1.5 text-xs font-semibold text-sky-800 shadow transition hover:scale-[1.03] sm:flex"
            title="企鹅助手状态"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75
                  ${thinking ? "animate-ping bg-amber-400" : "bg-emerald-400"}`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full
                  ${thinking ? "bg-amber-400" : "bg-emerald-500"}`}
              />
            </span>
            Agent {thinking ? "思考中" : "在线"}
          </button>

          {!user ? (
            <button
              type="button"
              onClick={onAuthOpen}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-pink-300 px-4 py-2
                text-sm font-semibold text-white shadow-cloud transition hover:scale-[1.03] active:scale-95"
            >
              <LogIn className="h-4 w-4" />
              登录 / 注册
            </button>
          ) : (
            <button
              type="button"
              onClick={onProfile}
              className="flex items-center gap-2 rounded-2xl bg-white/70 py-1 pl-1 pr-3 shadow transition hover:scale-[1.03] hover:bg-white"
            >
              <img
                src={user.avatar}
                alt=""
                className="h-9 w-9 rounded-xl object-cover ring-2 ring-white"
              />
              <span className="hidden text-sm font-semibold text-sky-800 sm:inline">
                {user.nickname}
              </span>
              <Sparkles className="hidden h-4 w-4 text-pink-400 sm:inline" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
        {NAV.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs font-semibold transition
              ${
                currentView === id
                  ? "bg-sky-400 text-white"
                  : "bg-white/60 text-sky-800"
              }`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}
