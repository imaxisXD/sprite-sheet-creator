import JSZip from 'jszip';

/**
 * Build sprite sheet from array of canvases
 */
export function buildSpriteSheet(
  canvases: HTMLCanvasElement[],
  forcedCols?: number
): HTMLCanvasElement {
  if (canvases.length === 0) {
    const empty = document.createElement('canvas');
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  // Find max dimensions
  const maxWidth = Math.max(...canvases.map((c) => c.width));
  const maxHeight = Math.max(...canvases.map((c) => c.height));

  // Calculate grid layout
  const cols = forcedCols ?? Math.ceil(Math.sqrt(canvases.length));
  const rows = Math.ceil(canvases.length / cols);

  // Create sprite sheet canvas
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = cols * maxWidth;
  sheetCanvas.height = rows * maxHeight;
  const ctx = sheetCanvas.getContext('2d')!;

  // Draw each frame centered in its cell
  canvases.forEach((canvas, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * maxWidth + Math.round((maxWidth - canvas.width) / 2);
    const y = row * maxHeight + Math.round((maxHeight - canvas.height) / 2);
    ctx.drawImage(canvas, x, y);
  });

  return sheetCanvas;
}

/**
 * Download canvas as PNG
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Create ZIP file from array of canvases
 */
export async function createZipFromCanvases(
  canvases: HTMLCanvasElement[],
  filenamePrefix: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    onProgress?.(Math.round((i / canvases.length) * 100));

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (blob) {
      const filename = `${filenamePrefix}_${String(i).padStart(4, '0')}.png`;
      zip.file(filename, blob);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Download a blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export sprite sheet and download
 */
export function exportSpriteSheet(
  canvases: HTMLCanvasElement[],
  baseName: string,
  forcedCols?: number
): void {
  const spriteSheet = buildSpriteSheet(canvases, forcedCols);
  downloadCanvasAsPng(spriteSheet, `${baseName}_spritesheet.png`);
}

/**
 * Export as ZIP and download
 */
export async function exportAsZip(
  canvases: HTMLCanvasElement[],
  baseName: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const zipBlob = await createZipFromCanvases(canvases, baseName, onProgress);
  downloadBlob(zipBlob, `${baseName}_frames.zip`);
}
