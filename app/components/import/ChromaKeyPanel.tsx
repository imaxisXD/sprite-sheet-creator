"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useImport } from "../../context/ImportContext";
import { applyChromaKey, getColorAtPosition } from "../../utils/chromaKey";

export default function ChromaKeyPanel() {
  const { state, dispatch } = useImport();
  const {
    isChromaKeyApplied,
    chromaKeyColor,
    chromaKeyTolerance,
    extractedFrames,
  } = state;

  const previewRef = useRef<HTMLCanvasElement>(null);
  const [isEyedropping, setIsEyedropping] = useState(false);

  // Preview: show first frame with chroma key applied
  useEffect(() => {
    const el = previewRef.current;
    const frame = extractedFrames[0];
    if (!el || !frame) return;

    const src = frame.processedCanvas;
    const size = 160;
    el.width = size;
    el.height = size;
    const ctx = el.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Checkerboard
    const sq = 8;
    for (let y = 0; y < size; y += sq) {
      for (let x = 0; x < size; x += sq) {
        ctx.fillStyle =
          (x / sq + y / sq) % 2 === 0 ? "#2a2a2e" : "#1a1a1e";
        ctx.fillRect(x, y, sq, sq);
      }
    }

    let preview: HTMLCanvasElement;
    if (isChromaKeyApplied) {
      preview = applyChromaKey(src, chromaKeyColor, chromaKeyTolerance);
    } else {
      preview = src;
    }

    const scale = Math.min(size / preview.width, size / preview.height);
    const w = preview.width * scale;
    const h = preview.height * scale;
    ctx.drawImage(preview, (size - w) / 2, (size - h) / 2, w, h);
  }, [extractedFrames, isChromaKeyApplied, chromaKeyColor, chromaKeyTolerance]);

  // Eyedropper click
  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isEyedropping) return;
      const frame = extractedFrames[0];
      if (!frame) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const src = frame.processedCanvas;
      const size = 160;
      const scale = Math.min(size / src.width, size / src.height);
      const w = src.width * scale;
      const h = src.height * scale;
      const ox = (size - w) / 2;
      const oy = (size - h) / 2;

      const px = Math.floor((e.clientX - rect.left - ox) / scale);
      const py = Math.floor((e.clientY - rect.top - oy) / scale);

      if (px >= 0 && py >= 0 && px < src.width && py < src.height) {
        const color = getColorAtPosition(src, px, py);
        dispatch({ type: "SET_CHROMA_KEY", color });
      }
      setIsEyedropping(false);
    },
    [isEyedropping, extractedFrames, dispatch]
  );

  if (extractedFrames.length === 0) return null;

  return (
    <details className="group border border-stroke/50 rounded-lg">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-sm font-medium text-content-primary hover:bg-surface-tertiary/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          Chroma Key
          {isChromaKeyApplied && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-fal-purple-deep/20 text-fal-purple-light">
              ON
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
            onClick={handlePreviewClick}
            className={`rounded-lg border border-stroke/50 ${
              isEyedropping ? "cursor-crosshair" : "cursor-default"
            }`}
            style={{ width: 160, height: 160 }}
          />
        </div>

        {/* Color picker row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-stroke"
              style={{ backgroundColor: chromaKeyColor }}
            />
            <input
              type="color"
              value={chromaKeyColor}
              onChange={(e) =>
                dispatch({ type: "SET_CHROMA_KEY", color: e.target.value })
              }
              className="w-8 h-6 rounded cursor-pointer bg-transparent"
            />
          </div>

          <button
            onClick={() => setIsEyedropping(!isEyedropping)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              isEyedropping
                ? "bg-fal-cyan/20 text-fal-cyan"
                : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
            }`}
          >
            Eyedropper
          </button>
        </div>

        {/* Tolerance */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">
            Tolerance: {chromaKeyTolerance}
          </span>
          <input
            type="range"
            min={0}
            max={150}
            value={chromaKeyTolerance}
            onChange={(e) =>
              dispatch({
                type: "SET_CHROMA_KEY",
                tolerance: +e.target.value,
              })
            }
            className="accent-fal-purple-deep"
          />
        </label>

        {/* Toggle */}
        <button
          onClick={() =>
            dispatch({
              type: "SET_CHROMA_KEY",
              isApplied: !isChromaKeyApplied,
            })
          }
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isChromaKeyApplied
              ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
              : "bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80"
          }`}
        >
          {isChromaKeyApplied ? "Remove Chroma Key" : "Apply Chroma Key"}
        </button>
      </div>
    </details>
  );
}
