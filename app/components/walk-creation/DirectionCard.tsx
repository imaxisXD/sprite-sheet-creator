"use client";

import { Direction8 } from "../../config/animation-types";
import type { Frame } from "../../types";

// Direction display names and rotation angles
const DIRECTION_META: Record<
  Direction8,
  { label: string; shortLabel: string; angle: number }
> = {
  north: { label: "North", shortLabel: "N", angle: 0 },
  north_east: { label: "North East", shortLabel: "NE", angle: 45 },
  east: { label: "East", shortLabel: "E", angle: 90 },
  south_east: { label: "South East", shortLabel: "SE", angle: 135 },
  south: { label: "South", shortLabel: "S", angle: 180 },
  south_west: { label: "South West", shortLabel: "SW", angle: 225 },
  west: { label: "West", shortLabel: "W", angle: 270 },
  north_west: { label: "North West", shortLabel: "NW", angle: 315 },
};

// Compass arrow SVG — a sharp chevron pointing up (rotated per direction)
function DirectionArrow({
  angle,
  isActive,
  isComplete,
}: {
  angle: number;
  isActive: boolean;
  isComplete: boolean;
}) {
  const color = isActive
    ? "#ab77ff"
    : isComplete
    ? "#38acc6"
    : "rgba(255,255,255,0.25)";

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      style={{ transform: `rotate(${angle}deg)`, transition: "transform 0.3s ease" }}
    >
      <path
        d="M14 6L8 16h4v6h4v-6h4L14 6z"
        fill={color}
        style={{ transition: "fill 0.3s ease" }}
      />
    </svg>
  );
}

interface DirectionCardProps {
  direction: Direction8;
  frames: Frame[];
  isActive: boolean;
  onClick: () => void;
  onClear: () => void;
}

export default function DirectionCard({
  direction,
  frames,
  isActive,
  onClick,
  onClear,
}: DirectionCardProps) {
  const meta = DIRECTION_META[direction];
  const hasFrames = frames.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        group relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg
        transition-all duration-300 ease-out cursor-pointer
        min-h-[100px] outline-none focus-visible:ring-2 focus-visible:ring-fal-purple-light/50
        ${
          isActive
            ? "bg-fal-purple-deep/15 border-2 border-fal-purple-light shadow-[0_0_20px_rgba(171,119,255,0.12),inset_0_1px_0_rgba(171,119,255,0.1)]"
            : hasFrames
            ? "bg-surface-tertiary/80 border border-fal-cyan/25 hover:border-fal-cyan/40 hover:bg-surface-tertiary"
            : "bg-surface-tertiary/40 border border-dashed border-stroke/40 hover:border-stroke/60 hover:bg-surface-tertiary/60"
        }
      `}
    >
      {/* Scan-line texture overlay */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)",
        }}
      />

      {/* Subtle corner accents for active state */}
      {isActive && (
        <>
          <span className="absolute top-0 left-0 w-3 h-px bg-fal-purple-light/60" />
          <span className="absolute top-0 left-0 w-px h-3 bg-fal-purple-light/60" />
          <span className="absolute top-0 right-0 w-3 h-px bg-fal-purple-light/60" />
          <span className="absolute top-0 right-0 w-px h-3 bg-fal-purple-light/60" />
          <span className="absolute bottom-0 left-0 w-3 h-px bg-fal-purple-light/60" />
          <span className="absolute bottom-0 left-0 w-px h-3 bg-fal-purple-light/60" />
          <span className="absolute bottom-0 right-0 w-3 h-px bg-fal-purple-light/60" />
          <span className="absolute bottom-0 right-0 w-px h-3 bg-fal-purple-light/60" />
        </>
      )}

      {/* Arrow icon */}
      <DirectionArrow
        angle={meta.angle}
        isActive={isActive}
        isComplete={hasFrames}
      />

      {/* Direction label */}
      <span
        className={`text-[11px] font-medium tracking-wide transition-colors duration-300 ${
          isActive
            ? "text-fal-purple-light"
            : hasFrames
            ? "text-fal-cyan"
            : "text-content-tertiary"
        }`}
      >
        {meta.label}
      </span>

      {/* Frame count or status */}
      {hasFrames ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-fal-cyan/15 text-fal-cyan font-mono tabular-nums">
            {frames.length} frames
          </span>
          {/* Clear button — appears on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="opacity-0 group-hover:opacity-100 text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-200"
          >
            clear
          </button>
        </div>
      ) : (
        <span className="text-[9px] text-content-tertiary/50 font-mono uppercase tracking-widest">
          empty
        </span>
      )}

      {/* Mini frame preview strip */}
      {hasFrames && frames.length > 0 && (
        <div className="flex gap-0.5 mt-1">
          {frames.slice(0, 4).map((frame, i) => (
            <div
              key={i}
              className="w-4 h-6 rounded-[2px] overflow-hidden bg-surface-primary/60 border border-stroke/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.dataUrl}
                alt=""
                className="w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          ))}
          {frames.length > 4 && (
            <span className="text-[8px] text-content-tertiary self-center ml-0.5">
              +{frames.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
