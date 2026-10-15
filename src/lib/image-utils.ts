/**
 * Utility to dynamically make solid white/light backgrounds transparent on HTML5 canvas.
 * This ensures legacy and AI images blend seamlessly onto dark cyber pedestals without white boxes.
 */
export async function removeWhiteBackgroundFromImage(imageSrc: string): Promise<string> {
  if (typeof window === "undefined" || !imageSrc) return imageSrc;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Check corner pixels to determine if background is light/white
        const corners = [
          0,
          (canvas.width - 1) * 4,
          (canvas.height - 1) * canvas.width * 4,
          ((canvas.height - 1) * canvas.width + (canvas.width - 1)) * 4
        ];
        
        const isWhiteBg = corners.some(idx => {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          return r > 230 && g > 230 && b > 230;
        });

        if (!isWhiteBg) {
          resolve(imageSrc);
          return;
        }

        // Convert white/near-white pixels to transparent with anti-aliasing edge blend
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Threshold for pure or near-white background
          if (r > 230 && g > 230 && b > 230) {
            data[i + 3] = 0; // Fully transparent
          } else if (r > 200 && g > 200 && b > 200) {
            // Soft feathered boundary
            const factor = (255 - Math.max(r, g, b)) / 55;
            data[i + 3] = Math.round(data[i + 3] * factor);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}
