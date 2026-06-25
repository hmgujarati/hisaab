// Browser-side image compression for bill photos
export async function compressImage(file, { maxSize = 1800, quality = 0.82, targetKb = 600 } = {}) {
  if (!file) return null;
  if (!file.type?.startsWith("image/")) return file;

  const img = await loadImage(file);
  const { width, height } = scaleToFit(img.width, img.height, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  let q = quality;
  let blob = await canvasToBlob(canvas, "image/jpeg", q);
  // try to land near targetKb
  while (blob.size > targetKb * 1024 * 1.4 && q > 0.45) {
    q -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
  }
  return new File([blob], (file.name || "bill").replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function scaleToFit(w, h, max) {
  if (Math.max(w, h) <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Simple "scan look" enhancement: increase contrast, slight brightness
export async function enhanceForScan(file) {
  if (!file?.type?.startsWith("image/")) return file;
  const img = await loadImage(file);
  const { width, height } = scaleToFit(img.width, img.height, 1800);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  const arr = data.data;
  const contrast = 1.25;
  const brightness = 8;
  for (let i = 0; i < arr.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      let v = arr[i + k];
      v = (v - 128) * contrast + 128 + brightness;
      arr[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  ctx.putImageData(data, 0, 0);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
  return new File([blob], (file.name || "scan") + ".jpg", { type: "image/jpeg" });
}
