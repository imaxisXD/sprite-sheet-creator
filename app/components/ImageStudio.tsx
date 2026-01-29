"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { AnimationType, ANIMATION_CONFIGS } from "../config/animation-types";
import { useCreationImages } from "../hooks/useCreationImages";
import PromptEditor from "./PromptEditor";
import { getDefaultPrompt } from "../utils/prompt-utils";

// Animation card configuration
interface AnimationCardConfig {
  type: AnimationType | "attack-combined";
  label: string;
  icon: string;
  description: string;
  apiType: string;
}

const ANIMATION_CARDS: AnimationCardConfig[] = [
  {
    type: "walk",
    label: "Walk Cycle",
    icon: "🚶",
    description: "6-frame walk with 4 directions",
    apiType: "walk-full",
  },
  {
    type: "idle",
    label: "Idle",
    icon: "🧍",
    description: "4-frame idle with 4 directions",
    apiType: "idle-full",
  },
  {
    type: "attack-combined",
    label: "Attack Combo",
    icon: "⚔️",
    description: "3 attack variations (4x3 grid)",
    apiType: "attack-combined",
  },
  {
    type: "dash",
    label: "Dash",
    icon: "💨",
    description: "4-frame dash animation",
    apiType: "dash",
  },
  {
    type: "hurt",
    label: "Hurt",
    icon: "💔",
    description: "3-frame hurt reaction",
    apiType: "hurt",
  },
  {
    type: "death",
    label: "Death",
    icon: "💀",
    description: "8-frame death sequence",
    apiType: "death",
  },
  {
    type: "special",
    label: "Special",
    icon: "✨",
    description: "10-frame special attack",
    apiType: "special",
  },
];

type CardStatus = "idle" | "generating" | "success" | "error";

interface AnimationState {
  status: CardStatus;
  imageUrl: string | null;
  error: string | null;
}

interface ImageStudioProps {
  characterImageUrl: string;
  characterDescription: string;
  onComplete: (results: Record<string, string>) => void;
  initialImages?: Record<string, string | undefined>;
  creationId?: Id<"creations"> | null;
}

// Fal Spinner component
const FalSpinner = ({ size = 32 }: { size?: number }) => (
  <svg
    viewBox="0 0 624 624"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    className="animate-fal-spin"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M402.365 0C413.17 0.000231771 421.824 8.79229 422.858 19.5596C432.087 115.528 508.461 191.904 604.442 201.124C615.198 202.161 624 210.821 624 221.638V402.362C624 413.179 615.198 421.839 604.442 422.876C508.461 432.096 432.087 508.472 422.858 604.44C421.824 615.208 413.17 624 402.365 624H221.635C210.83 624 202.176 615.208 201.142 604.44C191.913 508.472 115.538 432.096 19.5576 422.876C8.80183 421.839 0 413.179 0 402.362V221.638C0 210.821 8.80183 202.161 19.5576 201.124C115.538 191.904 191.913 115.528 201.142 19.5596C202.176 8.79215 210.83 0 221.635 0H402.365ZM312 124C208.17 124 124 208.17 124 312C124 415.83 208.17 500 312 500C415.83 500 500 415.83 500 312C500 208.17 415.83 124 312 124Z"
    />
  </svg>
);

export default function ImageStudio({
  characterImageUrl,
  characterDescription,
  onComplete,
  initialImages = {},
  creationId,
}: ImageStudioProps) {
  // Get images from R2 reactively
  const { imageUrls: r2ImageUrls, isLoading: isLoadingR2 } = useCreationImages(creationId);

  // Map R2 storage types back to API types for display
  const getApiTypeFromStorageType = (storageType: string): string | null => {
    const reverseMap: Record<string, string> = {
      "walk_raw": "walk-full",
      "idle_raw": "idle-full",
      "attack_raw": "attack-combined",
      "dash_raw": "dash",
      "hurt_raw": "hurt",
      "death_raw": "death",
      "special_raw": "special",
    };
    return reverseMap[storageType] || null;
  };

  // Generate default prompts for all animation types
  const defaultPrompts = useMemo(() => {
    const prompts: Record<string, string> = {};
    ANIMATION_CARDS.forEach((card) => {
      prompts[card.apiType] = getDefaultPrompt(card.apiType, characterDescription);
    });
    return prompts;
  }, [characterDescription]);

  // State for prompt overrides (user-edited prompts)
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    ANIMATION_CARDS.forEach((card) => {
      initial[card.apiType] = getDefaultPrompt(card.apiType, characterDescription);
    });
    return initial;
  });

  // Update prompts when character description changes
  useEffect(() => {
    setPromptOverrides((prev) => {
      const updated: Record<string, string> = {};
      ANIMATION_CARDS.forEach((card) => {
        const defaultPrompt = getDefaultPrompt(card.apiType, characterDescription);
        // Keep user edits if they've modified it, otherwise use new default
        if (prev[card.apiType] === getDefaultPrompt(card.apiType, '')) {
          updated[card.apiType] = defaultPrompt;
        } else {
          updated[card.apiType] = prev[card.apiType] || defaultPrompt;
        }
      });
      return updated;
    });
  }, [characterDescription]);

  // Initialize state with any existing images (from props or R2)
  const [animationStates, setAnimationStates] = useState<Record<string, AnimationState>>(() => {
    const initial: Record<string, AnimationState> = {};
    ANIMATION_CARDS.forEach((card) => {
      const existingUrl = initialImages[card.apiType];
      initial[card.apiType] = {
        status: existingUrl ? "success" : "idle",
        imageUrl: existingUrl || null,
        error: null,
      };
    });
    return initial;
  });

  // Update state when R2 images are loaded
  useEffect(() => {
    if (!r2ImageUrls || Object.keys(r2ImageUrls).length === 0) return;

    console.log("[ImageStudio] R2 images loaded:", Object.keys(r2ImageUrls));

    setAnimationStates((prev) => {
      const updated = { ...prev };
      Object.entries(r2ImageUrls).forEach(([storageType, url]) => {
        const apiType = getApiTypeFromStorageType(storageType);
        // Update if: card exists AND (status is idle OR success with no image yet)
        const shouldUpdate = apiType && updated[apiType] &&
          (updated[apiType].status === "idle" ||
           (updated[apiType].status === "success" && !updated[apiType].imageUrl));
        if (shouldUpdate) {
          console.log(`[ImageStudio] Loading ${apiType} from R2`);
          updated[apiType] = {
            status: "success",
            imageUrl: url,
            error: null,
          };
        }
      });
      return updated;
    });
  }, [r2ImageUrls]);

  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Convex action for generating sprite sheets (calls fal.ai and saves to R2)
  const generateSpriteSheet = useAction(api.fal.generateSpriteSheet);

  // Generate a single animation using Convex action
  const generateAnimation = useCallback(
    async (apiType: string) => {
      if (!creationId) {
        console.error("[ImageStudio] No creationId provided");
        return null;
      }

      setAnimationStates((prev) => ({
        ...prev,
        [apiType]: { status: "generating", imageUrl: null, error: null },
      }));

      try {
        // Get the current prompt (may be user-edited)
        const currentPrompt = promptOverrides[apiType];
        const defaultPrompt = defaultPrompts[apiType];
        const isCustomPrompt = currentPrompt !== defaultPrompt;

        // Call Convex action - generates with fal.ai and saves to R2
        const result = await generateSpriteSheet({
          creationId,
          characterImageUrl,
          characterDescription,
          type: apiType,
          customPrompt: isCustomPrompt ? currentPrompt : undefined,
        });

        if (!result.success) {
          throw new Error("Failed to generate animation");
        }

        // Image will be populated by useCreationImages hook
        // For immediate feedback, mark as success
        setAnimationStates((prev) => ({
          ...prev,
          [apiType]: { status: "success", imageUrl: null, error: null },
        }));

        return result.imageType;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Generation failed";
        setAnimationStates((prev) => ({
          ...prev,
          [apiType]: { status: "error", imageUrl: null, error: errorMessage },
        }));
        return null;
      }
    },
    [characterImageUrl, characterDescription, creationId, generateSpriteSheet, promptOverrides, defaultPrompts]
  );

  // Generate all animations in parallel
  const generateAll = useCallback(async () => {
    setIsGeneratingAll(true);

    // Start all generations in parallel
    const promises = ANIMATION_CARDS.map((card) => generateAnimation(card.apiType));
    await Promise.allSettled(promises);

    setIsGeneratingAll(false);
  }, [generateAnimation]);

  // Regenerate a single animation
  const regenerateAnimation = useCallback(
    async (apiType: string) => {
      await generateAnimation(apiType);
    },
    [generateAnimation]
  );

  // Check if all animations are complete
  const completedCount = Object.values(animationStates).filter(
    (s) => s.status === "success"
  ).length;
  const allComplete = completedCount === ANIMATION_CARDS.length;
  const anyGenerating = Object.values(animationStates).some(
    (s) => s.status === "generating"
  );

  // Handle continue - collect all URLs
  const handleContinue = useCallback(() => {
    const results: Record<string, string> = {};
    Object.entries(animationStates).forEach(([apiType, state]) => {
      if (state.imageUrl) {
        results[apiType] = state.imageUrl;
      }
    });
    onComplete(results);
  }, [animationStates, onComplete]);

  return (
    <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-content-primary flex items-center gap-3">
            <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">
              3
            </span>
            Image Studio
          </h2>
          <p className="text-content-secondary text-sm mt-1">
            Generate all sprite animations at once, regenerate any you don't like
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-purple-deep text-white hover:bg-fal-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={generateAll}
            disabled={isGeneratingAll || anyGenerating}
          >
            {isGeneratingAll || anyGenerating ? (
              <>
                <FalSpinner size={16} />
                Generating...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Generate All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-content-secondary mb-2">
          <span>Progress</span>
          <span>{completedCount} / {ANIMATION_CARDS.length} complete</span>
        </div>
        <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fal-purple-deep to-fal-cyan transition-all duration-500"
            style={{ width: `${(completedCount / ANIMATION_CARDS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Animation cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ANIMATION_CARDS.map((card) => {
          const state = animationStates[card.apiType];
          const isGenerating = state.status === "generating";

          return (
            <div
              key={card.apiType}
              className={`relative bg-surface-tertiary border rounded-lg p-4 transition-all ${
                state.status === "error"
                  ? "border-fal-red/50"
                  : state.status === "success"
                  ? "border-green-500/50"
                  : "border-stroke"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{card.icon}</span>
                <div>
                  <h3 className="text-sm font-medium text-content-primary">{card.label}</h3>
                  <p className="text-xs text-content-tertiary">{card.description}</p>
                </div>
              </div>

              {/* Card content */}
              <div className="aspect-video bg-surface-primary rounded-md flex items-center justify-center overflow-hidden mb-3">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-2 text-content-secondary">
                    <FalSpinner size={24} />
                    <span className="text-xs">Generating...</span>
                  </div>
                ) : state.imageUrl ? (
                  <img
                    src={state.imageUrl}
                    alt={`${card.label} sprite sheet`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : state.status === "error" ? (
                  <div className="flex flex-col items-center gap-2 text-fal-red text-center p-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-xs">{state.error || "Failed"}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-content-tertiary">
                    <span className="text-3xl opacity-30">{card.icon}</span>
                    <span className="text-xs">Not generated</span>
                  </div>
                )}
              </div>

              {/* Prompt editor */}
              <PromptEditor
                defaultPrompt={defaultPrompts[card.apiType]}
                value={promptOverrides[card.apiType] || defaultPrompts[card.apiType]}
                onChange={(newPrompt) => {
                  setPromptOverrides((prev) => ({
                    ...prev,
                    [card.apiType]: newPrompt,
                  }));
                }}
                isGenerating={isGenerating || isGeneratingAll}
                animationLabel={card.label}
              />

              {/* Card actions */}
              <button
                className="w-full mt-2 px-3 py-2 rounded-md text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => regenerateAnimation(card.apiType)}
                disabled={isGenerating || isGeneratingAll}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                {isGenerating ? "Generating..." : state.imageUrl ? "Regenerate" : "Generate"}
              </button>

              {/* Success badge */}
              {state.status === "success" && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 justify-end mt-6 flex-wrap">
        <button
          className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleContinue}
          disabled={completedCount === 0 || anyGenerating}
        >
          Continue to Processing
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
