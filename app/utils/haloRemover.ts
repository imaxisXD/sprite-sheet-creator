/**
 * Halo removal — expands transparency outward to clean edge artifacts.
 * Ported from sprite-maker.
 */

/**
 * Expand transparency outward from transparent pixels by a circular radius.
 */
export async function expandTransparency(
  imageData: ImageData,
  expandPixels: number
): Promise<ImageData> {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  // Find all transparent pixels (alpha < 128)
  const transparentPixels = new Set<string>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 128) {
        transparentPixels.add(`${x},${y}`);
      }
    }
  }

  // Expand transparency — find pixels within radius
  const newTransparent = new Set(transparentPixels);

  for (const coord of transparentPixels) {
    const [cx, cy] = coord.split(',').map(Number);

    for (let dy = -expandPixels; dy <= expandPixels; dy++) {
      for (let dx = -expandPixels; dx <= expandPixels; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= expandPixels) {
          newTransparent.add(`${nx},${ny}`);
        }
      }
    }
  }

  // Apply new transparency
  for (const coord of newTransparent) {
    const [x, y] = coord.split(',').map(Number);
    const idx = (y * width + x) * 4;
    data[idx + 3] = 0;
  }

  return new ImageData(data, width, height);
}

/**
 * Apply halo removal to a canvas.
 * @param sourceCanvas - Source canvas with image
 * @param expandPixels - How many pixels to expand transparency
 * @returns New canvas with halo removed
 */
export async function applyHaloRemover(
  sourceCanvas: HTMLCanvasElement,
  expandPixels: number
): Promise<HTMLCanvasElement> {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;
  const ctx = outputCanvas.getContext('2d')!;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);

  const processedData = await expandTransparency(imageData, expandPixels);
  ctx.putImageData(processedData, 0, 0);

  return outputCanvas;
}
