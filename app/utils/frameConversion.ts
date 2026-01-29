/**
 * Shared utilities for converting ExtractedFrame → Frame
 * Used by both the Import sub-tab and the Sprite Processor tab.
 */

import type { Frame, BoundingBox, ExtractedFrame } from "../types";

/** Convert a canvas to a data URL string */
export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

/** Get the bounding box of non-transparent pixels in a canvas */
export function getContentBoundsFromCanvas(
  canvas: HTMLCanvasElement
): BoundingBox {
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width,
    minY = canvas.height,
    maxX = 0,
    maxY = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const a = data[(y * canvas.width + x) * 4 + 3];
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX)
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Convert an ExtractedFrame (canvas-based) to a Frame (dataUrl-based) */
export function extractedFrameToFrame(ef: ExtractedFrame): Frame {
  const canvas = ef.processedCanvas;
  return {
    dataUrl: canvasToDataUrl(canvas),
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    contentBounds: getContentBoundsFromCanvas(canvas),
  };
}
