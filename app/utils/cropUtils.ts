/**
 * Auto-crop utilities — content detection, animation-relative and center-center crop modes.
 * Ported from sprite-maker.
 */

import type { CropParams, CanvasSize, AlignX, AlignY } from '../types';

/**
 * Find bounding box of non-transparent pixels in a canvas.
 */
export function findContentBounds(canvas: HTMLCanvasElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Calculate crop parameters for animation-relative mode.
 * Uses first frame bounds to determine crop area for all frames.
 */
export function calculateCropParameters(
  firstFrameCanvas: HTMLCanvasElement,
  canvasSize: CanvasSize,
  reductionPixels: number,
  _alignX: AlignX = 'center',
  _alignY: AlignY = 'center'
): CropParams {
  const bounds = findContentBounds(firstFrameCanvas);

  const contentWidth = bounds.maxX - bounds.minX + 1 - reductionPixels * 2;
  const contentHeight = bounds.maxY - bounds.minY + 1 - reductionPixels * 2;

  const targetWidth = typeof canvasSize === 'number' ? canvasSize : canvasSize.width;
  const targetHeight = typeof canvasSize === 'number' ? canvasSize : canvasSize.height;

  return {
    x: bounds.minX + reductionPixels,
    y: bounds.minY + reductionPixels,
    width: contentWidth,
    height: contentHeight,
    canvasWidth: targetWidth,
    canvasHeight: targetHeight,
  };
}

/**
 * Apply crop to a canvas using pre-calculated parameters.
 */
export function applyCropToCanvas(
  sourceCanvas: HTMLCanvasElement,
  cropParams: CropParams,
  alignX: AlignX = 'center',
  alignY: AlignY = 'center'
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = cropParams.canvasWidth;
  outputCanvas.height = cropParams.canvasHeight;
  const ctx = outputCanvas.getContext('2d')!;

  const scale = Math.min(
    cropParams.canvasWidth / cropParams.width,
    cropParams.canvasHeight / cropParams.height
  );

  const scaledWidth = Math.round(cropParams.width * scale);
  const scaledHeight = Math.round(cropParams.height * scale);

  let offsetX = 0;
  let offsetY = 0;

  switch (alignX) {
    case 'left':   offsetX = 0; break;
    case 'center': offsetX = Math.round((cropParams.canvasWidth - scaledWidth) / 2); break;
    case 'right':  offsetX = cropParams.canvasWidth - scaledWidth; break;
  }

  switch (alignY) {
    case 'top':    offsetY = 0; break;
    case 'center': offsetY = Math.round((cropParams.canvasHeight - scaledHeight) / 2); break;
    case 'bottom': offsetY = cropParams.canvasHeight - scaledHeight; break;
  }

  ctx.drawImage(
    sourceCanvas,
    cropParams.x, cropParams.y, cropParams.width, cropParams.height,
    offsetX, offsetY, scaledWidth, scaledHeight
  );

  return outputCanvas;
}

/**
 * Apply center-center crop — each frame is centered individually.
 */
export function applyCenterCenterCrop(
  sourceCanvas: HTMLCanvasElement,
  canvasSize: CanvasSize,
  reductionPixels: number,
  alignX: AlignX = 'center',
  alignY: AlignY = 'center'
): HTMLCanvasElement {
  const bounds = findContentBounds(sourceCanvas);

  const contentWidth = bounds.maxX - bounds.minX + 1 - reductionPixels * 2;
  const contentHeight = bounds.maxY - bounds.minY + 1 - reductionPixels * 2;

  const targetWidth = typeof canvasSize === 'number' ? canvasSize : canvasSize.width;
  const targetHeight = typeof canvasSize === 'number' ? canvasSize : canvasSize.height;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const ctx = outputCanvas.getContext('2d')!;

  const scale = Math.min(targetWidth / contentWidth, targetHeight / contentHeight);
  const scaledWidth = Math.round(contentWidth * scale);
  const scaledHeight = Math.round(contentHeight * scale);

  let offsetX = 0;
  let offsetY = 0;

  switch (alignX) {
    case 'left':   offsetX = 0; break;
    case 'center': offsetX = Math.round((targetWidth - scaledWidth) / 2); break;
    case 'right':  offsetX = targetWidth - scaledWidth; break;
  }

  switch (alignY) {
    case 'top':    offsetY = 0; break;
    case 'center': offsetY = Math.round((targetHeight - scaledHeight) / 2); break;
    case 'bottom': offsetY = targetHeight - scaledHeight; break;
  }

  ctx.drawImage(
    sourceCanvas,
    bounds.minX + reductionPixels,
    bounds.minY + reductionPixels,
    contentWidth,
    contentHeight,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight
  );

  return outputCanvas;
}
