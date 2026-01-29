"use client";

import { Suspense, lazy } from "react";
import { FalSpinner } from "../shared";
import { Frame, DirectionalFrameSet8 } from "../../types";

const PixiSandbox = lazy(() => import("../PixiSandbox"));

interface PreviewStepProps {
  characterImageUrl: string | null;
  characterName: string;
  idleFrames: DirectionalFrameSet8 | null;
  walkFrames: DirectionalFrameSet8 | null;
  attack1Frames: Frame[];
  attack2Frames: Frame[];
  attack3Frames: Frame[];
  dashFrames: Frame[];
  hurtFrames: Frame[];
  deathFrames: Frame[];
  specialFrames: Frame[];
  fps: number;
  onFpsChange: (fps: number) => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function PreviewStep({
  characterImageUrl,
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
  fps,
  onFpsChange,
  onBack,
  onContinue,
}: PreviewStepProps) {
  return (
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
          onChange={(e) => onFpsChange(parseInt(e.target.value))}
        />
      </div>

      <div className="flex gap-3 justify-end mt-6 flex-wrap">
        <button
          className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-transparent text-content-secondary border border-stroke hover:bg-white/[0.03] hover:border-stroke-hover"
          onClick={onBack}
        >
          Back
        </button>
        <button
          className="px-5 py-2.5 rounded-md font-medium text-sm transition-all inline-flex items-center justify-center gap-2 bg-fal-cyan text-white hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onContinue}
        >
          Export Sprites
        </button>
      </div>
    </div>
  );
}
