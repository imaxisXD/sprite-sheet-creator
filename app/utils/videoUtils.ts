/**
 * Video and image frame extraction utilities.
 * Ported from sprite-maker.
 */

import type { ExtractedFrame } from '../types';

/**
 * Load a video file and return its metadata.
 */
export function loadVideo(
  file: File
): Promise<{ video: HTMLVideoElement; fps: number; duration: number; totalFrames: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      const fps = 30;
      const duration = video.duration;
      const totalFrames = Math.floor(duration * fps);
      resolve({ video, fps, duration, totalFrames });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}

/**
 * Extract a single frame from a video at a specific time.
 */
export function extractFrameAtTime(
  video: HTMLVideoElement,
  time: number
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    video.currentTime = time;

    const handleSeeked = () => {
      video.removeEventListener('seeked', handleSeeked);

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      resolve(canvas);
    };

    video.addEventListener('seeked', handleSeeked);
  });
}

/**
 * Extract frames from a video at regular intervals.
 */
export async function extractFrames(
  video: HTMLVideoElement,
  startFrame: number,
  endFrame: number,
  interval: number,
  fps: number,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  const framesToExtract: number[] = [];

  for (let i = startFrame; i <= endFrame; i += interval) {
    framesToExtract.push(i);
  }

  const totalFrames = framesToExtract.length;

  for (let i = 0; i < totalFrames; i++) {
    const frameNumber = framesToExtract[i];
    const time = frameNumber / fps;

    onProgress?.(
      Math.round((i / totalFrames) * 100),
      `Extracting frame ${i + 1} of ${totalFrames}...`
    );

    const canvas = await extractFrameAtTime(video, time);

    frames.push({
      index: i,
      canvas,
      processedCanvas: canvas,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return frames;
}

/**
 * Load image files as ExtractedFrames.
 */
export async function loadImagesAsFrames(
  files: File[],
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedFrame[]> {
  console.log("[loadImagesAsFrames] called with", files.length, "files");
  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log("[loadImagesAsFrames] Loading file", i, file.name, file.type, file.size);
    onProgress?.(
      Math.round((i / files.length) * 100),
      `Loading image ${i + 1} of ${files.length}...`
    );

    const canvas = await loadImageAsCanvas(file);
    console.log("[loadImagesAsFrames] Canvas created:", canvas.width, "x", canvas.height);

    frames.push({
      index: i,
      canvas,
      processedCanvas: canvas,
      width: canvas.width,
      height: canvas.height,
    });
  }

  console.log("[loadImagesAsFrames] Done, returning", frames.length, "frames");
  return frames;
}

/**
 * Load a single image file as a canvas.
 */
export function loadImageAsCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * Get sanitized base name from a file (without extension).
 */
export function getBaseName(file: File): string {
  const name = file.name;
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(0, lastDot) : name;
}
