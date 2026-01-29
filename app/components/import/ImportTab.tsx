"use client";

import { useCallback } from "react";
import { ImportProvider, useImport } from "../../context/ImportContext";
import { applyChromaKey } from "../../utils/chromaKey";
import { applyHaloRemover } from "../../utils/haloRemover";
import {
  applyCropToCanvas,
  applyCenterCenterCrop,
  findContentBounds,
  calculateCropParameters,
} from "../../utils/cropUtils";
import type { Frame, CanvasSize } from "../../types";
import { FRAME_SIZE } from "../../config/animation-types";
import {
  canvasToDataUrl,
  getContentBoundsFromCanvas,
} from "../../utils/frameConversion";

import UploadZone from "./UploadZone";
import VideoPreviewControls from "./VideoPreviewControls";
import FramesGrid from "./FramesGrid";
import AnimationPreview from "./AnimationPreview";
import BackgroundRemovalPanel from "./BackgroundRemovalPanel";
import ChromaKeyPanel from "./ChromaKeyPanel";
import HaloRemoverPanel from "./HaloRemoverPanel";
import AutoCropPanel from "./AutoCropPanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportTabProps {
  onFramesReady?: (frames: Frame[]) => void;
}

// ---------------------------------------------------------------------------
// Inner component that uses context
// ---------------------------------------------------------------------------

function ImportTabInner({ onFramesReady }: ImportTabProps) {
  const { state, dispatch } = useImport();
  const { currentStep, extractedFrames, selectedFrames, isProcessing } = state;

  console.log("[ImportTabInner] render — step:", currentStep, "frames:", extractedFrames.length, "selected:", selectedFrames.size, "processing:", isProcessing);

  // Apply all processing and produce final Frame[]
  const handleFinalize = useCallback(async () => {
    if (!onFramesReady) return;

    const ordered = Array.from(selectedFrames)
      .sort((a, b) => a - b)
      .map((i) => extractedFrames[i])
      .filter(Boolean);

    if (ordered.length === 0) return;

    dispatch({
      type: "SET_PROCESSING",
      isProcessing: true,
      message: "Processing frames...",
      progress: 0,
    });

    try {
      const processed: HTMLCanvasElement[] = [];
      const firstSrc = ordered[0].processedCanvas;

      for (let i = 0; i < ordered.length; i++) {
        let canvas = ordered[i].processedCanvas;

        // 1) Chroma key
        if (state.isChromaKeyApplied) {
          canvas = applyChromaKey(
            canvas,
            state.chromaKeyColor,
            state.chromaKeyTolerance
          );
        }

        // 2) Halo remover
        if (state.isHaloRemoverApplied) {
          canvas = await applyHaloRemover(canvas, state.haloExpansion);
        }

        // 3) Auto crop
        if (state.isCropApplied) {
          const size: CanvasSize =
            typeof state.canvasSize === "number"
              ? state.canvasSize
              : state.canvasSize;

          if (state.cropMode === "center-center") {
            canvas = applyCenterCenterCrop(
              canvas,
              size,
              state.reductionAmount,
              state.cropAlignX,
              state.cropAlignY
            );
          } else {
            const bounds = findContentBounds(firstSrc);
            if (bounds) {
              const params = calculateCropParameters(
                firstSrc,
                size,
                state.reductionAmount,
                state.cropAlignX,
                state.cropAlignY
              );
              canvas = applyCropToCanvas(
                canvas,
                params,
                state.cropAlignX,
                state.cropAlignY
              );
            }
          }
        }

        processed.push(canvas);

        dispatch({
          type: "SET_PROCESSING",
          isProcessing: true,
          progress: (i + 1) / ordered.length,
        });
      }

      // Convert to Frame[]
      const frames: Frame[] = processed.map((c, i) => ({
        dataUrl: canvasToDataUrl(c),
        x: 0,
        y: 0,
        width: c.width,
        height: c.height,
        contentBounds: getContentBoundsFromCanvas(c),
      }));

      onFramesReady(frames);
    } finally {
      dispatch({ type: "SET_PROCESSING", isProcessing: false });
    }
  }, [state, extractedFrames, selectedFrames, dispatch, onFramesReady]);

  return (
    <div className="flex flex-col gap-5">
      {/* Step: Upload */}
      {currentStep === "upload" && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-content-primary">
            Import from Video or Image
          </h3>
          <UploadZone />
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: "Upload", desc: "Drop a sprite sheet or video" },
              { title: "Process", desc: `Crop to ${FRAME_SIZE.width}x${FRAME_SIZE.height}px, remove backgrounds, clean edges` },
              { title: "Use", desc: "Send processed frames to animation slots" },
            ].map((step, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 p-3 rounded-lg border border-stroke/30 bg-surface-secondary"
              >
                <span className="text-xs font-medium text-content-primary">
                  {i + 1}. {step.title}
                </span>
                <span className="text-[10px] text-content-tertiary">
                  {step.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step: Video settings */}
      {currentStep === "video-settings" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-content-primary">
              Video Settings
            </h3>
            <button
              onClick={() =>
                dispatch({ type: "SET_CURRENT_STEP", step: "upload" })
              }
              className="text-xs text-content-tertiary hover:text-content-secondary"
            >
              Back
            </button>
          </div>
          <VideoPreviewControls />
        </div>
      )}

      {/* Step: Frame selection + processing */}
      {currentStep === "frame-selection" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-content-primary">
              Frames & Processing
            </h3>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="text-xs text-content-tertiary hover:text-content-secondary"
            >
              Start Over
            </button>
          </div>

          {/* Two-column layout: frames + preview / processing */}
          <div className="grid grid-cols-[1fr_auto] gap-4">
            {/* Left: Frame grid */}
            <FramesGrid />

            {/* Right: Preview + processing stack */}
            <div className="flex flex-col gap-3 w-[220px]">
              <AnimationPreview />

              {/* Processing panels */}
              <div className="flex flex-col gap-2">
                <BackgroundRemovalPanel />
                <ChromaKeyPanel />
                <HaloRemoverPanel />
                <AutoCropPanel />
              </div>

              {/* Finalize button */}
              {onFramesReady && (
                <button
                  onClick={handleFinalize}
                  disabled={isProcessing || selectedFrames.size === 0}
                  className="px-4 py-2.5 rounded-md text-sm font-medium bg-fal-cyan text-black hover:bg-fal-cyan/80 disabled:opacity-50 transition-colors"
                >
                  {isProcessing
                    ? "Processing..."
                    : `Use ${selectedFrames.size} Frames`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-surface-secondary border border-stroke rounded-xl p-6 flex flex-col items-center gap-3 min-w-[240px]">
            <div className="w-6 h-6 border-2 border-fal-purple-light border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-content-primary">
              {state.processingMessage}
            </span>
            {state.processingProgress > 0 && (
              <div className="w-full h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className="h-full bg-fal-purple-deep transition-all duration-200"
                  style={{ width: `${state.processingProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component (wraps with provider)
// ---------------------------------------------------------------------------

export default function ImportTab(props: ImportTabProps) {
  return (
    <ImportProvider>
      <ImportTabInner {...props} />
    </ImportProvider>
  );
}
