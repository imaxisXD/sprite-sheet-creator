"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

const GRID_SIZE = 16;
const CELL_SIZE = 22;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;

const PALETTE = [
  "#ffffff",
  "#ffd166",
  "#ef476f",
  "#06d6a0",
  "#118ab2",
  "#9b5de5",
  "#0b0b0c",
];

type Tool = "paint" | "erase";

function SketchBoard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [color, setColor] = useState(PALETTE[0]);
  const [tool, setTool] = useState<Tool>("paint");

  const drawAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const col = Math.floor((x / rect.width) * GRID_SIZE);
      const row = Math.floor((y / rect.height) * GRID_SIZE);

      if (col < 0 || row < 0 || col >= GRID_SIZE || row >= GRID_SIZE) return;

      if (tool === "erase") {
        ctx.clearRect(col, row, 1, 1);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(col, row, 1, 1);
      }
    },
    [color, tool]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      isDrawingRef.current = true;
      drawAt(event.clientX, event.clientY);
    },
    [drawAt]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      drawAt(event.clientX, event.clientY);
    },
    [drawAt]
  );

  const handlePointerUp = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-tertiary">Sketch board</span>
          <span className="text-[10px] text-content-tertiary">(16×16 px)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTool("paint")}
            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
              tool === "paint"
                ? "border-fal-cyan text-fal-cyan"
                : "border-stroke text-content-tertiary hover:text-content-secondary"
            }`}
          >
            Paint
          </button>
          <button
            onClick={() => setTool("erase")}
            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
              tool === "erase"
                ? "border-fal-pink text-fal-pink"
                : "border-stroke text-content-tertiary hover:text-content-secondary"
            }`}
          >
            Erase
          </button>
          <button
            onClick={handleClear}
            className="px-2 py-1 rounded text-[10px] border border-stroke text-content-tertiary hover:text-content-secondary"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="relative w-full flex justify-center">
        <div
          className="relative rounded-xl border border-stroke bg-surface-elevated shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        >
          <canvas
            ref={canvasRef}
            width={GRID_SIZE}
            height={GRID_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="block w-full h-full rounded-xl"
            style={{ imageRendering: "pixelated", touchAction: "none" }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
              mixBlendMode: "screen",
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-content-tertiary">
          Palette
        </span>
        {PALETTE.map((swatch) => (
          <button
            key={swatch}
            onClick={() => {
              setColor(swatch);
              setTool("paint");
            }}
            className={`w-5 h-5 rounded border transition-transform ${
              color === swatch && tool === "paint"
                ? "border-fal-cyan scale-110"
                : "border-stroke"
            }`}
            style={{ backgroundColor: swatch }}
            aria-label={`Select ${swatch}`}
          />
        ))}
      </div>
    </div>
  );
}

interface NewCharacterBoardProps {
  characterName: string;
  onCharacterNameChange: (value: string) => void;
  onStartAi: () => void;
  onStartVideo: () => void;
  onOpenSettings?: () => void;
}

export default function NewCharacterBoard({
  characterName,
  onCharacterNameChange,
  onStartAi,
  onStartVideo,
  onOpenSettings,
}: NewCharacterBoardProps) {
  const workflowList = useMemo(
    () => [
      "8-direction idle + walk",
      "3-hit attack combo",
      "dash / hurt / death / special",
      "auto sprite-config.json",
    ],
    []
  );

  return (
    <div className="bg-surface-secondary border border-stroke rounded-[12px] p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-content-primary m-0">
            New Character
          </h2>
          <p className="text-content-secondary text-sm mt-2 max-w-[520px]">
            Start with a quick sketch, then choose the flow. Both pipelines output
            game-ready sprite sheets aligned to the Ichigo Journey spec.
          </p>
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 rounded-md text-xs font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
          >
            Game Settings
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-5">
          <SketchBoard />

          <div className="flex flex-col gap-2">
            <label className="text-xs text-content-tertiary">Character folder name</label>
            <input
              value={characterName}
              onChange={(e) => onCharacterNameChange(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-stroke bg-surface-tertiary text-sm text-content-primary placeholder:text-content-tertiary"
              placeholder="e.g. rukia"
            />
            <span className="text-[10px] text-content-tertiary">
              This becomes the folder name under <code className="bg-surface-elevated px-1 rounded">public/assets/sprites/characters/</code>
            </span>
          </div>

          <div className="rounded-lg border border-stroke/50 bg-surface-tertiary/40 p-4">
            <p className="text-xs text-content-secondary m-0">
              Game spec (locked)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-content-tertiary">
              {workflowList.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fal-cyan" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border border-stroke rounded-xl p-5 bg-surface-tertiary/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content-primary m-0">
                RPG AI Generator
              </h3>
              <span className="text-[10px] uppercase tracking-[0.2em] text-fal-cyan">
                Recommended
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-2">
              Use the RPG prompt templates and the 8-direction layout to generate a full
              character kit that fits the game.
            </p>
            <button
              onClick={onStartAi}
              className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-fal-cyan text-black hover:bg-fal-cyan/85 transition-colors"
            >
              Start AI Flow
            </button>
          </div>

          <div className="border border-stroke rounded-xl p-5 bg-surface-tertiary/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content-primary m-0">
                Video / Sprite Import
              </h3>
              <span className="text-[10px] uppercase tracking-[0.2em] text-content-tertiary">
                Fast
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-2">
              Upload a video or sprite sheet, extract frames, clean them up, and assign
              them to the animation slots.
            </p>
            <button
              onClick={onStartVideo}
              className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-surface-elevated text-content-primary hover:bg-surface-secondary transition-colors"
            >
              Start Video Flow
            </button>
          </div>

          <div className="rounded-xl border border-dashed border-stroke/60 p-4 text-[11px] text-content-tertiary">
            Finish either flow, then deploy directly to your game folder from the Slots tab.
          </div>
        </div>
      </div>
    </div>
  );
}
