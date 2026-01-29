"use client";

import { useState, useRef, useCallback, lazy, Suspense, useEffect, useMemo } from "react";
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
import MiniPixiSandbox from "./components/MiniPixiSandbox";
import ImageStudio from "./components/ImageStudio";
import { useSessionId } from "./components/ConvexClientProvider";

// New unified studio components
import { ImportTab } from "./components/import";
import { SpriteProcessorTab } from "./components/sprite-processor";
import AnimationSlotManager, {
  createEmptySlots,
  type AnimationSlot,
} from "./components/AnimationSlotManager";
import AnimationCreationFlow from "./components/AnimationCreationFlow";
import SettingsPanel, { type GameSettings } from "./components/SettingsPanel";
import DeployToGameButton from "./components/DeployToGameButton";

// Hooks
import { useCreationImages } from "./hooks/useCreationImages";

// Types and configs
import { CharacterPreset, Frame, DirectionalFrameSet8, createEmptyDirectionalFrameSet8 } from "./types";
import { buildCharacterPrompt, isCustomPreset, CHARACTER_PRESETS, getPresetById } from "./config/character-presets";
import { AnimationType, Direction8, ANIMATION_CONFIGS, DIRECTION_ROW_ORDER_8 } from "./config/animation-types";
import { getAnimationPrompt, getFullDirectionalSheetPrompt, COMBAT_ANIMATION_PROMPTS } from "./config/prompts";

// Dynamically import PixiSandbox to avoid SSR issues
const PixiSandbox = lazy(() => import("./components/PixiSandbox"));

type Step = 1 | 2 | 3 | 4 | 5 | 6;

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

// Default grid configurations for each animation type
const DEFAULT_GRID_CONFIGS: Record<string, GridConfig> = {
  walk: { cols: 6, rows: 4, verticalDividers: [], horizontalDividers: [] },
  idle: { cols: 4, rows: 4, verticalDividers: [], horizontalDividers: [] },
  attack: { cols: 4, rows: 3, verticalDividers: [], horizontalDividers: [] },
  dash: { cols: 4, rows: 1, verticalDividers: [], horizontalDividers: [] },
  hurt: { cols: 3, rows: 1, verticalDividers: [], horizontalDividers: [] },
  death: { cols: 4, rows: 2, verticalDividers: [], horizontalDividers: [] },
  special: { cols: 6, rows: 2, verticalDividers: [], horizontalDividers: [] },
};

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

  // Generation loading states
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);

  // Extracted frames
  const [walkFrames, setWalkFrames] = useState<DirectionalFrameSet8 | null>(null);
  const [idleFrames, setIdleFrames] = useState<DirectionalFrameSet8 | null>(null);
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
  const [gridSaveMessage, setGridSaveMessage] = useState<string | null>(null);

  // Grid adjustment state (Step 4)
  const [activeGridSheet, setActiveGridSheet] = useState<"walk" | "idle" | "attack" | "dash" | "hurt" | "death" | "special">("walk");
  const [gridConfigs, setGridConfigs] = useState<Record<string, GridConfig>>({ ...DEFAULT_GRID_CONFIGS });
  const [selectedAttack, setSelectedAttack] = useState<1 | 2 | 3>(1);

  // Per-animation custom prompts (Step 4)
  const [animationPrompts, setAnimationPrompts] = useState<Record<string, string>>({});
  const [regeneratingAnimations, setRegeneratingAnimations] = useState<Set<string>>(new Set());

  // History sidebar state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Top-level tabs: AI Generator | Sprite Processor
  const [mainTab, setMainTab] = useState<"ai-generator" | "sprite-processor">("ai-generator");
  // Sub-tabs within AI Generator
  const [aiSubTab, setAiSubTab] = useState<"generate" | "import" | "slots">("generate");

  // Animation slot state (Phase 5)
  const [animSlots, setAnimSlots] = useState<Record<AnimationType, AnimationSlot>>(createEmptySlots);
  const [activeCreationSlot, setActiveCreationSlot] = useState<AnimationType | null>(null);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    gamePath: "",
    characterName: "ichigo",
    isValid: false,
  });

  // Convex state
  const [creationId, setCreationId] = useState<Id<"creations"> | null>(null);
  const sessionId = useSessionId();

  // Get all image URLs from Convex (reactive)
  const { imageUrls, isLoading: isLoadingImages } = useCreationImages(creationId);

  // Derive image URLs from Convex query (replaces useState for URLs)
  const characterImageUrl = imageUrls.character || null;
  const walkSheetUrl = imageUrls.walk_raw || null;
  const walkBgRemovedUrl = imageUrls.walk_processed || null;
  const idleSheetUrl = imageUrls.idle_raw || null;
  const idleBgRemovedUrl = imageUrls.idle_processed || null;
  const attackSheetUrl = imageUrls.attack_raw || null;
  const attackBgRemovedUrl = imageUrls.attack_processed || null;
  const dashSheetUrl = imageUrls.dash_raw || null;
  const dashBgRemovedUrl = imageUrls.dash_processed || null;
  const hurtSheetUrl = imageUrls.hurt_raw || null;
  const hurtBgRemovedUrl = imageUrls.hurt_processed || null;
  const deathSheetUrl = imageUrls.death_raw || null;
  const deathBgRemovedUrl = imageUrls.death_processed || null;
  const specialSheetUrl = imageUrls.special_raw || null;
  const specialBgRemovedUrl = imageUrls.special_processed || null;

  // Track if we've already extracted frames for this set of URLs
  const lastExtractedUrlsRef = useRef<string>("");

  // Convex mutations
  const createCreation = useMutation(api.creations.create);
  const updateProgress = useMutation(api.creations.updateProgress);
  const markCompleted = useMutation(api.creations.markCompleted);
  const saveGridConfigsMutation = useMutation(api.creations.saveGridConfigs);

  // Convex actions - fal.ai generation
  const generateCharacterAction = useAction(api.fal.generateCharacter);
  const generateSpriteSheetAction = useAction(api.fal.generateSpriteSheet);
  const removeBackgroundsAction = useAction(api.fal.removeBackgrounds);

  // Get character description for prompts
  const getCharacterDescription = useCallback(() => {
    if (!selectedPreset) return "";
    if (isCustomPreset(selectedPreset)) {
      return customPrompt;
    }
    return selectedPreset.prompt;
  }, [selectedPreset, customPrompt]);

  // Get default prompt for an animation type
  const getDefaultPromptForAnimation = useCallback((animationType: AnimationType): string => {
    const charDesc = getCharacterDescription();
    if (animationType === 'idle' || animationType === 'walk') {
      return getFullDirectionalSheetPrompt(charDesc, animationType);
    }
    return getAnimationPrompt(charDesc, animationType);
  }, [getCharacterDescription]);

  // Regenerate a single animation
  const regenerateAnimation = useCallback(async (animationType: AnimationType) => {
    if (!creationId || !characterImageUrl) {
      setError("Missing creation ID or character image");
      return;
    }

    setRegeneratingAnimations(prev => new Set(prev).add(animationType));
    setError(null);

    try {
      const charDesc = getCharacterDescription();
      const customPromptValue = animationPrompts[animationType];

      // Map animation type to the expected type string for the action
      let typeForAction: string = animationType;
      if (animationType === 'walk') {
        typeForAction = 'walk-full';
      } else if (animationType === 'idle') {
        typeForAction = 'idle-full';
      }

      await generateSpriteSheetAction({
        creationId,
        characterImageUrl,
        characterDescription: charDesc,
        type: typeForAction,
        customPrompt: customPromptValue || undefined,
      });

      // The image URL will be updated automatically via the Convex query
    } catch (err) {
      console.error(`Failed to regenerate ${animationType}:`, err);
      setError(`Failed to regenerate ${animationType}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setRegeneratingAnimations(prev => {
        const next = new Set(prev);
        next.delete(animationType);
        return next;
      });
    }
  }, [creationId, characterImageUrl, getCharacterDescription, animationPrompts, generateSpriteSheetAction]);

  // Handle animation prompt change
  const handleAnimationPromptChange = useCallback((animationType: string, prompt: string) => {
    setAnimationPrompts(prev => ({ ...prev, [animationType]: prompt }));
  }, []);

  // Track the previous active tab to save when switching tabs
  const previousActiveTabRef = useRef<string>(activeGridSheet);

  // Save grid configs manually or when tab changes
  const saveGridConfigs = useCallback(async (showMessage = false) => {
    if (!creationId) return;
    try {
      await saveGridConfigsMutation({
        creationId,
        gridConfigs,
      });
      if (showMessage) {
        setGridSaveMessage("Grid saved!");
        setTimeout(() => setGridSaveMessage(null), 2000);
      }
    } catch (e) {
      console.error("Failed to save grid configs:", e);
      if (showMessage) {
        setGridSaveMessage("Failed to save");
        setTimeout(() => setGridSaveMessage(null), 2000);
      }
    }
  }, [creationId, gridConfigs, saveGridConfigsMutation]);

  // Auto-save when switching tabs (save the previous tab's config)
  useEffect(() => {
    if (previousActiveTabRef.current !== activeGridSheet && creationId) {
      // Tab changed - save the configs
      saveGridConfigsMutation({
        creationId,
        gridConfigs,
      }).catch((e) => console.error("Failed to save grid configs:", e));
    }
    previousActiveTabRef.current = activeGridSheet;
  }, [activeGridSheet, creationId, gridConfigs, saveGridConfigsMutation]);

  // Generate character using Convex action (calls fal.ai and saves to R2)
  const generateCharacter = async () => {
    if (!selectedPreset) {
      setError("Please select a character preset");
      return;
    }

    if (!creationId) {
      setError("No creation found. Please start a new creation.");
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
      // Call Convex action - generates with fal.ai and saves to R2
      await generateCharacterAction({
        prompt,
        creationId,
      });

      // Set character name from preset
      setCharacterName(selectedPreset.id === 'custom' ? 'custom-character' : selectedPreset.id);

      // Image URL will be populated by useCreationImages hook automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate character");
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  // Remove backgrounds using Convex action (calls fal.ai and saves to R2)
  const removeBackgrounds = async () => {
    if (!creationId) {
      setError("No creation found");
      return;
    }

    // Save grid configs before proceeding
    await saveGridConfigs();

    setError(null);
    setIsRemovingBg(true);

    try {
      // Build list of images to process
      const imagesToProcess: Array<{ url: string; type: string }> = [];

      if (walkSheetUrl) imagesToProcess.push({ url: walkSheetUrl, type: 'walk' });
      if (idleSheetUrl) imagesToProcess.push({ url: idleSheetUrl, type: 'idle' });
      if (attackSheetUrl) imagesToProcess.push({ url: attackSheetUrl, type: 'attack' });
      if (dashSheetUrl) imagesToProcess.push({ url: dashSheetUrl, type: 'dash' });
      if (hurtSheetUrl) imagesToProcess.push({ url: hurtSheetUrl, type: 'hurt' });
      if (deathSheetUrl) imagesToProcess.push({ url: deathSheetUrl, type: 'death' });
      if (specialSheetUrl) imagesToProcess.push({ url: specialSheetUrl, type: 'special' });

      if (imagesToProcess.length === 0) {
        setError("No sprite sheets to process");
        return;
      }

      // Call Convex action - removes backgrounds and saves to R2
      const result = await removeBackgroundsAction({
        creationId,
        images: imagesToProcess,
      });

      if (!result.success) {
        const failedTypes = result.results
          .filter((r: { success: boolean }) => !r.success)
          .map((r: { type: string }) => r.type)
          .join(", ");
        throw new Error(`Failed to process: ${failedTypes}`);
      }

      // Processed images will be populated by useCreationImages hook
      // Frame extraction will be triggered by useEffect

      // Advance to step 5 after successful background removal
      await completeStepAndAdvance(4, 5);
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
  ): Promise<DirectionalFrameSet8> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onerror = (e) => {
        console.error("Failed to load image for frame extraction:", e);
        reject(new Error(`Failed to load image: ${imageUrl}`));
      };

      img.onload = () => {
        const frameWidth = img.width / columns;
        const frameHeight = img.height / 8; // 8 directions

        const result = createEmptyDirectionalFrameSet8();

        for (let row = 0; row < 8; row++) {
          const direction = DIRECTION_ROW_ORDER_8[row];

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

  // Extract directional frames using dividers (for walk/idle with 8 rows)
  const extractDirectionalFramesWithDividers = useCallback(async (
    imageUrl: string,
    verticalDividers: number[],
    horizontalDividers: number[]
  ): Promise<DirectionalFrameSet8> => {
    const frames = await extractFramesWithDividers(imageUrl, verticalDividers, horizontalDividers);
    const rows = horizontalDividers.length + 1;
    const cols = verticalDividers.length + 1;

    const result = createEmptyDirectionalFrameSet8();

    if (rows !== 8) {
      // Fall back: put all frames in the 'east' direction
      result.east = frames;
      return result;
    }

    for (let i = 0; i < 8; i++) {
      const direction = DIRECTION_ROW_ORDER_8[i];
      result[direction] = frames.slice(i * cols, (i + 1) * cols);
    }
    return result;
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

  // Auto-extract frames when processed URLs become available (reactive)
  useEffect(() => {
    // Build the current URLs key to detect changes
    const currentUrlsKey = [
      walkBgRemovedUrl,
      idleBgRemovedUrl,
      attackBgRemovedUrl,
      dashBgRemovedUrl,
      hurtBgRemovedUrl,
      deathBgRemovedUrl,
      specialBgRemovedUrl,
    ].filter(Boolean).join("|");

    // Skip if no processed URLs or if we've already extracted these
    if (!currentUrlsKey || currentUrlsKey === lastExtractedUrlsRef.current) {
      return;
    }

    // Build the URLs object for extraction
    const processedUrls: Record<string, string> = {};
    if (walkBgRemovedUrl) processedUrls.walk = walkBgRemovedUrl;
    if (idleBgRemovedUrl) processedUrls.idle = idleBgRemovedUrl;
    if (attackBgRemovedUrl) processedUrls.attack = attackBgRemovedUrl;
    if (dashBgRemovedUrl) processedUrls.dash = dashBgRemovedUrl;
    if (hurtBgRemovedUrl) processedUrls.hurt = hurtBgRemovedUrl;
    if (deathBgRemovedUrl) processedUrls.death = deathBgRemovedUrl;
    if (specialBgRemovedUrl) processedUrls.special = specialBgRemovedUrl;

    // Mark as extracted and run extraction
    lastExtractedUrlsRef.current = currentUrlsKey;
    extractAllFramesFromUrls(processedUrls).catch(console.error);
  }, [
    walkBgRemovedUrl,
    idleBgRemovedUrl,
    attackBgRemovedUrl,
    dashBgRemovedUrl,
    hurtBgRemovedUrl,
    deathBgRemovedUrl,
    specialBgRemovedUrl,
    extractAllFramesFromUrls,
  ]);

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

  // Reset all state
  const resetAll = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setSelectedPreset(null);
    setCustomPrompt("");
    setCharacterName("character");
    // Note: Image URLs are now derived from Convex query
    // Setting creationId to null clears all images
    setCreationId(null);
    // Clear extracted frames
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
    setGridConfigs({ ...DEFAULT_GRID_CONFIGS });
    // Reset frame extraction tracking
    lastExtractedUrlsRef.current = "";
  }, []);

  // Slot management
  const handleCreateSlot = useCallback((type: AnimationType) => {
    setAnimSlots((prev) => ({
      ...prev,
      [type]: { ...prev[type], status: "in-progress" as const },
    }));
    setActiveCreationSlot(type);
  }, []);

  const handleClearSlot = useCallback((type: AnimationType) => {
    setAnimSlots((prev) => ({
      ...prev,
      [type]: {
        type,
        status: "empty" as const,
        source: null,
        frames: [],
        directionalFrames: null,
      },
    }));
  }, []);

  const handleSlotComplete = useCallback(
    (
      type: AnimationType,
      frames: Frame[],
      directionalFrames: DirectionalFrameSet8 | null,
      source: "ai" | "import"
    ) => {
      setAnimSlots((prev) => ({
        ...prev,
        [type]: {
          type,
          status: "complete" as const,
          source,
          frames,
          directionalFrames,
        },
      }));
      setActiveCreationSlot(null);

      // Also update the main frame state so sandbox/export can use them
      const config = ANIMATION_CONFIGS[type];
      if (config.isDirectional && directionalFrames) {
        if (type === "walk") setWalkFrames(directionalFrames);
        if (type === "idle") setIdleFrames(directionalFrames);
      } else if (frames.length > 0) {
        switch (type) {
          case "attack1": setAttack1Frames(frames); break;
          case "attack2": setAttack2Frames(frames); break;
          case "attack3": setAttack3Frames(frames); break;
          case "dash": setDashFrames(frames); break;
          case "hurt": setHurtFrames(frames); break;
          case "death": setDeathFrames(frames); break;
          case "special": setSpecialFrames(frames); break;
        }
      }
    },
    []
  );

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
  // Note: Image URLs are now reactive via useCreationImages hook
  const loadCreation = useCallback(async (
    creation: {
      _id: Id<"creations">;
      presetId: string;
      presetName: string;
      customPrompt?: string;
      characterName: string;
      currentStep: number;
      completedSteps: number[];
      gridConfigs?: Record<string, GridConfig>;
    },
    _imageUrls: Record<string, string> // No longer used - URLs come from query
  ) => {
    // Reset current state first (but keep creationId null temporarily)
    resetAll();

    // Set creation ID - this triggers useCreationImages to fetch URLs
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

    // Restore grid configs if available
    if (creation.gridConfigs) {
      setGridConfigs(prev => ({
        ...prev,
        ...creation.gridConfigs,
      }));
    }

    // Restore step progress
    setCurrentStep(creation.currentStep as Step);
    setCompletedSteps(new Set(creation.completedSteps));

    // Close sidebar after loading
    setIsHistoryOpen(false);

    // Note: Image URLs will be populated automatically by useCreationImages hook
    // Frame extraction is handled by useEffect below
  }, [resetAll]);

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
      gridConfigs?: Record<string, GridConfig>;
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

  // Handle ImageStudio completion
  // Note: ImageStudio already saves images to R2, URLs will come from query
  const handleImageStudioComplete = useCallback((_results: Record<string, string>) => {
    // Advance to processing step (Step 4)
    // Images are already saved to R2 by ImageStudio
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
            <h1 className="m-0 text-2xl font-semibold text-content-primary">Ichigo Game Studio</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="w-10 h-10 p-0 bg-surface-elevated border border-stroke-hover rounded-lg text-content-primary flex items-center justify-center transition-all hover:bg-fal-purple-deep hover:border-fal-purple-deep"
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              aria-label="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
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
        </div>
        <p className="text-content-secondary m-0">Create and process game-ready sprite sheets</p>
      </header>

      {/* Top-level tab bar */}
      <div className="flex gap-1 mb-4 border-b border-stroke/30 pb-px">
        <button
          onClick={() => setMainTab("ai-generator")}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-colors ${
            mainTab === "ai-generator"
              ? "bg-surface-tertiary text-content-primary border-b-2 border-fal-purple-deep"
              : "text-content-tertiary hover:text-content-secondary"
          }`}
        >
          AI Generator
        </button>
        <button
          onClick={() => setMainTab("sprite-processor")}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-colors ${
            mainTab === "sprite-processor"
              ? "bg-surface-tertiary text-content-primary border-b-2 border-[#e63946]"
              : "text-content-tertiary hover:text-content-secondary"
          }`}
        >
          Sprite Processor
        </button>
      </div>

      {/* Sub-tab bar (only when AI Generator is active) */}
      {mainTab === "ai-generator" && (
        <div className="flex gap-1 mb-6 pb-px">
          {([
            { key: "generate" as const, label: "AI Generate" },
            { key: "import" as const, label: "Import" },
            { key: "slots" as const, label: "Slots" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAiSubTab(key)}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                aiSubTab === key
                  ? "bg-fal-purple-deep/20 text-fal-purple-light border border-fal-purple-deep/40"
                  : "text-content-tertiary hover:text-content-secondary hover:bg-surface-tertiary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ===== AI Generate Tab ===== */}
      {mainTab === "ai-generator" && aiSubTab === "generate" && (
      <>
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
          creationId={creationId}
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

          {/* Show indicator if processed images already exist */}
          {(walkBgRemovedUrl || idleBgRemovedUrl || attackBgRemovedUrl || dashBgRemovedUrl || hurtBgRemovedUrl || deathBgRemovedUrl || specialBgRemovedUrl) && (
            <div className="mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-400 font-medium text-sm m-0">Backgrounds already removed</p>
                  <p className="text-content-tertiary text-xs m-0">You can skip to preview or re-process with adjusted grid</p>
                </div>
              </div>
              <button
                className="px-4 py-2 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600"
                onClick={() => completeStepAndAdvance(4, 5)}
              >
                Skip to Preview
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          )}

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
                🚶 Walk <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">6x4</span>
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
                🧍 Idle <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x4</span>
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
                ⚔️ Attack <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x3</span>
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
                💨 Dash <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x1</span>
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
                😣 Hurt <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">3x1</span>
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
                💀 Death <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">4x2</span>
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
                ✨ Special <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">6x2</span>
              </button>
            )}
          </div>

          {/* Action buttons for current animation */}
          <div className="flex items-center gap-3 mb-4">
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                regeneratingAnimations.has(activeGridSheet)
                  ? "bg-fal-purple-deep/50 text-fal-purple-light cursor-not-allowed"
                  : "bg-fal-purple-deep text-white hover:bg-fal-purple-light"
              }`}
              onClick={() => regenerateAnimation(activeGridSheet as AnimationType)}
              disabled={regeneratingAnimations.has(activeGridSheet)}
            >
              {regeneratingAnimations.has(activeGridSheet) ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Regenerating...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Regenerate {activeGridSheet.charAt(0).toUpperCase() + activeGridSheet.slice(1)}
                </>
              )}
            </button>
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-tertiary text-content-secondary border border-stroke hover:border-stroke-hover flex items-center gap-1.5"
              onClick={() => {
                const prompt = getDefaultPromptForAnimation(activeGridSheet as AnimationType);
                const customPromptValue = animationPrompts[activeGridSheet];
                const displayPrompt = customPromptValue || prompt;
                alert(`Current prompt for ${activeGridSheet}:\n\n${displayPrompt.substring(0, 500)}...`);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              View Prompt
            </button>
          </div>

          {/* Grid editors with preview */}
          <div className="flex gap-6">
            {/* Grid Editor Column */}
            <div className="flex-1 min-w-0">
              {activeGridSheet === "walk" && walkSheetUrl && (
                <FrameExtractorEditor
                  key="walk"
                  imageUrl={walkSheetUrl}
                  animationType="walk"
                  initialCols={gridConfigs.walk.cols}
                  initialRows={gridConfigs.walk.rows}
                  initialVerticalDividers={gridConfigs.walk.verticalDividers}
                  initialHorizontalDividers={gridConfigs.walk.horizontalDividers}
                  initialCustomRegions={gridConfigs.walk.customRegions}
                  initialMode={gridConfigs.walk.mode}
                  onFramesExtracted={(frames) => setWalkFrames(frames as DirectionalFrameSet8)}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, walk: config }))}
                />
              )}
              {activeGridSheet === "idle" && idleSheetUrl && (
                <FrameExtractorEditor
                  key="idle"
                  imageUrl={idleSheetUrl}
                  animationType="idle"
                  initialCols={gridConfigs.idle.cols}
                  initialRows={gridConfigs.idle.rows}
                  initialVerticalDividers={gridConfigs.idle.verticalDividers}
                  initialHorizontalDividers={gridConfigs.idle.horizontalDividers}
                  initialCustomRegions={gridConfigs.idle.customRegions}
                  initialMode={gridConfigs.idle.mode}
                  onFramesExtracted={(frames) => setIdleFrames(frames as DirectionalFrameSet8)}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, idle: config }))}
                />
              )}
              {activeGridSheet === "attack" && attackSheetUrl && (
                <FrameExtractorEditor
                  key="attack"
                  imageUrl={attackSheetUrl}
                  animationType="attack"
                  initialCols={gridConfigs.attack.cols}
                  initialRows={gridConfigs.attack.rows}
                  initialVerticalDividers={gridConfigs.attack.verticalDividers}
                  initialHorizontalDividers={gridConfigs.attack.horizontalDividers}
                  initialCustomRegions={gridConfigs.attack.customRegions}
                  initialMode={gridConfigs.attack.mode}
                  onFramesExtracted={() => {}}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, attack: config }))}
                />
              )}
              {activeGridSheet === "dash" && dashSheetUrl && (
                <FrameExtractorEditor
                  key="dash"
                  imageUrl={dashSheetUrl}
                  animationType="dash"
                  initialCols={gridConfigs.dash.cols}
                  initialRows={gridConfigs.dash.rows}
                  initialVerticalDividers={gridConfigs.dash.verticalDividers}
                  initialHorizontalDividers={gridConfigs.dash.horizontalDividers}
                  initialCustomRegions={gridConfigs.dash.customRegions}
                  initialMode={gridConfigs.dash.mode}
                  onFramesExtracted={(frames) => setDashFrames(frames as Frame[])}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, dash: config }))}
                />
              )}
              {activeGridSheet === "hurt" && hurtSheetUrl && (
                <FrameExtractorEditor
                  key="hurt"
                  imageUrl={hurtSheetUrl}
                  animationType="hurt"
                  initialCols={gridConfigs.hurt.cols}
                  initialRows={gridConfigs.hurt.rows}
                  initialVerticalDividers={gridConfigs.hurt.verticalDividers}
                  initialHorizontalDividers={gridConfigs.hurt.horizontalDividers}
                  initialCustomRegions={gridConfigs.hurt.customRegions}
                  initialMode={gridConfigs.hurt.mode}
                  onFramesExtracted={(frames) => setHurtFrames(frames as Frame[])}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, hurt: config }))}
                />
              )}
              {activeGridSheet === "death" && deathSheetUrl && (
                <FrameExtractorEditor
                  key="death"
                  imageUrl={deathSheetUrl}
                  animationType="death"
                  initialCols={gridConfigs.death.cols}
                  initialRows={gridConfigs.death.rows}
                  initialVerticalDividers={gridConfigs.death.verticalDividers}
                  initialHorizontalDividers={gridConfigs.death.horizontalDividers}
                  initialCustomRegions={gridConfigs.death.customRegions}
                  initialMode={gridConfigs.death.mode}
                  onFramesExtracted={(frames) => setDeathFrames(frames as Frame[])}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, death: config }))}
                />
              )}
              {activeGridSheet === "special" && specialSheetUrl && (
                <FrameExtractorEditor
                  key="special"
                  imageUrl={specialSheetUrl}
                  animationType="special"
                  initialCols={gridConfigs.special.cols}
                  initialRows={gridConfigs.special.rows}
                  initialVerticalDividers={gridConfigs.special.verticalDividers}
                  initialHorizontalDividers={gridConfigs.special.horizontalDividers}
                  initialCustomRegions={gridConfigs.special.customRegions}
                  initialMode={gridConfigs.special.mode}
                  onFramesExtracted={(frames) => setSpecialFrames(frames as Frame[])}
                  onGridConfigChange={(config) => setGridConfigs(prev => ({ ...prev, special: config }))}
                />
              )}
            </div>

            {/* Preview Sandbox Column */}
            <div className="flex-shrink-0 w-[260px]">
              <div className="sticky top-4 bg-surface-tertiary/50 p-4 rounded-xl border border-stroke/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-content-primary">Preview</h4>
                  <span className="text-[10px] text-content-tertiary px-2 py-0.5 bg-surface-secondary rounded-full">
                    {activeGridSheet === "attack" ? `Attack ${selectedAttack}` : activeGridSheet}
                  </span>
                </div>

                {/* Attack selection buttons */}
                {activeGridSheet === "attack" && (
                  <div className="flex gap-1 mb-4 p-1 bg-surface-secondary rounded-lg">
                    {([1, 2, 3] as const).map((num) => (
                      <button
                        key={num}
                        onClick={() => setSelectedAttack(num)}
                        className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                          selectedAttack === num
                            ? "bg-fal-purple-deep text-white shadow-sm"
                            : "text-content-secondary hover:text-content-primary hover:bg-surface-tertiary"
                        }`}
                      >
                        A{num}
                      </button>
                    ))}
                  </div>
                )}

                <MiniPixiSandbox
                  animationType={
                    activeGridSheet === "attack"
                      ? (`attack${selectedAttack}` as AnimationType)
                      : activeGridSheet as AnimationType
                  }
                  frames={
                    activeGridSheet === "attack" ? (
                      selectedAttack === 1 ? (attack1Frames.length > 0 ? attack1Frames : undefined) :
                      selectedAttack === 2 ? (attack2Frames.length > 0 ? attack2Frames : undefined) :
                      (attack3Frames.length > 0 ? attack3Frames : undefined)
                    ) :
                    activeGridSheet === "dash" ? (dashFrames.length > 0 ? dashFrames : undefined) :
                    activeGridSheet === "hurt" ? (hurtFrames.length > 0 ? hurtFrames : undefined) :
                    activeGridSheet === "death" ? (deathFrames.length > 0 ? deathFrames : undefined) :
                    activeGridSheet === "special" ? (specialFrames.length > 0 ? specialFrames : undefined) :
                    undefined
                  }
                  directionalFrames={
                    activeGridSheet === "walk" ? (walkFrames || undefined) :
                    activeGridSheet === "idle" ? (idleFrames || undefined) :
                    undefined
                  }
                  width={228}
                  height={180}
                />

                <p className="mt-4 text-[11px] text-content-tertiary text-center leading-relaxed">
                  Use &quot;Preview&quot; tab in grid editor to extract frames
                </p>
              </div>
            </div>
          </div>

          {/* Loading overlay when removing backgrounds */}
          {isRemovingBg && (
            <div className="flex flex-col items-center justify-center gap-4 p-10 mt-6 bg-surface-tertiary rounded-lg border border-stroke text-content-secondary">
              <FalSpinner />
              <span className="text-sm">Removing backgrounds and preparing preview...</span>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6 flex-wrap items-center">
            {gridSaveMessage && (
              <span className={`text-sm ${gridSaveMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                {gridSaveMessage}
              </span>
            )}
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentStep(3)}
              disabled={isRemovingBg}
            >
              Back
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-surface-tertiary text-content-primary border border-stroke hover:bg-surface-elevated hover:border-stroke-hover disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => saveGridConfigs(true)}
              disabled={isRemovingBg}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save Grid
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => removeBackgrounds()}
              disabled={isRemovingBg}
            >
              {isRemovingBg ? "Processing..." : "Remove Backgrounds & Continue"}
            </button>
          </div>
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

          <div className="mt-6 p-4 bg-surface-tertiary rounded-lg flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="m-0 mb-1 text-content-primary">Deploy to Game</h4>
              <p className="text-sm text-content-secondary m-0">
                Deploy directly or copy to <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-fal-cyan">ichigo-journey/public/assets/sprites/characters/{characterName}/</code>
              </p>
            </div>
            <DeployToGameButton
              slots={animSlots}
              settings={gameSettings}
              mode="all"
            />
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

      </>
      )}

      {/* ===== Import Tab ===== */}
      {mainTab === "ai-generator" && aiSubTab === "import" && (
        <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
          <ImportTab
            onFramesReady={(frames) => {
              // When frames come from import, they can be assigned to a slot
              // For now, store them and let the user assign via Slots tab
              console.log(`Imported ${frames.length} frames from Import tab`);
            }}
          />
        </div>
      )}

      {/* ===== Slots Tab ===== */}
      {mainTab === "ai-generator" && aiSubTab === "slots" && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
            <AnimationSlotManager
              slots={animSlots}
              onCreateSlot={handleCreateSlot}
              onClearSlot={handleClearSlot}
              activeSlot={activeCreationSlot}
            />
          </div>

          {/* Animation creation flow (shown when editing a slot) */}
          {activeCreationSlot && (
            <AnimationCreationFlow
              animationType={activeCreationSlot}
              onComplete={(frames, dirFrames, source) =>
                handleSlotComplete(activeCreationSlot, frames, dirFrames, source)
              }
              onCancel={() => {
                setAnimSlots((prev) => ({
                  ...prev,
                  [activeCreationSlot]: {
                    ...prev[activeCreationSlot],
                    status: prev[activeCreationSlot].frames.length > 0 ||
                      prev[activeCreationSlot].directionalFrames
                      ? ("complete" as const)
                      : ("empty" as const),
                  },
                }));
                setActiveCreationSlot(null);
              }}
            />
          )}

          {/* Deploy section */}
          <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-content-primary">Deploy</h3>
              {gameSettings.isValid && (
                <span className="text-[10px] text-fal-cyan px-2 py-0.5 rounded bg-fal-cyan/10">
                  Connected: {gameSettings.characterName}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <DeployToGameButton
                slots={animSlots}
                settings={gameSettings}
                mode="all"
              />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-4 py-2.5 rounded-md text-sm font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Sprite Processor Tab ===== */}
      {mainTab === "sprite-processor" && (
        <div className="sprite-processor relative min-h-[600px]">
          <SpriteProcessorTab
            onFramesReady={(frames, animationType, direction) => {
              const config = ANIMATION_CONFIGS[animationType];

              if (config.isDirectional && direction) {
                // Directional: assign frames to the specified direction
                const existing = animSlots[animationType];
                const existingDirFrames =
                  existing.directionalFrames ??
                  createEmptyDirectionalFrameSet8();
                const updated = { ...existingDirFrames, [direction]: frames };

                // Check how many directions are filled
                const filledCount = DIRECTION_ROW_ORDER_8.filter(
                  (d) => updated[d].length > 0
                ).length;

                setAnimSlots((prev) => ({
                  ...prev,
                  [animationType]: {
                    type: animationType,
                    status:
                      filledCount === 8
                        ? ("complete" as const)
                        : ("in-progress" as const),
                    source: "import",
                    frames: [],
                    directionalFrames: updated,
                  },
                }));

                // Update legacy frame state when all directions filled
                if (filledCount === 8) {
                  if (animationType === "walk") setWalkFrames(updated);
                  if (animationType === "idle") setIdleFrames(updated);
                }
              } else {
                // Non-directional: complete the slot immediately
                handleSlotComplete(animationType, frames, null, "import");
              }

              setMainTab("ai-generator");
              setAiSubTab("slots");
            }}
          />
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChange={setGameSettings}
      />

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
