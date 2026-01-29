"use client";

import { useState, useCallback } from "react";
import type { AnimationType } from "../config/animation-types";
import {
  ANIMATION_CONFIGS,
  DIRECTION_ROW_ORDER_8,
  FRAME_SIZE,
} from "../config/animation-types";
import type { AnimationSlot } from "./AnimationSlotManager";
import type { GameSettings } from "./SettingsPanel";
import type { Frame, DirectionalFrameSet8, GameDirection } from "../types";

// Map from 8-dir sprite-creator naming to game direction naming
const DIRECTION8_TO_GAME: Record<string, GameDirection> = {
  south: "down",
  south_west: "down-left",
  west: "left",
  north_west: "up-left",
  north: "up",
  north_east: "up-right",
  east: "right",
  south_east: "down-right",
};

interface DeployToGameButtonProps {
  slots: Record<AnimationType, AnimationSlot>;
  settings: GameSettings;
  /** Deploy specific slot or all completed */
  mode: "single" | "all";
  /** For single mode, which slot */
  targetSlot?: AnimationType;
}

export default function DeployToGameButton({
  slots,
  settings,
  mode,
  targetSlot,
}: DeployToGameButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const buildSheetFromFrames = useCallback(
    (frames: Frame[], cols: number): HTMLCanvasElement => {
      const rows = Math.ceil(frames.length / cols);
      const canvas = document.createElement("canvas");
      canvas.width = cols * FRAME_SIZE.width;
      canvas.height = rows * FRAME_SIZE.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      frames.forEach((frame, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const img = new Image();
        img.src = frame.dataUrl;
        ctx.drawImage(
          img,
          col * FRAME_SIZE.width,
          row * FRAME_SIZE.height,
          FRAME_SIZE.width,
          FRAME_SIZE.height
        );
      });

      return canvas;
    },
    []
  );

  const buildDirectionalSheet = useCallback(
    (dirFrames: DirectionalFrameSet8, cols: number): HTMLCanvasElement => {
      const canvas = document.createElement("canvas");
      canvas.width = cols * FRAME_SIZE.width;
      canvas.height = 8 * FRAME_SIZE.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      DIRECTION_ROW_ORDER_8.forEach((dir, rowIdx) => {
        const frames = dirFrames[dir] || [];
        frames.forEach((frame, colIdx) => {
          if (colIdx >= cols) return;
          const img = new Image();
          img.src = frame.dataUrl;
          ctx.drawImage(
            img,
            colIdx * FRAME_SIZE.width,
            rowIdx * FRAME_SIZE.height,
            FRAME_SIZE.width,
            FRAME_SIZE.height
          );
        });
      });

      return canvas;
    },
    []
  );

  const handleDeploy = useCallback(async () => {
    setIsDeploying(true);
    setResult(null);

    try {
      const slotsToProcess: AnimationType[] =
        mode === "single" && targetSlot
          ? [targetSlot]
          : (Object.keys(slots) as AnimationType[]).filter(
              (k) => slots[k].status === "complete"
            );

      if (slotsToProcess.length === 0) {
        setResult({ success: false, message: "No completed animations to deploy" });
        return;
      }

      const sheets = slotsToProcess.map((animType) => {
        const slot = slots[animType];
        const config = ANIMATION_CONFIGS[animType];

        let dataUrl: string;
        let animations: Record<string, unknown>;

        if (config.isDirectional && slot.directionalFrames) {
          const canvas = buildDirectionalSheet(
            slot.directionalFrames,
            config.columns
          );
          dataUrl = canvas.toDataURL("image/png");

          // Build directional animation mapping
          const dirMapping: Record<string, unknown> = {};
          DIRECTION_ROW_ORDER_8.forEach((dir, rowIdx) => {
            const gameDir = DIRECTION8_TO_GAME[dir];
            const frameCount =
              slot.directionalFrames?.[dir]?.length ?? config.frameCount;
            dirMapping[gameDir] = {
              sheet: animType,
              startFrame: rowIdx * config.columns,
              frameCount,
              frameDuration: config.frameDuration,
              loop: config.loop,
            };
          });
          animations = { [animType]: dirMapping };
        } else {
          const canvas = buildSheetFromFrames(slot.frames, config.columns);
          dataUrl = canvas.toDataURL("image/png");

          animations = {
            [animType]: {
              sheet: animType,
              startFrame: 0,
              frameCount: slot.frames.length,
              frameDuration: config.frameDuration,
              loop: config.loop,
            },
          };
        }

        return {
          name: animType,
          dataUrl,
          sheetConfig: {
            columns: config.columns,
            rows: config.isDirectional ? 8 : config.rows,
            frameWidth: FRAME_SIZE.width,
            frameHeight: FRAME_SIZE.height,
          },
          animations,
        };
      });

      const res = await fetch("/api/deploy-to-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gamePath: settings.gamePath || undefined,
          character: settings.characterName,
          sheets,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `Deployed ${data.deployedFiles.length} files to ${settings.characterName}`,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Deploy failed",
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "Deploy failed",
      });
    } finally {
      setIsDeploying(false);
    }
  }, [slots, settings, mode, targetSlot, buildSheetFromFrames, buildDirectionalSheet]);

  const completedCount = Object.values(slots).filter(
    (s) => s.status === "complete"
  ).length;

  const isDisabled =
    isDeploying ||
    (mode === "all" && completedCount === 0) ||
    (mode === "single" && (!targetSlot || slots[targetSlot]?.status !== "complete"));

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleDeploy}
        disabled={isDisabled}
        className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
          isDisabled
            ? "bg-surface-tertiary text-content-tertiary cursor-not-allowed"
            : "bg-fal-cyan text-black hover:bg-fal-cyan/80"
        }`}
      >
        {isDeploying
          ? "Deploying..."
          : mode === "single"
          ? `Deploy ${targetSlot}`
          : `Deploy All (${completedCount})`}
      </button>

      {result && (
        <span
          className={`text-xs ${
            result.success ? "text-fal-cyan" : "text-red-400"
          }`}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
