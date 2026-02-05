"use client";

import { useCallback, useState } from "react";
import JSZip from "jszip";
import {
  AnimationType,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  DIRECTION_ROW_ORDER_8,
  Direction8,
} from "../config/animation-types";
import { Frame, DirectionalFrameSet8, SpriteSheetFile, SpriteConfig, GameDirection, DirectionalAnimationMapping } from "../types";

/** Map Direction8 (sprite-creator) to GameDirection (game engine) */
const DIRECTION8_TO_GAME: Record<Direction8, GameDirection> = {
  south: 'down',
  south_west: 'down-left',
  west: 'left',
  north_west: 'up-left',
  north: 'up',
  north_east: 'up-right',
  east: 'right',
  south_east: 'down-right',
};

interface ExportPanelProps {
  characterName: string;
  /** Directional animation frames (8-direction) */
  idleFrames?: DirectionalFrameSet8;
  walkFrames?: DirectionalFrameSet8;
  /** Combat animation frames */
  attack1Frames?: Frame[];
  attack2Frames?: Frame[];
  attack3Frames?: Frame[];
  dashFrames?: Frame[];
  hurtFrames?: Frame[];
  deathFrames?: Frame[];
  specialFrames?: Frame[];
  onExportComplete?: () => void;
}

/**
 * Assembles individual frames into grid sprite sheets and exports as ZIP
 */
export default function ExportPanel({
  characterName,
  idleFrames,
  walkFrames,
  attack1Frames,
  attack2Frames,
  attack3Frames,
  dashFrames,
  hurtFrames,
  deathFrames,
  specialFrames,
  onExportComplete,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  /**
   * Create a sprite sheet canvas from directional frames
   */
  const createDirectionalSheet = useCallback(
    async (
      frames: DirectionalFrameSet8,
      animType: "idle" | "walk"
    ): Promise<HTMLCanvasElement> => {
      const config = ANIMATION_CONFIGS[animType];
      const canvas = document.createElement("canvas");
      canvas.width = config.columns * FRAME_SIZE.width;
      canvas.height = 8 * FRAME_SIZE.height; // Always 8 rows for 8-direction
      const ctx = canvas.getContext("2d")!;

      // Clear with transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw frames for each direction (row) — 8 directions
      for (let rowIndex = 0; rowIndex < DIRECTION_ROW_ORDER_8.length; rowIndex++) {
        const direction = DIRECTION_ROW_ORDER_8[rowIndex];
        const dirFrames = frames[direction];

        for (let col = 0; col < Math.min(dirFrames.length, config.columns); col++) {
          const frame = dirFrames[col];
          const img = await loadImage(frame.dataUrl);

          // Scale and center frame in cell
          const cellX = col * FRAME_SIZE.width;
          const cellY = rowIndex * FRAME_SIZE.height;

          // Draw scaled to fit cell
          const scale = Math.min(
            FRAME_SIZE.width / frame.width,
            FRAME_SIZE.height / frame.height
          );
          const scaledWidth = frame.width * scale;
          const scaledHeight = frame.height * scale;
          const offsetX = (FRAME_SIZE.width - scaledWidth) / 2;
          const offsetY = FRAME_SIZE.height - scaledHeight; // Align to bottom

          ctx.drawImage(
            img,
            cellX + offsetX,
            cellY + offsetY,
            scaledWidth,
            scaledHeight
          );
        }
      }

      return canvas;
    },
    []
  );

  /**
   * Create a sprite sheet canvas from non-directional frames (single row)
   * Uses actual frame count instead of hardcoded config
   */
  const createSingleRowSheet = useCallback(
    async (frames: Frame[]): Promise<HTMLCanvasElement> => {
      const frameCount = frames.length;
      const canvas = document.createElement("canvas");
      canvas.width = frameCount * FRAME_SIZE.width;
      canvas.height = FRAME_SIZE.height;
      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let col = 0; col < frameCount; col++) {
        const frame = frames[col];
        const img = await loadImage(frame.dataUrl);

        const cellX = col * FRAME_SIZE.width;
        const scale = Math.min(
          FRAME_SIZE.width / frame.width,
          FRAME_SIZE.height / frame.height
        );
        const scaledWidth = frame.width * scale;
        const scaledHeight = frame.height * scale;
        const offsetX = (FRAME_SIZE.width - scaledWidth) / 2;
        const offsetY = FRAME_SIZE.height - scaledHeight;

        ctx.drawImage(img, cellX + offsetX, offsetY, scaledWidth, scaledHeight);
      }

      return canvas;
    },
    []
  );

  /**
   * Create combined attack sheet (attack1 + attack2 + attack3 stacked)
   */
  const createCombinedAttackSheet = useCallback(
    async (
      attack1: Frame[],
      attack2: Frame[],
      attack3: Frame[]
    ): Promise<HTMLCanvasElement> => {
      const canvas = document.createElement("canvas");
      canvas.width = 4 * FRAME_SIZE.width;
      canvas.height = 3 * FRAME_SIZE.height;
      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const allAttacks = [attack1, attack2, attack3];

      for (let row = 0; row < 3; row++) {
        const frames = allAttacks[row];
        for (let col = 0; col < Math.min(frames.length, 4); col++) {
          const frame = frames[col];
          const img = await loadImage(frame.dataUrl);

          const cellX = col * FRAME_SIZE.width;
          const cellY = row * FRAME_SIZE.height;
          const scale = Math.min(
            FRAME_SIZE.width / frame.width,
            FRAME_SIZE.height / frame.height
          );
          const scaledWidth = frame.width * scale;
          const scaledHeight = frame.height * scale;
          const offsetX = (FRAME_SIZE.width - scaledWidth) / 2;
          const offsetY = FRAME_SIZE.height - scaledHeight;

          ctx.drawImage(
            img,
            cellX + offsetX,
            cellY + offsetY,
            scaledWidth,
            scaledHeight
          );
        }
      }

      return canvas;
    },
    []
  );

  /**
   * Build 8-directional animation mapping for sprite-config.json.
   * Row order: down, down-left, left, up-left, up, up-right, right, down-right
   */
  const buildDirectionalMapping = useCallback(
    (sheetName: string, colCount: number, frameDuration: number): DirectionalAnimationMapping => {
      const mapping = {} as DirectionalAnimationMapping;
      for (let i = 0; i < DIRECTION_ROW_ORDER_8.length; i++) {
        const dir8 = DIRECTION_ROW_ORDER_8[i];
        const gameDir = DIRECTION8_TO_GAME[dir8];
        mapping[gameDir] = {
          sheet: sheetName,
          startFrame: i * colCount,
          frameCount: colCount,
          frameDuration,
          loop: true,
        };
      }
      return mapping;
    },
    []
  );

  /**
   * Generate the sprite configuration JSON
   * Uses actual frame counts from extracted frames
   */
  const generateConfig = useCallback((): SpriteConfig => {
    const basePath = `./${characterName}`;

    // Get actual frame counts (use south/down as reference)
    const idleColCount = idleFrames?.south?.length ?? 4;
    const walkColCount = walkFrames?.south?.length ?? 6;
    const attack1Count = attack1Frames?.length ?? 8;
    const attack2Count = attack2Frames?.length ?? 8;
    const attack3Count = attack3Frames?.length ?? 8;
    const attackColCount = Math.max(attack1Count, attack2Count, attack3Count);
    const dashCount = dashFrames?.length ?? 6;
    const hurtCount = hurtFrames?.length ?? 4;
    const deathCount = deathFrames?.length ?? 10;
    const specialCount = specialFrames?.length ?? 12;

    return {
      sheets: {
        idle: {
          path: `${basePath}/idle.png`,
          columns: idleColCount,
          rows: 8,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
        walk: {
          path: `${basePath}/walk.png`,
          columns: walkColCount,
          rows: 8,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
        attack: {
          path: `${basePath}/attack.png`,
          columns: attackColCount,
          rows: 3,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
        dash: {
          path: `${basePath}/dash.png`,
          columns: dashCount,
          rows: 1,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
        hurt: {
          path: `${basePath}/hurt.png`,
          columns: hurtCount,
          rows: 1,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
        death: {
          path: `${basePath}/death.png`,
          columns: deathCount,
          rows: 1,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
        special: {
          path: `${basePath}/special.png`,
          columns: specialCount,
          rows: 1,
          frameWidth: FRAME_SIZE.width,
          frameHeight: FRAME_SIZE.height,
        },
      },
      animations: {
        idle: buildDirectionalMapping("idle", idleColCount, 150),
        walk: buildDirectionalMapping("walk", walkColCount, 100),
        attack1: { sheet: "attack", startFrame: 0, frameCount: attack1Count, frameDuration: 50, loop: false },
        attack2: { sheet: "attack", startFrame: attackColCount, frameCount: attack2Count, frameDuration: 50, loop: false },
        attack3: { sheet: "attack", startFrame: attackColCount * 2, frameCount: attack3Count, frameDuration: 50, loop: false },
        dash: { sheet: "dash", startFrame: 0, frameCount: dashCount, frameDuration: 40, loop: false },
        hurt: { sheet: "hurt", startFrame: 0, frameCount: hurtCount, frameDuration: 80, loop: false },
        death: { sheet: "death", startFrame: 0, frameCount: deathCount, frameDuration: 100, loop: false },
        special: { sheet: "special", startFrame: 0, frameCount: specialCount, frameDuration: 60, loop: false },
      },
    };
  }, [characterName, idleFrames, walkFrames, attack1Frames, attack2Frames, attack3Frames, dashFrames, hurtFrames, deathFrames, specialFrames, buildDirectionalMapping]);

  /**
   * Export all sheets as a ZIP file
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportProgress("Preparing sheets...");

    try {
      const files: SpriteSheetFile[] = [];

      // Generate directional sheets
      if (idleFrames) {
        setExportProgress("Creating idle sheet...");
        const idleCanvas = await createDirectionalSheet(idleFrames, "idle");
        files.push({
          name: "idle.png",
          dataUrl: idleCanvas.toDataURL("image/png"),
          width: idleCanvas.width,
          height: idleCanvas.height,
        });
      }

      if (walkFrames) {
        setExportProgress("Creating walk sheet...");
        const walkCanvas = await createDirectionalSheet(walkFrames, "walk");
        files.push({
          name: "walk.png",
          dataUrl: walkCanvas.toDataURL("image/png"),
          width: walkCanvas.width,
          height: walkCanvas.height,
        });
      }

      // Generate combined attack sheet
      if (attack1Frames && attack2Frames && attack3Frames) {
        setExportProgress("Creating attack sheet...");
        const attackCanvas = await createCombinedAttackSheet(
          attack1Frames,
          attack2Frames,
          attack3Frames
        );
        files.push({
          name: "attack.png",
          dataUrl: attackCanvas.toDataURL("image/png"),
          width: attackCanvas.width,
          height: attackCanvas.height,
        });
      }

      // Generate single-row combat sheets
      if (dashFrames) {
        setExportProgress("Creating dash sheet...");
        const dashCanvas = await createSingleRowSheet(dashFrames);
        files.push({
          name: "dash.png",
          dataUrl: dashCanvas.toDataURL("image/png"),
          width: dashCanvas.width,
          height: dashCanvas.height,
        });
      }

      if (hurtFrames) {
        setExportProgress("Creating hurt sheet...");
        const hurtCanvas = await createSingleRowSheet(hurtFrames);
        files.push({
          name: "hurt.png",
          dataUrl: hurtCanvas.toDataURL("image/png"),
          width: hurtCanvas.width,
          height: hurtCanvas.height,
        });
      }

      if (deathFrames) {
        setExportProgress("Creating death sheet...");
        const deathCanvas = await createSingleRowSheet(deathFrames);
        files.push({
          name: "death.png",
          dataUrl: deathCanvas.toDataURL("image/png"),
          width: deathCanvas.width,
          height: deathCanvas.height,
        });
      }

      if (specialFrames) {
        setExportProgress("Creating special sheet...");
        const specialCanvas = await createSingleRowSheet(specialFrames);
        files.push({
          name: "special.png",
          dataUrl: specialCanvas.toDataURL("image/png"),
          width: specialCanvas.width,
          height: specialCanvas.height,
        });
      }

      // Generate config JSON
      const config = generateConfig();
      const configJson = JSON.stringify(config, null, 2);
      const configBlob = new Blob([configJson], { type: "application/json" });
      const configDataUrl = await blobToDataUrl(configBlob);
      files.push({
        name: "sprite-config.json",
        dataUrl: configDataUrl,
        width: 0,
        height: 0,
      });

      setExportProgress("Creating ZIP file...");

      // Create and download ZIP (using simple approach without external library)
      await downloadFilesAsZip(files, characterName);

      setExportProgress("Export complete!");
      onExportComplete?.();
    } catch (error) {
      console.error("Export failed:", error);
      setExportProgress("Export failed. Please try again.");
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress("");
      }, 2000);
    }
  }, [
    characterName,
    idleFrames,
    walkFrames,
    attack1Frames,
    attack2Frames,
    attack3Frames,
    dashFrames,
    hurtFrames,
    deathFrames,
    specialFrames,
    createDirectionalSheet,
    createSingleRowSheet,
    createCombinedAttackSheet,
    generateConfig,
    onExportComplete,
  ]);

  /**
   * Export individual sheets
   */
  const handleExportSingle = useCallback(
    async (sheetName: string) => {
      try {
        let canvas: HTMLCanvasElement | null = null;

        switch (sheetName) {
          case "idle":
            if (idleFrames) canvas = await createDirectionalSheet(idleFrames, "idle");
            break;
          case "walk":
            if (walkFrames) canvas = await createDirectionalSheet(walkFrames, "walk");
            break;
          case "attack":
            if (attack1Frames && attack2Frames && attack3Frames) {
              canvas = await createCombinedAttackSheet(attack1Frames, attack2Frames, attack3Frames);
            }
            break;
          case "dash":
            if (dashFrames) canvas = await createSingleRowSheet(dashFrames);
            break;
          case "hurt":
            if (hurtFrames) canvas = await createSingleRowSheet(hurtFrames);
            break;
          case "death":
            if (deathFrames) canvas = await createSingleRowSheet(deathFrames);
            break;
          case "special":
            if (specialFrames) canvas = await createSingleRowSheet(specialFrames);
            break;
        }

        if (canvas) {
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = `${sheetName}.png`;
          link.click();
        }
      } catch (error) {
        console.error(`Failed to export ${sheetName}:`, error);
      }
    },
    [
      idleFrames,
      walkFrames,
      attack1Frames,
      attack2Frames,
      attack3Frames,
      dashFrames,
      hurtFrames,
      deathFrames,
      specialFrames,
      createDirectionalSheet,
      createSingleRowSheet,
      createCombinedAttackSheet,
    ]
  );

  const hasAnyFrames =
    idleFrames ||
    walkFrames ||
    attack1Frames ||
    attack2Frames ||
    attack3Frames ||
    dashFrames ||
    hurtFrames ||
    deathFrames ||
    specialFrames;

  return (
    <div className="p-6 bg-surface-tertiary rounded-lg border border-stroke">
      <h3 className="m-0 mb-4 text-content-primary text-lg font-semibold">
        Export Sprite Sheets
      </h3>

      {!hasAnyFrames && (
        <p className="text-content-secondary italic">
          No frames available for export. Generate some animations first.
        </p>
      )}

      {hasAnyFrames && (
        <>
          <div className="mb-4 p-4 bg-surface-elevated rounded-md">
            <p className="m-0 mb-2 text-content-primary text-sm">
              Export format matches <strong>ichigo-journey</strong> SpriteSheetCharacterLoader:
            </p>
            <ul className="m-0 pl-6 text-content-secondary text-sm">
              <li className="my-1">Frame size: {FRAME_SIZE.width}x{FRAME_SIZE.height}px</li>
              <li className="my-1">8 directions: down, down-left, left, up-left, up, up-right, right, down-right</li>
              <li className="my-1">Includes sprite-config.json</li>
            </ul>
          </div>

          <div className="mb-6">
            <button
              className="w-full py-3 px-6 text-base rounded-md bg-fal-purple-deep text-white font-medium transition-all hover:bg-fal-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? exportProgress : "Export All (ZIP)"}
            </button>
          </div>

          <div>
            <h4 className="m-0 mb-3 text-content-secondary text-sm font-medium">
              Export Individual Sheets
            </h4>
            <div className="flex flex-wrap gap-2">
              {idleFrames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("idle")}
                >
                  idle.png
                </button>
              )}
              {walkFrames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("walk")}
                >
                  walk.png
                </button>
              )}
              {attack1Frames && attack2Frames && attack3Frames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("attack")}
                >
                  attack.png
                </button>
              )}
              {dashFrames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("dash")}
                >
                  dash.png
                </button>
              )}
              {hurtFrames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("hurt")}
                >
                  hurt.png
                </button>
              )}
              {deathFrames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("death")}
                >
                  death.png
                </button>
              )}
              {specialFrames && (
                <button
                  className="py-2 px-4 text-sm rounded bg-transparent text-content-secondary border border-stroke transition-all hover:bg-white/[0.03] hover:border-stroke-hover hover:text-content-primary"
                  onClick={() => handleExportSingle("special")}
                >
                  special.png
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper functions

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download files as a ZIP archive
 */
async function downloadFilesAsZip(files: SpriteSheetFile[], folderName: string): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(folderName);

  if (!folder) {
    throw new Error("Failed to create ZIP folder");
  }

  for (const file of files) {
    // Convert data URL to binary data
    const base64Data = file.dataUrl.split(",")[1];
    folder.file(file.name, base64Data, { base64: true });
  }

  // Generate the ZIP file
  const blob = await zip.generateAsync({ type: "blob" });

  // Download the ZIP file
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${folderName}-sprites.zip`;
  link.click();

  // Clean up the object URL
  URL.revokeObjectURL(link.href);
}
