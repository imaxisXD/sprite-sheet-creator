"use client";

import { CharacterPreset } from "../../types";
import CharacterPresets from "../CharacterPresets";
import RecentCreationsGallery from "../RecentCreationsGallery";
import { Id } from "../../../convex/_generated/dataModel";

interface CharacterSelectStepProps {
  selectedPreset: CharacterPreset | null;
  onSelectPreset: (preset: CharacterPreset | null) => void;
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
  canProceed: boolean;
  onContinue: () => void;
  creationId: Id<"creations"> | null;
  onLoadCreation: (creation: any, imageUrls: Record<string, string>) => void;
  onViewOutput: (creation: any, imageUrls: Record<string, string>) => void;
  onOpenHistory: () => void;
}

export default function CharacterSelectStep({
  selectedPreset,
  onSelectPreset,
  customPrompt,
  onCustomPromptChange,
  canProceed,
  onContinue,
  creationId,
  onLoadCreation,
  onViewOutput,
  onOpenHistory,
}: CharacterSelectStepProps) {
  return (
    <div className="bg-surface-secondary border border-stroke rounded-[10px] p-7">
      <h2 className="text-xl font-semibold text-content-primary mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-fal-purple-deep text-white text-sm font-semibold rounded-full flex items-center justify-center">1</span>
        Select Character
      </h2>

      <CharacterPresets
        selectedPreset={selectedPreset}
        onSelectPreset={onSelectPreset}
        customPrompt={customPrompt}
        onCustomPromptChange={onCustomPromptChange}
      />

      <div className="flex gap-3 justify-end mt-6 flex-wrap">
        <button
          className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onContinue}
          disabled={!canProceed}
        >
          Continue to Generation
        </button>
      </div>

      {/* Recent Creations Gallery */}
      <RecentCreationsGallery
        onContinue={onLoadCreation}
        onViewOutput={onViewOutput}
        currentCreationId={creationId}
        onOpenHistory={onOpenHistory}
      />
    </div>
  );
}
