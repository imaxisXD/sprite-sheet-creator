"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ANIMATION_CONFIGS, AnimationType, DIRECTION_ROW_ORDER } from "../config/animation-types";
import { GRID_RECOMMENDATIONS, STANDARD_FRAME_SIZE } from "../utils/grid-analyzer";
import { Frame, DirectionalFrameSet } from "../types";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Custom region for frame selection
interface CustomRegion {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
}

// Get bounding box of non-transparent pixels
function getContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

interface FrameExtractorEditorProps {
  imageUrl: string;
  animationType: AnimationType | "attack";
  onFramesExtracted: (frames: Frame[] | DirectionalFrameSet | { attack1: Frame[]; attack2: Frame[]; attack3: Frame[] }) => void;
  initialCols?: number;
  initialRows?: number;
  onGridConfigChange?: (config: {
    cols: number;
    rows: number;
    verticalDividers: number[];
    horizontalDividers: number[];
    customRegions?: CustomRegion[];
    mode: "grid" | "custom";
  }) => void;
}

export default function FrameExtractorEditor({
  imageUrl,
  animationType,
  onFramesExtracted,
  initialCols,
  initialRows,
  onGridConfigChange,
}: FrameExtractorEditorProps) {
  // Mode: grid or custom region selection
  const [mode, setMode] = useState<"grid" | "custom">("grid");

  // Get recommended config
  const recommendation = animationType === "attack"
    ? GRID_RECOMMENDATIONS.attack
    : GRID_RECOMMENDATIONS[animationType];

  // Grid configuration
  const [gridCols, setGridCols] = useState(initialCols ?? recommendation?.recommendedColumns ?? 4);
  const [gridRows, setGridRows] = useState(initialRows ?? recommendation?.recommendedRows ?? 1);

  // Draggable divider positions (as percentages 0-100)
  const [verticalDividers, setVerticalDividers] = useState<number[]>([]);
  const [horizontalDividers, setHorizontalDividers] = useState<number[]>([]);

  // Custom regions for frame selection
  const [customRegions, setCustomRegions] = useState<CustomRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Resize/move state
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // Image dimensions
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Extracted frames
  const [extractedFrames, setExtractedFrames] = useState<Frame[]>([]);

  // Refs
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Is this a directional animation (4 rows)?
  const isDirectional = animationType === "idle" || animationType === "walk";
  const isAttackCombined = animationType === "attack";

  // Initialize divider positions when grid changes
  useEffect(() => {
    if (imageDimensions.width > 0 && mode === "grid") {
      // Calculate even divider positions
      const vPositions: number[] = [];
      for (let i = 1; i < gridCols; i++) {
        vPositions.push((i / gridCols) * 100);
      }
      setVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < gridRows; i++) {
        hPositions.push((i / gridRows) * 100);
      }
      setHorizontalDividers(hPositions);
    }
  }, [gridCols, gridRows, imageDimensions.width, mode]);

  // Notify parent of grid config changes
  useEffect(() => {
    if (onGridConfigChange && imageDimensions.width > 0) {
      onGridConfigChange({
        cols: gridCols,
        rows: gridRows,
        verticalDividers,
        horizontalDividers,
        customRegions: mode === "custom" ? customRegions : undefined,
        mode,
      });
    }
  }, [gridCols, gridRows, verticalDividers, horizontalDividers, customRegions, imageDimensions.width, onGridConfigChange, mode]);

  // Extract frames when config changes
  useEffect(() => {
    if (imageUrl && imageDimensions.width > 0) {
      if (mode === "grid") {
        extractGridFrames();
      } else if (customRegions.length > 0) {
        extractCustomFrames();
      } else {
        setExtractedFrames([]);
      }
    }
  }, [imageUrl, verticalDividers, horizontalDividers, customRegions, imageDimensions, mode]);

  // Keyboard event handler for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "custom") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRegionId) {
          e.preventDefault();
          setCustomRegions(prev => prev.filter(r => r.id !== selectedRegionId));
          setSelectedRegionId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, selectedRegionId]);

  // Grid-based frame extraction
  const extractGridFrames = useCallback(async () => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...verticalDividers, 100];
      const rowPositions = [0, ...horizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      setExtractedFrames(frames);
      handleFramesExtracted(frames);
    };

    img.src = imageUrl;
  }, [imageUrl, verticalDividers, horizontalDividers]);

  // Custom region-based frame extraction
  const extractCustomFrames = useCallback(async () => {
    if (!imageUrl || customRegions.length === 0) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const frames: Frame[] = customRegions.map((region) => {
        const startX = Math.round((region.x / 100) * img.width);
        const startY = Math.round((region.y / 100) * img.height);
        const frameWidth = Math.round((region.width / 100) * img.width);
        const frameHeight = Math.round((region.height / 100) * img.height);

        const canvas = document.createElement("canvas");
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
          const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
          return {
            dataUrl: canvas.toDataURL("image/png"),
            x: startX,
            y: startY,
            width: frameWidth,
            height: frameHeight,
            contentBounds,
          };
        }

        return {
          dataUrl: "",
          x: startX,
          y: startY,
          width: frameWidth,
          height: frameHeight,
          contentBounds: { x: 0, y: 0, width: frameWidth, height: frameHeight },
        };
      });

      setExtractedFrames(frames);
      handleFramesExtracted(frames);
    };

    img.src = imageUrl;
  }, [imageUrl, customRegions]);

  // Handle extracted frames callback
  const handleFramesExtracted = (frames: Frame[]) => {
    if (isDirectional && gridRows === 4 && mode === "grid") {
      const framesPerRow = Math.floor(frames.length / 4);
      const directionalFrames: DirectionalFrameSet = {
        down: frames.slice(0, framesPerRow),
        up: frames.slice(framesPerRow, framesPerRow * 2),
        left: frames.slice(framesPerRow * 2, framesPerRow * 3),
        right: frames.slice(framesPerRow * 3, framesPerRow * 4),
      };
      onFramesExtracted(directionalFrames);
    } else if (isAttackCombined && gridRows === 3 && mode === "grid") {
      const framesPerRow = Math.floor(frames.length / 3);
      const attackFrames = {
        attack1: frames.slice(0, framesPerRow),
        attack2: frames.slice(framesPerRow, framesPerRow * 2),
        attack3: frames.slice(framesPerRow * 2, framesPerRow * 3),
      };
      onFramesExtracted(attackFrames);
    } else {
      onFramesExtracted(frames);
    }
  };

  // Vertical divider drag handler
  const handleVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = imageRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...verticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Horizontal divider drag handler
  const handleHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = imageRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...horizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Custom region drawing handlers
  const getMousePosition = (e: React.MouseEvent): { x: number; y: number } | null => {
    const imgRect = imageRef.current?.getBoundingClientRect();
    if (!imgRect) return null;
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - imgRect.left) / imgRect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - imgRect.top) / imgRect.height) * 100)),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (mode !== "custom") return;

    const pos = getMousePosition(e);
    if (!pos) return;

    // Check if clicking on a resize handle
    if (selectedRegionId) {
      const region = customRegions.find(r => r.id === selectedRegionId);
      if (region) {
        const handle = getResizeHandle(pos, region);
        if (handle) {
          setResizeHandle(handle);
          e.preventDefault();
          return;
        }

        // Check if clicking inside the selected region to drag it
        if (isPointInRegion(pos, region)) {
          setIsDraggingRegion(true);
          setDragOffset({ x: pos.x - region.x, y: pos.y - region.y });
          e.preventDefault();
          return;
        }
      }
    }

    // Check if clicking on an existing region to select it
    const clickedRegion = customRegions.find(r => isPointInRegion(pos, r));
    if (clickedRegion) {
      setSelectedRegionId(clickedRegion.id);
      setIsDraggingRegion(true);
      setDragOffset({ x: pos.x - clickedRegion.x, y: pos.y - clickedRegion.y });
      return;
    }

    // Start drawing a new region
    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentDraw({ x: pos.x, y: pos.y, width: 0, height: 0 });
    setSelectedRegionId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (mode !== "custom") return;

    const pos = getMousePosition(e);
    if (!pos) return;

    if (isDrawing && drawStart) {
      // Drawing a new region
      const x = Math.min(drawStart.x, pos.x);
      const y = Math.min(drawStart.y, pos.y);
      const width = Math.abs(pos.x - drawStart.x);
      const height = Math.abs(pos.y - drawStart.y);
      setCurrentDraw({ x, y, width, height });
    } else if (resizeHandle && selectedRegionId) {
      // Resizing a region
      setCustomRegions(prev => prev.map(r => {
        if (r.id !== selectedRegionId) return r;
        return applyResize(r, resizeHandle, pos);
      }));
    } else if (isDraggingRegion && selectedRegionId && dragOffset) {
      // Moving a region
      setCustomRegions(prev => prev.map(r => {
        if (r.id !== selectedRegionId) return r;
        const newX = Math.max(0, Math.min(100 - r.width, pos.x - dragOffset.x));
        const newY = Math.max(0, Math.min(100 - r.height, pos.y - dragOffset.y));
        return { ...r, x: newX, y: newY };
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && currentDraw && currentDraw.width > 1 && currentDraw.height > 1) {
      // Finish drawing a new region
      const newRegion: CustomRegion = {
        id: generateId(),
        x: currentDraw.x,
        y: currentDraw.y,
        width: currentDraw.width,
        height: currentDraw.height,
      };
      setCustomRegions(prev => [...prev, newRegion]);
      setSelectedRegionId(newRegion.id);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentDraw(null);
    setResizeHandle(null);
    setIsDraggingRegion(false);
    setDragOffset(null);
  };

  // Check if point is inside a region
  const isPointInRegion = (point: { x: number; y: number }, region: CustomRegion): boolean => {
    return point.x >= region.x && point.x <= region.x + region.width &&
           point.y >= region.y && point.y <= region.y + region.height;
  };

  // Get resize handle at point
  const getResizeHandle = (point: { x: number; y: number }, region: CustomRegion): string | null => {
    const threshold = 2; // percentage
    const right = region.x + region.width;
    const bottom = region.y + region.height;

    const nearLeft = Math.abs(point.x - region.x) < threshold;
    const nearRight = Math.abs(point.x - right) < threshold;
    const nearTop = Math.abs(point.y - region.y) < threshold;
    const nearBottom = Math.abs(point.y - bottom) < threshold;

    if (nearTop && nearLeft) return "nw";
    if (nearTop && nearRight) return "ne";
    if (nearBottom && nearLeft) return "sw";
    if (nearBottom && nearRight) return "se";
    if (nearTop) return "n";
    if (nearBottom) return "s";
    if (nearLeft) return "w";
    if (nearRight) return "e";

    return null;
  };

  // Apply resize to region
  const applyResize = (region: CustomRegion, handle: string, pos: { x: number; y: number }): CustomRegion => {
    let { x, y, width, height } = region;
    const minSize = 2;

    switch (handle) {
      case "nw":
        const newWidthNW = width + (x - pos.x);
        const newHeightNW = height + (y - pos.y);
        if (newWidthNW >= minSize) { width = newWidthNW; x = pos.x; }
        if (newHeightNW >= minSize) { height = newHeightNW; y = pos.y; }
        break;
      case "ne":
        const newWidthNE = pos.x - x;
        const newHeightNE = height + (y - pos.y);
        if (newWidthNE >= minSize) width = newWidthNE;
        if (newHeightNE >= minSize) { height = newHeightNE; y = pos.y; }
        break;
      case "sw":
        const newWidthSW = width + (x - pos.x);
        const newHeightSW = pos.y - y;
        if (newWidthSW >= minSize) { width = newWidthSW; x = pos.x; }
        if (newHeightSW >= minSize) height = newHeightSW;
        break;
      case "se":
        const newWidthSE = pos.x - x;
        const newHeightSE = pos.y - y;
        if (newWidthSE >= minSize) width = newWidthSE;
        if (newHeightSE >= minSize) height = newHeightSE;
        break;
      case "n":
        const newHeightN = height + (y - pos.y);
        if (newHeightN >= minSize) { height = newHeightN; y = pos.y; }
        break;
      case "s":
        const newHeightS = pos.y - y;
        if (newHeightS >= minSize) height = newHeightS;
        break;
      case "w":
        const newWidthW = width + (x - pos.x);
        if (newWidthW >= minSize) { width = newWidthW; x = pos.x; }
        break;
      case "e":
        const newWidthE = pos.x - x;
        if (newWidthE >= minSize) width = newWidthE;
        break;
    }

    return { ...region, x: Math.max(0, x), y: Math.max(0, y), width: Math.min(100 - x, width), height: Math.min(100 - y, height) };
  };

  // Delete selected region
  const deleteSelectedRegion = () => {
    if (selectedRegionId) {
      setCustomRegions(prev => prev.filter(r => r.id !== selectedRegionId));
      setSelectedRegionId(null);
    }
  };

  // Reorder regions
  const moveRegion = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= customRegions.length) return;

    setCustomRegions(prev => {
      const newRegions = [...prev];
      [newRegions[fromIndex], newRegions[toIndex]] = [newRegions[toIndex], newRegions[fromIndex]];
      return newRegions;
    });
  };

  // Clear all regions
  const clearAllRegions = () => {
    setCustomRegions([]);
    setSelectedRegionId(null);
    setExtractedFrames([]);
  };

  // Auto-detect frames (basic grid-based detection)
  const autoDetectFrames = () => {
    // Use current grid settings to create initial regions
    const regions: CustomRegion[] = [];
    const colWidth = 100 / gridCols;
    const rowHeight = 100 / gridRows;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        regions.push({
          id: generateId(),
          x: col * colWidth,
          y: row * rowHeight,
          width: colWidth,
          height: rowHeight,
        });
      }
    }

    setCustomRegions(regions);
  };

  // Reset to recommended grid
  const resetToRecommended = () => {
    if (recommendation) {
      setGridCols(recommendation.recommendedColumns);
      setGridRows(recommendation.recommendedRows);
    }
  };

  // Calculate frame info
  const frameCount = mode === "grid" ? gridCols * gridRows : customRegions.length;
  const estimatedFrameWidth = imageDimensions.width > 0 ? Math.round(imageDimensions.width / gridCols) : 0;
  const estimatedFrameHeight = imageDimensions.height > 0 ? Math.round(imageDimensions.height / gridRows) : 0;

  // Check if matches standard
  const matchesStandard = estimatedFrameWidth === STANDARD_FRAME_SIZE.width && estimatedFrameHeight === STANDARD_FRAME_SIZE.height;
  const matchesRecommendation = recommendation && gridCols === recommendation.recommendedColumns && gridRows === recommendation.recommendedRows;

  return (
    <div className="space-y-4">
      {/* Header with animation type and recommendation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-base font-medium text-content-primary m-0">
            {animationType.charAt(0).toUpperCase() + animationType.slice(1)}
          </h4>
          {recommendation && mode === "grid" && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                matchesRecommendation
                  ? "bg-green-500/20 text-green-400"
                  : "bg-fal-purple-deep/20 text-fal-purple-light"
              }`}
              title={recommendation.description}
            >
              {matchesRecommendation ? "✓ Matches Game Config" : `Recommended: ${recommendation.recommendedColumns}×${recommendation.recommendedRows}`}
            </span>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-surface-tertiary rounded-lg p-0.5">
          <button
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              mode === "grid"
                ? "bg-fal-purple-deep text-white"
                : "text-content-secondary hover:text-content-primary"
            }`}
            onClick={() => setMode("grid")}
          >
            Grid
          </button>
          <button
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              mode === "custom"
                ? "bg-fal-purple-deep text-white"
                : "text-content-secondary hover:text-content-primary"
            }`}
            onClick={() => setMode("custom")}
          >
            Custom Regions
          </button>
        </div>
      </div>

      {/* Grid controls (only in grid mode) */}
      {mode === "grid" && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor={`${animationType}-cols`} className="text-sm text-content-secondary">Columns:</label>
            <input
              id={`${animationType}-cols`}
              type="number"
              className="w-16 px-2 py-1 text-sm bg-surface-tertiary border border-stroke rounded text-content-primary"
              min={1}
              max={12}
              value={gridCols}
              onChange={(e) => setGridCols(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={`${animationType}-rows`} className="text-sm text-content-secondary">Rows:</label>
            <input
              id={`${animationType}-rows`}
              type="number"
              className="w-16 px-2 py-1 text-sm bg-surface-tertiary border border-stroke rounded text-content-primary"
              min={1}
              max={8}
              value={gridRows}
              onChange={(e) => setGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
            />
          </div>

          <span className="text-sm text-content-tertiary">
            {frameCount} frames • {estimatedFrameWidth}×{estimatedFrameHeight}px
            {matchesStandard && <span className="ml-2 text-green-400">✓ 32×48</span>}
          </span>

          {recommendation && !matchesRecommendation && (
            <button
              className="px-3 py-1 text-xs bg-surface-tertiary border border-stroke rounded hover:border-stroke-hover text-content-secondary transition-colors"
              onClick={resetToRecommended}
            >
              Reset to Recommended
            </button>
          )}
        </div>
      )}

      {/* Custom region controls */}
      {mode === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-content-secondary">
            {customRegions.length} frame{customRegions.length !== 1 ? "s" : ""} selected
          </span>
          <button
            className="px-3 py-1 text-xs bg-surface-tertiary border border-stroke rounded hover:border-stroke-hover text-content-secondary transition-colors"
            onClick={autoDetectFrames}
          >
            Auto-detect ({gridCols}×{gridRows})
          </button>
          <button
            className="px-3 py-1 text-xs bg-surface-tertiary border border-stroke rounded hover:border-stroke-hover text-content-secondary transition-colors"
            onClick={clearAllRegions}
          >
            Clear All
          </button>
          {selectedRegionId && (
            <button
              className="px-3 py-1 text-xs bg-red-500/20 border border-red-500/30 rounded hover:bg-red-500/30 text-red-400 transition-colors"
              onClick={deleteSelectedRegion}
            >
              Delete Selected (Del)
            </button>
          )}
          <span className="text-xs text-content-tertiary ml-auto">
            Click + drag to draw frames
          </span>
        </div>
      )}

      {/* Sprite sheet with dividers/regions */}
      <div className="relative" ref={containerRef}>
        <div
          className={`relative inline-block ${mode === "custom" ? "cursor-crosshair" : ""}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={`${animationType} sprite sheet`}
            className="max-w-full h-auto rounded-lg border border-stroke select-none"
            draggable={false}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }}
          />

          {/* Grid mode overlay */}
          {mode === "grid" && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Vertical dividers (columns) - purple */}
              {verticalDividers.map((pos, index) => (
                <div
                  key={`v-${index}`}
                  className="absolute top-0 bottom-0 w-0.5 bg-fal-purple-light cursor-col-resize pointer-events-auto hover:w-1 transition-all group"
                  style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  onMouseDown={(e) => handleVerticalDividerDrag(index, e)}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 bg-fal-purple-light rounded-sm opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg" />
                </div>
              ))}

              {/* Horizontal dividers (rows) - pink */}
              {horizontalDividers.map((pos, index) => (
                <div
                  key={`h-${index}`}
                  className="absolute left-0 right-0 h-0.5 bg-pink-400 cursor-row-resize pointer-events-auto hover:h-1 transition-all group"
                  style={{ top: `${pos}%`, transform: 'translateY(-50%)' }}
                  onMouseDown={(e) => handleHorizontalDividerDrag(index, e)}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-3 bg-pink-400 rounded-sm opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg" />
                </div>
              ))}

              {/* Grid cell labels */}
              {isDirectional && gridRows === 4 && (
                <>
                  {DIRECTION_ROW_ORDER.map((dir, idx) => (
                    <div
                      key={dir}
                      className="absolute left-1 text-xs font-medium text-white bg-black/60 px-1.5 py-0.5 rounded"
                      style={{ top: `${(idx + 0.5) * (100 / 4)}%`, transform: 'translateY(-50%)' }}
                    >
                      {dir}
                    </div>
                  ))}
                </>
              )}
              {isAttackCombined && gridRows === 3 && (
                <>
                  <div className="absolute left-1 text-xs font-medium text-white bg-black/60 px-1.5 py-0.5 rounded" style={{ top: `${0.5 * (100 / 3)}%`, transform: 'translateY(-50%)' }}>Attack 1</div>
                  <div className="absolute left-1 text-xs font-medium text-white bg-black/60 px-1.5 py-0.5 rounded" style={{ top: `${1.5 * (100 / 3)}%`, transform: 'translateY(-50%)' }}>Attack 2</div>
                  <div className="absolute left-1 text-xs font-medium text-white bg-black/60 px-1.5 py-0.5 rounded" style={{ top: `${2.5 * (100 / 3)}%`, transform: 'translateY(-50%)' }}>Attack 3</div>
                </>
              )}
            </div>
          )}

          {/* Custom regions mode overlay */}
          {mode === "custom" && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Existing regions */}
              {customRegions.map((region, index) => (
                <div
                  key={region.id}
                  className={`absolute border-2 pointer-events-auto ${
                    selectedRegionId === region.id
                      ? "border-fal-cyan bg-fal-cyan/10"
                      : "border-fal-purple-light bg-fal-purple-light/10 hover:border-fal-purple-deep"
                  }`}
                  style={{
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.width}%`,
                    height: `${region.height}%`,
                    cursor: selectedRegionId === region.id ? "move" : "pointer",
                  }}
                >
                  {/* Frame number badge */}
                  <div className={`absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    selectedRegionId === region.id
                      ? "bg-fal-cyan text-black"
                      : "bg-fal-purple-light text-white"
                  }`}>
                    {index + 1}
                  </div>

                  {/* Resize handles (only for selected) */}
                  {selectedRegionId === region.id && (
                    <>
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-fal-cyan rounded-full cursor-nw-resize" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-fal-cyan rounded-full cursor-ne-resize" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-fal-cyan rounded-full cursor-sw-resize" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-fal-cyan rounded-full cursor-se-resize" />
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-fal-cyan rounded-full cursor-n-resize" />
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-fal-cyan rounded-full cursor-s-resize" />
                      <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-fal-cyan rounded-full cursor-w-resize" />
                      <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-fal-cyan rounded-full cursor-e-resize" />
                    </>
                  )}
                </div>
              ))}

              {/* Currently drawing region */}
              {isDrawing && currentDraw && (
                <div
                  className="absolute border-2 border-dashed border-fal-cyan bg-fal-cyan/20"
                  style={{
                    left: `${currentDraw.x}%`,
                    top: `${currentDraw.y}%`,
                    width: `${currentDraw.width}%`,
                    height: `${currentDraw.height}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Frame list for custom regions (for reordering) */}
      {mode === "custom" && customRegions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {customRegions.map((region, index) => (
            <div
              key={region.id}
              className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors ${
                selectedRegionId === region.id
                  ? "bg-fal-cyan/20 border-fal-cyan text-fal-cyan"
                  : "bg-surface-tertiary border-stroke text-content-secondary hover:border-stroke-hover"
              }`}
              onClick={() => setSelectedRegionId(region.id)}
            >
              <span className="text-xs font-medium">Frame {index + 1}</span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30"
                  onClick={(e) => { e.stopPropagation(); moveRegion(index, "up"); }}
                  disabled={index === 0}
                  title="Move up in order"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30"
                  onClick={(e) => { e.stopPropagation(); moveRegion(index, "down"); }}
                  disabled={index === customRegions.length - 1}
                  title="Move down in order"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Extracted frames preview */}
      {extractedFrames.length > 0 && (
        <div className="mt-4">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: mode === "grid"
                ? `repeat(${gridCols}, minmax(0, 1fr))`
                : `repeat(${Math.min(6, extractedFrames.length)}, minmax(0, 1fr))`,
            }}
          >
            {extractedFrames.map((frame, index) => {
              let label = `${index + 1}`;
              if (mode === "grid") {
                const row = Math.floor(index / gridCols);
                const col = index % gridCols;
                if (isDirectional && gridRows === 4) {
                  const direction = DIRECTION_ROW_ORDER[row];
                  label = `${direction[0].toUpperCase()}${col + 1}`;
                } else if (isAttackCombined && gridRows === 3) {
                  label = `A${row + 1}-${col + 1}`;
                }
              }

              return (
                <div key={index} className="flex flex-col items-center">
                  <div
                    className={`bg-surface-tertiary border rounded p-1 ${
                      mode === "custom" && customRegions[index]?.id === selectedRegionId
                        ? "border-fal-cyan"
                        : "border-stroke"
                    }`}
                    onClick={() => mode === "custom" && customRegions[index] && setSelectedRegionId(customRegions[index].id)}
                  >
                    <img
                      src={frame.dataUrl}
                      alt={`Frame ${index + 1}`}
                      className="max-w-full h-auto pixelated"
                      style={{ maxHeight: '60px' }}
                    />
                  </div>
                  <span className="text-[10px] text-content-tertiary mt-0.5">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Animation timing info */}
      {recommendation && (
        <div className="flex items-center gap-2 text-xs text-content-tertiary">
          <span>Duration: {recommendation.frameDuration}ms/frame</span>
          <span>•</span>
          <span>Total: {extractedFrames.length * recommendation.frameDuration}ms</span>
          <span>•</span>
          <span>{recommendation.loop ? "Loops" : "Plays once"}</span>
        </div>
      )}
    </div>
  );
}
