"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type { Frame } from "@/app/types";
import { canvasToDataUrl, getContentBoundsFromCanvas } from "@/app/utils/frameConversion";
import { applyChromaKey, getColorAtPosition } from "@/app/utils/chromaKey";

const DEFAULT_PALETTE = [
  "#111827",
  "#f8fafc",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#38acc6",
  "#3b82f6",
  "#a855f7",
];

type Tool = "pencil" | "eraser" | "fill" | "picker";

interface PixelFrame {
  id: string;
  data: Uint8ClampedArray;
  previewUrl: string;
}

interface PixelEditorProps {
  width: number;
  height: number;
  frameCount: number;
  onFramesReady?: (frames: Frame[]) => void;
  title?: string;
  description?: string;
}

interface Point {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b, a: 255 };
}

function sameColor(a: number[], b: number[]) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function PixelEditor({
  width,
  height,
  frameCount,
  onFramesReady,
  title = "Pixel Draw",
  description = "Draw frame-by-frame sprites optimized for Ichigo Journey.",
}: PixelEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onionRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const onionBufferRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#e63946");
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [zoom, setZoom] = useState(12);
  const [showGrid, setShowGrid] = useState(true);
  const [showOnion, setShowOnion] = useState(true);
  const [fps, setFps] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chromaColor, setChromaColor] = useState("#00ff00");
  const [chromaTolerance, setChromaTolerance] = useState(24);
  const [pickMode, setPickMode] = useState<"brush" | "chroma" | null>(null);
  const [importMode, setImportMode] = useState<"contain" | "cover" | "stretch">("contain");
  const [pixelation, setPixelation] = useState(1);

  const blankData = useMemo(() => new Uint8ClampedArray(width * height * 4), [width, height]);

  const createPreviewUrl = useCallback(
    (data: Uint8ClampedArray) => {
      if (!previewCanvasRef.current) {
        previewCanvasRef.current = document.createElement("canvas");
      }
      const canvas = previewCanvasRef.current;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
      return canvas.toDataURL("image/png");
    },
    [width, height]
  );

  const createBlankFrame = useCallback(
    () => ({
      id: createId("frame"),
      data: new Uint8ClampedArray(blankData),
      previewUrl: createPreviewUrl(blankData),
    }),
    [blankData, createPreviewUrl]
  );

  const [frames, setFrames] = useState<PixelFrame[]>(() => {
    const list: PixelFrame[] = [];
    const initialCount = frameCount > 0 ? 1 : 0;
    for (let i = 0; i < initialCount; i++) {
      list.push({
        id: createId(`frame-${i}`),
        data: new Uint8ClampedArray(blankData),
        previewUrl: "",
      });
    }
    return list;
  });

  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const framesRef = useRef<PixelFrame[]>(frames);
  const isDirtyRef = useRef(false);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);

  useEffect(() => {
    if (frames.some((frame) => !frame.previewUrl)) {
      setFrames((prev) =>
        prev.map((frame) =>
          frame.previewUrl
            ? frame
            : { ...frame, previewUrl: createPreviewUrl(frame.data) }
        )
      );
    }
  }, [frames, createPreviewUrl]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    const frame = frames[activeFrameIndex];
    if (frame) {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
    }
  }, [frames, activeFrameIndex, width, height]);

  const drawOnionSkin = useCallback(() => {
    const canvas = onionRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    if (!showOnion) return;

    if (!onionBufferRef.current) {
      onionBufferRef.current = document.createElement("canvas");
    }
    const buffer = onionBufferRef.current;
    buffer.width = width;
    buffer.height = height;
    const bufferCtx = buffer.getContext("2d")!;

    const drawGhost = (frame: PixelFrame | undefined, alpha: number) => {
      if (!frame) return;
      bufferCtx.clearRect(0, 0, width, height);
      bufferCtx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
      ctx.globalAlpha = alpha;
      ctx.drawImage(buffer, 0, 0);
      ctx.globalAlpha = 1;
    };

    drawGhost(frames[activeFrameIndex - 1], 0.25);
    drawGhost(frames[activeFrameIndex + 1], 0.25);
  }, [frames, activeFrameIndex, showOnion, width, height]);

  useEffect(() => {
    drawOnionSkin();
  }, [drawOnionSkin]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = 0;
    let index = 0;

    const drawFrame = (frame: PixelFrame | undefined) => {
      if (!frame) return;
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
    };

    const tick = (time: number) => {
      if (!isPlaying) return;
      const interval = 1000 / Math.max(1, fps);
      if (time - last >= interval) {
        drawFrame(frames[index % frames.length]);
        index = (index + 1) % frames.length;
        last = time;
      }
      raf = requestAnimationFrame(tick);
    };

    if (frames.length === 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    if (isPlaying) {
      raf = requestAnimationFrame(tick);
    } else {
      drawFrame(frames[activeFrameIndex]);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [frames, activeFrameIndex, fps, isPlaying, width, height]);

  const getCanvasPoint = useCallback(
    (event: PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);
      return {
        x: clamp(x, 0, width - 1),
        y: clamp(y, 0, height - 1),
      };
    },
    [width, height]
  );

  const drawPixel = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, mode: Tool) => {
      if (mode === "eraser") {
        ctx.clearRect(x, y, 1, 1);
        return;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    },
    [color]
  );

  const drawLine = useCallback(
    (ctx: CanvasRenderingContext2D, start: Point, end: Point, mode: Tool) => {
      let x0 = start.x;
      let y0 = start.y;
      const x1 = end.x;
      const y1 = end.y;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        drawPixel(ctx, x0, y0, mode);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
    },
    [drawPixel]
  );

  const commitActiveFrame = useCallback(
    (force?: boolean) => {
      if (!canvasRef.current) return;
      if (!isDirtyRef.current && !force) return;
      const ctx = canvasRef.current.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = new Uint8ClampedArray(imageData.data);
      const previewUrl = createPreviewUrl(data);
      setFrames((prev) => {
        const next = [...prev];
        if (next[activeFrameIndex]) {
          next[activeFrameIndex] = {
            ...next[activeFrameIndex],
            data,
            previewUrl,
          };
        }
        return next;
      });
      isDirtyRef.current = false;
    },
    [activeFrameIndex, createPreviewUrl, width, height]
  );

  const applyFill = useCallback(
    (ctx: CanvasRenderingContext2D, point: Point) => {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const index = (point.y * width + point.x) * 4;
      const target = [data[index], data[index + 1], data[index + 2], data[index + 3]];
      const fill = hexToRgba(color);
      const replacement = [fill.r, fill.g, fill.b, fill.a];

      if (sameColor(target, replacement)) return;

      const stack: Point[] = [point];
      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const idx = (y * width + x) * 4;
        const current = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        if (!sameColor(current, target)) continue;
        data[idx] = replacement[0];
        data[idx + 1] = replacement[1];
        data[idx + 2] = replacement[2];
        data[idx + 3] = replacement[3];
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [color, width, height]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;
      event.preventDefault();
      canvasRef.current.setPointerCapture(event.pointerId);
      const point = getCanvasPoint(event);

      if (pickMode === "chroma") {
        setChromaColor(getColorAtPosition(canvasRef.current, point.x, point.y));
        setPickMode(null);
        return;
      }

      if (tool === "picker") {
        setColor(getColorAtPosition(canvasRef.current, point.x, point.y));
        return;
      }

      const ctx = canvasRef.current.getContext("2d")!;

      if (tool === "fill") {
        applyFill(ctx, point);
        isDirtyRef.current = true;
        commitActiveFrame(true);
        return;
      }

      isDrawingRef.current = true;
      lastPointRef.current = point;
      drawLine(ctx, point, point, tool);
      isDirtyRef.current = true;
    },
    [applyFill, commitActiveFrame, drawLine, getCanvasPoint, pickMode, tool]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !canvasRef.current) return;
      event.preventDefault();
      const ctx = canvasRef.current.getContext("2d")!;
      const point = getCanvasPoint(event);
      const last = lastPointRef.current ?? point;
      drawLine(ctx, last, point, tool);
      lastPointRef.current = point;
      isDirtyRef.current = true;
    },
    [drawLine, getCanvasPoint, tool]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;
      event.preventDefault();
      isDrawingRef.current = false;
      lastPointRef.current = null;
      commitActiveFrame();
    },
    [commitActiveFrame]
  );

  const handleSelectFrame = useCallback(
    (index: number) => {
      commitActiveFrame();
      setActiveFrameIndex(clamp(index, 0, frames.length - 1));
    },
    [commitActiveFrame, frames.length]
  );

  const handleAddFrame = useCallback(() => {
    if (frames.length >= frameCount) return;
    commitActiveFrame();
    setFrames((prev) => {
      const next = [...prev];
      next.splice(activeFrameIndex + 1, 0, createBlankFrame());
      return next;
    });
    setActiveFrameIndex((prev) => prev + 1);
  }, [frames.length, frameCount, commitActiveFrame, activeFrameIndex, createBlankFrame]);

  const handleDuplicateFrame = useCallback(() => {
    if (frames.length >= frameCount) return;
    commitActiveFrame();
    setFrames((prev) => {
      const next = [...prev];
      const source = prev[activeFrameIndex];
      if (!source) return prev;
      next.splice(activeFrameIndex + 1, 0, {
        id: createId("frame"),
        data: new Uint8ClampedArray(source.data),
        previewUrl: source.previewUrl,
      });
      return next;
    });
    setActiveFrameIndex((prev) => prev + 1);
  }, [frames.length, frameCount, commitActiveFrame, activeFrameIndex]);

  const handleDeleteFrame = useCallback(() => {
    if (frames.length <= 1) return;
    commitActiveFrame();
    setFrames((prev) => prev.filter((_, idx) => idx !== activeFrameIndex));
    setActiveFrameIndex((prev) => Math.max(0, prev - 1));
  }, [frames.length, commitActiveFrame, activeFrameIndex]);

  const handleClearFrame = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    isDirtyRef.current = true;
    commitActiveFrame(true);
  }, [commitActiveFrame, width, height]);

  const handleApplyChroma = useCallback(
    (applyAll: boolean) => {
      const applyToFrame = (frame: PixelFrame | undefined) => {
        if (!frame) return frame as PixelFrame;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
        const result = applyChromaKey(canvas, chromaColor, chromaTolerance);
        const data = result.getContext("2d")!.getImageData(0, 0, width, height).data;
        return {
          ...frame,
          data: new Uint8ClampedArray(data),
          previewUrl: createPreviewUrl(new Uint8ClampedArray(data)),
        };
      };

      if (applyAll) {
        setFrames((prev) => prev.map((frame) => applyToFrame(frame)));
      } else {
        setFrames((prev) => {
          const next = [...prev];
          next[activeFrameIndex] = applyToFrame(next[activeFrameIndex]);
          return next;
        });
      }
    },
    [activeFrameIndex, chromaColor, chromaTolerance, createPreviewUrl, width, height]
  );

  const handleAddPaletteColor = useCallback(() => {
    setPalette((prev) => (prev.includes(color) ? prev : [...prev, color]));
  }, [color]);

  const handleImportImage = useCallback(
    async (file: File) => {
      if (!canvasRef.current) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const sampleScale = Math.max(1, pixelation);
        const sampleWidth = Math.max(1, Math.round(width / sampleScale));
        const sampleHeight = Math.max(1, Math.round(height / sampleScale));
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = sampleWidth;
        sampleCanvas.height = sampleHeight;
        const sampleCtx = sampleCanvas.getContext("2d")!;
        sampleCtx.imageSmoothingEnabled = false;

        const scaleX = sampleWidth / img.width;
        const scaleY = sampleHeight / img.height;
        let drawWidth = sampleWidth;
        let drawHeight = sampleHeight;
        if (importMode !== "stretch") {
          const scale = importMode === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
        }
        const offsetX = (sampleWidth - drawWidth) / 2;
        const offsetY = (sampleHeight - drawHeight) / 2;
        sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
        sampleCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        const ctx = canvasRef.current!.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sampleCanvas, 0, 0, width, height);

        isDirtyRef.current = true;
        commitActiveFrame(true);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [commitActiveFrame, importMode, pixelation, width, height]
  );

  const handleFinalize = useCallback(() => {
    if (!onFramesReady) return;

    let currentData: Uint8ClampedArray | null = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, width, height);
      currentData = new Uint8ClampedArray(imageData.data);
    }

    const snapshot = framesRef.current.map((frame, idx) =>
      idx === activeFrameIndex && currentData
        ? { ...frame, data: currentData }
        : frame
    );

    const padded = [...snapshot];
    while (padded.length < frameCount) {
      padded.push(createBlankFrame());
    }

    const output = padded.slice(0, frameCount).map((frame) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
      return {
        dataUrl: canvasToDataUrl(canvas),
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        contentBounds: getContentBoundsFromCanvas(canvas),
      };
    });

    onFramesReady(output);
  }, [activeFrameIndex, frameCount, createBlankFrame, onFramesReady, width, height]);

  const containerStyle = useMemo<CSSProperties>(() => {
    return {
      width: `${width * zoom}px`,
      height: `${height * zoom}px`,
    };
  }, [width, height, zoom]);

  const gridStyle = useMemo<CSSProperties>(() => {
    return {
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
      backgroundSize: `${zoom}px ${zoom}px`,
    };
  }, [zoom]);

  const canAddFrame = frames.length < frameCount;
  const canDeleteFrame = frames.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-content-primary m-0">{title}</h3>
            <p className="text-[11px] text-content-tertiary m-0">{description}</p>
          </div>
          {onFramesReady && (
            <button
              onClick={handleFinalize}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-fal-cyan text-black hover:bg-fal-cyan/80 transition-colors"
            >
              Use Frames ({frames.length}/{frameCount})
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-content-tertiary">
          <span className="px-2 py-1 rounded-md bg-surface-tertiary">Frame size: {width}x{height}px</span>
          <span className="px-2 py-1 rounded-md bg-surface-tertiary">Max frames: {frameCount}</span>
          <span className="px-2 py-1 rounded-md bg-surface-tertiary">Auto-pads on export</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_260px] gap-4">
        {/* Left panel */}
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-lg border border-stroke/40 bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-content-secondary font-semibold">Tools</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "pencil", label: "Pencil" },
                { id: "eraser", label: "Eraser" },
                { id: "fill", label: "Fill" },
                { id: "picker", label: "Pick" },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTool(item.id)}
                  className={`px-2 py-2 rounded-md text-[11px] font-semibold transition-colors border ${
                    tool === item.id
                      ? "bg-fal-purple-deep text-white border-fal-purple-deep"
                      : "bg-surface-tertiary text-content-secondary border-stroke/40 hover:border-stroke-hover"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-stroke/40 bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-content-secondary font-semibold">Color</span>
              <button
                onClick={handleAddPaletteColor}
                className="text-[10px] text-content-tertiary hover:text-content-secondary"
              >
                Add to palette
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-md border border-stroke/40 bg-transparent"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-2 py-1 rounded-md bg-surface-tertiary border border-stroke/40 text-[11px] text-content-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {palette.map((swatch) => (
                <button
                  key={swatch}
                  onClick={() => setColor(swatch)}
                  className="w-6 h-6 rounded-md border border-stroke/40"
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-stroke/40 bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-content-secondary font-semibold">Chroma Key</span>
              <button
                onClick={() => setPickMode("chroma")}
                className={`text-[10px] ${pickMode === "chroma" ? "text-fal-cyan" : "text-content-tertiary"}`}
              >
                Pick from canvas
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={chromaColor}
                onChange={(e) => setChromaColor(e.target.value)}
                className="w-8 h-8 rounded-md border border-stroke/40 bg-transparent"
              />
              <input
                type="text"
                value={chromaColor}
                onChange={(e) => setChromaColor(e.target.value)}
                className="flex-1 px-2 py-1 rounded-md bg-surface-tertiary border border-stroke/40 text-[11px] text-content-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={120}
                value={chromaTolerance}
                onChange={(e) => setChromaTolerance(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-[10px] text-content-tertiary w-8 text-right">{chromaTolerance}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleApplyChroma(false)}
                className="flex-1 px-2 py-1.5 rounded-md text-[10px] bg-surface-tertiary text-content-secondary border border-stroke/40 hover:border-stroke-hover"
              >
                Apply
              </button>
              <button
                onClick={() => handleApplyChroma(true)}
                className="flex-1 px-2 py-1.5 rounded-md text-[10px] bg-surface-tertiary text-content-secondary border border-stroke/40 hover:border-stroke-hover"
              >
                Apply all
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-stroke/40 bg-surface-secondary">
            <span className="text-[11px] text-content-secondary font-semibold">Import & Pixelize</span>
            <label className="mt-2 flex items-center justify-center border border-dashed border-stroke/50 rounded-md p-3 text-[10px] text-content-tertiary cursor-pointer hover:border-stroke-hover">
              Drop image or click to upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportImage(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <div className="mt-2 flex items-center justify-between text-[10px] text-content-tertiary">
              <span>Fit mode</span>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as typeof importMode)}
                className="bg-surface-tertiary border border-stroke/40 rounded-md px-2 py-1 text-[10px] text-content-secondary"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="stretch">Stretch</option>
              </select>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-content-tertiary">Pixelation</span>
              <input
                type="range"
                min={1}
                max={6}
                value={pixelation}
                onChange={(e) => setPixelation(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-[10px] text-content-tertiary w-6 text-right">{pixelation}</span>
            </div>
          </div>
        </div>

        {/* Center canvas */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] text-content-tertiary">
            <button
              onClick={() => setZoom((prev) => Math.max(6, prev - 2))}
              className="px-2 py-1 rounded-md border border-stroke/40 bg-surface-tertiary"
            >
              -
            </button>
            <span>Zoom {zoom}x</span>
            <button
              onClick={() => setZoom((prev) => Math.min(24, prev + 2))}
              className="px-2 py-1 rounded-md border border-stroke/40 bg-surface-tertiary"
            >
              +
            </button>
            <button
              onClick={() => setShowGrid((prev) => !prev)}
              className="px-2 py-1 rounded-md border border-stroke/40 bg-surface-tertiary"
            >
              {showGrid ? "Hide grid" : "Show grid"}
            </button>
            <button
              onClick={() => setShowOnion((prev) => !prev)}
              className="px-2 py-1 rounded-md border border-stroke/40 bg-surface-tertiary"
            >
              {showOnion ? "Onion on" : "Onion off"}
            </button>
          </div>

          <div
            className="relative sprite-checkerboard rounded-lg border border-stroke/40 overflow-hidden"
            style={containerStyle}
          >
            <canvas
              ref={onionRef}
              width={width}
              height={height}
              className="absolute inset-0 pointer-events-none"
              style={{ width: "100%", height: "100%", imageRendering: "pixelated", opacity: 0.8 }}
            />
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0"
              style={{ width: "100%", height: "100%", imageRendering: "pixelated", touchAction: "none" }}
            />
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none" style={gridStyle} />
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                isPlaying
                  ? "bg-fal-purple-deep text-white"
                  : "bg-surface-tertiary text-content-secondary"
              }`}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <label className="text-[11px] text-content-tertiary">
              FPS {fps}
              <input
                type="range"
                min={4}
                max={16}
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
                className="ml-2 align-middle"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-content-tertiary">Preview</span>
            <div className="sprite-checkerboard rounded-md border border-stroke/40 p-2">
              <canvas
                ref={previewRef}
                width={width}
                height={height}
                style={{ width: width * 3, height: height * 3, imageRendering: "pixelated" }}
              />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-lg border border-stroke/40 bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-content-secondary font-semibold">Frames</span>
              <span className="text-[10px] text-content-tertiary">{frames.length}/{frameCount}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-auto pr-1">
              {frames.map((frame, idx) => (
                <button
                  key={frame.id}
                  onClick={() => handleSelectFrame(idx)}
                  className={`relative rounded-md border ${
                    idx === activeFrameIndex
                      ? "border-fal-cyan"
                      : "border-stroke/40"
                  }`}
                >
                  <div className="sprite-checkerboard w-full aspect-square rounded-md overflow-hidden">
                    {frame.previewUrl && (
                      <img
                        src={frame.previewUrl}
                        alt={`Frame ${idx + 1}`}
                        className="w-full h-full pixelated"
                      />
                    )}
                  </div>
                  <span className="absolute -top-2 -right-2 text-[9px] bg-surface-tertiary px-1 rounded-md border border-stroke/40">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={handleAddFrame}
                disabled={!canAddFrame}
                className="px-2 py-1.5 rounded-md text-[10px] bg-surface-tertiary text-content-secondary border border-stroke/40 disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={handleDuplicateFrame}
                disabled={!canAddFrame}
                className="px-2 py-1.5 rounded-md text-[10px] bg-surface-tertiary text-content-secondary border border-stroke/40 disabled:opacity-40"
              >
                Duplicate
              </button>
              <button
                onClick={handleDeleteFrame}
                disabled={!canDeleteFrame}
                className="px-2 py-1.5 rounded-md text-[10px] bg-surface-tertiary text-content-secondary border border-stroke/40 disabled:opacity-40"
              >
                Delete
              </button>
              <button
                onClick={handleClearFrame}
                className="px-2 py-1.5 rounded-md text-[10px] bg-surface-tertiary text-content-secondary border border-stroke/40"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-stroke/40 bg-surface-secondary">
            <span className="text-[11px] text-content-secondary font-semibold">Hints</span>
            <ul className="text-[10px] text-content-tertiary mt-2 space-y-1">
              <li>Use Pick to sample colors from your sprite.</li>
              <li>Chroma key works well for flat backgrounds.</li>
              <li>Preview uses current frame order.</li>
              <li>Exports use sprite-config.json for Excalibur + Ichigo Journey.</li>
              <li>Slots preview matches the in-game sandbox behavior.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
