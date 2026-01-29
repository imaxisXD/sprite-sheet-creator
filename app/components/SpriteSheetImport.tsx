"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import type { AnimationType } from "../config/animation-types";
import {
  ANIMATION_CONFIGS,
  DIRECTION_ROW_ORDER_8,
} from "../config/animation-types";
import type { Frame, DirectionalFrameSet8, BoundingBox } from "../types";
import { createEmptyDirectionalFrameSet8 } from "../types";
import { getContentBoundsFromCanvas } from "../utils/frameConversion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpriteSheetImportProps {
  animationType: AnimationType;
  onFramesExtracted: (frames: Frame[]) => void;
  onDirectionalFramesExtracted: (dirFrames: DirectionalFrameSet8) => void;
}

interface ExtractedCell {
  dataUrl: string;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpriteSheetImport({
  animationType,
  onFramesExtracted,
  onDirectionalFramesExtracted,
}: SpriteSheetImportProps) {
  const config = ANIMATION_CONFIGS[animationType];

  // Upload state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sheetSize, setSheetSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Grid config (auto-filled from animation config, user-editable)
  const [gridCols, setGridCols] = useState(config.columns);
  const [gridRows, setGridRows] = useState(config.isDirectional ? 8 : 1);

  // Extracted cells
  const [cells, setCells] = useState<ExtractedCell[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  // Animation preview
  const [fps, setFps] = useState(12);
  const [isPlaying, setIsPlaying] = useState(true);
  const [displayFrameIdx, setDisplayFrameIdx] = useState(0);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdxRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animIdRef = useRef(0);
  const imagesRef = useRef<HTMLImageElement[]>([]);

  const totalGridCells = gridCols * gridRows;
  const hasFrames = cells.length > 0;

  // -----------------------------------------------------------------------
  // Preload images when cells change
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (cells.length === 0) {
      imagesRef.current = [];
      return;
    }
    const imgs = cells.map((c) => {
      const img = new Image();
      img.src = c.dataUrl;
      return img;
    });
    imagesRef.current = imgs;
  }, [cells]);

  // -----------------------------------------------------------------------
  // Selected indices in sorted order
  // -----------------------------------------------------------------------

  const selectedOrdered = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected]
  );

  // -----------------------------------------------------------------------
  // Animation loop
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (selectedOrdered.length === 0 || cells.length === 0) return;

    const animate = (ts: number) => {
      const canvas = previewCanvasRef.current;
      if (!canvas) {
        animIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const interval = 1000 / fps;
      if (isPlaying && ts - lastTimeRef.current >= interval) {
        lastTimeRef.current = ts;
        frameIdxRef.current =
          (frameIdxRef.current + 1) % selectedOrdered.length;
        setDisplayFrameIdx(frameIdxRef.current);
      }

      const cellIdx = selectedOrdered[frameIdxRef.current];
      const img = imagesRef.current[cellIdx];

      const PREVIEW_SIZE = 180;
      canvas.width = PREVIEW_SIZE;
      canvas.height = PREVIEW_SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      // Checkerboard background
      const sq = 8;
      for (let y = 0; y < PREVIEW_SIZE; y += sq) {
        for (let x = 0; x < PREVIEW_SIZE; x += sq) {
          ctx.fillStyle =
            (Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.15)";
          ctx.fillRect(x, y, sq, sq);
        }
      }

      // Draw current frame scaled to fit
      if (img && img.complete && img.naturalWidth > 0) {
        const scale = Math.min(
          PREVIEW_SIZE / img.naturalWidth,
          PREVIEW_SIZE / img.naturalHeight
        );
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(
          img,
          (PREVIEW_SIZE - w) / 2,
          (PREVIEW_SIZE - h) / 2,
          w,
          h
        );
      }

      animIdRef.current = requestAnimationFrame(animate);
    };

    frameIdxRef.current = 0;
    lastTimeRef.current = 0;
    setDisplayFrameIdx(0);
    animIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animIdRef.current);
  }, [selectedOrdered, cells, fps, isPlaying]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleFile = useCallback(
    (file: File) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setCells([]);
      setSelected(new Set());
      setLastClicked(null);
      setDisplayFrameIdx(0);

      const img = new Image();
      img.onload = () =>
        setSheetSize({ width: img.width, height: img.height });
      img.src = url;
    },
    [previewUrl]
  );

  const handleExtract = useCallback(() => {
    if (!previewUrl || !sheetSize || gridCols < 1 || gridRows < 1) return;

    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      const cellW = Math.floor(img.width / gridCols);
      const cellH = Math.floor(img.height / gridRows);
      const extracted: ExtractedCell[] = [];

      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const c = document.createElement("canvas");
          c.width = cellW;
          c.height = cellH;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(
            img,
            col * cellW,
            row * cellH,
            cellW,
            cellH,
            0,
            0,
            cellW,
            cellH
          );

          extracted.push({
            dataUrl: c.toDataURL("image/png"),
            width: cellW,
            height: cellH,
            contentBounds: getContentBoundsFromCanvas(c),
          });
        }
      }

      setCells(extracted);
      setSelected(new Set(extracted.map((_, i) => i)));
      setLastClicked(null);
      setIsProcessing(false);
    };
    img.src = previewUrl;
  }, [previewUrl, sheetSize, gridCols, gridRows]);

  const handleFrameClick = useCallback(
    (index: number, shiftKey: boolean) => {
      if (shiftKey && lastClicked !== null) {
        const lo = Math.min(lastClicked, index);
        const hi = Math.max(lastClicked, index);
        const willSelect = !selected.has(index);
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) {
            if (willSelect) next.add(i);
            else next.delete(i);
          }
          return next;
        });
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
        });
      }
      setLastClicked(index);
    },
    [lastClicked, selected]
  );

  const handleConfirm = useCallback(() => {
    if (selectedOrdered.length === 0) return;

    const makeFrame = (idx: number): Frame => {
      const cell = cells[idx];
      const col = idx % gridCols;
      const row = Math.floor(idx / gridCols);
      return {
        dataUrl: cell.dataUrl,
        x: col * cell.width,
        y: row * cell.height,
        width: cell.width,
        height: cell.height,
        contentBounds: cell.contentBounds,
      };
    };

    if (config.isDirectional && gridRows === 8) {
      const dirFrames = createEmptyDirectionalFrameSet8();
      for (const idx of selectedOrdered) {
        const row = Math.floor(idx / gridCols);
        if (row < 8) {
          dirFrames[DIRECTION_ROW_ORDER_8[row]].push(makeFrame(idx));
        }
      }
      onDirectionalFramesExtracted(dirFrames);
    } else {
      onFramesExtracted(selectedOrdered.map(makeFrame));
    }
  }, [
    selectedOrdered,
    cells,
    gridCols,
    gridRows,
    config.isDirectional,
    onFramesExtracted,
    onDirectionalFramesExtracted,
  ]);

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSheetSize(null);
    setCells([]);
    setSelected(new Set());
    setLastClicked(null);
    setDisplayFrameIdx(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl]);

  // -----------------------------------------------------------------------
  // Render: Phase 1 — Upload
  // -----------------------------------------------------------------------

  if (!previewUrl) {
    return (
      <div className="flex flex-col gap-4">
        {/* Info */}
        <InfoBanner animationType={animationType} cols={gridCols} rows={gridRows} />

        {/* Upload zone */}
        <div
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
            isDragOver
              ? "border-fal-purple-light bg-fal-purple-deep/10"
              : "border-stroke/40 hover:border-fal-purple-deep/50"
          }`}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-content-tertiary"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="text-sm text-content-tertiary">
            Drop or click to upload sprite sheet
          </span>
          <span className="text-[10px] text-content-tertiary/60">
            PNG, JPG, or WebP
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Phase 2 — Configure grid (no frames extracted yet)
  // -----------------------------------------------------------------------

  if (!hasFrames) {
    return (
      <div className="flex flex-col gap-4">
        <InfoBanner animationType={animationType} cols={gridCols} rows={gridRows} />

        {/* Sprite sheet preview with grid overlay */}
        <div className="relative border border-stroke/30 rounded-lg overflow-hidden bg-[repeating-conic-gradient(#27272a_0%_25%,transparent_0%_50%)_0_0/16px_16px]">
          <img
            src={previewUrl}
            alt="Sprite sheet"
            className="w-full h-auto max-h-[300px] object-contain"
          />
          {sheetSize && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${sheetSize.width} ${sheetSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {Array.from({ length: gridCols - 1 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={((i + 1) * sheetSize.width) / gridCols}
                  y1={0}
                  x2={((i + 1) * sheetSize.width) / gridCols}
                  y2={sheetSize.height}
                  stroke="rgba(168,85,247,0.5)"
                  strokeWidth={Math.max(1, sheetSize.width * 0.003)}
                />
              ))}
              {Array.from({ length: gridRows - 1 }, (_, i) => (
                <line
                  key={`h${i}`}
                  x1={0}
                  y1={((i + 1) * sheetSize.height) / gridRows}
                  x2={sheetSize.width}
                  y2={((i + 1) * sheetSize.height) / gridRows}
                  stroke="rgba(168,85,247,0.5)"
                  strokeWidth={Math.max(1, sheetSize.height * 0.003)}
                />
              ))}
            </svg>
          )}
        </div>

        {/* Grid config */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-content-secondary">
            <span>Grid:</span>
            <label className="flex items-center gap-1">
              Cols
              <input
                type="number"
                min={1}
                max={64}
                value={gridCols}
                onChange={(e) => setGridCols(Math.max(1, +e.target.value || 1))}
                className="w-14 px-2 py-1 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary text-center"
              />
            </label>
            <span>x</span>
            <label className="flex items-center gap-1">
              Rows
              <input
                type="number"
                min={1}
                max={64}
                value={gridRows}
                onChange={(e) => setGridRows(Math.max(1, +e.target.value || 1))}
                className="w-14 px-2 py-1 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary text-center"
              />
            </label>
          </div>
          {sheetSize && (
            <span className="text-[10px] text-content-tertiary">
              Cell: {Math.round(sheetSize.width / gridCols)}x
              {Math.round(sheetSize.height / gridRows)}px
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExtract}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80 transition-colors disabled:opacity-50"
          >
            {isProcessing ? "Extracting..." : `Extract ${totalGridCells} Frames`}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-md text-sm font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
          >
            Change
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Phase 3 — Frame grid + animation preview
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar: grid config + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-content-secondary">
          <span>Grid:</span>
          <label className="flex items-center gap-1">
            Cols
            <input
              type="number"
              min={1}
              max={64}
              value={gridCols}
              onChange={(e) => setGridCols(Math.max(1, +e.target.value || 1))}
              className="w-12 px-1.5 py-0.5 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary text-center"
            />
          </label>
          <span>x</span>
          <label className="flex items-center gap-1">
            Rows
            <input
              type="number"
              min={1}
              max={64}
              value={gridRows}
              onChange={(e) => setGridRows(Math.max(1, +e.target.value || 1))}
              className="w-12 px-1.5 py-0.5 rounded bg-surface-tertiary border border-stroke text-xs text-content-primary text-center"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExtract}
            className="px-3 py-1 rounded text-[10px] font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
          >
            Re-slice
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 rounded text-[10px] font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
          >
            New Image
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_auto] gap-4">
        {/* Left column: Frame grid */}
        <div className="flex flex-col gap-2">
          {/* Selection controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-content-secondary">
              <span>{cells.length} total</span>
              <span className="text-fal-purple-light">
                {selected.size} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set(cells.map((_, i) => i)))}
                className="px-2 py-0.5 rounded text-[10px] bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-2 py-0.5 rounded text-[10px] bg-surface-tertiary text-content-secondary hover:bg-surface-elevated transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Thumbnails grid */}
          <div
            className="grid gap-1.5 max-h-[360px] overflow-y-auto p-1"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(56px, 1fr))`,
            }}
          >
            {cells.map((cell, i) => {
              const isSelected = selected.has(i);
              const row = Math.floor(i / gridCols);
              return (
                <button
                  key={i}
                  onClick={(e) => handleFrameClick(i, e.shiftKey)}
                  className={`relative rounded overflow-hidden border-2 transition-all duration-100 ${
                    isSelected
                      ? "border-fal-purple-light shadow-[0_0_6px_rgba(171,119,255,0.3)]"
                      : "border-transparent hover:border-stroke-hover"
                  }`}
                  title={`Frame ${i} (row ${row}, col ${i % gridCols}) — ${cell.width}x${cell.height}px`}
                >
                  <div
                    className="w-full aspect-square bg-[repeating-conic-gradient(#27272a_0%_25%,transparent_0%_50%)_0_0/8px_8px]"
                    style={{ imageRendering: "pixelated" }}
                  >
                    <img
                      src={cell.dataUrl}
                      alt={`Frame ${i}`}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-fal-purple-deep flex items-center justify-center">
                      <svg
                        width="7"
                        height="7"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 text-[8px] text-content-tertiary bg-black/60 px-0.5 rounded-tr">
                    {i}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Preview + controls */}
        <div className="flex flex-col gap-3 w-[200px]">
          {/* Animation preview canvas */}
          <div className="border border-stroke/30 rounded-lg overflow-hidden">
            <canvas
              ref={previewCanvasRef}
              className="block mx-auto"
              style={{
                width: 180,
                height: 180,
                imageRendering: "pixelated",
              }}
            />
          </div>

          {/* Playback controls */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="w-7 h-7 rounded-full bg-fal-purple-deep text-white flex items-center justify-center hover:bg-fal-purple-deep/80 transition-colors"
              >
                {isPlaying ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <polygon points="5 3 19 12 5 21" />
                  </svg>
                )}
              </button>
              <span className="text-[10px] text-content-tertiary">FPS</span>
              <input
                type="range"
                min={1}
                max={60}
                value={fps}
                onChange={(e) => setFps(+e.target.value)}
                className="flex-1 accent-fal-purple-deep"
              />
              <span className="text-[10px] text-content-secondary w-6 text-right">
                {fps}
              </span>
            </div>
            <div className="text-[10px] text-content-tertiary text-center">
              Frame: {selectedOrdered.length > 0 ? displayFrameIdx + 1 : 0} /{" "}
              {selectedOrdered.length}
            </div>
          </div>

          {/* Directional info */}
          {config.isDirectional && gridRows === 8 && (
            <div className="p-2 rounded bg-surface-tertiary/50 border border-stroke/20">
              <div className="text-[10px] text-content-tertiary leading-relaxed">
                <span className="text-content-secondary font-medium">
                  8 directions detected
                </span>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {DIRECTION_ROW_ORDER_8.map((dir, i) => {
                    const rowStart = i * gridCols;
                    const rowEnd = rowStart + gridCols - 1;
                    const rowSelected = Array.from(selected).filter(
                      (idx) => idx >= rowStart && idx <= rowEnd
                    ).length;
                    return (
                      <span
                        key={dir}
                        className={`text-[8px] px-1 py-0.5 rounded ${
                          rowSelected === gridCols
                            ? "bg-fal-cyan/20 text-fal-cyan"
                            : rowSelected > 0
                            ? "bg-yellow-500/10 text-yellow-400/80"
                            : "bg-surface-tertiary text-content-tertiary"
                        }`}
                      >
                        {dir.replace("_", "-")}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="px-4 py-2.5 rounded-md text-sm font-medium bg-fal-cyan text-black hover:bg-fal-cyan/80 transition-colors disabled:opacity-50"
          >
            {config.isDirectional && gridRows === 8
              ? `Use All 8 Directions (${selected.size} frames)`
              : `Use ${selected.size} Frames`}
          </button>
        </div>
      </div>

      {/* Hidden file input for re-upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Banner (shared across phases)
// ---------------------------------------------------------------------------

function InfoBanner({
  animationType,
  cols,
  rows,
}: {
  animationType: AnimationType;
  cols: number;
  rows: number;
}) {
  const config = ANIMATION_CONFIGS[animationType];
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-tertiary/50 border border-stroke/30">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-content-tertiary mt-0.5 flex-shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <div className="text-xs text-content-tertiary leading-relaxed">
        <span className="text-content-secondary font-medium capitalize">
          {animationType}
        </span>
        {" — Default: "}
        <span className="text-content-secondary font-medium">
          {config.columns} cols
        </span>
        {" x "}
        <span className="text-content-secondary font-medium">
          {config.isDirectional ? 8 : 1} rows
        </span>
        {" = "}
        <span className="text-content-secondary font-medium">
          {config.columns * (config.isDirectional ? 8 : 1)} frames
        </span>
        {config.isDirectional && (
          <span className="block mt-1 text-[10px]">
            Row order: {DIRECTION_ROW_ORDER_8.map((d) => d.replace("_", " ")).join(" \u2192 ")}
          </span>
        )}
      </div>
    </div>
  );
}
