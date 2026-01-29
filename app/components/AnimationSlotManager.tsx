"use client";

import { useState, useCallback } from "react";
import {
  AnimationType,
  ANIMATION_CONFIGS,
  ALL_ANIMATIONS,
  DIRECTIONAL_ANIMATIONS,
  Direction8,
  DIRECTION_ROW_ORDER_8,
} from "../config/animation-types";
import type { Frame, DirectionalFrameSet8 } from "../types";
import { createEmptyDirectionalFrameSet8 } from "../types";
import MiniPixiSandbox from "./MiniPixiSandbox";

// ---------------------------------------------------------------------------
// Slot state
// ---------------------------------------------------------------------------

export type SlotSource = "ai" | "import" | null;

export interface AnimationSlot {
  type: AnimationType;
  status: "empty" | "in-progress" | "complete";
  source: SlotSource;
  /** For non-directional animations */
  frames: Frame[];
  /** For directional (idle/walk) — per-direction frames */
  directionalFrames: DirectionalFrameSet8 | null;
}

function createEmptySlot(type: AnimationType): AnimationSlot {
  return {
    type,
    status: "empty",
    source: null,
    frames: [],
    directionalFrames: null,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AnimationSlotManagerProps {
  /** Current slot data, keyed by AnimationType */
  slots: Record<AnimationType, AnimationSlot>;
  /** Called when user clicks "Create" on a slot */
  onCreateSlot: (type: AnimationType) => void;
  /** Called when user clicks "Clear" on a slot */
  onClearSlot: (type: AnimationType) => void;
  /** Currently active/editing slot */
  activeSlot: AnimationType | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnimationSlotManager({
  slots,
  onCreateSlot,
  onClearSlot,
  activeSlot,
}: AnimationSlotManagerProps) {
  const [previewSlot, setPreviewSlot] = useState<AnimationType | null>(null);

  const isDirectional = (t: AnimationType) =>
    DIRECTIONAL_ANIMATIONS.includes(t as "idle" | "walk");

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-content-primary">
        Animation Slots
      </h3>

      <div className="grid grid-cols-3 gap-3">
        {ALL_ANIMATIONS.map((animType) => {
          const slot = slots[animType];
          const config = ANIMATION_CONFIGS[animType];
          const isActive = activeSlot === animType;

          return (
            <div
              key={animType}
              className={`
                flex flex-col gap-2 p-3 rounded-lg border transition-all
                ${
                  isActive
                    ? "border-fal-purple-light bg-fal-purple-deep/10"
                    : slot.status === "complete"
                    ? "border-fal-cyan/30 bg-surface-secondary"
                    : "border-stroke/50 bg-surface-secondary"
                }
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-content-primary capitalize">
                  {animType}
                </span>
                <StatusBadge status={slot.status} source={slot.source} />
              </div>

              {/* Description */}
              <span className="text-[10px] text-content-tertiary leading-tight">
                {config.description}
              </span>

              {/* Info badges */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-tertiary text-content-tertiary">
                  {config.frameCount} frames
                </span>
                {config.isDirectional && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-tertiary text-content-tertiary">
                    8-dir
                  </span>
                )}
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-tertiary text-content-tertiary">
                  {config.frameDuration}ms
                </span>
              </div>

              {/* Preview (if complete) */}
              {slot.status === "complete" && (
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setPreviewSlot(previewSlot === animType ? null : animType)
                  }
                >
                  {previewSlot === animType ? (
                    <MiniPixiSandbox
                      animationType={animType}
                      directionalFrames={
                        slot.directionalFrames ?? undefined
                      }
                      frames={
                        !slot.directionalFrames ? slot.frames : undefined
                      }
                      width={160}
                      height={120}
                      showDirectionControls={isDirectional(animType)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-8 text-[10px] text-fal-cyan hover:text-fal-cyan/80 transition-colors">
                      Click to preview
                    </div>
                  )}
                </div>
              )}

              {/* Direction sub-slots for directional animations */}
              {isDirectional(animType) && slot.status === "complete" && slot.directionalFrames && (
                <div className="flex flex-wrap gap-1">
                  {DIRECTION_ROW_ORDER_8.map((dir) => {
                    const hasFrames =
                      slot.directionalFrames?.[dir] &&
                      slot.directionalFrames[dir].length > 0;
                    return (
                      <span
                        key={dir}
                        className={`text-[8px] px-1 py-0.5 rounded ${
                          hasFrames
                            ? "bg-fal-cyan/20 text-fal-cyan"
                            : "bg-red-600/20 text-red-400"
                        }`}
                      >
                        {dir.replace("_", "-")}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1 mt-auto">
                {slot.status === "empty" && (
                  <button
                    onClick={() => onCreateSlot(animType)}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80 transition-colors"
                  >
                    Create
                  </button>
                )}

                {slot.status === "complete" && (
                  <>
                    <button
                      onClick={() => onCreateSlot(animType)}
                      className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onClearSlot(animType)}
                      className="px-2 py-1.5 rounded-md text-xs font-medium bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}

                {slot.status === "in-progress" && (
                  <span className="flex-1 px-2 py-1.5 text-center text-xs text-fal-purple-light">
                    Editing...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createEmptySlots(): Record<AnimationType, AnimationSlot> {
  const slots = {} as Record<AnimationType, AnimationSlot>;
  for (const t of ALL_ANIMATIONS) {
    slots[t] = createEmptySlot(t);
  }
  return slots;
}

function StatusBadge({
  status,
  source,
}: {
  status: AnimationSlot["status"];
  source: SlotSource;
}) {
  if (status === "empty") {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-tertiary text-content-tertiary">
        Empty
      </span>
    );
  }
  if (status === "in-progress") {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-fal-purple-deep/20 text-fal-purple-light">
        Editing
      </span>
    );
  }
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-fal-cyan/20 text-fal-cyan">
      {source === "ai" ? "AI" : source === "import" ? "Imported" : "Done"}
    </span>
  );
}
