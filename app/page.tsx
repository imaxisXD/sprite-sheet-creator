"use client";

import { useState, useRef, useCallback, lazy, Suspense, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// Layout and shared components
import { FalSpinner, FalLogo, StepIndicator } from "./components/shared";
import PageHeader from "./components/layout/PageHeader";

// Step components
import { CharacterSelectStep, BaseCharacterStep, PreviewStep } from "./components/steps";

// Feature components  
import CharacterPresets from "./components/CharacterPresets";
import RecentCreationsGallery from "./components/RecentCreationsGallery";
import ExportPanel from "./components/ExportPanel";
import HistorySidebar from "./components/HistorySidebar";
import FrameExtractorEditor from "./components/FrameExtractorEditor";
import ImageStudio from "./components/ImageStudio";
import { useSessionId } from "./components/ConvexClientProvider";

// Types and configs
import { CharacterPreset, Frame, DirectionalFrameSet } from "./types";
import { buildCharacterPrompt, isCustomPreset, CHARACTER_PRESETS, getPresetById } from "./config/character-presets";
import { AnimationType, Direction, ANIMATION_CONFIGS, DIRECTION_ROW_ORDER } from "./config/animation-types";

// Dynamically import PixiSandbox to avoid SSR issues
const PixiSandbox = lazy(() => import("./components/PixiSandbox"));

type Step = 1 | 2 | 3 | 4 | 5 | 6;

// Grid configuration for each animation type
// Custom region for frame selection
interface CustomRegion {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
}

interface GridConfig {
  cols: number;
  rows: number;
  verticalDividers: number[];
  horizontalDividers: number[];
  customRegions?: CustomRegion[];
  mode?: "grid" | "custom";
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Get bounding box of non-transparent pixels in image data
function getContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export default function Home() {
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1: Character selection
  const [selectedPreset, setSelectedPreset] = useState<CharacterPreset | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [characterName, setCharacterName] = useState("character");

  // Step 2: Base character generation
  const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);

  // Step 3: Walk cycle generation
  const [walkSheetUrl, setWalkSheetUrl] = useState<string | null>(null);
  const [walkBgRemovedUrl, setWalkBgRemovedUrl] = useState<string | null>(null);
  const [isGeneratingWalk, setIsGeneratingWalk] = useState(false);

  // Step 4: Idle animation generation
  const [idleSheetUrl, setIdleSheetUrl] = useState<string | null>(null);
  const [idleBgRemovedUrl, setIdleBgRemovedUrl] = useState<string | null>(null);
  const [isGeneratingIdle, setIsGeneratingIdle] = useState(false);

  // Step 5: Combat animations generation
  const [attackSheetUrl, setAttackSheetUrl] = useState<string | null>(null);
  const [attackBgRemovedUrl, setAttackBgRemovedUrl] = useState<string | null>(null);
  const [dashSheetUrl, setDashSheetUrl] = useState<string | null>(null);
  const [dashBgRemovedUrl, setDashBgRemovedUrl] = useState<string | null>(null);
  const [hurtSheetUrl, setHurtSheetUrl] = useState<string | null>(null);
  const [hurtBgRemovedUrl, setHurtBgRemovedUrl] = useState<string | null>(null);
  const [deathSheetUrl, setDeathSheetUrl] = useState<string | null>(null);
  const [deathBgRemovedUrl, setDeathBgRemovedUrl] = useState<string | null>(null);
  const [specialSheetUrl, setSpecialSheetUrl] = useState<string | null>(null);
  const [specialBgRemovedUrl, setSpecialBgRemovedUrl] = useState<string | null>(null);
  const [isGeneratingCombat, setIsGeneratingCombat] = useState(false);

  // Extracted frames
  const [walkFrames, setWalkFrames] = useState<DirectionalFrameSet | null>(null);
  const [idleFrames, setIdleFrames] = useState<DirectionalFrameSet | null>(null);
  const [attack1Frames, setAttack1Frames] = useState<Frame[]>([]);
  const [attack2Frames, setAttack2Frames] = useState<Frame[]>([]);
  const [attack3Frames, setAttack3Frames] = useState<Frame[]>([]);
  const [dashFrames, setDashFrames] = useState<Frame[]>([]);
  const [hurtFrames, setHurtFrames] = useState<Frame[]>([]);
  const [deathFrames, setDeathFrames] = useState<Frame[]>([]);
  const [specialFrames, setSpecialFrames] = useState<Frame[]>([]);

  // UI state
  const [fps, setFps] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Grid adjustment state (Step 6)
  const [activeGridSheet, setActiveGridSheet] = useState<"walk" | "idle" | "attack" | "dash" | "hurt" | "death" | "special">("walk");
  const [gridConfigs, setGridConfigs] = useState<Record<string, GridConfig>>({
    walk: { cols: 6, rows: 4, verticalDividers: [], horizontalDividers: [] },
    idle: { cols: 4, rows: 4, verticalDividers: [], horizontalDividers: [] },
    attack: { cols: 4, rows: 3, verticalDividers: [], horizontalDividers: [] },
    dash: { cols: 4, rows: 1, verticalDividers: [], horizontalDividers: [] },
    hurt: { cols: 3, rows: 1, verticalDividers: [], horizontalDividers: [] },
    death: { cols: 4, rows: 2, verticalDividers: [], horizontalDividers: [] }, // AI generates 2 rows due to aspect ratio
    special: { cols: 6, rows: 2, verticalDividers: [], horizontalDividers: [] }, // AI generates 2 rows due to aspect ratio
  });

  // History sidebar state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Convex state
  const [creationId, setCreationId] = useState<Id<"creations"> | null>(null);
  const sessionId = useSessionId();

  // Convex mutations
  const createCreation = useMutation(api.creations.create);
  const updateProgress = useMutation(api.creations.updateProgress);
  const markCompleted = useMutation(api.creations.markCompleted);
  const saveImageRecord = useMutation(api.images.saveImageRecord);
  const saveThumbnailRecord = useMutation(api.images.saveThumbnailRecord);

  // Convex actions
  const uploadFromUrl = useAction(api.images.uploadFromUrl);
  const getUploadUrl = useAction(api.images.getUploadUrl);
  const getThumbnailUploadUrl = useAction(api.images.getThumbnailUploadUrl);

  // Get character description for prompts
  const getCharacterDescription = useCallback(() => {
    if (!selectedPreset) return "";
    if (isCustomPreset(selectedPreset)) {
      return customPrompt;
    }
    return selectedPreset.prompt;
  }, [selectedPreset, customPrompt]);

  // API calls
  const generateCharacter = async () => {
    if (!selectedPreset) {
      setError("Please select a character preset");
      return;
    }

    const prompt = buildCharacterPrompt(selectedPreset, customPrompt);
    if (!prompt.trim()) {
      setError("Please enter a character description");
      return;
    }

    setError(null);
    setIsGeneratingCharacter(true);

    try {
      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate character");
      }

      setCharacterImageUrl(data.imageUrl);
      // Set character name from preset
      setCharacterName(selectedPreset.id === 'custom' ? 'custom-character' : selectedPreset.id);

      // Save character image and thumbnail to R2 if we have a creation
      if (creationId) {
        // Save in background - don't block UI
        Promise.all([
          saveImageToR2(data.imageUrl, "character", creationId, data.width || 512, data.height || 512),
          saveThumbnail(data.imageUrl, creationId),
        ]).catch(e => console.error("Failed to save character to R2:", e));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate character");
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const generateWalkCycle = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingWalk(true);

    try {
      const response = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterDescription: getCharacterDescription(),
          type: "walk-full",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate walk cycle");
      }

      setWalkSheetUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate walk cycle");
    } finally {
      setIsGeneratingWalk(false);
    }
  };

  const generateIdleAnimation = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingIdle(true);

    try {
      const response = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterDescription: getCharacterDescription(),
          type: "idle-full",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate idle animation");
      }

      setIdleSheetUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate idle animation");
    } finally {
      setIsGeneratingIdle(false);
    }
  };

  const generateCombatAnimations = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingCombat(true);

    try {
      // Generate all combat animations in parallel
      const [attackRes, dashRes, hurtRes, deathRes, specialRes] = await Promise.all([
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterImageUrl,
            characterDescription: getCharacterDescription(),
            type: "attack-combined",
          }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterImageUrl,
            characterDescription: getCharacterDescription(),
            type: "dash",
          }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterImageUrl,
            characterDescription: getCharacterDescription(),
            type: "hurt",
          }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterImageUrl,
            characterDescription: getCharacterDescription(),
            type: "death",
          }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterImageUrl,
            characterDescription: getCharacterDescription(),
            type: "special",
          }),
        }),
      ]);

      const attackData = await attackRes.json();
      const dashData = await dashRes.json();
      const hurtData = await hurtRes.json();
      const deathData = await deathRes.json();
      const specialData = await specialRes.json();

      if (!attackRes.ok) throw new Error(attackData.error || "Failed to generate attack");
      if (!dashRes.ok) throw new Error(dashData.error || "Failed to generate dash");
      if (!hurtRes.ok) throw new Error(hurtData.error || "Failed to generate hurt");
      if (!deathRes.ok) throw new Error(deathData.error || "Failed to generate death");
      if (!specialRes.ok) throw new Error(specialData.error || "Failed to generate special");

      setAttackSheetUrl(attackData.imageUrl);
      setDashSheetUrl(dashData.imageUrl);
      setHurtSheetUrl(hurtData.imageUrl);
      setDeathSheetUrl(deathData.imageUrl);
      setSpecialSheetUrl(specialData.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate combat animations");
    } finally {
      setIsGeneratingCombat(false);
    }
  };

  const removeBackgrounds = async () => {
    setError(null);
    setIsRemovingBg(true);

    try {
      const sheetsToProcess = [
        { url: walkSheetUrl, key: 'walk' as const, setter: setWalkBgRemovedUrl },
        { url: idleSheetUrl, key: 'idle' as const, setter: setIdleBgRemovedUrl },
        { url: attackSheetUrl, key: 'attack' as const, setter: setAttackBgRemovedUrl },
        { url: dashSheetUrl, key: 'dash' as const, setter: setDashBgRemovedUrl },
        { url: hurtSheetUrl, key: 'hurt' as const, setter: setHurtBgRemovedUrl },
        { url: deathSheetUrl, key: 'death' as const, setter: setDeathBgRemovedUrl },
        { url: specialSheetUrl, key: 'special' as const, setter: setSpecialBgRemovedUrl },
      ].filter(s => s.url);

      const responses = await Promise.all(
        sheetsToProcess.map(({ url }) =>
          fetch("/api/remove-background", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: url }),
          })
        )
      );

      // Collect the processed URLs to pass directly to frame extraction
      const processedUrls: Record<string, string> = {};

      for (let i = 0; i < responses.length; i++) {
        const data = await responses[i].json();
        if (!responses[i].ok) {
          throw new Error(data.error || "Failed to remove background");
        }
        sheetsToProcess[i].setter(data.imageUrl);
        processedUrls[sheetsToProcess[i].key] = data.imageUrl;
      }

      // Extract frames using the URLs directly (not relying on state which is async)
      await extractAllFramesFromUrls(processedUrls);

      // Save all processed images to R2 if we have a creation
      if (creationId) {
        // Save in background - don't block UI
        saveProcessedImages(processedUrls, creationId).catch(e =>
          console.error("Failed to save processed images to R2:", e)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove backgrounds");
    } finally {
      setIsRemovingBg(false);
    }
  };

  // Extract frames from directional sprite sheet (4 rows)
  const extractDirectionalFrames = useCallback(async (
    imageUrl: string,
    columns: number
  ): Promise<DirectionalFrameSet> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const frameWidth = img.width / columns;
        const frameHeight = img.height / 4; // 4 directions

        const result: DirectionalFrameSet = {
          down: [],
          up: [],
          left: [],
          right: [],
        };

        for (let row = 0; row < 4; row++) {
          const direction = DIRECTION_ROW_ORDER[row];

          for (let col = 0; col < columns; col++) {
            const canvas = document.createElement("canvas");
            canvas.width = frameWidth;
            canvas.height = frameHeight;
            const ctx = canvas.getContext("2d")!;

            ctx.drawImage(
              img,
              col * frameWidth,
              row * frameHeight,
              frameWidth,
              frameHeight,
              0,
              0,
              frameWidth,
              frameHeight
            );

            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);

            result[direction].push({
              dataUrl: canvas.toDataURL("image/png"),
              x: col * frameWidth,
              y: row * frameHeight,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }

        resolve(result);
      };

      img.src = imageUrl;
    });
  }, []);

  // Extract frames from single-row sprite sheet
  const extractSingleRowFrames = useCallback(async (
    imageUrl: string,
    columns: number
  ): Promise<Frame[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const frameWidth = img.width / columns;
        const frameHeight = img.height;
        const frames: Frame[] = [];

        for (let col = 0; col < columns; col++) {
          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d")!;

          ctx.drawImage(
            img,
            col * frameWidth,
            0,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);

          frames.push({
            dataUrl: canvas.toDataURL("image/png"),
            x: col * frameWidth,
            y: 0,
            width: frameWidth,
            height: frameHeight,
            contentBounds,
          });
        }

        resolve(frames);
      };

      img.src = imageUrl;
    });
  }, []);

  // Extract frames from any grid (cols × rows)
  const extractGridFrames = useCallback(async (
    imageUrl: string,
    columns: number,
    rows: number
  ): Promise<Frame[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const frameWidth = img.width / columns;
        const frameHeight = img.height / rows;
        const frames: Frame[] = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            const canvas = document.createElement("canvas");
            canvas.width = frameWidth;
            canvas.height = frameHeight;
            const ctx = canvas.getContext("2d")!;

            ctx.drawImage(
              img,
              col * frameWidth,
              row * frameHeight,
              frameWidth,
              frameHeight,
              0,
              0,
              frameWidth,
              frameHeight
            );

            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);

            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: col * frameWidth,
              y: row * frameHeight,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }

        resolve(frames);
      };

      img.src = imageUrl;
    });
  }, []);

  // Extract frames using custom regions (any size/position)
  const extractCustomRegionFrames = useCallback(async (
    imageUrl: string,
    customRegions: CustomRegion[]
  ): Promise<Frame[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const frames: Frame[] = customRegions.map((region) => {
          const startX = Math.round((region.x / 100) * img.width);
          const startY = Math.round((region.y / 100) * img.height);
          const frameWidth = Math.round((region.width / 100) * img.width);
          const frameHeight = Math.round((region.height / 100) * img.height);

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d")!;

          ctx.drawImage(
            img,
            startX,
            startY,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);

          return {
            dataUrl: canvas.toDataURL("image/png"),
            x: startX,
            y: startY,
            width: frameWidth,
            height: frameHeight,
            contentBounds,
          };
        });

        resolve(frames);
      };

      img.src = imageUrl;
    });
  }, []);

  // Extract attack frames from combined sheet (3 rows)
  const extractCombinedAttackFrames = useCallback(async (
    imageUrl: string
  ): Promise<{ attack1: Frame[]; attack2: Frame[]; attack3: Frame[] }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const columns = 4;
        const frameWidth = img.width / columns;
        const frameHeight = img.height / 3;

        const result = {
          attack1: [] as Frame[],
          attack2: [] as Frame[],
          attack3: [] as Frame[],
        };

        const attackKeys: ('attack1' | 'attack2' | 'attack3')[] = ['attack1', 'attack2', 'attack3'];

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < columns; col++) {
            const canvas = document.createElement("canvas");
            canvas.width = frameWidth;
            canvas.height = frameHeight;
            const ctx = canvas.getContext("2d")!;

            ctx.drawImage(
              img,
              col * frameWidth,
              row * frameHeight,
              frameWidth,
              frameHeight,
              0,
              0,
              frameWidth,
              frameHeight
            );

            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);

            result[attackKeys[row]].push({
              dataUrl: canvas.toDataURL("image/png"),
              x: col * frameWidth,
              y: row * frameHeight,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }

        resolve(result);
      };

      img.src = imageUrl;
    });
  }, []);

  // Extract frames using divider positions (respects user adjustments)
  const extractFramesWithDividers = useCallback(async (
    imageUrl: string,
    verticalDividers: number[],
    horizontalDividers: number[]
  ): Promise<Frame[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const frames: Frame[] = [];
        const colPositions = [0, ...verticalDividers.map(p => (p / 100) * img.width), img.width];
        const rowPositions = [0, ...horizontalDividers.map(p => (p / 100) * img.height), img.height];

        for (let row = 0; row < rowPositions.length - 1; row++) {
          for (let col = 0; col < colPositions.length - 1; col++) {
            const startX = Math.round(colPositions[col]);
            const endX = Math.round(colPositions[col + 1]);
            const startY = Math.round(rowPositions[row]);
            const endY = Math.round(rowPositions[row + 1]);

            const frameWidth = endX - startX;
            const frameHeight = endY - startY;

            const canvas = document.createElement("canvas");
            canvas.width = frameWidth;
            canvas.height = frameHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);

            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);

            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
        resolve(frames);
      };
      img.src = imageUrl;
    });
  }, []);

  // Extract directional frames using dividers (for walk/idle with 4 rows)
  const extractDirectionalFramesWithDividers = useCallback(async (
    imageUrl: string,
    verticalDividers: number[],
    horizontalDividers: number[]
  ): Promise<DirectionalFrameSet> => {
    const frames = await extractFramesWithDividers(imageUrl, verticalDividers, horizontalDividers);
    const rows = horizontalDividers.length + 1;
    const cols = verticalDividers.length + 1;

    if (rows !== 4) {
      // Fall back to treating all frames as "right" direction
      return {
        down: [],
        up: [],
        left: [],
        right: frames,
      };
    }

    return {
      down: frames.slice(0, cols),
      up: frames.slice(cols, cols * 2),
      left: frames.slice(cols * 2, cols * 3),
      right: frames.slice(cols * 3, cols * 4),
    };
  }, [extractFramesWithDividers]);

  // Extract attack frames using dividers (for combined sheet with 3 rows)
  const extractAttackFramesWithDividers = useCallback(async (
    imageUrl: string,
    verticalDividers: number[],
    horizontalDividers: number[]
  ): Promise<{ attack1: Frame[]; attack2: Frame[]; attack3: Frame[] }> => {
    const frames = await extractFramesWithDividers(imageUrl, verticalDividers, horizontalDividers);
    const rows = horizontalDividers.length + 1;
    const cols = verticalDividers.length + 1;

    if (rows !== 3) {
      // Fall back to all frames as attack1
      return {
        attack1: frames,
        attack2: [],
        attack3: [],
      };
    }

    return {
      attack1: frames.slice(0, cols),
      attack2: frames.slice(cols, cols * 2),
      attack3: frames.slice(cols * 2, cols * 3),
    };
  }, [extractFramesWithDividers]);

  const extractAllFrames = useCallback(async () => {
    // Extract walk frames (6 columns, 4 rows)
    if (walkBgRemovedUrl) {
      const frames = await extractDirectionalFrames(walkBgRemovedUrl, 6);
      setWalkFrames(frames);
    }

    // Extract idle frames (4 columns, 4 rows)
    if (idleBgRemovedUrl) {
      const frames = await extractDirectionalFrames(idleBgRemovedUrl, 4);
      setIdleFrames(frames);
    }

    // Extract attack frames (combined sheet)
    if (attackBgRemovedUrl) {
      const { attack1, attack2, attack3 } = await extractCombinedAttackFrames(attackBgRemovedUrl);
      setAttack1Frames(attack1);
      setAttack2Frames(attack2);
      setAttack3Frames(attack3);
    }

    // Extract single-row combat frames
    if (dashBgRemovedUrl) {
      const frames = await extractSingleRowFrames(dashBgRemovedUrl, 4);
      setDashFrames(frames);
    }

    if (hurtBgRemovedUrl) {
      const frames = await extractSingleRowFrames(hurtBgRemovedUrl, 3);
      setHurtFrames(frames);
    }

    if (deathBgRemovedUrl) {
      const frames = await extractSingleRowFrames(deathBgRemovedUrl, 8);
      setDeathFrames(frames);
    }

    if (specialBgRemovedUrl) {
      const frames = await extractSingleRowFrames(specialBgRemovedUrl, 10);
      setSpecialFrames(frames);
    }
  }, [
    walkBgRemovedUrl,
    idleBgRemovedUrl,
    attackBgRemovedUrl,
    dashBgRemovedUrl,
    hurtBgRemovedUrl,
    deathBgRemovedUrl,
    specialBgRemovedUrl,
    extractDirectionalFrames,
    extractSingleRowFrames,
    extractCombinedAttackFrames,
  ]);

  // Extract frames using URLs directly (bypasses async state issue)
  // Uses gridConfigs dividers if available, otherwise falls back to hardcoded column counts
  const extractAllFramesFromUrls = useCallback(async (urls: Record<string, string>) => {
    // Extract walk frames - use dividers if available
    if (urls.walk) {
      const config = gridConfigs.walk;
      if (config.verticalDividers.length > 0 || config.horizontalDividers.length > 0) {
        const frames = await extractDirectionalFramesWithDividers(urls.walk, config.verticalDividers, config.horizontalDividers);
        setWalkFrames(frames);
      } else {
        const frames = await extractDirectionalFrames(urls.walk, config.cols);
        setWalkFrames(frames);
      }
    }

    // Extract idle frames - use dividers if available
    if (urls.idle) {
      const config = gridConfigs.idle;
      if (config.verticalDividers.length > 0 || config.horizontalDividers.length > 0) {
        const frames = await extractDirectionalFramesWithDividers(urls.idle, config.verticalDividers, config.horizontalDividers);
        setIdleFrames(frames);
      } else {
        const frames = await extractDirectionalFrames(urls.idle, config.cols);
        setIdleFrames(frames);
      }
    }

    // Extract attack frames - use dividers if available
    if (urls.attack) {
      const config = gridConfigs.attack;
      if (config.verticalDividers.length > 0 || config.horizontalDividers.length > 0) {
        const { attack1, attack2, attack3 } = await extractAttackFramesWithDividers(urls.attack, config.verticalDividers, config.horizontalDividers);
        setAttack1Frames(attack1);
        setAttack2Frames(attack2);
        setAttack3Frames(attack3);
      } else {
        const { attack1, attack2, attack3 } = await extractCombinedAttackFrames(urls.attack);
        setAttack1Frames(attack1);
        setAttack2Frames(attack2);
        setAttack3Frames(attack3);
      }
    }

    // Extract single-row combat frames - use custom regions or dividers if available
    if (urls.dash) {
      const config = gridConfigs.dash;
      if (config.mode === "custom" && config.customRegions && config.customRegions.length > 0) {
        const frames = await extractCustomRegionFrames(urls.dash, config.customRegions);
        setDashFrames(frames);
      } else if (config.verticalDividers.length > 0) {
        const frames = await extractFramesWithDividers(urls.dash, config.verticalDividers, config.horizontalDividers);
        setDashFrames(frames);
      } else {
        const frames = await extractSingleRowFrames(urls.dash, config.cols);
        setDashFrames(frames);
      }
    }

    if (urls.hurt) {
      const config = gridConfigs.hurt;
      if (config.mode === "custom" && config.customRegions && config.customRegions.length > 0) {
        const frames = await extractCustomRegionFrames(urls.hurt, config.customRegions);
        setHurtFrames(frames);
      } else if (config.verticalDividers.length > 0) {
        const frames = await extractFramesWithDividers(urls.hurt, config.verticalDividers, config.horizontalDividers);
        setHurtFrames(frames);
      } else {
        const frames = await extractSingleRowFrames(urls.hurt, config.cols);
        setHurtFrames(frames);
      }
    }

    if (urls.death) {
      const config = gridConfigs.death;
      // Use custom regions if available
      if (config.mode === "custom" && config.customRegions && config.customRegions.length > 0) {
        const frames = await extractCustomRegionFrames(urls.death, config.customRegions);
        setDeathFrames(frames);
      } else if (config.verticalDividers.length > 0) {
        const frames = await extractFramesWithDividers(urls.death, config.verticalDividers, config.horizontalDividers);
        setDeathFrames(frames);
      } else {
        // Use extractGridFrames for multi-row grids (default 4x2)
        const frames = await extractGridFrames(urls.death, config.cols, config.rows);
        setDeathFrames(frames);
      }
    }

    if (urls.special) {
      const config = gridConfigs.special;
      // Use custom regions if available
      if (config.mode === "custom" && config.customRegions && config.customRegions.length > 0) {
        const frames = await extractCustomRegionFrames(urls.special, config.customRegions);
        setSpecialFrames(frames);
      } else if (config.verticalDividers.length > 0) {
        const frames = await extractFramesWithDividers(urls.special, config.verticalDividers, config.horizontalDividers);
        setSpecialFrames(frames);
      } else {
        // Use extractGridFrames for multi-row grids (default 6x2)
        const frames = await extractGridFrames(urls.special, config.cols, config.rows);
        setSpecialFrames(frames);
      }
    }
  }, [gridConfigs, extractDirectionalFrames, extractDirectionalFramesWithDividers, extractSingleRowFrames, extractCombinedAttackFrames, extractAttackFramesWithDividers, extractFramesWithDividers, extractGridFrames, extractCustomRegionFrames]);

  // Helper function to upload image to R2 and save record
  const saveImageToR2 = useCallback(async (
    imageUrl: string,
    imageType: string,
    creationIdToUse: Id<"creations">,
    width: number = 512,
    height: number = 512
  ) => {
    try {
      // Upload to R2
      const { key } = await uploadFromUrl({
        creationId: creationIdToUse,
        imageType,
        sourceUrl: imageUrl,
      });

      // Save record to database
      await saveImageRecord({
        creationId: creationIdToUse,
        imageType,
        r2Key: key,
        originalUrl: imageUrl,
        width,
        height,
      });

      return key;
    } catch (e) {
      console.error(`Failed to save ${imageType} to R2:`, e);
      return null;
    }
  }, [uploadFromUrl, saveImageRecord]);

  // Create and save a thumbnail from character image
  const saveThumbnail = useCallback(async (
    imageUrl: string,
    creationIdToUse: Id<"creations">
  ) => {
    try {
      // Create a thumbnail (128x128) from the character image
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;

      // Scale and center the image
      const scale = Math.min(128 / img.width, 128 / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (128 - scaledWidth) / 2;
      const y = (128 - scaledHeight) / 2;

      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
          "image/png"
        );
      });

      // Get upload URL and upload
      const { url, key } = await getThumbnailUploadUrl({
        creationId: creationIdToUse,
      });

      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "image/png",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload thumbnail: ${uploadResponse.statusText}`);
      }

      // Save record
      await saveThumbnailRecord({
        creationId: creationIdToUse,
        r2Key: key,
        width: 128,
        height: 128,
      });
    } catch (e) {
      console.error("Failed to save thumbnail:", e);
    }
  }, [getThumbnailUploadUrl, saveThumbnailRecord]);

  // Create a new creation record when starting
  const createNewCreation = useCallback(async () => {
    if (!selectedPreset || !sessionId) return null;

    try {
      const id = await createCreation({
        presetId: selectedPreset.id,
        presetName: selectedPreset.name,
        customPrompt: isCustomPreset(selectedPreset) ? customPrompt : undefined,
        characterName: selectedPreset.id === "custom" ? "custom-character" : selectedPreset.id,
        sessionId,
      });
      setCreationId(id);
      return id;
    } catch (e) {
      console.error("Failed to create creation:", e);
      return null;
    }
  }, [selectedPreset, customPrompt, sessionId, createCreation]);

  // Save all processed images after background removal
  const saveProcessedImages = useCallback(async (
    processedUrls: Record<string, string>,
    creationIdToUse: Id<"creations">
  ) => {
    const savePromises: Promise<string | null>[] = [];

    if (processedUrls.walk) {
      savePromises.push(saveImageToR2(processedUrls.walk, "walk_processed", creationIdToUse));
    }
    if (processedUrls.idle) {
      savePromises.push(saveImageToR2(processedUrls.idle, "idle_processed", creationIdToUse));
    }
    if (processedUrls.attack) {
      savePromises.push(saveImageToR2(processedUrls.attack, "attack_processed", creationIdToUse));
    }
    if (processedUrls.dash) {
      savePromises.push(saveImageToR2(processedUrls.dash, "dash_processed", creationIdToUse));
    }
    if (processedUrls.hurt) {
      savePromises.push(saveImageToR2(processedUrls.hurt, "hurt_processed", creationIdToUse));
    }
    if (processedUrls.death) {
      savePromises.push(saveImageToR2(processedUrls.death, "death_processed", creationIdToUse));
    }
    if (processedUrls.special) {
      savePromises.push(saveImageToR2(processedUrls.special, "special_processed", creationIdToUse));
    }

    await Promise.all(savePromises);
  }, [saveImageToR2]);

  // Reset all state
  const resetAll = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setSelectedPreset(null);
    setCustomPrompt("");
    setCharacterName("character");
    setCharacterImageUrl(null);
    setWalkSheetUrl(null);
    setWalkBgRemovedUrl(null);
    setIdleSheetUrl(null);
    setIdleBgRemovedUrl(null);
    setAttackSheetUrl(null);
    setAttackBgRemovedUrl(null);
    setDashSheetUrl(null);
    setDashBgRemovedUrl(null);
    setHurtSheetUrl(null);
    setHurtBgRemovedUrl(null);
    setDeathSheetUrl(null);
    setDeathBgRemovedUrl(null);
    setSpecialSheetUrl(null);
    setSpecialBgRemovedUrl(null);
    setWalkFrames(null);
    setIdleFrames(null);
    setAttack1Frames([]);
    setAttack2Frames([]);
    setAttack3Frames([]);
    setDashFrames([]);
    setHurtFrames([]);
    setDeathFrames([]);
    setSpecialFrames([]);
    setError(null);
    setCreationId(null);
  }, []);

  // Confirmation before going home if work in progress
  const handleGoHome = useCallback(() => {
    if (currentStep > 1 && (characterImageUrl || walkSheetUrl || idleSheetUrl)) {
      if (confirm("You have unsaved progress. Return to start?")) {
        resetAll();
      }
    } else {
      resetAll();
    }
  }, [currentStep, characterImageUrl, walkSheetUrl, idleSheetUrl, resetAll]);

  // Navigate to a completed or current step
  const navigateToStep = useCallback((targetStep: Step) => {
    if (completedSteps.has(targetStep) || targetStep <= currentStep) {
      setCurrentStep(targetStep);
    }
  }, [completedSteps, currentStep]);

  // Load a creation from history
  const loadCreation = useCallback(async (
    creation: {
      _id: Id<"creations">;
      presetId: string;
      presetName: string;
      customPrompt?: string;
      characterName: string;
      currentStep: number;
      completedSteps: number[];
    },
    imageUrls: Record<string, string>
  ) => {
    // Reset current state first
    resetAll();

    // Set creation ID
    setCreationId(creation._id);

    // Restore preset
    const preset = getPresetById(creation.presetId);
    if (preset) {
      setSelectedPreset(preset);
      if (creation.customPrompt) {
        setCustomPrompt(creation.customPrompt);
      }
    }

    // Restore character name
    setCharacterName(creation.characterName);

    // Restore step progress
    setCurrentStep(creation.currentStep as Step);
    setCompletedSteps(new Set(creation.completedSteps));

    // Restore image URLs and extract frames
    if (imageUrls.character) {
      setCharacterImageUrl(imageUrls.character);
    }

    // For processed images, set the bg-removed URLs and extract frames
    const processedUrls: Record<string, string> = {};

    if (imageUrls.walk_processed) {
      setWalkBgRemovedUrl(imageUrls.walk_processed);
      processedUrls.walk = imageUrls.walk_processed;
    }
    if (imageUrls.idle_processed) {
      setIdleBgRemovedUrl(imageUrls.idle_processed);
      processedUrls.idle = imageUrls.idle_processed;
    }
    if (imageUrls.attack_processed) {
      setAttackBgRemovedUrl(imageUrls.attack_processed);
      processedUrls.attack = imageUrls.attack_processed;
    }
    if (imageUrls.dash_processed) {
      setDashBgRemovedUrl(imageUrls.dash_processed);
      processedUrls.dash = imageUrls.dash_processed;
    }
    if (imageUrls.hurt_processed) {
      setHurtBgRemovedUrl(imageUrls.hurt_processed);
      processedUrls.hurt = imageUrls.hurt_processed;
    }
    if (imageUrls.death_processed) {
      setDeathBgRemovedUrl(imageUrls.death_processed);
      processedUrls.death = imageUrls.death_processed;
    }
    if (imageUrls.special_processed) {
      setSpecialBgRemovedUrl(imageUrls.special_processed);
      processedUrls.special = imageUrls.special_processed;
    }

    // Extract frames from loaded images
    if (Object.keys(processedUrls).length > 0) {
      await extractAllFramesFromUrls(processedUrls);
    }

    // Close sidebar after loading
    setIsHistoryOpen(false);
  }, [extractAllFramesFromUrls, resetAll]);

  // Load a creation and jump directly to preview/export for viewing
  const loadCreationForViewing = useCallback(async (
    creation: {
      _id: Id<"creations">;
      presetId: string;
      presetName: string;
      customPrompt?: string;
      characterName: string;
      currentStep: number;
      completedSteps: number[];
    },
    imageUrls: Record<string, string>
  ) => {
    // Use the regular loadCreation to restore state
    await loadCreation(creation, imageUrls);

    // Then jump to the appropriate viewing step
    // Step 5 is Preview, Step 6 is Export
    if (creation.completedSteps.includes(5) || creation.completedSteps.includes(4)) {
      setCurrentStep(5);
    } else if (creation.completedSteps.includes(6)) {
      setCurrentStep(6);
    }
  }, [loadCreation]);

  // Navigation helpers
  const completeStepAndAdvance = useCallback(async (fromStep: number, toStep: Step) => {
    const newCompletedSteps = new Set([...completedSteps, fromStep]);
    setCompletedSteps(newCompletedSteps);
    setCurrentStep(toStep);

    // Update progress in Convex if we have a creation
    if (creationId) {
      try {
        await updateProgress({
          creationId,
          currentStep: toStep,
          completedSteps: Array.from(newCompletedSteps),
        });
      } catch (e) {
        console.error("Failed to update progress:", e);
      }
    }
  }, [completedSteps, creationId, updateProgress]);

  // Handle ImageStudio completion - set all the generated sprite URLs
  const handleImageStudioComplete = useCallback((results: Record<string, string>) => {
    // Map the API types to state setters
    if (results["walk-full"]) setWalkSheetUrl(results["walk-full"]);
    if (results["idle-full"]) setIdleSheetUrl(results["idle-full"]);
    if (results["attack-combined"]) setAttackSheetUrl(results["attack-combined"]);
    if (results["dash"]) setDashSheetUrl(results["dash"]);
    if (results["hurt"]) setHurtSheetUrl(results["hurt"]);
    if (results["death"]) setDeathSheetUrl(results["death"]);
    if (results["special"]) setSpecialSheetUrl(results["special"]);
    
    // Advance to processing step (Step 4)
    completeStepAndAdvance(3, 4);
  }, [completeStepAndAdvance]);

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2: return !!selectedPreset && (isCustomPreset(selectedPreset) ? !!customPrompt.trim() : true);
      case 3: return !!characterImageUrl;
      case 4: return walkSheetUrl !== null || idleSheetUrl !== null; // Can proceed to processing if any sheets exist
      case 5: return walkBgRemovedUrl !== null || idleBgRemovedUrl !== null; // Can preview after bg removal
      case 6: return walkFrames !== null || idleFrames !== null; // Can export after frames extracted
      default: return true;
    }
  };

  return (
    <main className={`max-w-container mx-auto p-8 min-h-screen transition-all duration-300 ${isHistoryOpen ? "ml-80 max-md:ml-0" : ""}`}>
      <header className="text-center mb-10">
        <div className="flex items-center justify-between w-full mb-2">
          <button
            className="w-10 h-10 p-0 bg-surface-elevated border border-stroke-hover rounded-lg text-content-primary flex items-center justify-center transition-all hover:bg-fal-purple-deep hover:border-fal-purple-deep"
            onClick={handleGoHome}
            title="Return to Start"
            aria-label="Return to Start"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <FalLogo size={36} />
            <h1 className="m-0 text-2xl font-semibold text-content-primary">Ichigo Sprite Creator</h1>
          </div>
          <button
            className="w-10 h-10 p-0 bg-surface-elevated border border-stroke-hover rounded-lg text-content-primary flex items-center justify-center transition-all hover:bg-fal-purple-deep hover:border-fal-purple-deep"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title="History"
            aria-label="Toggle History"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
        </div>
        <p className="text-content-secondary m-0">Create sprite sheets for Ichigo Journey using fal.ai</p>
      </header>

      {/* Steps indicator */}
      <div className="flex justify-center gap-3 mb-10">
        {[1, 2, 3, 4, 5, 6].map((step) => {
          const isCompleted = completedSteps.has(step);
          const isCurrent = currentStep === step;
          const isClickable = isCompleted || step < currentStep;

          return (
            <div
              key={step}
              className={`w-2.5 h-2.5 rounded-full border transition-all ${
                isCurrent
                  ? "bg-fal-purple-light border-fal-purple-light"
                  : isCompleted
                  ? "bg-green-500 border-green-500"
                  : "bg-surface-tertiary border-stroke"
              } ${isClickable ? "cursor-pointer hover:scale-[1.3] hover:shadow-[0_0_8px_#ab77ff]" : ""}`}
              title={getStepTitle(step)}
              onClick={() => isClickable && navigateToStep(step as Step)}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : -1}
              onKeyDown={(e) => {
                if (isClickable && (e.key === "Enter" || e.key === " ")) {
                  navigateToStep(step as Step);
                }
              }}
            />
          );
        })}
      </div>

      {error && (
        <div className="bg-fal-red/[0.08] border border-fal-red/30 text-fal-red p-3.5 rounded-md my-4 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select Character */}
      {currentStep === 1 && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">1</span>
            Select Character
          </h2>

          <CharacterPresets
            selectedPreset={selectedPreset}
            onSelectPreset={setSelectedPreset}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />

          <div className="flex gap-3 justify-end mt-6 flex-wrap">
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={async () => {
                // Create a new creation record when advancing from step 1
                const newCreationId = await createNewCreation();
                if (newCreationId) {
                  completeStepAndAdvance(1, 2);
                } else {
                  // Still advance even if save fails
                  completeStepAndAdvance(1, 2);
                }
              }}
              disabled={!canProceedToStep(2)}
            >
              Continue to Generation
            </button>
          </div>

          {/* Recent Creations Gallery */}
          <RecentCreationsGallery
            onContinue={loadCreation}
            onViewOutput={loadCreationForViewing}
            currentCreationId={creationId}
            onOpenHistory={() => setIsHistoryOpen(true)}
          />
        </div>
      )}

      {/* Step 2: Generate Base Character */}
      {currentStep === 2 && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">2</span>
            Generate Base Character
          </h2>

          <p className="text-content-secondary text-[0.95rem] leading-relaxed mb-5">
            Generate a base character image that will be used to create all animations.
          </p>

          <div className="flex gap-3 justify-end mt-6 flex-wrap">
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-purple-deep text-white hover:bg-fal-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={generateCharacter}
              disabled={isGeneratingCharacter}
            >
              {isGeneratingCharacter ? "Generating..." : "Generate Character"}
            </button>
          </div>

          {isGeneratingCharacter && (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-content-secondary">
              <FalSpinner />
              <span className="text-sm">Creating your character...</span>
            </div>
          )}

          {characterImageUrl && (
            <>
              <div className="mt-5 p-4 bg-surface-tertiary rounded-lg border border-stroke flex justify-center">
                <img src={characterImageUrl} alt="Generated character" className="max-w-full max-h-96 rounded-lg" />
              </div>

              <div className="flex gap-3 justify-end mt-6 flex-wrap">
                <button
                  className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
                  onClick={() => setCurrentStep(1)}
                >
                  Back
                </button>
                <button
                  className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
                  onClick={generateCharacter}
                  disabled={isGeneratingCharacter}
                >
                  Regenerate
                </button>
                <button
                  className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => completeStepAndAdvance(2, 3)}
                >
                  Use This Character
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Image Studio - Generate All Animations */}
      {currentStep === 3 && characterImageUrl && (
        <ImageStudio
          characterImageUrl={characterImageUrl}
          characterDescription={getCharacterDescription()}
          onComplete={handleImageStudioComplete}
          initialImages={{
            "walk-full": walkSheetUrl || undefined,
            "idle-full": idleSheetUrl || undefined,
            "attack-combined": attackSheetUrl || undefined,
            "dash": dashSheetUrl || undefined,
            "hurt": hurtSheetUrl || undefined,
            "death": deathSheetUrl || undefined,
            "special": specialSheetUrl || undefined,
          }}
        />
      )}

      {/* Step 4: Processing - Grid Adjustment */}
      {currentStep === 4 && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">4</span>
            Processing - Grid Adjustment
          </h2>

          <p className="text-content-secondary text-[0.95rem] leading-relaxed mb-5">
            Verify and adjust frame boundaries before background removal.
            Drag the purple (column) and pink (row) dividers to fine-tune.
          </p>

          {/* Tab buttons for switching between sheets */}
          <div className="flex flex-wrap gap-2 mb-5">
            {walkSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "walk"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("walk")}
              >
                Walk <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">6x4</span>
              </button>
            )}
            {idleSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "idle"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("idle")}
              >
                Idle <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x4</span>
              </button>
            )}
            {attackSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "attack"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("attack")}
              >
                Attack <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x3</span>
              </button>
            )}
            {dashSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "dash"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("dash")}
              >
                Dash <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x1</span>
              </button>
            )}
            {hurtSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "hurt"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("hurt")}
              >
                Hurt <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">3x1</span>
              </button>
            )}
            {deathSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "death"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("death")}
              >
                Death <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x2</span>
              </button>
            )}
            {specialSheetUrl && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition-all ${
                  activeGridSheet === "special"
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover"
                }`}
                onClick={() => setActiveGridSheet("special")}
              >
                Special <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">6x2</span>
              </button>
            )}
          </div>

          {/* Grid editors */}
          <div className="flex flex-col gap-4">
            {activeGridSheet === "walk" && walkSheetUrl && (
              <FrameExtractorEditor
                imageUrl={walkSheetUrl}
                animationType="walk"
                initialCols={gridConfigs.walk.cols}
                initialRows={gridConfigs.walk.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, walk: config }));
                }}
              />
            )}
            {activeGridSheet === "idle" && idleSheetUrl && (
              <FrameExtractorEditor
                imageUrl={idleSheetUrl}
                animationType="idle"
                initialCols={gridConfigs.idle.cols}
                initialRows={gridConfigs.idle.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, idle: config }));
                }}
              />
            )}
            {activeGridSheet === "attack" && attackSheetUrl && (
              <FrameExtractorEditor
                imageUrl={attackSheetUrl}
                animationType="attack"
                initialCols={gridConfigs.attack.cols}
                initialRows={gridConfigs.attack.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, attack: config }));
                }}
              />
            )}
            {activeGridSheet === "dash" && dashSheetUrl && (
              <FrameExtractorEditor
                imageUrl={dashSheetUrl}
                animationType="dash"
                initialCols={gridConfigs.dash.cols}
                initialRows={gridConfigs.dash.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, dash: config }));
                }}
              />
            )}
            {activeGridSheet === "hurt" && hurtSheetUrl && (
              <FrameExtractorEditor
                imageUrl={hurtSheetUrl}
                animationType="hurt"
                initialCols={gridConfigs.hurt.cols}
                initialRows={gridConfigs.hurt.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, hurt: config }));
                }}
              />
            )}
            {activeGridSheet === "death" && deathSheetUrl && (
              <FrameExtractorEditor
                imageUrl={deathSheetUrl}
                animationType="death"
                initialCols={gridConfigs.death.cols}
                initialRows={gridConfigs.death.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, death: config }));
                }}
              />
            )}
            {activeGridSheet === "special" && specialSheetUrl && (
              <FrameExtractorEditor
                imageUrl={specialSheetUrl}
                animationType="special"
                initialCols={gridConfigs.special.cols}
                initialRows={gridConfigs.special.rows}
                onFramesExtracted={() => {}}
                onGridConfigChange={(config) => {
                  setGridConfigs(prev => ({ ...prev, special: config }));
                }}
              />
            )}
          </div>

          <div className="flex gap-3 justify-end mt-6 flex-wrap">
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
              onClick={() => setCurrentStep(5)}
            >
              Back
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => removeBackgrounds()}
            >
              Remove Backgrounds & Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4 sub-step: Background Removal Status */}
      {currentStep === 4 && isRemovingBg && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">4</span>
            Removing Backgrounds
          </h2>

          <p className="text-content-secondary text-[0.95rem] leading-relaxed mb-5">
            Remove backgrounds from all sprite sheets for transparent PNGs.
          </p>

          <div className="flex gap-3 justify-end mt-6 flex-wrap">
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-purple-deep text-white hover:bg-fal-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={removeBackgrounds}
              disabled={isRemovingBg}
            >
              {isRemovingBg ? "Processing..." : "Remove All Backgrounds"}
            </button>
          </div>

          {isRemovingBg && (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-content-secondary">
              <FalSpinner />
              <span className="text-sm">Removing backgrounds and extracting frames...</span>
            </div>
          )}

          {(walkBgRemovedUrl || idleBgRemovedUrl || attackBgRemovedUrl || dashBgRemovedUrl || hurtBgRemovedUrl || deathBgRemovedUrl || specialBgRemovedUrl) && (
            <>
              {/* Directional animations */}
              <div className="grid grid-cols-2 gap-4 mt-4 max-md:grid-cols-1">
                {walkBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Walk (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={walkBgRemovedUrl} alt="Walk transparent" className="max-w-full max-h-48 rounded-lg" />
                    </div>
                  </div>
                )}
                {idleBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Idle (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={idleBgRemovedUrl} alt="Idle transparent" className="max-w-full max-h-48 rounded-lg" />
                    </div>
                  </div>
                )}
              </div>

              {/* Combat animations */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mt-4">
                {attackBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Attack (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={attackBgRemovedUrl} alt="Attack transparent" className="max-w-full max-h-32 rounded-lg" />
                    </div>
                  </div>
                )}
                {dashBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Dash (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={dashBgRemovedUrl} alt="Dash transparent" className="max-w-full max-h-32 rounded-lg" />
                    </div>
                  </div>
                )}
                {hurtBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Hurt (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={hurtBgRemovedUrl} alt="Hurt transparent" className="max-w-full max-h-32 rounded-lg" />
                    </div>
                  </div>
                )}
                {deathBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Death (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={deathBgRemovedUrl} alt="Death transparent" className="max-w-full max-h-32 rounded-lg" />
                    </div>
                  </div>
                )}
                {specialBgRemovedUrl && (
                  <div>
                    <h4 className="text-[0.85rem] text-content-secondary mb-2">Special (Transparent)</h4>
                    <div className="p-4 rounded-lg border border-stroke flex justify-center m-0 checkerboard">
                      <img src={specialBgRemovedUrl} alt="Special transparent" className="max-w-full max-h-32 rounded-lg" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-6 flex-wrap">
                <button
                  className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
                  onClick={() => setCurrentStep(4)}
                >
                  Back
                </button>
                <button
                  className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => completeStepAndAdvance(4, 5)}
                >
                  Preview & Export
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Preview in Sandbox */}
      {currentStep === 5 && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">5</span>
            Preview in Sandbox
          </h2>

          <p className="text-content-secondary text-[0.95rem] leading-relaxed mb-5">
            Test your character animations. Use WASD to move, J to attack, K to dash.
          </p>

          {/* Character preview and sandbox side by side */}
          <div className="flex gap-6 items-start flex-wrap">
            {/* Character reference image */}
            {characterImageUrl && (
              <div className="flex flex-col items-center gap-2">
                <h4 className="text-sm text-content-secondary m-0">Character</h4>
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-surface-tertiary border border-stroke">
                  <img src={characterImageUrl} alt={characterName} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-content-tertiary">{characterName}</span>
              </div>
            )}

            {/* Sandbox */}
            <div className="flex-1 min-w-[500px] max-md:min-w-full">
              <div className="bg-surface-tertiary rounded-lg p-4 border border-stroke">
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center gap-4 p-10 text-content-secondary">
                    <FalSpinner />
                    <span className="text-sm">Loading sandbox...</span>
                  </div>
                }>
                  <PixiSandbox
                    idleDirectional={idleFrames || undefined}
                    walkDirectional={walkFrames || undefined}
                    attack1Frames={attack1Frames}
                    attack2Frames={attack2Frames}
                    attack3Frames={attack3Frames}
                    dashFrames={dashFrames}
                    hurtFrames={hurtFrames}
                    deathFrames={deathFrames}
                    specialFrames={specialFrames}
                    fps={fps}
                  />
                </Suspense>
              </div>

              <div className="mt-4 text-xs text-content-tertiary">
                <kbd>WASD</kbd> move | <kbd>J</kbd>/<kbd>Z</kbd> attack | <kbd>K</kbd>/<kbd>X</kbd> dash | <kbd>L</kbd>/<kbd>C</kbd> special | <kbd>H</kbd> hurt | <kbd>G</kbd> debug
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <label className="text-content-secondary text-sm">Animation Speed (FPS): {fps}</label>
            <input
              type="range"
              className="flex-1 max-w-xs"
              min={4}
              max={16}
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
            />
          </div>

          <div className="flex gap-3 justify-end mt-6 flex-wrap">
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
              onClick={() => setCurrentStep(4)}
            >
              Back
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => completeStepAndAdvance(5, 6)}
            >
              Export Sprites
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Export */}
      {currentStep === 6 && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">6</span>
            Export Sprites
          </h2>

          <ExportPanel
            characterName={characterName}
            idleFrames={idleFrames || undefined}
            walkFrames={walkFrames || undefined}
            attack1Frames={attack1Frames}
            attack2Frames={attack2Frames}
            attack3Frames={attack3Frames}
            dashFrames={dashFrames}
            hurtFrames={hurtFrames}
            deathFrames={deathFrames}
            specialFrames={specialFrames}
          />

          <div className="mt-6 p-4 bg-surface-tertiary rounded-lg">
            <h4 className="m-0 mb-2 text-content-primary">Usage in Ichigo Journey</h4>
            <p className="text-sm text-content-secondary m-0">
              Copy exported files to <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-fal-cyan">ichigo-journey/public/assets/sprites/characters/{characterName}/</code>
            </p>
          </div>

          <div className="flex gap-3 justify-end mt-6 flex-wrap">
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
              onClick={() => setCurrentStep(5)}
            >
              Back to Preview
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
              onClick={async () => {
                // Mark creation as completed before resetting
                if (creationId) {
                  try {
                    await markCompleted({ creationId });
                  } catch (e) {
                    console.error("Failed to mark creation as completed:", e);
                  }
                }
                resetAll();
              }}
            >
              Create New Character
            </button>
          </div>
        </div>
      )}

      {/* History Sidebar */}
      <HistorySidebar
        isOpen={isHistoryOpen}
        onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
        onLoadCreation={loadCreation}
        currentCreationId={creationId}
      />
    </main>
  );
}

function getStepTitle(step: number): string {
  const titles: Record<number, string> = {
    1: "Select Character",
    2: "Generate Base",
    3: "Image Studio",
    4: "Processing",
    5: "Preview",
    6: "Export",
  };
  return titles[step] || "";
}
