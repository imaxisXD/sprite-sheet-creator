"use client";

import { FalSpinner } from "../shared";

interface BaseCharacterStepProps {
  characterImageUrl: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function BaseCharacterStep({
  characterImageUrl,
  isGenerating,
  onGenerate,
  onBack,
  onContinue,
}: BaseCharacterStepProps) {
  return (
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
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Character"}
        </button>
      </div>

      {isGenerating && (
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
              onClick={onBack}
            >
              Back
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              Regenerate
            </button>
            <button
              className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onContinue}
            >
              Use This Character
            </button>
          </div>
        </>
      )}
    </div>
  );
}
