"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useImport } from "../../context/ImportContext";
import {
  applyCropToCanvas,
  applyCenterCenterCrop,
  findContentBounds,
  calculateCropParameters,
} from "../../utils/cropUtils";
import type { CanvasSize, CropMode, AlignX, AlignY } from "../../types";
import { FRAME_SIZE } from "../../config/animation-types";

const CANVAS_PRESETS = [24, 32, 48, 64, 96, 128, 192, 256, 512];

export default function AutoCropPanel() {
  const { state, dispatch } = useImport();
  const {
    isCropApplied,
    cropMode,
    canvasSize,
    reductionAmount,
    cropAlignX,
    cropAlignY,
    extractedFrames,
    selectedFrames,
    previewFps,
    previewBgColor,
  } = state;

  const previewRef = useRef<HTMLCanvasElement>(null);
  const frameIndexRef = useRef(0);
  const animRef = useRef<number>(0);
  const lastFrameRef = useRef(0);

  const [customW, setCustomW] = useState(typeof canvasSize === "number" ? canvasSize : canvasSize.width);
  const [customH, setCustomH] = useState(typeof canvasSize === "number" ? canvasSize : canvasSize.height);
  const [useCustom, setUseCustom] = useState(typeof canvasSize !== "number");

  // Get selected frames in order
  const orderedFrames = Array.from(selectedFrames)
    .sort((a, b) => a - b)
    .map((i) => extractedFrames[i])
    .filter(Boolean);

  // Process a single canvas
  const processCanvas = useCallback(
    (src: HTMLCanvasElement, firstSrc?: HTMLCanvasElement): HTMLCanvasElement => {
      if (!isCropApplied) return src;

      const size: CanvasSize = useCustom
        ? { width: customW, height: customH }
        : (typeof canvasSize === "number" ? canvasSize : canvasSize);

      if (cropMode === "center-center") {
        return applyCenterCenterCrop(src, size, reductionAmount, cropAlignX, cropAlignY);
      }

      // animation-relative
      const refFrame = firstSrc || src;
      const bounds = findContentBounds(refFrame);
      if (!bounds) return src;
      const params = calculateCropParameters(
        refFrame,
        size,
        reductionAmount,
        cropAlignX,
        cropAlignY
      );
      return applyCropToCanvas(src, params, cropAlignX, cropAlignY);
    },
    [isCropApplied, cropMode, canvasSize, reductionAmount, cropAlignX, cropAlignY, useCustom, customW, customH]
  );

  // Animation loop for preview
  useEffect(() => {
    const el = previewRef.current;
    if (!el || orderedFrames.length === 0) return;

    const size = 180;
    el.width = size;
    el.height = size;
    frameIndexRef.current = 0;
    lastFrameRef.current = 0;

    const firstSrc = orderedFrames[0].processedCanvas;

    const loop = (ts: number) => {
      const interval = 1000 / previewFps;
      if (ts - lastFrameRef.current >= interval) {
        lastFrameRef.current = ts;
        frameIndexRef.current =
          (frameIndexRef.current + 1) % orderedFrames.length;
      }

      const frame = orderedFrames[frameIndexRef.current];
      if (!frame) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      const processed = processCanvas(frame.processedCanvas, firstSrc);

      const ctx = el.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = previewBgColor;
      ctx.fillRect(0, 0, size, size);

      const scale = Math.min(size / processed.width, size / processed.height);
      const w = processed.width * scale;
      const h = processed.height * scale;
      ctx.drawImage(processed, (size - w) / 2, (size - h) / 2, w, h);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [orderedFrames, processCanvas, previewFps, previewBgColor]);

  if (extractedFrames.length === 0) return null;

  const sizeLabel = typeof canvasSize === "number"
    ? `${canvasSize}x${canvasSize}`
    : `${canvasSize.width}x${canvasSize.height}`;

  return (
    <details className="group border border-stroke/50 rounded-lg">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-sm font-medium text-content-primary hover:bg-surface-tertiary/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          Auto Crop
          {isCropApplied && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-fal-purple-deep/20 text-fal-purple-light">
              {sizeLabel}
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform group-open:rotate-90 text-content-tertiary"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </summary>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {/* Preview */}
        <div className="flex justify-center">
          <canvas
            ref={previewRef}
            className="rounded-lg border border-stroke/50"
            style={{ width: 180, height: 180 }}
          />
        </div>

        {/* Crop mode */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">Mode</span>
          <div className="flex gap-2">
            {(["animation-relative", "center-center"] as CropMode[]).map(
              (m) => (
                <button
                  key={m}
                  onClick={() =>
                    dispatch({ type: "SET_CROP_SETTINGS", cropMode: m })
                  }
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    cropMode === m
                      ? "bg-fal-purple-deep text-white"
                      : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
                  }`}
                >
                  {m === "animation-relative" ? "Anim-Relative" : "Center"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Canvas size presets */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-tertiary">Canvas Size</span>
            <span className="text-[9px] text-fal-cyan/60">
              game: {FRAME_SIZE.width}x{FRAME_SIZE.height}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => {
                setUseCustom(true);
                setCustomW(FRAME_SIZE.width);
                setCustomH(FRAME_SIZE.height);
                dispatch({
                  type: "SET_CROP_SETTINGS",
                  canvasSize: { width: FRAME_SIZE.width, height: FRAME_SIZE.height },
                });
              }}
              className={`px-2 py-1 rounded text-xs transition-colors border ${
                useCustom && customW === FRAME_SIZE.width && customH === FRAME_SIZE.height
                  ? "bg-fal-cyan/20 text-fal-cyan border-fal-cyan/30"
                  : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated border-transparent"
              }`}
            >
              {FRAME_SIZE.width}x{FRAME_SIZE.height}
              <span className="ml-1 text-[9px] opacity-70">Game</span>
            </button>
            {CANVAS_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setUseCustom(false);
                  dispatch({
                    type: "SET_CROP_SETTINGS",
                    canvasSize: s,
                  });
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  !useCustom && canvasSize === s
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                useCustom
                  ? "bg-fal-purple-deep text-white"
                  : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
              }`}
            >
              Custom
            </button>
          </div>

          {useCustom && (
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                min={1}
                value={customW}
                onChange={(e) => {
                  const v = +e.target.value;
                  setCustomW(v);
                  dispatch({
                    type: "SET_CROP_SETTINGS",
                    canvasSize: { width: v, height: customH },
                  });
                }}
                className="w-16 px-2 py-1 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary"
                placeholder="W"
              />
              <span className="text-content-tertiary text-xs self-center">x</span>
              <input
                type="number"
                min={1}
                value={customH}
                onChange={(e) => {
                  const v = +e.target.value;
                  setCustomH(v);
                  dispatch({
                    type: "SET_CROP_SETTINGS",
                    canvasSize: { width: customW, height: v },
                  });
                }}
                className="w-16 px-2 py-1 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary"
                placeholder="H"
              />
            </div>
          )}
        </div>

        {/* Alignment */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-tertiary">H-Align</span>
            <div className="flex gap-1">
              {(["left", "center", "right"] as AlignX[]).map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    dispatch({ type: "SET_CROP_SETTINGS", alignX: a })
                  }
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    cropAlignX === a
                      ? "bg-fal-cyan/20 text-fal-cyan"
                      : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
                  }`}
                >
                  {a[0].toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-tertiary">V-Align</span>
            <div className="flex gap-1">
              {(["top", "center", "bottom"] as AlignY[]).map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    dispatch({ type: "SET_CROP_SETTINGS", alignY: a })
                  }
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    cropAlignY === a
                      ? "bg-fal-cyan/20 text-fal-cyan"
                      : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
                  }`}
                >
                  {a[0].toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reduction */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">
            Reduction: {reductionAmount}px
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={reductionAmount}
            onChange={(e) =>
              dispatch({
                type: "SET_CROP_SETTINGS",
                reductionAmount: +e.target.value,
              })
            }
            className="accent-fal-purple-deep"
          />
        </label>

        {/* Toggle */}
        <button
          onClick={() =>
            dispatch({
              type: "SET_CROP_SETTINGS",
              isApplied: !isCropApplied,
            })
          }
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isCropApplied
              ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
              : "bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80"
          }`}
        >
          {isCropApplied ? "Disable Auto Crop" : "Enable Auto Crop"}
        </button>
      </div>
    </details>
  );
}
