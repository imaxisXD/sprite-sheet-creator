/**
 * Chroma key (color-based background removal) utilities.
 * Ported from sprite-maker.
 */

/**
 * Apply chroma key to a canvas — makes pixels matching a target color transparent.
 * @param sourceCanvas - Source canvas with image
 * @param targetColorHex - Hex color to remove (e.g., "#00ff00")
 * @param tolerance - Color distance tolerance (0-255)
 * @returns New canvas with chroma key applied
 */
export function applyChromaKey(
  sourceCanvas: HTMLCanvasElement,
  targetColorHex: string,
  tolerance: number
): HTMLCanvasElement {
  const targetColor = {
    r: parseInt(targetColorHex.substr(1, 2), 16),
    g: parseInt(targetColorHex.substr(3, 2), 16),
    b: parseInt(targetColorHex.substr(5, 2), 16),
  };

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;
  const outputCtx = outputCanvas.getContext('2d')!;

  outputCtx.drawImage(sourceCanvas, 0, 0);

  const imageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      (r - targetColor.r) ** 2 +
      (g - targetColor.g) ** 2 +
      (b - targetColor.b) ** 2
    );

    if (distance <= tolerance) {
      data[i + 3] = 0;
    }
  }

  outputCtx.putImageData(imageData, 0, 0);
  return outputCanvas;
}

/**
 * Get the color at a specific position on a canvas.
 * @returns Hex color string (e.g., "#ff00aa")
 */
export function getColorAtPosition(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): string {
  const ctx = canvas.getContext('2d')!;
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const r = pixel[0].toString(16).padStart(2, '0');
  const g = pixel[1].toString(16).padStart(2, '0');
  const b = pixel[2].toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}
