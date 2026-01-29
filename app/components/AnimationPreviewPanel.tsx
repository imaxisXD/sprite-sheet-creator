"use client";

import { useState, useCallback } from "react";
import {
  AnimationType,
  Direction8,
  ANIMATION_CONFIGS,
} from "../config/animation-types";
import { Frame, DirectionalFrameSet8 } from "../types";
import FrameExtractorEditor from "./FrameExtractorEditor";
import MiniPixiSandbox from "./MiniPixiSandbox";
import PromptEditor from "./PromptEditor";

// Grid configuration type (matches page.tsx)
interface GridConfig {
  cols: number;
  rows: number;
  verticalDividers: number[];
  horizontalDividers: number[];
  customRegions?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  mode?: "grid" | "custom";
}

// Attack frames result type
interface AttackFramesResult {
  attack1: Frame[];
  attack2: Frame[];
  attack3: Frame[];
}

interface AnimationPreviewPanelProps {
  // Animation identification
  animationType: AnimationType;
  label: string;
  description: string;

  // Image data
  sheetUrl: string | null;

  // Extracted frames for preview
  frames?: Frame[];
  directionalFrames?: DirectionalFrameSet8;

  // Grid configuration
  gridConfig?: GridConfig;
  onGridConfigChange?: (config: GridConfig) => void;

  // Frame extraction callback
  onFramesExtracted: (
    frames: Frame[] | DirectionalFrameSet8 | AttackFramesResult
  ) => void;

  // Prompt editing
  defaultPrompt: string;
  customPrompt?: string;
  onPromptChange?: (prompt: string) => void;

  // Regeneration
  onRegenerate?: () => void;
  isRegenerating?: boolean;

  // Preview settings
  previewWidth?: number;
  previewHeight?: number;

  // Initial grid settings
  initialCols?: number;
  initialRows?: number;
}

// Animation type icons
function getAnimationIcon(animationType: AnimationType): string {
  switch (animationType) {
    case "idle":
      return "🧍";
    case "walk":
      return "🚶";
    case "attack1":
      return "⚔️";
    case "attack2":
      return "🗡️";
    case "attack3":
      return "💥";
    case "dash":
      return "💨";
    case "hurt":
      return "😣";
    case "death":
      return "💀";
    case "special":
      return "✨";
    default:
      return "🎮";
  }
}

export default function AnimationPreviewPanel({
  animationType,
  label,
  description,
  sheetUrl,
  frames,
  directionalFrames,
  gridConfig,
  onGridConfigChange,
  onFramesExtracted,
  defaultPrompt,
  customPrompt,
  onPromptChange,
  onRegenerate,
  isRegenerating = false,
  previewWidth = 180,
  previewHeight = 140,
  initialCols,
  initialRows,
}: AnimationPreviewPanelProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [direction, setDirection] = useState<Direction8>("south");

  const config = ANIMATION_CONFIGS[animationType];
  const isDirectional = config.isDirectional;

  // Prompt value (use custom if provided, otherwise default)
  const promptValue = customPrompt ?? defaultPrompt;

  // Check if we have frames for preview
  const hasFrames = isDirectional
    ? directionalFrames &&
      Object.values(directionalFrames).some((d) => d.length > 0)
    : frames && frames.length > 0;

  // Handle prompt change
  const handlePromptChange = useCallback(
    (newPrompt: string) => {
      onPromptChange?.(newPrompt);
    },
    [onPromptChange]
  );

  // Handle direction change from mini sandbox
  const handleDirectionChange = useCallback((newDirection: Direction8) => {
    setDirection(newDirection);
  }, []);

  return (
    <div className="bg-surface-secondary border border-stroke rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-tertiary/50 border-b border-stroke">
        <div className="flex items-center gap-3">
          <span className="text-lg">{getAnimationIcon(animationType)}</span>
          <div>
            <h3 className="text-sm font-semibold text-content-primary m-0">
              {label}
            </h3>
            <p className="text-xs text-content-tertiary m-0">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Regenerate button */}
          {onRegenerate && (
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                isRegenerating
                  ? "bg-fal-purple-deep/50 text-fal-purple-light cursor-not-allowed"
                  : "bg-fal-purple-deep text-white hover:bg-fal-purple-light"
              }`}
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <>
                  <svg
                    className="animate-spin h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Regenerate
                </>
              )}
            </button>
          )}

          {/* Prompt toggle button */}
          {onPromptChange && (
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                showPrompt
                  ? "bg-fal-cyan/20 text-fal-cyan border border-fal-cyan/30"
                  : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
              }`}
              onClick={() => setShowPrompt(!showPrompt)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Prompt
              {customPrompt && customPrompt !== defaultPrompt && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-fal-cyan" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {sheetUrl ? (
          <div className="flex gap-4">
            {/* Grid Editor */}
            <div className="flex-1 min-w-0">
              <FrameExtractorEditor
                imageUrl={sheetUrl}
                animationType={animationType}
                onFramesExtracted={onFramesExtracted}
                initialCols={initialCols ?? gridConfig?.cols ?? config.columns}
                initialRows={initialRows ?? gridConfig?.rows ?? config.rows}
                initialVerticalDividers={gridConfig?.verticalDividers}
                initialHorizontalDividers={gridConfig?.horizontalDividers}
                initialCustomRegions={gridConfig?.customRegions}
                initialMode={gridConfig?.mode}
                onGridConfigChange={onGridConfigChange}
              />
            </div>

            {/* Preview Sandbox */}
            <div className="flex-shrink-0">
              <div className="text-xs text-content-secondary mb-2 font-medium">
                Preview
              </div>
              <MiniPixiSandbox
                animationType={animationType}
                frames={frames}
                directionalFrames={directionalFrames}
                width={previewWidth}
                height={previewHeight}
                showDirectionControls={isDirectional}
                onDirectionChange={handleDirectionChange}
                initialDirection={direction}
              />
              {!hasFrames && (
                <div className="mt-2 text-xs text-content-tertiary text-center">
                  Adjust grid to extract frames
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-content-tertiary">
            <div className="text-center">
              <div className="text-3xl mb-2">🎨</div>
              <p className="text-sm">No sprite sheet generated yet</p>
              {onRegenerate && (
                <button
                  type="button"
                  className="mt-3 px-4 py-2 text-sm font-medium bg-fal-purple-deep text-white rounded-md hover:bg-fal-purple-light transition-colors"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? "Generating..." : "Generate"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Prompt Editor (collapsible) */}
        {showPrompt && onPromptChange && (
          <div className="mt-4 pt-4 border-t border-stroke">
            <PromptEditor
              defaultPrompt={defaultPrompt}
              value={promptValue}
              onChange={handlePromptChange}
              isGenerating={isRegenerating}
              animationLabel={label}
            />
          </div>
        )}
      </div>

      {/* Footer with status */}
      {hasFrames && (
        <div className="px-4 py-2 bg-surface-tertiary/30 border-t border-stroke">
          <div className="flex items-center justify-between text-xs text-content-tertiary">
            <span>
              {isDirectional
                ? `${
                    directionalFrames?.[direction]?.length ?? 0
                  } frames per direction`
                : `${frames?.length ?? 0} frames`}
            </span>
            <span>
              {config.frameDuration}ms/frame •{" "}
              {config.loop ? "Loops" : "Plays once"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
