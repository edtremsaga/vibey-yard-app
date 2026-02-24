export async function resizeImageForIdentify(
  input: Blob,
  opts?: { maxDimension?: number; quality?: number }
): Promise<Blob> {
  const maxDimension = opts?.maxDimension ?? 1024;
  const quality = opts?.quality ?? 0.82;

  let width = 0;
  let height = 0;
  let drawSource: CanvasImageSource;
  let cleanup: (() => void) | null = null;

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(input);
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
      cleanup = () => bitmap.close();
    } else {
      throw new Error("createImageBitmap unavailable");
    }
  } catch {
    const url = URL.createObjectURL(input);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image decode failed"));
        img.src = url;
      });

      width = image.naturalWidth || image.width;
      height = image.naturalHeight || image.height;
      drawSource = image;
      cleanup = () => {
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  const longestSide = Math.max(width, height);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (cleanup) {
      cleanup();
    }
    throw new Error("Could not get canvas context");
  }

  ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);

  const output = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("JPEG export failed"));
      },
      "image/jpeg",
      quality
    );
  });

  if (cleanup) {
    cleanup();
  }

  return output;
}
