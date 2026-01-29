"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Direction8,
  AnimationType,
  ANIMATION_CONFIGS,
  ANIMATION_SPEEDS,
  DIRECTION_ROW_ORDER_8,
} from "../config/animation-types";
import { DirectionalFrameSet8, Frame } from "../types";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MiniPixiSandboxProps {
  // For directional animations (idle/walk)
  directionalFrames?: DirectionalFrameSet8;
  // For non-directional animations
  frames?: Frame[];
  // Animation configuration
  animationType: AnimationType;
  // Canvas dimensions
  width?: number;
  height?: number;
  // Show direction controls for directional animations
  showDirectionControls?: boolean;
  // Callback when direction changes
  onDirectionChange?: (direction: Direction8) => void;
  // Initial direction
  initialDirection?: Direction8;
}

// Get default animation speed based on type
function getDefaultSpeedMs(animationType: AnimationType): number {
  switch (animationType) {
    case "idle":
      return ANIMATION_SPEEDS.IDLE;
    case "walk":
      return ANIMATION_SPEEDS.WALK;
    case "attack1":
    case "attack2":
    case "attack3":
      return ANIMATION_SPEEDS.ATTACK;
    case "dash":
      return ANIMATION_SPEEDS.DASH;
    case "hurt":
      return ANIMATION_SPEEDS.HURT;
    case "death":
      return ANIMATION_SPEEDS.DEATH;
    case "special":
      return ANIMATION_SPEEDS.SPECIAL;
    default:
      return 100;
  }
}

// Create empty 8-directional frame set
function createEmptyDirectionalSet<T>(): Record<Direction8, T[]> {
  return {
    south: [], south_west: [], west: [], north_west: [],
    north: [], north_east: [], east: [], south_east: [],
  };
}

export default function MiniPixiSandbox({
  directionalFrames,
  frames,
  animationType,
  width = 200,
  height = 150,
  showDirectionControls = true,
  onDirectionChange,
  initialDirection = "south",
}: MiniPixiSandboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [direction, setDirection] = useState<Direction8>(initialDirection);

  // Playback controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [speedMs, setSpeedMs] = useState(() => getDefaultSpeedMs(animationType));

  // Animation state
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const animationRef = useRef<number>(0);

  // Loaded images
  const imagesRef = useRef<{
    directional: Record<Direction8, HTMLImageElement[]>;
    flat: HTMLImageElement[];
  }>({
    directional: createEmptyDirectionalSet(),
    flat: [],
  });

  const frameDataRef = useRef<{
    directional: Record<Direction8, Frame[]>;
    flat: Frame[];
  }>({
    directional: createEmptyDirectionalSet(),
    flat: [],
  });

  const config = ANIMATION_CONFIGS[animationType];
  const isDirectional = config.isDirectional;

  // Calculate ground position (matching game proportions)
  const groundY = height * 0.85;
  const targetCharacterHeight = height * 0.55; // Character takes ~55% of height

  // Handle direction change
  const handleDirectionChange = useCallback(
    (newDirection: Direction8) => {
      setDirection(newDirection);
      frameIndexRef.current = 0;
      onDirectionChange?.(newDirection);
    },
    [onDirectionChange]
  );

  // Reset to first frame
  const resetAnimation = useCallback(() => {
    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
  }, []);

  // Load directional frames
  useEffect(() => {
    if (!directionalFrames) return;

    const loadDirectionalFrames = async () => {
      for (const dir of DIRECTION_ROW_ORDER_8) {
        const dirFrames = directionalFrames[dir];
        if (!dirFrames) continue;
        
        const images: HTMLImageElement[] = [];
        for (const frame of dirFrames) {
          const img = new Image();
          img.src = frame.dataUrl;
          await new Promise((resolve) => {
            img.onload = resolve;
          });
          images.push(img);
        }
        imagesRef.current.directional[dir] = images;
        frameDataRef.current.directional[dir] = dirFrames;
      }
    };

    loadDirectionalFrames();
  }, [directionalFrames]);

  // Load flat frames
  useEffect(() => {
    if (!frames || frames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of frames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      imagesRef.current.flat = images;
      frameDataRef.current.flat = frames;
    };

    loadImages();
  }, [frames]);

  // Game loop
  const gameLoop = useCallback(
    (currentTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      // Get current frames based on animation type
      let currentImages: HTMLImageElement[] = [];
      let currentFrameData: Frame[] = [];

      if (isDirectional && imagesRef.current.directional[direction]?.length > 0) {
        currentImages = imagesRef.current.directional[direction];
        currentFrameData = frameDataRef.current.directional[direction];
      } else if (!isDirectional && imagesRef.current.flat.length > 0) {
        currentImages = imagesRef.current.flat;
        currentFrameData = frameDataRef.current.flat;
      }

      // Time-based frame advancement (only if playing)
      if (isPlaying && currentTime - lastFrameTimeRef.current >= speedMs) {
        lastFrameTimeRef.current = currentTime;
        frameIndexRef.current++;

        if (frameIndexRef.current >= currentImages.length) {
          if (loop) {
            frameIndexRef.current = 0;
          } else {
            frameIndexRef.current = Math.max(0, currentImages.length - 1);
            setIsPlaying(false); // Stop when animation ends
          }
        }
      }

      // Draw simple dark background (no parallax)
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid pattern
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw character
      if (currentImages.length > 0 && currentFrameData.length > 0) {
        const idx = Math.min(frameIndexRef.current, currentImages.length - 1);
        const currentImg = currentImages[idx];
        const currentFrame = currentFrameData[idx];

        if (currentImg && currentFrame) {
          // Scale based on content bounds
          const referenceContentHeight = currentFrame.contentBounds.height;
          const scale = targetCharacterHeight / referenceContentHeight;

          const drawWidth = currentImg.width * scale;
          const drawHeight = currentImg.height * scale;

          const contentBounds = currentFrame.contentBounds;
          const feetY = (contentBounds.y + contentBounds.height) * scale;

          // Position character - feet on ground
          const drawY = groundY - feetY;

          // Center horizontally based on content bounds
          const contentCenterX = (contentBounds.x + contentBounds.width / 2) * scale;
          const drawX = width / 2 - contentCenterX;

          // Draw shadow
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.beginPath();
          const shadowWidth = contentBounds.width * scale * 0.35;
          ctx.ellipse(width / 2, groundY + 2, shadowWidth, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Draw character
          ctx.drawImage(currentImg, drawX, drawY, drawWidth, drawHeight);
        }

        // Show frame counter
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${frameIndexRef.current + 1}/${currentImages.length}`, 6, 14);
      } else {
        // No frames loaded - show placeholder
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No frames", width / 2, height / 2);
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    },
    [width, height, direction, isDirectional, groundY, targetCharacterHeight, isPlaying, speedMs, loop]
  );

  // Initialize canvas
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if we have any frames
    const hasFrames =
      (directionalFrames &&
        Object.values(directionalFrames).some((d) => d?.length > 0)) ||
      (frames && frames.length > 0);

    if (!hasFrames) return;

    containerRef.current.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = "block";
    canvas.style.borderRadius = "6px";
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [directionalFrames, frames, width, height, gameLoop]);

  const hasAnyFrames =
    (directionalFrames &&
      Object.values(directionalFrames).some((d) => d?.length > 0)) ||
    (frames && frames.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="border border-stroke/50 rounded-lg overflow-hidden bg-[#1a1a2e]"
        style={{ width, height }}
      >
        {!hasAnyFrames && (
          <div
            className="flex items-center justify-center text-content-tertiary text-xs"
            style={{ width, height }}
          >
            No frames extracted
          </div>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Playback buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (!isPlaying) {
                const currentImages = isDirectional
                  ? imagesRef.current.directional[direction]
                  : imagesRef.current.flat;
                if (frameIndexRef.current >= currentImages.length - 1) {
                  resetAnimation();
                }
              }
              setIsPlaying(!isPlaying);
            }}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              isPlaying
                ? "bg-fal-purple-deep text-white"
                : "bg-surface-tertiary text-content-primary hover:bg-surface-elevated"
            }`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button
            onClick={() => {
              resetAnimation();
              setIsPlaying(true);
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center bg-surface-tertiary text-content-secondary hover:bg-surface-elevated hover:text-content-primary transition-colors"
            title="Restart"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          <button
            onClick={() => setLoop(!loop)}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              loop
                ? "bg-fal-cyan/20 text-fal-cyan"
                : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
            }`}
            title={loop ? "Loop ON" : "Loop OFF"}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </div>

        {/* Right: Speed control */}
        <div className="flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-tertiary">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <input
            type="range"
            min="20"
            max="300"
            step="10"
            value={300 - speedMs + 20}
            onChange={(e) => setSpeedMs(300 - parseInt(e.target.value) + 20)}
            className="w-16 h-1 accent-fal-purple-deep cursor-pointer"
            title={`${speedMs}ms/frame`}
          />
        </div>
      </div>

      {/* Direction controls — 8 directions */}
      {isDirectional && showDirectionControls && (
        <div className="grid grid-cols-3 gap-1 w-fit mx-auto">
          {([
            ['north_west', '↖'], ['north', '↑'], ['north_east', '↗'],
            ['west', '←'],       ['south', '↓'], ['east', '→'],
            ['south_west', '↙'], ['south', '↓'], ['south_east', '↘'],
          ] as [Direction8, string][]).map(([dir, arrow], i) => {
            // Center cell (index 4) shows south/down
            if (i === 4) {
              return (
                <button
                  key="south-center"
                  onClick={() => handleDirectionChange("south")}
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors ${
                    direction === "south"
                      ? "bg-fal-purple-deep text-white"
                      : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
                  }`}
                >
                  ●
                </button>
              );
            }
            return (
              <button
                key={dir + i}
                onClick={() => handleDirectionChange(dir)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors ${
                  direction === dir
                    ? "bg-fal-purple-deep text-white"
                    : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
                }`}
              >
                {arrow}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
