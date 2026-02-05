"use client";

import { useState } from "react";
import { Direction8, AnimationType, ANIMATION_CONFIGS, FRAME_SIZE } from "../../config/animation-types";
import type { Frame } from "../../types";
import { ImportTab } from "../import";
import SpriteSheetImport from "../SpriteSheetImport";
import { PixelEditor } from "../pixel-editor";

// Direction display names
const DIRECTION_LABELS: Record<Direction8, string> = {
  north: "North",
  north_east: "North East",
  east: "East",
  south_east: "South East",
  south: "South",
  south_west: "South West",
  west: "West",
  north_west: "North West",
};

// Direction angles for the arrow indicator
const DIRECTION_ANGLES: Record<Direction8, number> = {
  north: 0,
  north_east: 45,
  east: 90,
  south_east: 135,
  south: 180,
  south_west: 225,
  west: 270,
  north_west: 315,
};

interface DirectionImportPanelProps {
  direction: Direction8;
  animationType: AnimationType;
  onFramesReady: (frames: Frame[]) => void;
  onClose: () => void;
}

export default function DirectionImportPanel({
  direction,
  animationType,
  onFramesReady,
  onClose,
}: DirectionImportPanelProps) {
  const [activeTab, setActiveTab] = useState<"import" | "sheet" | "draw">("import");
  const angle = DIRECTION_ANGLES[direction];
  const config = ANIMATION_CONFIGS[animationType];

  return (
    <div
      className="border border-stroke/40 rounded-xl bg-surface-secondary/90 backdrop-blur-sm overflow-hidden"
      style={{
        animation: "slideDown 0.25s ease-out",
      }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stroke/20 bg-surface-tertiary/30">
        <div className="flex items-center gap-3">
          {/* Direction indicator */}
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-fal-purple-deep/15 border border-fal-purple-light/20">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <path
                d="M7 2L4 8h2v4h2V8h2L7 2z"
                fill="#ab77ff"
              />
            </svg>
          </div>

          <span className="text-xs font-semibold text-content-primary tracking-tight">
            Importing: {DIRECTION_LABELS[direction]}
          </span>

          <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-tertiary text-content-tertiary font-mono">
            {direction.replace("_", "-")}
          </span>
        </div>

        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-md text-content-tertiary hover:text-content-secondary hover:bg-surface-tertiary transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-4 pt-2 border-b border-stroke/15">
        {(["import", "sheet", "draw"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-all duration-200 border-b-2 ${
              activeTab === tab
                ? "text-content-primary border-fal-purple-light"
                : "text-content-tertiary border-transparent hover:text-content-secondary hover:border-stroke/30"
            }`}
          >
            {tab === "import" ? "Import Frames" : tab === "draw" ? "Pixel Draw" : "Sprite Sheet"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "import" && (
          <ImportTab onFramesReady={onFramesReady} />
        )}

        {activeTab === "sheet" && (
          <SpriteSheetImport
            animationType={animationType}
            onFramesExtracted={onFramesReady}
            onDirectionalFramesExtracted={() => {
              // Single-direction mode: we don't use directional extraction here
            }}
          />
        )}

        {activeTab === "draw" && (
          <PixelEditor
            key={`pixel-${animationType}-${direction}`}
            width={FRAME_SIZE.width}
            height={FRAME_SIZE.height}
            frameCount={config.frameCount}
            onFramesReady={onFramesReady}
            title={`Draw ${animationType} - ${DIRECTION_LABELS[direction]}`}
            description={`${config.frameCount} frames - ${FRAME_SIZE.width}x${FRAME_SIZE.height}px`}
          />
        )}
      </div>

      {/* Inline CSS for slide animation */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
