import { ApiError, type ProcessedImage } from '../data/types';

const MAX_BYTES = 400 * 1024;

async function decode(file: Blob): Promise<{ src: CanvasImageSource; width: number; height: number; close(): void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { src: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { src: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ApiError('unsupported_image');
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

/**
 * Spec §6.3: decode (EXIF-aware), resize long edge ≤ maxEdge, encode WebP q≈0.8 (JPEG fallback),
 * retry at lower quality / smaller size until ≤ 400 KB.
 */
export async function processImage(file: Blob, maxEdge = 1600): Promise<ProcessedImage> {
  const img = await decode(file);
  try {
    let edge = Math.min(maxEdge, Math.max(img.width, img.height));
    let best: ProcessedImage | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = edge / Math.max(img.width, img.height);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ApiError('unsupported_image');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img.src, 0, 0, w, h);

      for (const q of [0.8, 0.7, 0.6]) {
        let blob = await toBlob(canvas, 'image/webp', q);
        let ext: 'webp' | 'jpg' = 'webp';
        if (!blob || blob.type !== 'image/webp') {
          blob = await toBlob(canvas, 'image/jpeg', q);
          ext = 'jpg';
        }
        if (!blob) throw new ApiError('unsupported_image');
        best = { blob, width: w, height: h, bytes: blob.size, ext };
        if (blob.size <= MAX_BYTES) return best;
      }
      edge = Math.round(edge * 0.75);
    }
    if (!best) throw new ApiError('unsupported_image');
    return best;
  } finally {
    img.close();
  }
}
