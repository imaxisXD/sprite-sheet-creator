/**
 * Background removal using ImgLy with WebGPU acceleration.
 * Ported from sprite-maker.
 */

import { removeBackground, preload } from '@imgly/background-removal';
import type { ExtractedFrame, BackgroundModel } from '../types';

const bgRemovalConfig = {
  device: 'gpu' as const,
  model: 'isnet_fp16' as const,
  output: {
    format: 'image/png' as const,
    quality: 1,
  },
};

let isModelPreloaded = false;

/**
 * Preload the background removal model for faster first inference.
 * Call this early (e.g., on app mount) to warm up the model.
 */
export async function preloadBackgroundRemovalModel(): Promise<void> {
  if (isModelPreloaded) return;

  try {
    console.log('Preloading background removal model (WebGPU)...');
    await preload(bgRemovalConfig);
    isModelPreloaded = true;
    console.log('Background removal model preloaded (WebGPU ready)');
  } catch (error) {
    console.warn('WebGPU preload failed, will use WASM fallback:', error);
  }
}

/**
 * Remove background from a canvas using ImgLy with WebGPU acceleration.
 */
export async function removeBackgroundImgLy(
  canvas: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const dataUrl = canvas.toDataURL('image/png');

  const blob = await removeBackground(dataUrl, bgRemovalConfig);
  const url = URL.createObjectURL(blob);

  const processedImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = processedImg.width;
  outputCanvas.height = processedImg.height;
  const ctx = outputCanvas.getContext('2d')!;
  ctx.drawImage(processedImg, 0, 0);

  URL.revokeObjectURL(url);

  return outputCanvas;
}

/**
 * Process a single frame with the specified background removal model.
 */
export async function processFrameBackground(
  frame: ExtractedFrame,
  model: BackgroundModel
): Promise<HTMLCanvasElement> {
  if (model === 'imgly') {
    return removeBackgroundImgLy(frame.canvas);
  }

  // model === 'none': return a copy
  return cloneCanvas(frame.canvas);
}

/**
 * Process all frames with background removal.
 */
export async function processFramesBackground(
  frames: ExtractedFrame[],
  model: BackgroundModel,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedFrame[]> {
  const processedFrames: ExtractedFrame[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    onProgress?.(
      Math.round((i / frames.length) * 100),
      `Processing frame ${i + 1} of ${frames.length}...`
    );

    const processedCanvas = await processFrameBackground(frame, model);

    processedFrames.push({
      ...frame,
      processedCanvas,
    });
  }

  return processedFrames;
}

/**
 * Clone a canvas.
 */
export function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const clone = document.createElement('canvas');
  clone.width = canvas.width;
  clone.height = canvas.height;
  const ctx = clone.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  return clone;
}
