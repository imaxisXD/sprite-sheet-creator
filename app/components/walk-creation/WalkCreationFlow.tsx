"use client";

import { useState, useCallback } from "react";
import {
  AnimationType,
  Direction8,
  DIRECTION_ROW_ORDER_8,
} from "../../config/animation-types";
import type { Frame, DirectionalFrameSet8 } from "../../types";
import { createEmptyDirectionalFrameSet8 } from "../../types";

import WalkProgressHeader from "./WalkProgressHeader";
import CompassGrid from "./CompassGrid";
import DirectionImportPanel from "./DirectionImportPanel";

// ---------------------------------------------------------------------------
// Props — identical to AnimationCreationFlowProps
// ---------------------------------------------------------------------------

export interface WalkCreationFlowProps {
  animationType: AnimationType;
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

export default function WalkCreationFlow({
  animationType,
  onComplete,
  onCancel,
}: WalkCreationFlowProps) {
  const [dirFrames, setDirFrames] = useState<DirectionalFrameSet8>(
    createEmptyDirectionalFrameSet8()
  );
  const [activeDirection, setActiveDirection] = useState<Direction8 | null>(null);

  // Handle frames imported for the active direction
  const handleDirectionFramesReady = useCallback(
    (frames: Frame[]) => {
      if (!activeDirection) return;

      setDirFrames((prev) => ({
        ...prev,
        [activeDirection]: frames,
      }));

      // Auto-advance to the next empty direction
      const currentIdx = DIRECTION_ROW_ORDER_8.indexOf(activeDirection);
      const remaining = DIRECTION_ROW_ORDER_8.filter(
        (d, i) => i !== currentIdx && dirFrames[d].length === 0
      );

      if (remaining.length > 0) {
        // Pick the next direction in order after the current one
        const nextAfterCurrent = DIRECTION_ROW_ORDER_8.find(
          (d, i) => i > currentIdx && dirFrames[d].length === 0
        );
        setActiveDirection(nextAfterCurrent ?? remaining[0]);
      } else {
        // All filled — close the panel
        setActiveDirection(null);
      }
    },
    [activeDirection, dirFrames]
  );

  // Handle clearing a direction's frames
  const handleClearDirection = useCallback((dir: Direction8) => {
    setDirFrames((prev) => ({
      ...prev,
      [dir]: [],
    }));
  }, []);

  // Finalize — send all directional frames back via onComplete
  const handleDone = useCallback(() => {
    onComplete([], dirFrames, "import");
  }, [dirFrames, onComplete]);

  // Toggle direction selection (clicking active direction closes panel)
  const handleSelectDirection = useCallback(
    (dir: Direction8) => {
      setActiveDirection((prev) => (prev === dir ? null : dir));
    },
    []
  );

  return (
    <div className="flex flex-col gap-5 border border-stroke/40 rounded-xl bg-surface-secondary p-5">
      {/* Progress header with title, specs, segmented bar, and Done/Cancel */}
      <WalkProgressHeader
        animationType={animationType}
        dirFrames={dirFrames}
        onDone={handleDone}
        onCancel={onCancel}
      />

      {/* Compass grid — 8 direction cards + center hub */}
      <CompassGrid
        dirFrames={dirFrames}
        activeDirection={activeDirection}
        onSelectDirection={handleSelectDirection}
        onClearDirection={handleClearDirection}
      />

      {/* Direction import panel — shown when a direction is selected */}
      {activeDirection && (
        <DirectionImportPanel
          key={activeDirection}
          direction={activeDirection}
          animationType={animationType}
          onFramesReady={handleDirectionFramesReady}
          onClose={() => setActiveDirection(null)}
        />
      )}

      {/* Hint text when no direction is selected */}
      {!activeDirection && (
        <p className="text-center text-[11px] text-content-tertiary/60 font-mono tracking-wide">
          Select a direction above to import frames
        </p>
      )}
    </div>
  );
}
