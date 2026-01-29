"use client";

import { useRef, useEffect, useCallback } from "react";
import { useImport } from "../../context/ImportContext";

export default function AnimationPreview() {
  const { state, dispatch } = useImport();
  const {
    extractedFrames,
    selectedFrames,
    previewFps,
    previewBgColor,
    isPlaying,
  } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIndexRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animRef = useRef<number>(0);

  const orderedIndices = Array.from(selectedFrames).sort((a, b) => a - b);

  const draw = useCallback(
    (ts: number) => {
      const el = canvasRef.current;
      if (!el || orderedIndices.length === 0) return;

      const interval = 1000 / previewFps;
      if (isPlaying && ts - lastFrameRef.current >= interval) {
        lastFrameRef.current = ts;
        frameIndexRef.current =
          (frameIndexRef.current + 1) % orderedIndices.length;
      }

      const frame = extractedFrames[orderedIndices[frameIndexRef.current]];
      if (!frame) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const size = 180;
      el.width = size;
      el.height = size;
      const ctx = el.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = previewBgColor;
      ctx.fillRect(0, 0, size, size);

      const src = frame.processedCanvas;
      const scale = Math.min(size / src.width, size / src.height);
      const w = src.width * scale;
      const h = src.height * scale;
      ctx.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);

      // Frame counter
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `${frameIndexRef.current + 1}/${orderedIndices.length}`,
        4,
        12
      );

      animRef.current = requestAnimationFrame(draw);
    },
    [extractedFrames, orderedIndices, previewFps, previewBgColor, isPlaying]
  );

  useEffect(() => {
    if (orderedIndices.length === 0) return;
    frameIndexRef.current = 0;
    lastFrameRef.current = 0;
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, orderedIndices.length]);

  if (selectedFrames.size === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-content-tertiary border border-stroke/50 rounded-lg">
        Select frames to preview
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-stroke/50"
        style={{ width: 180, height: 180 }}
      />

      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={() =>
            dispatch({ type: "SET_IS_PLAYING", isPlaying: !isPlaying })
          }
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            isPlaying
              ? "bg-fal-purple-deep text-white"
              : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
          }`}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* FPS */}
        <span className="text-xs text-content-tertiary">FPS</span>
        <input
          type="range"
          min={1}
          max={60}
          value={previewFps}
          onChange={(e) =>
            dispatch({
              type: "SET_PREVIEW_SETTINGS",
              fps: +e.target.value,
            })
          }
          className="w-16 accent-fal-purple-deep"
        />
        <span className="text-xs text-content-secondary w-5 text-right">
          {previewFps}
        </span>
      </div>
    </div>
  );
}
