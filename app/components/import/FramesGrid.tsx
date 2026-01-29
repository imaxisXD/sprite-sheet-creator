"use client";

import { useCallback, useRef, useEffect } from "react";
import { useImport } from "../../context/ImportContext";
import { FRAME_SIZE } from "../../config/animation-types";

export default function FramesGrid() {
  const { state, dispatch } = useImport();
  const {
    extractedFrames,
    selectedFrames,
    lastSelectedIndex,
    thumbnailZoom,
  } = state;

  console.log("[FramesGrid] render — extractedFrames:", extractedFrames.length, "selectedFrames:", selectedFrames.size);

  const handleClick = useCallback(
    (index: number, shiftKey: boolean) => {
      if (shiftKey && lastSelectedIndex !== null) {
        const isSelecting = !selectedFrames.has(index);
        dispatch({
          type: "SET_FRAME_RANGE_SELECTION",
          from: lastSelectedIndex,
          to: index,
          selected: isSelecting,
        });
      } else {
        dispatch({ type: "TOGGLE_FRAME_SELECTION", index });
      }
      dispatch({ type: "SET_LAST_SELECTED_INDEX", index });
    },
    [dispatch, lastSelectedIndex, selectedFrames]
  );

  // Determine grid column width based on zoom
  const cellSize = Math.round((thumbnailZoom / 100) * 80);

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-content-secondary">
          <span>{extractedFrames.length} total</span>
          <span className="text-fal-purple-light">
            {selectedFrames.size} selected
          </span>
          <span className="text-fal-cyan/70">
            Target: {FRAME_SIZE.width}x{FRAME_SIZE.height}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: "SELECT_ALL_FRAMES" })}
            className="px-2 py-1 rounded text-xs bg-surface-tertiary text-content-secondary hover:bg-surface-elevated hover:text-content-primary transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => dispatch({ type: "CLEAR_FRAME_SELECTION" })}
            className="px-2 py-1 rounded text-xs bg-surface-tertiary text-content-secondary hover:bg-surface-elevated hover:text-content-primary transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-2 text-xs text-content-tertiary">
        <span>Zoom</span>
        <input
          type="range"
          min={60}
          max={300}
          value={thumbnailZoom}
          onChange={(e) =>
            dispatch({ type: "SET_THUMBNAIL_ZOOM", zoom: +e.target.value })
          }
          className="w-24 accent-fal-purple-deep"
        />
        <span>{thumbnailZoom}%</span>
      </div>

      {/* Grid */}
      <div
        className="grid gap-2 max-h-[400px] overflow-y-auto p-1"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${cellSize}px, 1fr))`,
        }}
      >
        {extractedFrames.map((frame, i) => (
          <FrameThumb
            key={i}
            index={i}
            canvas={frame.processedCanvas}
            isSelected={selectedFrames.has(i)}
            size={cellSize}
            onClick={(e) => handleClick(i, e.shiftKey)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FrameThumb — individual thumbnail
// ---------------------------------------------------------------------------

function FrameThumb({
  index,
  canvas,
  isSelected,
  size,
  onClick,
}: {
  index: number;
  canvas: HTMLCanvasElement;
  isSelected: boolean;
  size: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    el.width = size;
    el.height = size;
    const ctx = el.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Checkerboard
    const sq = 6;
    for (let y = 0; y < size; y += sq) {
      for (let x = 0; x < size; x += sq) {
        ctx.fillStyle =
          (x / sq + y / sq) % 2 === 0
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.15)";
        ctx.fillRect(x, y, sq, sq);
      }
    }

    // Draw frame scaled to fit
    const scale = Math.min(size / canvas.width, size / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    ctx.drawImage(canvas, (size - w) / 2, (size - h) / 2, w, h);
  }, [canvas, size]);

  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-md overflow-hidden border-2 transition-all duration-150
        ${
          isSelected
            ? "border-fal-purple-light shadow-[0_0_8px_rgba(171,119,255,0.4)]"
            : "border-transparent hover:border-stroke-hover"
        }
      `}
    >
      <canvas ref={ref} className="block" style={{ width: size, height: size }} />
      {isSelected && (
        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-fal-purple-deep flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      <span className="absolute bottom-0.5 left-0.5 text-[9px] text-content-tertiary bg-black/50 px-1 rounded">
        {index}
      </span>
      <span
        className={`absolute bottom-0.5 right-0.5 text-[8px] px-0.5 rounded ${
          canvas.width === FRAME_SIZE.width && canvas.height === FRAME_SIZE.height
            ? "text-green-400 bg-black/50"
            : "text-yellow-400/80 bg-black/50"
        }`}
      >
        {canvas.width}x{canvas.height}
      </span>
    </button>
  );
}
