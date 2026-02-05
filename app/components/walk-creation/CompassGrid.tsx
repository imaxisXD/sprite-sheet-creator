"use client";

import { Direction8, DIRECTION_ROW_ORDER_8 } from "../../config/animation-types";
import type { DirectionalFrameSet8 } from "../../types";
import DirectionCard from "./DirectionCard";

interface CompassGridProps {
  dirFrames: DirectionalFrameSet8;
  activeDirection: Direction8 | null;
  onSelectDirection: (dir: Direction8) => void;
  onClearDirection: (dir: Direction8) => void;
}

export default function CompassGrid({
  dirFrames,
  activeDirection,
  onSelectDirection,
  onClearDirection,
}: CompassGridProps) {
  const completedCount = DIRECTION_ROW_ORDER_8.filter(
    (d) => dirFrames[d].length > 0
  ).length;

  // Build the grid cells — 3x3 with center being the hub
  const gridCells: (Direction8 | "hub")[][] = [
    ["north_west", "north", "north_east"],
    ["west", "hub", "east"],
    ["south_west", "south", "south_east"],
  ];

  return (
    <div className="relative">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background:
            completedCount === 8
              ? "radial-gradient(ellipse at center, rgba(56,172,198,0.04) 0%, transparent 70%)"
              : activeDirection
              ? "radial-gradient(ellipse at center, rgba(171,119,255,0.03) 0%, transparent 70%)"
              : "none",
          transition: "background 0.5s ease",
        }}
      />

      <div className="grid grid-cols-3 gap-2 max-w-[380px] mx-auto">
        {gridCells.flat().map((cell, i) => {
          if (cell === "hub") {
            return (
              <CenterHub
                key="hub"
                completedCount={completedCount}
                totalCount={8}
              />
            );
          }

          const dir = cell as Direction8;
          return (
            <DirectionCard
              key={dir}
              direction={dir}
              frames={dirFrames[dir]}
              isActive={activeDirection === dir}
              onClick={() => onSelectDirection(dir)}
              onClear={() => onClearDirection(dir)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Center Hub — progress ring + compass crosshairs
// ---------------------------------------------------------------------------

function CenterHub({
  completedCount,
  totalCount,
}: {
  completedCount: number;
  totalCount: number;
}) {
  const progress = completedCount / totalCount;
  const circumference = 2 * Math.PI * 32;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-surface-primary/80 border border-stroke/30 min-h-[100px] relative overflow-hidden">
      {/* Crosshair lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-stroke/15" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-stroke/15" />
      </div>

      {/* Progress ring */}
      <svg width="72" height="72" viewBox="0 0 72 72" className="relative z-10">
        {/* Background ring */}
        <circle
          cx="36"
          cy="36"
          r="32"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        {/* Progress arc */}
        <circle
          cx="36"
          cy="36"
          r="32"
          fill="none"
          stroke={completedCount === totalCount ? "#38acc6" : "#ab77ff"}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
        />
        {/* Center text */}
        <text
          x="36"
          y="33"
          textAnchor="middle"
          fill={completedCount === totalCount ? "#38acc6" : "rgba(255,255,255,0.8)"}
          fontSize="16"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontWeight="600"
          style={{ transition: "fill 0.4s ease" }}
        >
          {completedCount}
        </text>
        <text
          x="36"
          y="46"
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize="9"
          fontFamily="var(--font-outfit), sans-serif"
          letterSpacing="0.1em"
        >
          of {totalCount}
        </text>
      </svg>
    </div>
  );
}
