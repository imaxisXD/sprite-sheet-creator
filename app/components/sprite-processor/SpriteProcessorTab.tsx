"use client";

import { useCallback, useState } from "react";
import {
  SpriteProcessorProvider,
  useSpriteProcessor,
} from "./context/SpriteProcessorContext";
import { UploadZone } from "./components/UploadZone";
import { VideoPreviewControls } from "./components/VideoPreviewControls";
import { FramesGrid } from "./components/FramesGrid";
import { AnimationPreview } from "./components/AnimationPreview";
import { BackgroundRemovalPanel } from "./components/BackgroundRemovalPanel";
import { ChromaKeyPanel } from "./components/ChromaKeyPanel";
import { AutoCropPanel } from "./components/AutoCropPanel";
import { HaloRemoverPanel } from "./components/HaloRemoverPanel";
import { ExportButtons } from "./components/ExportButtons";
import { ProcessingOverlay } from "./components/ProcessingOverlay";
import type { Frame } from "@/app/types";
import type { AnimationType, Direction8 } from "@/app/config/animation-types";
import { ANIMATION_CONFIGS, DIRECTION_ROW_ORDER_8 } from "@/app/config/animation-types";
import {
  canvasToDataUrl,
  getContentBoundsFromCanvas,
} from "@/app/utils/frameConversion";

// ---------------------------------------------------------------------------
// Workflow guide steps
// ---------------------------------------------------------------------------

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Create Your Art",
    desc: "Generate sprite artwork with AI tools. Use a solid color background for best results.",
    accent: "#e63946",
  },
  {
    num: "02",
    title: "Animate It",
    desc: "Use AI video generation (Kling, Grok, etc.) to bring your art to life.",
    accent: "#f4727a",
  },
  {
    num: "03",
    title: "Upload & Process",
    desc: "Upload here and Ichigo handles background removal, cropping, and alignment.",
    accent: "#ff8fa3",
  },
  {
    num: "04",
    title: "Export",
    desc: "Download your game-ready sprite sheet or individual frame ZIP file.",
    accent: "#ffb347",
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SpriteProcessorTabProps {
  /** Callback to bridge processed frames into the slot system */
  onFramesReady?: (
    frames: Frame[],
    animationType: AnimationType,
    direction?: Direction8
  ) => void;
}

// ---------------------------------------------------------------------------
// Inner component (uses context)
// ---------------------------------------------------------------------------

function SpriteProcessorContent({ onFramesReady }: SpriteProcessorTabProps) {
  const { state, dispatch } = useSpriteProcessor();
  const [showAssignment, setShowAssignment] = useState(false);
  const [assignAnimType, setAssignAnimType] = useState<AnimationType>("idle");
  const [assignDirection, setAssignDirection] = useState<Direction8>("south");
  const [pendingFrames, setPendingFrames] = useState<Frame[]>([]);

  // Bridge: send selected processed frames to the slot system
  const handleSendToSlots = useCallback(() => {
    if (!onFramesReady) return;

    const indices = Array.from(state.selectedFrames).sort((a, b) => a - b);
    const frames: Frame[] = indices
      .map((i) => state.extractedFrames[i])
      .filter(Boolean)
      .map((ef) => ({
        dataUrl: canvasToDataUrl(ef.processedCanvas),
        x: 0,
        y: 0,
        width: ef.processedCanvas.width,
        height: ef.processedCanvas.height,
        contentBounds: getContentBoundsFromCanvas(ef.processedCanvas),
      }));

    if (frames.length > 0) {
      setPendingFrames(frames);
      setShowAssignment(true);
    }
  }, [state.selectedFrames, state.extractedFrames, onFramesReady]);

  const handleConfirmAssignment = useCallback(() => {
    if (!onFramesReady || pendingFrames.length === 0) return;
    const config = ANIMATION_CONFIGS[assignAnimType];
    onFramesReady(
      pendingFrames,
      assignAnimType,
      config.isDirectional ? assignDirection : undefined
    );
    setShowAssignment(false);
    setPendingFrames([]);
  }, [onFramesReady, pendingFrames, assignAnimType, assignDirection]);

  // Upload step
  if (state.currentStep === "upload") {
    return (
      <>
        <UploadZone />

        {/* Workflow Guide */}
        <div className="mt-12 animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[rgba(230,57,70,0.2)] to-transparent" />
            <span className="label text-[#52525b]">How it works</span>
            <div className="h-px flex-1 bg-gradient-to-l from-[rgba(230,57,70,0.2)] to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`group glass-card p-5 hover:border-[rgba(230,57,70,0.2)] transition-all duration-300 animate-fade-in animate-fade-in-delay-${i + 1}`}
              >
                <span
                  className="text-[28px] font-extrabold block mb-3 leading-none"
                  style={{ color: step.accent, opacity: 0.7 }}
                >
                  {step.num}
                </span>
                <h3 className="text-[14px] font-bold text-[#e4e4e7] mb-1.5">
                  {step.title}
                </h3>
                <p className="text-[12px] text-[#52525b] leading-relaxed m-0">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Tip callout */}
          <div className="mt-6 glass-card p-4 flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[rgba(255,179,71,0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffb347"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <p className="text-[12px] text-[#52525b] leading-relaxed m-0">
              You can also upload still images or batches to automatically align
              and position them with consistency.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Video settings step
  if (state.currentStep === "video-settings") {
    return <VideoPreviewControls />;
  }

  // Frame selection and processing
  return (
    <>
      <FramesGrid />
      <AnimationPreview />

      <div className="mt-10 glass-card-elevated p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#e63946] to-[#b5202b] flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <h3 className="text-[18px] text-[#e4e4e7] font-bold m-0">
            Processing & Export
          </h3>
        </div>

        <div className="space-y-3">
          <BackgroundRemovalPanel />
          <ChromaKeyPanel />
          <AutoCropPanel />
          <HaloRemoverPanel />
          <ExportButtons />
        </div>
      </div>

      {/* Assignment Panel */}
      {showAssignment && (
        <div className="mt-8 glass-card-elevated p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#e63946] to-[#b5202b] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </div>
            <h3 className="text-[16px] text-[#e4e4e7] font-bold m-0">
              Assign {pendingFrames.length} Frames to Slot
            </h3>
          </div>

          {/* Animation Type Selector */}
          <div className="mb-4">
            <label className="block text-[12px] text-[#a1a1aa] mb-2 font-medium">
              Animation Type
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(Object.keys(ANIMATION_CONFIGS) as AnimationType[]).map((type) => {
                const config = ANIMATION_CONFIGS[type];
                return (
                  <button
                    key={type}
                    onClick={() => setAssignAnimType(type)}
                    className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all border ${
                      assignAnimType === type
                        ? "bg-[#e63946]/20 border-[#e63946] text-[#e63946]"
                        : "bg-[rgba(24,24,27,0.6)] border-[rgba(63,63,70,0.3)] text-[#a1a1aa] hover:border-[#e63946]/40 hover:text-[#e4e4e7]"
                    }`}
                  >
                    <span className="capitalize">{type}</span>
                    <span className="block text-[9px] opacity-60 mt-0.5">
                      {config.frameCount}f {config.isDirectional ? "x8dir" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direction Selector (only for directional animations) */}
          {ANIMATION_CONFIGS[assignAnimType].isDirectional && (
            <div className="mb-4">
              <label className="block text-[12px] text-[#a1a1aa] mb-2 font-medium">
                Direction
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DIRECTION_ROW_ORDER_8.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setAssignDirection(dir)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                      assignDirection === dir
                        ? "bg-[#e63946]/20 border-[#e63946] text-[#e63946]"
                        : "bg-[rgba(24,24,27,0.6)] border-[rgba(63,63,70,0.3)] text-[#a1a1aa] hover:border-[#e63946]/40"
                    }`}
                  >
                    {dir.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info + Confirm */}
          <div className="flex items-center justify-between pt-3 border-t border-[rgba(63,63,70,0.3)]">
            <span className="text-[12px] text-[#a1a1aa]">
              {pendingFrames.length} frames → <span className="text-[#e4e4e7] capitalize">{assignAnimType}</span>
              {ANIMATION_CONFIGS[assignAnimType].isDirectional && (
                <> / <span className="text-[#e4e4e7]">{assignDirection.replace("_", " ")}</span></>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAssignment(false); setPendingFrames([]); }}
                className="btn-secondary text-[12px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignment}
                className="btn-primary text-[12px]"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Slots + Start Over */}
      <div className="mt-8 flex items-center justify-center gap-4">
        {onFramesReady && state.selectedFrames.size > 0 && !showAssignment && (
          <button onClick={handleSendToSlots} className="btn-primary text-[13px]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Send {state.selectedFrames.size} Frames to Slots
          </button>
        )}
        <button
          onClick={() => dispatch({ type: "RESET" })}
          className="btn-secondary text-[13px]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Start Over
        </button>
      </div>

      {/* Processing overlay */}
      {state.isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <ProcessingOverlay
            message={state.processingMessage}
            progress={state.processingProgress}
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component (wraps with provider + .sprite-processor scope)
// ---------------------------------------------------------------------------

export default function SpriteProcessorTab(props: SpriteProcessorTabProps) {
  return (
    <SpriteProcessorProvider>
      <div className="max-w-[1100px] mx-auto px-6 pb-8 w-full">
        <SpriteProcessorContent {...props} />
      </div>
    </SpriteProcessorProvider>
  );
}
