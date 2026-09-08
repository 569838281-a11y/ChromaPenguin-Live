import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, X, ZoomIn } from "lucide-react";
import { cropImageToBlob, defaultCoverRect } from "../utils/profileImage.js";

/**
 * Manual crop UI: drag to pan, zoom to scale crop window over the image.
 * Exports exact target.width × target.height JPEG.
 */
export default function ImageCropModal({
  open,
  image,
  target,
  title = "裁剪图片",
  onCancel,
  onConfirm,
}) {
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const [busy, setBusy] = useState(false);

  const safeTarget = target || { width: 256, height: 256, aspect: 1 };
  const aspect = safeTarget.aspect || safeTarget.width / safeTarget.height;

  const baseRect = useMemo(() => {
    if (!image) return null;
    return defaultCoverRect(image, aspect);
  }, [image, aspect]);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBusy(false);
  }, [open, image]);

  const viewSize = useMemo(() => {
    const maxW = 320;
    const h = Math.round(maxW / aspect);
    return { w: maxW, h: Math.min(h, 280) };
  }, [aspect]);

  const layout = useMemo(() => {
    if (!image || !baseRect) return null;
    const scale = Math.max(viewSize.w / baseRect.w, viewSize.h / baseRect.h) * zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const cx = baseRect.x + baseRect.w / 2;
    const cy = baseRect.y + baseRect.h / 2;
    const left = viewSize.w / 2 - cx * scale + offset.x;
    const top = viewSize.h / 2 - cy * scale + offset.y;
    return { scale, drawW, drawH, left, top };
  }, [image, baseRect, viewSize, zoom, offset]);

  const onPointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  };

  const onPointerUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const computeSrcRect = useCallback(() => {
    if (!image || !layout || !baseRect) return null;
    const x = (0 - layout.left) / layout.scale;
    const y = (0 - layout.top) / layout.scale;
    const w = viewSize.w / layout.scale;
    const h = viewSize.h / layout.scale;
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    let sx = x;
    let sy = y;
    let sw = w;
    let sh = h;
    if (sw > iw) {
      sw = iw;
      sx = 0;
    }
    if (sh > ih) {
      sh = ih;
      sy = 0;
    }
    sx = Math.max(0, Math.min(sx, iw - sw));
    sy = Math.max(0, Math.min(sy, ih - sh));
    const targetAspect = aspect;
    if (sw / sh > targetAspect) {
      const nw = sh * targetAspect;
      sx += (sw - nw) / 2;
      sw = nw;
    } else {
      const nh = sw / targetAspect;
      sy += (sh - nh) / 2;
      sh = nh;
    }
    sx = Math.max(0, Math.min(sx, iw - sw));
    sy = Math.max(0, Math.min(sy, ih - sh));
    return { x: sx, y: sy, w: sw, h: sh };
  }, [image, layout, baseRect, viewSize, aspect]);

  const handleConfirm = async () => {
    const rect = computeSrcRect();
    if (!rect || !image || !target) return;
    setBusy(true);
    try {
      const blob = await cropImageToBlob(image, rect, target);
      await onConfirm?.(blob);
    } catch (err) {
      window.alert(err?.message || "裁剪失败");
    } finally {
      setBusy(false);
    }
  };

  if (!open || !image || !target) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fadeIn">
      <button
        type="button"
        className="absolute inset-0 bg-sky-900/40 backdrop-blur-sm"
        onClick={() => !busy && onCancel?.()}
        aria-label="关闭"
      />
      <div className="glass-card relative z-10 w-full max-w-md rounded-3xl p-5 shadow-soft">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-sky-800">{title}</h3>
            <p className="mt-0.5 text-xs text-sky-600">
              尺寸需为 {target.width}×{target.height}。拖动调整位置，滑杆缩放。
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl bg-white/80 p-2 text-sky-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={viewportRef}
          className="relative mx-auto overflow-hidden rounded-2xl bg-sky-950/20 ring-2 ring-sky-300/60 touch-none"
          style={{ width: viewSize.w, height: viewSize.h, cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {layout && (
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                width: layout.drawW,
                height: layout.drawH,
                left: layout.left,
                top: layout.top,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_rgba(56,189,248,0.85)]" />
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-800">
          <ZoomIn className="h-3.5 w-3.5 text-sky-500" />
          缩放
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            disabled={busy}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-sky-400"
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-white/80 py-2.5 text-sm font-semibold text-sky-700"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-400 to-pink-300 py-2.5 text-sm font-bold text-white shadow-cloud disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {busy ? "处理中…" : "确认裁剪"}
          </button>
        </div>
      </div>
    </div>
  );
}
