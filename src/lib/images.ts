/** Achica y comprime una foto para guardarla en el dispositivo sin ocupar demasiado espacio. */
export async function compressImage(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      image.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlSizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round((base64.length * 3) / 4 / 1024);
}
