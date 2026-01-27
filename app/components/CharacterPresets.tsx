"use client";

import { CHARACTER_PRESETS, isCustomPreset } from "../config/character-presets";
import { CharacterPreset } from "../types";

interface CharacterPresetsProps {
  selectedPreset: CharacterPreset | null;
  onSelectPreset: (preset: CharacterPreset) => void;
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
}

export default function CharacterPresets({
  selectedPreset,
  onSelectPreset,
  customPrompt,
  onCustomPromptChange,
}: CharacterPresetsProps) {
  const isCustom = selectedPreset && isCustomPreset(selectedPreset);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 mb-4">
        {CHARACTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`p-4 border-2 rounded-lg bg-surface-tertiary text-left transition-all hover:border-fal-purple-light hover:bg-surface-elevated ${
              selectedPreset?.id === preset.id
                ? "border-fal-purple-light bg-fal-purple-light/10"
                : "border-stroke"
            }`}
            onClick={() => onSelectPreset(preset)}
          >
            <div className="font-semibold text-content-primary mb-1 text-[0.95rem]">
              {preset.name}
            </div>
            <div className="text-xs text-content-secondary leading-tight">
              {preset.description}
            </div>
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="mt-4">
          <label
            htmlFor="custom-prompt"
            className="block mb-2 text-content-primary font-medium"
          >
            Describe your character:
          </label>
          <textarea
            id="custom-prompt"
            className="w-full px-4 py-3 bg-surface-tertiary border border-stroke rounded-md text-content-primary text-[0.95rem] transition-all resize-y focus:outline-none focus:border-fal-purple-light"
            rows={4}
            placeholder="e.g., A ninja with blue armor and dual katanas, fierce expression, athletic build"
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
          />
          <p className="text-xs text-content-tertiary mt-2">
            Tip: Include details about clothing, weapons, hair color, and pose
          </p>
        </div>
      )}

      {selectedPreset && !isCustom && (
        <div className="mt-4 p-4 bg-surface-tertiary rounded-lg border border-stroke">
          <h4 className="text-content-primary m-0 mb-2 text-sm">
            Selected: {selectedPreset.name}
          </h4>
          <p className="text-sm text-content-secondary m-0 leading-relaxed">
            {selectedPreset.prompt}
          </p>
        </div>
      )}
    </div>
  );
}
