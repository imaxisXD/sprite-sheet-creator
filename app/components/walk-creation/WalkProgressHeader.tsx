"use client";

import {
  AnimationType,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  DIRECTION_ROW_ORDER_8,
} from "../../config/animation-types";
import type { DirectionalFrameSet8 } from "../../types";

interface WalkProgressHeaderProps {
  animationType: AnimationType;
  dirFrames: DirectionalFrameSet8;
  onDone: () => void;
  onCancel: () => void;
}

export default function WalkProgressHeader({
  animationType,
  dirFrames,
  onDone,
  onCancel,
}: WalkProgressHeaderProps) {
  const config = ANIMATION_CONFIGS[animationType];
  const completedDirs = DIRECTION_ROW_ORDER_8.filter(
    (d) => dirFrames[d].length > 0
  );
  const completedCount = completedDirs.length;
  const allComplete = completedCount === 8;
  const hasAny = completedCount > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Animated pulsing dot */}
          <div className="relative flex items-center justify-center w-5 h-5">
            <div
              className={`absolute inset-0 rounded-full ${
                allComplete ? "bg-fal-cyan/20" : "bg-fal-purple-deep/20"
              }`}
              style={{
                animation: hasAny && !allComplete ? "pulse 2s ease-in-out infinite" : "none",
              }}
            />
            <div
              className={`w-2 h-2 rounded-full ${
                allComplete ? "bg-fal-cyan" : hasAny ? "bg-fal-purple-light" : "bg-content-tertiary/40"
              }`}
            />
          </div>

          <h3 className="text-sm font-semibold text-content-primary tracking-tight">
            Create {animationType.charAt(0).toUpperCase() + animationType.slice(1)} Animation
          </h3>

          {/* Spec badge */}
          <span className="hidden sm:inline-flex text-[10px] px-2.5 py-1 rounded-full bg-surface-tertiary border border-stroke/20 text-content-tertiary font-mono tabular-nums tracking-wide">
            {config.frameCount} frames &times; 8 dirs &middot; {FRAME_SIZE.width}&times;{FRAME_SIZE.height}px
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-content-tertiary hover:text-content-secondary transition-colors rounded-md hover:bg-surface-tertiary"
          >
            Cancel
          </button>
          <button
            onClick={onDone}
            disabled={!hasAny}
            className={`
              relative px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-300
              ${
                hasAny
                  ? allComplete
                    ? "bg-fal-cyan text-black hover:bg-fal-cyan/85 shadow-[0_0_12px_rgba(56,172,198,0.2)]"
                    : "bg-fal-purple-deep text-white hover:bg-fal-purple-deep/85"
                  : "bg-surface-tertiary text-content-tertiary cursor-not-allowed opacity-50"
              }
            `}
          >
            Done ({completedCount}/8)
          </button>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-1">
        {DIRECTION_ROW_ORDER_8.map((dir) => {
          const filled = dirFrames[dir].length > 0;
          return (
            <div
              key={dir}
              className="flex-1 h-1 rounded-full overflow-hidden bg-surface-tertiary/60"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  filled
                    ? allComplete
                      ? "bg-fal-cyan w-full"
                      : "bg-fal-purple-light w-full"
                    : "w-0"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
