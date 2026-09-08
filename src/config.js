/** 后端 API / WebSocket 地址（开发走 Vite 代理；桌面端直连本机后端） */

function isDesktopApp() {
  try {
    return Boolean(window.chromaDesktop?.isDesktop);
  } catch {
    return false;
  }
}

export const API_BASE = (() => {
  const fromEnv = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Electron 打包后为 file://，必须直连本地魔法后端
  if (isDesktopApp() || window.location.protocol === "file:") {
    return "http://127.0.0.1:8765";
  }
  return "";
})();

function wsUrl(pathname) {
  if (API_BASE) {
    const u = new URL(API_BASE);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = pathname;
    u.search = "";
    u.hash = "";
    return u.toString();
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${pathname}`;
}

export function guguWsUrl() {
  return wsUrl("/ws/gugu");
}

export function exploreWsUrl() {
  return wsUrl("/ws/explore");
}

export function healthUrl() {
  return `${API_BASE || ""}/api/health`;
}
