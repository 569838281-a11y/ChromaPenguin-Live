import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bird,
  Camera,
  Cloud,
  Download,
  Home,
  Image as ImageIcon,
  Rainbow,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { exploreWsUrl, guguWsUrl } from "../config.js";
import { useEnergy } from "../energy/EnergyContext.jsx";

/**
 * Creation tools: Mode1 (咕咕嘎嘎) + Mode2 (探索变身)
 * Kept separate from community shell.
 */


function magifyStatus(raw) {
  const text = (raw || "").trim();
  if (!text) return "";
  if (/加载|loading|模型/i.test(text)) return "正在查阅魔法咒语中…";
  if (/就绪|ready/i.test(text) && /推流|开始/.test(text)) return "叽里咕噜，变身魔法启动！";
  if (/就绪|ready/i.test(text)) return "咒语已经备好啦，随时可以变身～";
  if (/变身中|streaming|跟踪|隔帧/i.test(text)) return "正在吟诵魔法咒语中…";
  if (/停止|已停止/i.test(text)) return "呼——魔法先歇一口气～";
  if (/连接中/i.test(text)) return "正在搭建云端传送门…";
  if (/已连接.*模型/i.test(text)) return "正在查阅魔法咒语中…";
  if (/连接已关闭|断开/i.test(text)) return "欸，传送门忽然关上了…";
  return text;
}

function magifyError(raw) {
  const text = (raw || "").trim() || "未知小精灵";
  return `欸，魔法怎么失灵了?!难道是「${text}」出现了问题？`;
}
function mapClickToVideoNormalized(video, clientX, clientY, fit = "cover") {
  const rect = video.getBoundingClientRect();
  const elemX = clientX - rect.left;
  const elemY = clientY - rect.top;
  const vw = video.videoWidth || rect.width;
  const vh = video.videoHeight || rect.height;
  if (!vw || !vh || !rect.width || !rect.height) {
    return {
      x: Math.min(1, Math.max(0, elemX / Math.max(rect.width, 1))),
      y: Math.min(1, Math.max(0, elemY / Math.max(rect.height, 1))),
    };
  }
  const videoAspect = vw / vh;
  const elemAspect = rect.width / rect.height;
  let contentW;
  let contentH;
  let offsetX;
  let offsetY;
  const fillWidth =
    fit === "contain" ? elemAspect < videoAspect : elemAspect > videoAspect;
  if (fillWidth) {
    contentW = rect.width;
    contentH = rect.width / videoAspect;
    offsetX = 0;
    offsetY = (rect.height - contentH) / 2;
  } else {
    contentH = rect.height;
    contentW = rect.height * videoAspect;
    offsetX = (rect.width - contentW) / 2;
    offsetY = 0;
  }
  const x = (elemX - offsetX) / contentW;
  const y = (elemY - offsetY) / contentH;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

/** Place a pin (video-normalized) onto the element, matching cover/contain. */
function pinStyleFromVideoNormalized(video, x, y, fit = "cover") {
  if (!video?.getBoundingClientRect) {
    return { left: `${x * 100}%`, top: `${y * 100}%` };
  }
  const rect = video.getBoundingClientRect();
  const vw = video.videoWidth || rect.width;
  const vh = video.videoHeight || rect.height;
  if (!vw || !vh || !rect.width || !rect.height) {
    return { left: `${x * 100}%`, top: `${y * 100}%` };
  }
  const videoAspect = vw / vh;
  const elemAspect = rect.width / rect.height;
  let contentW;
  let contentH;
  let offsetX;
  let offsetY;
  const fillWidth =
    fit === "contain" ? elemAspect < videoAspect : elemAspect > videoAspect;
  if (fillWidth) {
    contentW = rect.width;
    contentH = rect.width / videoAspect;
    offsetX = 0;
    offsetY = (rect.height - contentH) / 2;
  } else {
    contentH = rect.height;
    contentW = rect.height * videoAspect;
    offsetX = (rect.width - contentW) / 2;
    offsetY = 0;
  }
  return {
    left: `${((offsetX + x * contentW) / rect.width) * 100}%`,
    top: `${((offsetY + y * contentH) / rect.height) * 100}%`,
  };
}

// ---------- Decorative clouds ----------
function FloatingClouds() {
  const clouds = [
    { top: "8%", left: "6%", size: 120, delay: "0s", opacity: 0.55 },
    { top: "18%", right: "8%", size: 160, delay: "1.2s", opacity: 0.45 },
    { top: "62%", left: "10%", size: 100, delay: "2s", opacity: 0.4 },
    { top: "70%", right: "14%", size: 140, delay: "0.6s", opacity: 0.5 },
    { top: "40%", left: "42%", size: 90, delay: "1.8s", opacity: 0.28 },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {clouds.map((c, i) => (
        <div
          key={i}
          className="cloud-blob absolute animate-floaty rounded-full"
          style={{
            top: c.top,
            left: c.left,
            right: c.right,
            width: c.size,
            height: c.size * 0.55,
            opacity: c.opacity,
            animationDelay: c.delay,
          }}
        />
      ))}
      <Cloud className="absolute left-8 top-24 h-10 w-10 text-white/50 animate-floaty" />
      <Cloud
        className="absolute right-16 top-40 h-14 w-14 text-white/40 animate-floaty"
        style={{ animationDelay: "1.5s" }}
      />
      <Sparkles className="absolute bottom-24 left-1/3 h-8 w-8 text-sky-200/70 animate-floaty" />
    </div>
  );
}

function Tooltip({ text, children }) {
  return (
    <div className="group relative w-full">
      {children}
      <div
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-max max-w-xs -translate-x-1/2
          rounded-2xl bg-sky-900/90 px-4 py-2 text-center text-sm text-white opacity-0 shadow-soft
          transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 translate-y-1"
      >
        {text}
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-sky-900/90" />
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl bg-gradient-to-r from-sky-300 via-sky-400 to-pink-300
        px-6 py-4 text-lg font-semibold text-white shadow-cloud
        transition-all duration-300 hover:scale-[1.02] hover:shadow-soft active:scale-[0.98]
        ${className}`}
    >
      {children}
    </button>
  );
}

function SoftButton({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl bg-white/70 px-6 py-4 text-lg font-semibold text-sky-800
        shadow-md ring-1 ring-white/80 transition-all duration-300
        hover:bg-white hover:scale-[1.02] active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function IconToolButton({ label, onClick, active, danger, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`relative flex h-14 w-14 items-center justify-center rounded-2xl
        shadow-md transition-all duration-300 hover:scale-105 active:scale-95
        ${danger ? "bg-rose-500 text-white" : "bg-white/85 text-sky-700 backdrop-blur-md"}
        ${active ? "ring-2 ring-rose-400" : "ring-1 ring-white/70"}`}
    >
      {children}
      {active && (
        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-rose-500 animate-softPulse" />
      )}
    </button>
  );
}

function FloatingToolbar({ onCapture, onToggleRecord, isRecording, onHome, onAskAgent }) {
  return (
    <div
      className="glass-card absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3
        rounded-3xl px-4 py-3 shadow-soft animate-fadeIn md:bottom-8 md:left-6 md:right-auto md:translate-x-0
        md:flex-col"
    >
      <IconToolButton label="咔嚓留下魔法瞬间" onClick={onCapture}>
        <Camera className="h-6 w-6" />
      </IconToolButton>
      <IconToolButton
        label={isRecording ? "收起时光水晶" : "点亮时光水晶"}
        onClick={onToggleRecord}
        active={isRecording}
        danger={isRecording}
      >
        <Video className="h-6 w-6" />
      </IconToolButton>
      {onAskAgent && (
        <IconToolButton label="询问 Agent 意见" onClick={onAskAgent}>
          <Sparkles className="h-6 w-6" />
        </IconToolButton>
      )}
      <IconToolButton label="传送回云端小屋" onClick={onHome}>
        <Home className="h-6 w-6" />
      </IconToolButton>
    </div>
  );
}

function useCamera(enabled) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!enabled) return;
      setError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setReady(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      setReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [enabled]);

  return { videoRef, streamRef, ready, error };
}

function VideoStage({
  enabled,
  onVideoClick,
  points = [],
  overlayUrl = "",
  children,
  videoRefOut,
  fit = "contain",
}) {
  const { videoRef, ready, error } = useCamera(enabled);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (videoRefOut) videoRefOut.current = videoRef.current;
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const bump = () => setTick((n) => n + 1);
    v.addEventListener("loadedmetadata", bump);
    window.addEventListener("resize", bump);
    return () => {
      v.removeEventListener("loadedmetadata", bump);
      window.removeEventListener("resize", bump);
    };
  }, [videoRef, ready]);

  const handleClick = (e) => {
    if (!onVideoClick || !videoRef.current) return;
    const mapped = mapClickToVideoNormalized(
      videoRef.current,
      e.clientX,
      e.clientY,
      fit,
    );
    onVideoClick({ ...mapped, clientX: e.clientX, clientY: e.clientY });
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl animate-fadeIn">
      <div
        className="relative overflow-hidden rounded-3xl bg-sky-900/10 shadow-soft ring-4 ring-white/50"
        style={{ aspectRatio: "16 / 9" }}
      >
        <video
          ref={videoRef}
          className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"} bg-sky-950/20`}
          playsInline
          muted
          autoPlay
          onClick={overlayUrl ? undefined : handleClick}
          style={{ cursor: onVideoClick && !overlayUrl ? "crosshair" : "default" }}
        />
        {overlayUrl && (
          <img
            src={overlayUrl}
            alt="魔法变身结果"
            className="absolute inset-0 h-full w-full object-contain bg-sky-950/30"
          />
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-sky-100/80 text-sky-700">
            正在唤醒水晶球视线…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-rose-50/90 p-6 text-center text-rose-700">
            欸，魔法怎么失灵了?!难道是「摄像头」出现了问题？
            <br />
            <span className="mt-2 block text-sm opacity-80">{error}</span>
          </div>
        )}

        {/* SAM2 prompt pin — position synced with click mapping */}
        {!overlayUrl &&
          points.map((p) => (
            <span
              key="sam2-prompt-pin"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={pinStyleFromVideoNormalized(videoRef.current, p.x, p.y, fit)}
            >
              <span className="absolute inset-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400/50 animate-softPulse" />
              <span className="relative block h-3.5 w-3.5 rounded-full bg-pink-500 shadow ring-2 ring-white" />
            </span>
          ))}

        {children}
      </div>
    </div>
  );
}

function HomeView({ onEnterMode1, onEnterMode2, onOpenGallery }) {
  return (
    <section className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-16 animate-fadeIn">
      <header className="mb-10 text-center">
        <div className="mb-4 flex items-center justify-center gap-3 text-sky-500">
          <Cloud className="h-8 w-8 animate-floaty" />
          <Rainbow className="h-9 w-9" />
          <Bird className="h-9 w-9 animate-floaty" style={{ animationDelay: "0.8s" }} />
        </div>
        <h1
          className="text-4xl font-bold tracking-wide text-sky-800 drop-shadow-sm sm:text-5xl md:text-6xl"
          style={{ textShadow: "0 4px 0 rgba(255,255,255,0.55)" }}
        >
          ChromaPenguin-Live
        </h1>
        <p className="mt-4 text-base text-sky-700/80 sm:text-lg">
          梦幻云端变身站·实时AIGC小程序
        </p>
      </header>

      <div className="glass-card w-full space-y-4 rounded-3xl p-6 shadow-soft sm:p-8">
        <Tooltip text="轻轻一点，就能踏进企鹅魔法世界喔～">
          <PrimaryButton onClick={onEnterMode1}>咕咕嘎嘎大作战</PrimaryButton>
        </Tooltip>

        <SoftButton onClick={onEnterMode2}>探索其他变身</SoftButton>

        <SoftButton onClick={onOpenGallery} className="flex items-center justify-center gap-2">
          <ImageIcon className="h-5 w-5" />
          翻开魔法相册看看吧
        </SoftButton>
      </div>
    </section>
  );
}

function Mode1View({ onHome, onAddMedia, onCaptureSuccess, onAskAgent }) {
  const [isRecording, setIsRecording] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const drawLoopRef = useRef(0);
  const { trySpend, energy, maxEnergy, genCost } = useEnergy();

  const { frameUrl, meta, status, error, connected } = useGuguBackendStream(true);

  const spendOrWarn = () => {
    const result = trySpend(genCost);
    if (!result.ok) {
      window.alert(result.message);
      return false;
    }
    return true;
  };

  // Keep a canvas mirror for MediaRecorder when recording backend frames
  useEffect(() => {
    if (!isRecording || !frameUrl || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const paint = () => {
      if (!img.naturalWidth) return;
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      ctx.drawImage(img, 0, 0);
    };
    paint();
    img.addEventListener("load", paint);
    return () => img.removeEventListener("load", paint);
  }, [frameUrl, isRecording]);

  const captureMeta = () => {
    const color = meta?.color ? String(meta.color) : "";
    const prompt =
      meta?.prompt ||
      `cloth color transform ${color} cute fluffy penguin soft studio light`.trim();
    return { genPrompt: prompt, mode: "create1", clothColor: color || undefined };
  };

  const capturePhoto = () => {
    if (!spendOrWarn()) return;
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const item = {
      id: crypto.randomUUID(),
      type: "photo",
      url: canvas.toDataURL("image/jpeg", 0.92),
      createdAt: Date.now(),
      ...captureMeta(),
    };
    onAddMedia?.(item);
    onCaptureSuccess?.(item);
  };

  const toggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (drawLoopRef.current) {
        cancelAnimationFrame(drawLoopRef.current);
        drawLoopRef.current = 0;
      }
      return;
    }

    if (!spendOrWarn()) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img?.naturalWidth || !canvas) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(8);
    recordedChunksRef.current = [];

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const item = {
        id: crypto.randomUUID(),
        type: "video",
        url: URL.createObjectURL(blob),
        createdAt: Date.now(),
        ...captureMeta(),
      };
      onAddMedia?.(item);
      onCaptureSuccess?.(item);
    };

    const tick = () => {
      if (img.naturalWidth) ctx.drawImage(img, 0, 0);
      drawLoopRef.current = requestAnimationFrame(tick);
    };
    tick();
    recorder.start(200);
    setIsRecording(true);
  };

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-sky-800 sm:text-3xl">咕咕嘎嘎大作战</h2>
          <p className="mt-1 text-xs font-semibold text-amber-600/90">
            咔嚓留下画面消耗 {genCost} 体力 · 当前 {energy}/{maxEnergy}
          </p>
        </div>
        {meta && (
          <div className="rounded-2xl bg-white/70 px-4 py-2 text-sm text-sky-800 shadow">
            <span className="font-semibold">{meta.color || "—"}</span>
            <span className="mx-2 text-sky-400">|</span>
            {meta.mode || "—"}
            <span className="mx-2 text-sky-400">|</span>
            {meta.fps != null ? `${meta.fps} FPS` : "—"}
          </div>
        )}
      </div>

      <div className="relative mx-auto w-full max-w-5xl animate-fadeIn">
        <div
          className="relative overflow-hidden rounded-3xl bg-sky-900/10 shadow-soft ring-4 ring-white/50"
          style={{ aspectRatio: "16 / 9" }}
        >
          {frameUrl ? (
            <img
              ref={imgRef}
              src={frameUrl}
              alt="魔法变身画面"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sky-100/85 p-6 text-center text-sky-700">
              {!error && (
                <>
                  <Sparkles className="h-8 w-8 animate-floaty text-sky-400" />
                  <p>
                    {status ||
                      (connected
                        ? "正在查阅魔法咒语中…"
                        : "正在搭建云端传送门…")}
                  </p>
                  <p className="text-xs text-sky-600/70">
                    若传送门迟迟不开，请先唤醒后端魔法炉灶喔
                  </p>
                </>
              )}
              {error && (
                <p className="text-rose-600">{magifyError(error)}</p>
              )}
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          <FloatingToolbar
            onCapture={capturePhoto}
            onToggleRecord={toggleRecord}
            isRecording={isRecording}
            onHome={onHome}
            onAskAgent={onAskAgent}
          />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-sky-700/60">
        魔法链路 · {connected ? "闪闪发光中" : "还在沉睡"}
        {meta?.prompt ? ` · 咒语：${meta.prompt.slice(0, 48)}` : ""}
      </p>
    </section>
  );
}

function useGuguBackendStream(enabled) {
  const [frameUrl, setFrameUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const urlRef = useRef("");

  useEffect(() => {
    if (!enabled) return undefined;

    let ws;
    let closed = false;
    setError("");
    setStatus("正在搭建云端传送门…");

    try {
      ws = new WebSocket(guguWsUrl());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    }

    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (closed) return;
      setConnected(true);
      setStatus("正在查阅魔法咒语中…");
    };

    ws.onmessage = (ev) => {
      if (closed) return;
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "meta") setMeta(msg);
          if (msg.type === "status") setStatus(magifyStatus(msg.message || msg.phase || ""));
          if (msg.type === "error") setError(msg.message || "后端小精灵罢工");
        } catch {
          /* ignore */
        }
        return;
      }
      const blob = new Blob([ev.data], { type: "image/jpeg" });
      const next = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = next;
      setFrameUrl(next);
      setStatus("");
    };

    ws.onerror = () => {
      if (!closed) setError("传送门打不开（请确认魔法炉灶已在 8765 端口燃烧）");
    };

    ws.onclose = () => {
      if (closed) return;
      setConnected(false);
      setStatus("欸，传送门忽然关上了…");
    };

    return () => {
      closed = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = "";
      }
    };
  }, [enabled]);

  return { frameUrl, meta, status, error, connected };
}

function Mode2View({
  onHome,
  onAddMedia,
  onCaptureSuccess,
  onAskAgent,
  onOptimizePrompt,
  registerPromptSetter,
}) {
  const [points, setPoints] = useState([]);
  const [promptText, setPromptText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const { trySpend, refund, energy, maxEnergy, genCost } = useEnergy();

  useEffect(() => {
    if (!registerPromptSetter) return undefined;
    return registerPromptSetter(setPromptText);
  }, [registerPromptSetter]);

  const videoRefOut = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const drawLoopRef = useRef(0);

  const {
    frameUrl,
    meta,
    status,
    error,
    connected,
    ready,
    startTransform,
    stopTransform,
    resetSession,
  } = useExploreBackend(true, videoRefOut);

  const handlePointClick = useCallback(({ x, y }) => {
    if (transforming) return;
    // 功能二：仅保留一个 SAM2 prompt 点（再次点击会替换）
    setPoints([{ id: crypto.randomUUID(), x, y, createdAt: Date.now() }]);
  }, [transforming]);

  const onStart = useCallback(() => {
    if (!points.length) {
      window.alert("先用小魔杖在画面上点一下目标吧～");
      return;
    }
    if (!promptText.trim()) {
      window.alert("要把变身咒语写上喔（英文），例如 penguin～");
      return;
    }
    const spent = trySpend(genCost);
    if (!spent.ok) {
      window.alert(spent.message);
      return;
    }
    const ok = startTransform({
      points: [{ x: points[0].x, y: points[0].y }],
      prompt: promptText.trim(),
    });
    if (ok) {
      setTransforming(true);
    } else {
      refund(genCost);
      window.alert("传送门还没亮起来，体力已退回。请稍后再试～");
    }
  }, [points, promptText, startTransform, trySpend, refund, genCost]);

  const onStop = useCallback(() => {
    stopTransform();
    setTransforming(false);
    resetSession();
  }, [stopTransform, resetSession]);

  const onClearPoints = useCallback(() => {
    setPoints([]);
    if (transforming) {
      stopTransform();
      setTransforming(false);
    }
    resetSession();
  }, [transforming, stopTransform, resetSession]);

  useEffect(() => {
    if (!isRecording || !frameUrl || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const paint = () => {
      if (!img.naturalWidth) return;
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      ctx.drawImage(img, 0, 0);
    };
    paint();
    img.addEventListener("load", paint);
    return () => img.removeEventListener("load", paint);
  }, [frameUrl, isRecording]);

  const emitCapture = (item) => {
    const genPrompt =
      (promptText || meta?.prompt || "").trim() ||
      "dreamy cute fluffy penguin soft pastel light magical transform";
    onAddMedia?.(item);
    onCaptureSuccess?.({ ...item, genPrompt, mode: "create2" });
  };

  const capturePhoto = () => {
    const img = imgRef.current;
    if (img?.naturalWidth) {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      emitCapture({
        id: crypto.randomUUID(),
        type: "photo",
        url: canvas.toDataURL("image/jpeg", 0.92),
        createdAt: Date.now(),
      });
      return;
    }
    const video = videoRefOut.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    emitCapture({
      id: crypto.randomUUID(),
      type: "photo",
      url: canvas.toDataURL("image/jpeg", 0.92),
      createdAt: Date.now(),
    });
  };

  const toggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (drawLoopRef.current) {
        cancelAnimationFrame(drawLoopRef.current);
        drawLoopRef.current = 0;
      }
      return;
    }

    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img?.naturalWidth && canvas) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      const stream = canvas.captureStream(8);
      recordedChunksRef.current = [];
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        emitCapture({
          id: crypto.randomUUID(),
          type: "video",
          url: URL.createObjectURL(blob),
          createdAt: Date.now(),
        });
      };
      const tick = () => {
        if (img.naturalWidth) ctx.drawImage(img, 0, 0);
        drawLoopRef.current = requestAnimationFrame(tick);
      };
      tick();
      recorder.start(200);
      setIsRecording(true);
      return;
    }

    const video = videoRefOut.current;
    const camStream = video?.srcObject;
    if (!(camStream instanceof MediaStream)) return;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(camStream, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      emitCapture({
        id: crypto.randomUUID(),
        type: "video",
        url: URL.createObjectURL(blob),
        createdAt: Date.now(),
      });
    };
    recorder.start();
    setIsRecording(true);
  };

  return (
    <section className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-8 animate-fadeIn">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-sky-800 sm:text-3xl">探索其他变身</h2>
          <p className="text-sm text-sky-700/70">
            点一下选中目标，念出英文咒语，叽里咕噜就能变身喔～
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-600/90">
            每次启动变身消耗 {genCost} 体力 · 当前 {energy}/{maxEnergy}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta && transforming && (
            <div className="rounded-2xl bg-white/70 px-4 py-2 text-sm text-sky-800 shadow">
              咒语施展中
              <span className="mx-2 text-sky-400">|</span>
              {meta.fps != null ? `${meta.fps} FPS` : "—"}
            </div>
          )}
          <button
            type="button"
            onClick={onClearPoints}
            className="rounded-2xl bg-white/70 px-4 py-2 text-sm text-sky-700 shadow transition hover:bg-white"
          >
            {points.length ? "擦掉魔法标记" : "还没落下标记"}
          </button>
        </div>
      </div>

      <VideoStage
        enabled
        onVideoClick={handlePointClick}
        points={points}
        overlayUrl={transforming ? frameUrl : ""}
        videoRefOut={videoRefOut}
      >
        <FloatingToolbar
          onCapture={capturePhoto}
          onToggleRecord={toggleRecord}
          isRecording={isRecording}
          onHome={onHome}
          onAskAgent={onAskAgent}
        />
        {/* Hidden img for recording backend frames */}
        {frameUrl && (
          <img ref={imgRef} src={frameUrl} alt="" className="hidden" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </VideoStage>

      <div className="glass-card mx-auto mt-6 max-w-3xl space-y-4 rounded-3xl p-5 shadow-soft">
        <label className="block text-sm font-medium text-sky-800">
          写下你想变成的模样（英文咒语）
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={transforming}
            placeholder="例如：penguin、duck、cat"
            className="mt-2 w-full rounded-2xl border-0 bg-white/80 px-4 py-3 text-base text-sky-900
              shadow-inner outline-none ring-1 ring-sky-100 placeholder:text-sky-400
              focus:ring-2 focus:ring-sky-300 transition-all disabled:opacity-60"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={transforming}
            onClick={() => onOptimizePrompt?.(promptText)}
            className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-sky-700 shadow ring-1 ring-sky-100
              transition hover:scale-[1.02] hover:bg-white disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-pink-400" />
              Agent 优化咒语
            </span>
          </button>
          <button
            type="button"
            disabled={transforming}
            onClick={onAskAgent}
            className="rounded-2xl bg-sky-100/80 px-4 py-2 text-sm font-semibold text-sky-800 shadow
              transition hover:scale-[1.02] disabled:opacity-50"
          >
            询问 Agent 意见
          </button>
        </div>
        {transforming ? (
          <SoftButton onClick={onStop}>停下这道魔法</SoftButton>
        ) : (
          <PrimaryButton onClick={onStart} className={!ready ? "opacity-70" : ""}>
            {ready ? "叽里咕噜，变身魔法启动！" : "正在查阅魔法咒语中…"}
          </PrimaryButton>
        )}
        <p className="text-xs text-sky-700/60">
          魔法链路 · {connected ? "闪闪发光中" : "还在沉睡"}
          {status ? ` · ${status}` : ""}
          {error ? ` · ${magifyError(error)}` : ""}
          {meta?.prompt ? ` · 咒语：${meta.prompt.slice(0, 40)}` : ""}
        </p>
      </div>
    </section>
  );
}

function useExploreBackend(enabled, videoRefOut) {
  const [frameUrl, setFrameUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const urlRef = useRef("");
  const wsRef = useRef(null);
  const liveRef = useRef(false); // 是否接受并显示后端帧
  const inFlightRef = useRef(false); // 应答式：上一帧未返回不发下一帧
  const clientSessionRef = useRef(0);
  const serverSessionRef = useRef(-1);
  const waitMetaRef = useRef(false); // 新会话需先收到 meta 再显示画面


  const clearFrame = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }
    setFrameUrl("");
  }, []);

  const captureAndSendFrame = useCallback(() => {
    const ws = wsRef.current;
    const video = videoRefOut?.current;
    if (!liveRef.current || inFlightRef.current) return;
    if (!ws || ws.readyState !== WebSocket.OPEN || !video?.videoWidth) return;

    const maxW = 640;
    const scale = Math.min(1, maxW / video.videoWidth);
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);
    inFlightRef.current = true;
    canvas.toBlob(
      (blob) => {
        if (!blob || !liveRef.current || ws.readyState !== WebSocket.OPEN) {
          inFlightRef.current = false;
          return;
        }
        blob.arrayBuffer().then((buf) => {
          if (!liveRef.current || ws.readyState !== WebSocket.OPEN) {
            inFlightRef.current = false;
            return;
          }
          ws.send(buf);
        });
      },
      "image/jpeg",
      0.65,
    );
  }, [videoRefOut]);

  useEffect(() => {
    if (!enabled) return undefined;

    let ws;
    let closed = false;
    setError("");
    setStatus("正在搭建云端传送门…");
    setReady(false);
    liveRef.current = false;
    inFlightRef.current = false;

    try {
      ws = new WebSocket(exploreWsUrl());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    }

    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (closed) return;
      setConnected(true);
      setStatus("正在查阅魔法咒语中…");
    };

    ws.onmessage = (ev) => {
      if (closed) return;
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "ack" && msg.action === "start") {
            if (typeof msg.session === "number") {
              serverSessionRef.current = msg.session;
            }
            waitMetaRef.current = true;
            // 仅在当前仍处于 live 时开始推帧
            if (liveRef.current) {
              inFlightRef.current = false;
              captureAndSendFrame();
            }
          }
          if (msg.type === "meta") {
            if (
              typeof msg.session === "number" &&
              msg.session !== serverSessionRef.current
            ) {
              return; // 丢弃旧会话 meta
            }
            waitMetaRef.current = false;
            setMeta(msg);
          }
          if (msg.type === "status") {
            setStatus(magifyStatus(msg.message || msg.phase || ""));
            if (msg.phase === "ready" || msg.phase === "streaming") setReady(true);
          }
          if (msg.type === "error") setError(msg.message || "后端小精灵罢工");
        } catch {
          /* ignore */
        }
        return;
      }

      // 二进制帧：停止后、或尚未收到本会话 meta 时一律丢弃
      if (!liveRef.current || waitMetaRef.current) return;
      const blob = new Blob([ev.data], { type: "image/jpeg" });
      const next = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = next;
      setFrameUrl(next);
      inFlightRef.current = false;
      if (liveRef.current) {
        setStatus("正在吟诵魔法咒语中…");
        requestAnimationFrame(() => captureAndSendFrame());
      }
    };

    ws.onerror = () => {
      if (!closed) setError("传送门打不开（请确认魔法炉灶已在 8765 端口燃烧）");
    };

    ws.onclose = () => {
      if (closed) return;
      setConnected(false);
      setReady(false);
      setStatus("欸，传送门忽然关上了…");
      liveRef.current = false;
      inFlightRef.current = false;
    };

    return () => {
      closed = true;
      liveRef.current = false;
      inFlightRef.current = false;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = "";
      }
    };
  }, [enabled, captureAndSendFrame]);

  const stopTransform = useCallback(() => {
    liveRef.current = false;
    inFlightRef.current = false;
    waitMetaRef.current = false;
    clearFrame();
    setMeta(null);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
    }
  }, [clearFrame]);

  const resetSession = useCallback(() => {
    liveRef.current = false;
    inFlightRef.current = false;
    waitMetaRef.current = false;
    clearFrame();
    setMeta(null);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "reset" }));
    }
  }, [clearFrame]);

  const startTransform = useCallback(
    ({ points, prompt }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError("传送门还没亮起来");
        return false;
      }
      setError("");
      clearFrame();
      setMeta(null);
      setStatus("叽里咕噜，变身魔法启动！");
      clientSessionRef.current += 1;
      serverSessionRef.current = -1;
      waitMetaRef.current = true;
      liveRef.current = true;
      inFlightRef.current = false;
      ws.send(
        JSON.stringify({
          type: "start",
          points,
          prompt,
          session: clientSessionRef.current,
        }),
      );
      return true;
    },
    [clearFrame],
  );

  return {
    frameUrl,
    meta,
    status,
    error,
    connected,
    ready,
    startTransform,
    stopTransform,
    resetSession,
  };
}

function GalleryModal({ open, media, filter, setFilter, onClose, onDelete, onDownload }) {
  const filtered = useMemo(() => {
    if (filter === "photo") return media.filter((m) => m.type === "photo");
    if (filter === "video") return media.filter((m) => m.type === "video");
    return media;
  }, [media, filter]);

  const tabs = [
    { id: "all", label: "全部宝藏" },
    { id: "photo", label: "魔法照片" },
    { id: "video", label: "时光片段" },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <button
        type="button"
        className="absolute inset-0 bg-sky-900/30 backdrop-blur-sm"
        aria-label="合上魔法相册"
        onClick={onClose}
      />
      <div className="glass-card relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col rounded-3xl p-5 shadow-soft sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-sky-800">魔法相册与时光水晶</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white/80 p-2 text-sky-700 shadow transition hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-all
                ${
                  filter === t.id
                    ? "bg-gradient-to-r from-sky-300 to-pink-300 text-white shadow"
                    : "bg-white/70 text-sky-700 hover:bg-white"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-3xl bg-white/40 text-sky-600">
              <ImageIcon className="mb-2 h-10 w-10 opacity-60" />
              相册还是空空的，先去拍一张魔法瞬间吧～
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-3xl bg-white/60 shadow transition-all
                    duration-300 hover:-translate-y-1 hover:shadow-soft"
                >
                  {item.type === "photo" ? (
                    <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <video src={item.url} className="aspect-square w-full object-cover" muted />
                  )}
                  <div
                    className="absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t
                      from-sky-900/60 to-transparent p-3 opacity-0 transition-opacity duration-300
                      group-hover:opacity-100"
                  >
                    <button
                      type="button"
                      onClick={() => onDownload(item)}
                      className="rounded-xl bg-white/90 p-2 text-sky-700 shadow"
                      title="收藏到口袋"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="rounded-xl bg-white/90 p-2 text-rose-600 shadow"
                      title="让它变回泡泡"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                    {item.type === "photo" ? "魔法照片" : "时光片段"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { Mode1View, Mode2View, FloatingClouds, HomeView };
