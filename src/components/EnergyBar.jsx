import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { useEnergy } from "../energy/EnergyContext.jsx";

export default function EnergyBar({ compact = false }) {
  const {
    energy,
    maxEnergy,
    progress,
    secondsUntilNext,
    isFull,
  } = useEnergy();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const fill = Math.max(0, Math.min(1, energy / maxEnergy));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-2xl bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow transition hover:scale-[1.03] ${
          compact ? "" : "sm:px-3"
        }`}
        title="点击查看体力恢复"
        aria-expanded={open}
      >
        <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="tabular-nums">
          {energy}/{maxEnergy}
        </span>
        <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-sky-100 sm:block">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-sky-400 transition-all duration-500"
            style={{ width: `${fill * 100}%` }}
          />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-fadeIn rounded-2xl bg-white/95 p-3 text-left shadow-soft ring-1 ring-sky-100 backdrop-blur-md">
          <p className="text-xs font-bold text-sky-800">体力恢复</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sky-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-sky-300 to-pink-300 transition-all duration-300"
              style={{ width: `${isFull ? 100 : Math.max(4, progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-sky-700/85">
            {isFull ? (
              <>体力已满，可以放心变身啦 ✦</>
            ) : (
              <>
                下一格恢复进度 {(progress * 100).toFixed(0)}%
                <br />
                还有 <span className="font-bold text-amber-600">{secondsUntilNext}</span> 秒恢复下一格体力
              </>
            )}
          </p>
          <p className="mt-1.5 text-[10px] text-sky-500">每次生图 / 变身启动消耗 1 格</p>
        </div>
      )}
    </div>
  );
}
