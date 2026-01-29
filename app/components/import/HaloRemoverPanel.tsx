"use client";

import { useRef, useEffect } from "react";
import { useImport } from "../../context/ImportContext";
import { applyHaloRemover } from "../../utils/haloRemover";

export default function HaloRemoverPanel() {
  const { state, dispatch } = useImport();
  const {
    isHaloRemoverApplied,
    haloExpansion,
    extractedFrames,
    previewBgColor,
  } = state;

  const previewRef = useRef<HTMLCanvasElement>(null);

  // Preview with halo removal
  useEffect(() => {
    const el = previewRef.current;
    const frame = extractedFrames[0];
    if (!el || !frame) return;

    let cancelled = false;
    const size = 160;
    el.width = size;
    el.height = size;

    (async () => {
      const src = frame.processedCanvas;
      let preview: HTMLCanvasElement;
      if (isHaloRemoverApplied) {
        preview = await applyHaloRemover(src, haloExpansion);
      } else {
        preview = src;
      }

      if (cancelled) return;
      const ctx = el.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      // Background
      ctx.fillStyle = previewBgColor;
      ctx.fillRect(0, 0, size, size);

      const scale = Math.min(size / preview.width, size / preview.height);
      const w = preview.width * scale;
      const h = preview.height * scale;
      ctx.drawImage(preview, (size - w) / 2, (size - h) / 2, w, h);
    })();

    return () => {
      cancelled = true;
    };
  }, [extractedFrames, isHaloRemoverApplied, haloExpansion, previewBgColor]);

  if (extractedFrames.length === 0) return null;

  return (
    <details className="group border border-stroke/50 rounded-lg">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-sm font-medium text-content-primary hover:bg-surface-tertiary/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          Halo Remover
          {isHaloRemoverApplied && (
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
            className="rounded-lg border border-stroke/50"
            style={{ width: 160, height: 160 }}
          />
        </div>

        {/* Preview bg color */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-tertiary">Preview BG</span>
          {["#000000", "#ffffff", "#ff00ff", "#00ff00", "#555555"].map((c) => (
            <button
              key={c}
              onClick={() =>
                dispatch({ type: "SET_PREVIEW_SETTINGS", bgColor: c })
              }
              className={`w-5 h-5 rounded border ${
                previewBgColor === c
                  ? "border-fal-purple-light"
                  : "border-stroke"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Expansion slider */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">
            Expansion: {haloExpansion}px
          </span>
          <input
            type="range"
            min={1}
            max={30}
            value={haloExpansion}
            onChange={(e) =>
              dispatch({
                type: "SET_HALO_REMOVER",
                expansion: +e.target.value,
              })
            }
            className="accent-fal-purple-deep"
          />
        </label>

        {haloExpansion > 10 && (
          <p className="text-[10px] text-yellow-400/70">
            High expansion values may remove fine details.
          </p>
        )}

        {/* Toggle */}
        <button
          onClick={() =>
            dispatch({
              type: "SET_HALO_REMOVER",
              isApplied: !isHaloRemoverApplied,
            })
          }
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isHaloRemoverApplied
              ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
              : "bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80"
          }`}
        >
          {isHaloRemoverApplied ? "Remove Halo Cleanup" : "Apply Halo Cleanup"}
        </button>
      </div>
    </details>
  );
}
