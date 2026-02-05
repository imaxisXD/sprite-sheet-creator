"use client";

import { useState, useCallback } from "react";
import {
  AnimationType,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  Direction8,
  DIRECTION_ROW_ORDER_8,
} from "../config/animation-types";
import type { Frame, DirectionalFrameSet8 } from "../types";
import { createEmptyDirectionalFrameSet8 } from "../types";
import { ImportTab } from "./import";
import SpriteSheetImport from "./SpriteSheetImport";
import { PixelEditor } from "./pixel-editor";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AnimationCreationFlowProps {
  animationType: AnimationType;
  /** Called when the user finalizes frames from this flow */
  onComplete: (
    frames: Frame[],
    directionalFrames: DirectionalFrameSet8 | null,
    source: "ai" | "import"
  ) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnimationCreationFlow({
  animationType,
  onComplete,
  onCancel,
}: AnimationCreationFlowProps) {
  const config = ANIMATION_CONFIGS[animationType];
  const [activeTab, setActiveTab] = useState<"ai" | "import" | "sheet" | "draw">("import");

  // For directional imports: which direction are the imported frames for?
  const [targetDirection, setTargetDirection] = useState<Direction8>("south");
  const [dirFrames, setDirFrames] = useState<DirectionalFrameSet8>(
    createEmptyDirectionalFrameSet8()
  );

  // Count completed directions
  const completedDirs = DIRECTION_ROW_ORDER_8.filter(
    (d) => dirFrames[d].length > 0
  );

  const handleImportFrames = useCallback(
    (frames: Frame[]) => {
      if (config.isDirectional) {
        // Assign to selected direction
        const updated = { ...dirFrames };
        updated[targetDirection] = frames;
        setDirFrames(updated);
      } else {
        // Non-directional: done immediately
        onComplete(frames, null, "import");
      }
    },
    [config.isDirectional, dirFrames, targetDirection, onComplete]
  );

  const handleFinalizeDirectional = useCallback(() => {
    onComplete([], dirFrames, "import");
  }, [dirFrames, onComplete]);

  return (
    <div className="flex flex-col gap-4 border border-stroke/50 rounded-xl bg-surface-secondary p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-content-primary capitalize">
            Create: {animationType}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-tertiary text-content-tertiary">
            {config.frameCount} frames{" "}
            {config.isDirectional ? "x 8 directions" : ""}
            {" \u00B7 "}{FRAME_SIZE.width}x{FRAME_SIZE.height}px each
          </span>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-content-tertiary hover:text-content-secondary transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-stroke/30 pb-px">
        {(["import", "sheet", "draw", "ai"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium rounded-t-md transition-colors ${
              activeTab === tab
                ? "bg-surface-tertiary text-content-primary border-b-2 border-fal-purple-deep"
                : "text-content-tertiary hover:text-content-secondary"
            }`}
          >
            {tab === "ai"
              ? "AI Generate"
              : tab === "sheet"
              ? "Sprite Sheet"
              : tab === "draw"
              ? "Pixel Draw"
              : "Import"}
          </button>
        ))}
      </div>

      {/* Direction selector for directional imports (hidden for sprite sheet since all directions come at once) */}
      {config.isDirectional && activeTab === "import" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-content-tertiary">
              Importing for direction:
            </span>
            <select
              value={targetDirection}
              onChange={(e) =>
                setTargetDirection(e.target.value as Direction8)
              }
              className="px-2 py-1 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary"
            >
              {DIRECTION_ROW_ORDER_8.map((dir) => (
                <option key={dir} value={dir}>
                  {dir.replace("_", " ")}{" "}
                  {dirFrames[dir].length > 0
                    ? `(${dirFrames[dir].length} frames)`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Direction progress */}
          <div className="flex flex-wrap gap-1">
            {DIRECTION_ROW_ORDER_8.map((dir) => (
              <span
                key={dir}
                className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  dir === targetDirection
                    ? "bg-fal-purple-deep text-white"
                    : dirFrames[dir].length > 0
                    ? "bg-fal-cyan/20 text-fal-cyan"
                    : "bg-surface-tertiary text-content-tertiary"
                }`}
                onClick={() => setTargetDirection(dir)}
              >
                {dir.replace("_", "-")}
                {dirFrames[dir].length > 0 && " \u2713"}
              </span>
            ))}
          </div>

          {completedDirs.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-content-secondary">
                {completedDirs.length}/8 directions filled
              </span>
              <button
                onClick={handleFinalizeDirectional}
                className="px-4 py-2 rounded-md text-sm font-medium bg-fal-cyan text-black hover:bg-fal-cyan/80 transition-colors"
              >
                Done ({completedDirs.length}/8)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "import" && (
        <ImportTab onFramesReady={handleImportFrames} />
      )}

      {activeTab === "sheet" && (
        <SpriteSheetImport
          animationType={animationType}
          onFramesExtracted={(frames) => {
            onComplete(frames, null, "import");
          }}
          onDirectionalFramesExtracted={(dirFrames) => {
            onComplete([], dirFrames, "import");
          }}
        />
      )}

      {activeTab === "draw" && (
        <PixelEditor
          key={`pixel-${animationType}`}
          width={FRAME_SIZE.width}
          height={FRAME_SIZE.height}
          frameCount={config.frameCount}
          onFramesReady={(frames) => onComplete(frames, null, "import")}
          title={`Draw ${animationType}`}
          description={`${config.frameCount} frames - ${FRAME_SIZE.width}x${FRAME_SIZE.height}px`}
        />
      )}

      {activeTab === "ai" && (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-content-tertiary text-sm">
            AI generation uses the existing workflow.
          </div>
          <p className="text-xs text-content-tertiary max-w-sm">
            Go to the &quot;AI Generate&quot; tab in the main page to generate sprite
            sheets with fal.ai, then use the grid editor to extract frames
            into animation slots.
          </p>
        </div>
      )}
    </div>
  );
}
