"use client";

import { useEffect, useRef, useCallback } from "react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  dataUrl: string;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

interface PixiSandboxProps {
  walkFrames: Frame[];
  jumpFrames: Frame[];
  attackFrames: Frame[];
  fps: number;
}

// Side-scroller parallax layers
const PARALLAX_LAYERS = [
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-1.png", speed: 0 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-2.png", speed: 0.1 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-3.png", speed: 0.3 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-4.png", speed: 0.5 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-5.png", speed: 0.7 },
];

// Jump physics constants
const JUMP_VELOCITY = -12;
const GRAVITY = 0.6;

export default function PixiSandbox({ walkFrames, jumpFrames, attackFrames, fps }: PixiSandboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const characterState = useRef({
    x: 400,
    y: 0,
    velocityY: 0,
    direction: "right" as "left" | "right",
    isWalking: false,
    isJumping: false,
    isAttacking: false,
    walkFrameIndex: 0,
    jumpFrameIndex: 0,
    attackFrameIndex: 0,
    frameTime: 0,
    jumpFrameTime: 0,
    attackFrameTime: 0,
  });
  const keysPressed = useRef<Set<string>>(new Set());
  const animationRef = useRef<number>(0);
  const walkImagesRef = useRef<HTMLImageElement[]>([]);
  const jumpImagesRef = useRef<HTMLImageElement[]>([]);
  const attackImagesRef = useRef<HTMLImageElement[]>([]);
  // Store frame metadata for bounding box info
  const walkFrameDataRef = useRef<Frame[]>([]);
  const jumpFrameDataRef = useRef<Frame[]>([]);
  const attackFrameDataRef = useRef<Frame[]>([]);
  const bgLayersRef = useRef<HTMLImageElement[]>([]);
  const bgLoadedRef = useRef(false);
  const cameraX = useRef(0);
  const timeRef = useRef(0);

  const WORLD_WIDTH = 800;
  const WORLD_HEIGHT = 400;
  const GROUND_Y = 340;
  const MOVE_SPEED = 3;

  // Load parallax background layers
  useEffect(() => {
    const loadLayers = async () => {
      const layers: HTMLImageElement[] = [];
      let loadedCount = 0;
      
      for (const layer of PARALLAX_LAYERS) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            loadedCount++;
            resolve();
          };
          img.onerror = () => {
            console.log(`Layer failed to load: ${layer.url}`);
            resolve();
          };
          img.src = layer.url;
        });
        
        layers.push(img);
      }
      
      bgLayersRef.current = layers;
      bgLoadedRef.current = loadedCount === PARALLAX_LAYERS.length;
    };
    
    loadLayers();
  }, []);

  // Load walk sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of walkFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      walkImagesRef.current = images;
      walkFrameDataRef.current = walkFrames;
    };
    
    if (walkFrames.length > 0) {
      loadImages();
    }
  }, [walkFrames]);

  // Load jump sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of jumpFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      jumpImagesRef.current = images;
      jumpFrameDataRef.current = jumpFrames;
    };
    
    if (jumpFrames.length > 0) {
      loadImages();
    }
  }, [jumpFrames]);

  // Load attack sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of attackFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      attackImagesRef.current = images;
      attackFrameDataRef.current = attackFrames;
    };
    
    if (attackFrames.length > 0) {
      loadImages();
    }
  }, [attackFrames]);

  // Main game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const state = characterState.current;
    const walkImages = walkImagesRef.current;
    const jumpImages = jumpImagesRef.current;
    const attackImages = attackImagesRef.current;
    const bgLayers = bgLayersRef.current;
    timeRef.current++;

    // Clear
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Check if walking (horizontal movement) - can't walk while attacking on ground
    const movingHorizontally = keysPressed.current.has("right") || keysPressed.current.has("left");
    state.isWalking = movingHorizontally && !state.isJumping && !state.isAttacking;

    // Handle horizontal movement (works both on ground and in air, but not during ground attack)
    const canMove = !state.isAttacking || state.isJumping; // Can move during air attack
    if (canMove) {
      if (keysPressed.current.has("right")) {
        state.direction = "right";
        state.x += MOVE_SPEED;
        cameraX.current += MOVE_SPEED;
      }
      if (keysPressed.current.has("left")) {
        state.direction = "left";
        state.x -= MOVE_SPEED;
        cameraX.current -= MOVE_SPEED;
      }
    }

    state.x = Math.max(50, Math.min(WORLD_WIDTH - 50, state.x));

    // Jump physics
    if (state.isJumping) {
      state.velocityY += GRAVITY;
      state.y += state.velocityY;
      
      if (state.y >= 0) {
        state.y = 0;
        state.velocityY = 0;
        state.isJumping = false;
        state.jumpFrameIndex = 0;
        state.jumpFrameTime = 0;
      }
    }

    // Draw background layers with parallax
    if (bgLoadedRef.current && bgLayers.length > 0) {
      bgLayers.forEach((layer, index) => {
        if (layer.complete && layer.naturalWidth > 0) {
          const speed = PARALLAX_LAYERS[index].speed;
          const layerOffset = (cameraX.current * speed) % layer.naturalWidth;
          
          const scale = WORLD_HEIGHT / layer.naturalHeight;
          const scaledWidth = layer.naturalWidth * scale;
          
          let startX = -((layerOffset * scale) % scaledWidth);
          if (startX > 0) startX -= scaledWidth;
          
          for (let x = startX; x < WORLD_WIDTH; x += scaledWidth) {
            ctx.drawImage(layer, x, 0, scaledWidth, WORLD_HEIGHT);
          }
        }
      });
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Loading...", WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    }

    // Walk animation
    if (state.isWalking && walkImages.length > 0) {
      state.frameTime += 1;
      if (state.frameTime >= 60 / fps) {
        state.frameTime = 0;
        state.walkFrameIndex = (state.walkFrameIndex + 1) % walkImages.length;
      }
    } else if (!state.isJumping && !state.isAttacking) {
      state.walkFrameIndex = 0;
      state.frameTime = 0;
    }

    // Jump animation
    if (state.isJumping && jumpImages.length > 0 && !state.isAttacking) {
      state.jumpFrameTime += 1;
      if (state.jumpFrameTime >= 60 / (fps * 0.8)) {
        state.jumpFrameTime = 0;
        if (state.jumpFrameIndex < jumpImages.length - 1) {
          state.jumpFrameIndex++;
        }
      }
    }

    // Attack animation - plays once then stops
    if (state.isAttacking && attackImages.length > 0) {
      state.attackFrameTime += 1;
      if (state.attackFrameTime >= 60 / (fps * 1.2)) { // Slightly faster for attack
        state.attackFrameTime = 0;
        state.attackFrameIndex++;
        
        // Attack finished
        if (state.attackFrameIndex >= attackImages.length) {
          state.isAttacking = false;
          state.attackFrameIndex = 0;
          state.attackFrameTime = 0;
        }
      }
    }

    // Determine which sprite to draw (priority: attack > jump > walk/idle)
    let currentImg: HTMLImageElement | null = null;
    let currentFrameData: Frame | null = null;
    
    const walkFrameData = walkFrameDataRef.current;
    const jumpFrameData = jumpFrameDataRef.current;
    const attackFrameData = attackFrameDataRef.current;
    
    if (state.isAttacking && attackImages.length > 0) {
      // Use attack frames (highest priority)
      const idx = Math.min(state.attackFrameIndex, attackImages.length - 1);
      currentImg = attackImages[idx];
      currentFrameData = attackFrameData[idx] || null;
    } else if (state.isJumping && jumpImages.length > 0) {
      // Use jump frames
      currentImg = jumpImages[state.jumpFrameIndex];
      currentFrameData = jumpFrameData[state.jumpFrameIndex] || null;
    } else if (walkImages.length > 0) {
      // Use walk frames (idle = frame 0)
      currentImg = walkImages[state.walkFrameIndex];
      currentFrameData = walkFrameData[state.walkFrameIndex] || null;
    }

    // Draw character
    if (currentImg && currentFrameData) {
      const targetContentHeight = 80; // Target height for the actual character content
      
      // Get reference content height from first walk frame
      const referenceFrameData = walkFrameData.length > 0 ? walkFrameData[0] : currentFrameData;
      const referenceContentHeight = referenceFrameData.contentBounds.height;
      
      // Scale based on actual character content, not frame dimensions
      const baseScale = targetContentHeight / referenceContentHeight;
      
      // Apply scale boost for attack frames - the AI renders characters smaller
      // to fit spell effects, so we compensate
      const isAttackFrame = state.isAttacking && attackImages.length > 0;
      const scale = baseScale * (isAttackFrame ? 1.2 : 1.0);
      
      const drawWidth = currentImg.width * scale;
      const drawHeight = currentImg.height * scale;
      
      // Calculate where the character's feet are within the current frame
      const contentBounds = currentFrameData.contentBounds;
      const feetY = (contentBounds.y + contentBounds.height) * scale; // Bottom of content in scaled coordinates
      
      // Only add bob when walking on ground
      const bob = state.isWalking && !state.isJumping && !state.isAttacking ? Math.sin(timeRef.current * 0.3) * 2 : 0;
      
      // Position so feet are at GROUND_Y
      // drawY is top-left of the sprite, so: drawY + feetY = GROUND_Y
      const drawY = GROUND_Y - feetY + bob + state.y;
      
      // Center horizontally based on content center, not frame center
      const contentCenterX = (contentBounds.x + contentBounds.width / 2) * scale;
      const drawX = state.x - contentCenterX;

      // Shadow
      const shadowScale = Math.max(0.3, 1 + state.y / 100);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(state.x, GROUND_Y + 2, (contentBounds.width * scale / 3) * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      if (state.direction === "left") {
        // Flip horizontally around the character's center
        ctx.translate(state.x * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(currentImg, state.x - contentCenterX, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(currentImg, drawX, drawY, drawWidth, drawHeight);
      }
      ctx.restore();
    }

    // Vignette
    const vignette = ctx.createRadialGradient(
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.4,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [fps]);

  // Initialize
  useEffect(() => {
    if (!containerRef.current || walkFrames.length === 0) return;

    containerRef.current.innerHTML = "";
    
    const canvas = document.createElement("canvas");
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;
    canvas.style.display = "block";
    canvas.style.borderRadius = "8px";
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    characterState.current.x = WORLD_WIDTH / 2;
    characterState.current.y = 0;
    characterState.current.velocityY = 0;
    characterState.current.isJumping = false;
    characterState.current.isAttacking = false;
    cameraX.current = 0;

    animationRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.add("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.add("left");
      }
      // Jump on W or Up arrow - only if on ground and not attacking
      if ((e.key === "w" || e.key === "W" || e.key === "ArrowUp") && !characterState.current.isJumping && !characterState.current.isAttacking) {
        characterState.current.isJumping = true;
        characterState.current.velocityY = JUMP_VELOCITY;
        characterState.current.jumpFrameIndex = 0;
        characterState.current.jumpFrameTime = 0;
      }
      // Attack on J - only if not already attacking
      if ((e.key === "j" || e.key === "J") && !characterState.current.isAttacking) {
        characterState.current.isAttacking = true;
        characterState.current.attackFrameIndex = 0;
        characterState.current.attackFrameTime = 0;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.delete("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.delete("left");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [walkFrames, gameLoop]);

  return (
    <div className="pixi-sandbox-container">
      <div ref={containerRef} className="pixi-canvas-wrapper" />
    </div>
  );
}
