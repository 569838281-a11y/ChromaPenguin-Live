/** Target pixel sizes for profile images */
export const AVATAR_SIZE = { width: 256, height: 256, label: "头像 256×256", aspect: 1 };
export const COVER_SIZE = { width: 1200, height: 400, label: "背景 1200×400", aspect: 1200 / 400 };

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

/** Exact pixel match → no crop needed */
export function needsCrop(img, target) {
  return !(img.naturalWidth === target.width && img.naturalHeight === target.height);
}

/**
 * Draw a source rect from img onto canvas at target size → JPEG Blob
 * @param {{ x: number, y: number, w: number, h: number }} srcRect in image pixels
 */
export function cropImageToBlob(img, srcRect, target, quality = 0.92) {
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    srcRect.x,
    srcRect.y,
    srcRect.w,
    srcRect.h,
    0,
    0,
    target.width,
    target.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("裁剪导出失败"));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Center-cover crop rect that fills target aspect */
export function defaultCoverRect(img, aspect) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const imgAspect = iw / ih;
  let w;
  let h;
  if (imgAspect > aspect) {
    h = ih;
    w = ih * aspect;
  } else {
    w = iw;
    h = iw / aspect;
  }
  return {
    x: (iw - w) / 2,
    y: (ih - h) / 2,
    w,
    h,
  };
}
