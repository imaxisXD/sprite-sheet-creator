"use client";

import { useState, useCallback } from "react";
import { useImport } from "../../context/ImportContext";
import {
  preloadBackgroundRemovalModel,
  processFramesBackground,
} from "../../utils/imageProcessing";

export default function BackgroundRemovalPanel() {
  const { state, dispatch } = useImport();
  const { backgroundModel, extractedFrames } = state;

  const [isPreloading, setIsPreloading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlePreload = useCallback(async () => {
    setIsPreloading(true);
    try {
      await preloadBackgroundRemovalModel();
      setIsModelReady(true);
    } finally {
      setIsPreloading(false);
    }
  }, []);

  const handleRemove = useCallback(async () => {
    if (extractedFrames.length === 0) return;
    setIsRemoving(true);
    setProgress(0);
    dispatch({
      type: "SET_PROCESSING",
      isProcessing: true,
      message: "Removing backgrounds...",
      progress: 0,
    });

    try {
      const processed = await processFramesBackground(
        extractedFrames,
        "imgly",
        (p) => {
          setProgress(p);
          dispatch({
            type: "SET_PROCESSING",
            isProcessing: true,
            message: `Removing backgrounds... ${Math.round(p * 100)}%`,
            progress: p,
          });
        }
      );

      dispatch({ type: "SET_EXTRACTED_FRAMES", frames: processed });
    } finally {
      dispatch({ type: "SET_PROCESSING", isProcessing: false });
      setIsRemoving(false);
    }
  }, [extractedFrames, dispatch]);

  if (extractedFrames.length === 0) return null;

  return (
    <details className="group border border-stroke/50 rounded-lg">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-sm font-medium text-content-primary hover:bg-surface-tertiary/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          AI Background Removal
          {backgroundModel !== "none" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-fal-cyan/20 text-fal-cyan">
              ImgLy
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
        <p className="text-xs text-content-tertiary">
          Uses ImgLy's background removal model. Works locally via WebGPU (GPU) or WASM (CPU).
        </p>

        {/* Model select */}
        <div className="flex gap-2">
          <button
            onClick={() =>
              dispatch({ type: "SET_BACKGROUND_MODEL", model: "none" })
            }
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              backgroundModel === "none"
                ? "bg-surface-elevated text-content-primary"
                : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
            }`}
          >
            None
          </button>
          <button
            onClick={() =>
              dispatch({ type: "SET_BACKGROUND_MODEL", model: "imgly" })
            }
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              backgroundModel === "imgly"
                ? "bg-fal-cyan/20 text-fal-cyan"
                : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
            }`}
          >
            ImgLy (Local AI)
          </button>
        </div>

        {backgroundModel === "imgly" && (
          <div className="flex flex-col gap-2">
            {!isModelReady && (
              <button
                onClick={handlePreload}
                disabled={isPreloading}
                className="px-4 py-2 rounded-md text-sm font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated disabled:opacity-50 transition-colors"
              >
                {isPreloading ? "Loading model..." : "Preload Model"}
              </button>
            )}

            {isModelReady && (
              <span className="text-xs text-fal-cyan">Model ready</span>
            )}

            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="px-4 py-2 rounded-md text-sm font-medium bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80 disabled:opacity-50 transition-colors"
            >
              {isRemoving
                ? `Removing... ${Math.round(progress * 100)}%`
                : `Remove Backgrounds (${extractedFrames.length} frames)`}
            </button>

            {isRemoving && (
              <div className="w-full h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className="h-full bg-fal-purple-deep transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
