"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Direction8, DIRECTION_ROW_ORDER_8 } from "../config/animation-types";

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

type DirectionalFrameSet8 = Record<Direction8, Frame[]>;

interface PixiSandboxProps {
  // Legacy props for backwards compatibility
  walkFrames?: Frame[];
  jumpFrames?: Frame[];
  attackFrames?: Frame[];
  // 8-directional props
  idleDirectional?: DirectionalFrameSet8;
  walkDirectional?: DirectionalFrameSet8;
  // Combat frames
  attack1Frames?: Frame[];
  attack2Frames?: Frame[];
  attack3Frames?: Frame[];
  dashFrames?: Frame[];
  hurtFrames?: Frame[];
  deathFrames?: Frame[];
  specialFrames?: Frame[];
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

// Match ichigo-journey animation speeds (ms per frame)
const ANIMATION_SPEED = {
  IDLE: 150,
  WALK: 100,
  ATTACK: 50,
  DASH: 40,
  HURT: 80,
  DEATH: 100,
  SPECIAL: 60,
} as const;

// Match ichigo-journey dash config
const DASH_CONFIG = {
  SPEED: 450,      // px/sec
  DURATION: 180,   // ms
  COOLDOWN: 400,   // ms
} as const;

// Match ichigo-journey combo system
const COMBO_WINDOW_MS = 500;
const MAX_COMBO = 3;

// Animation types matching ichigo-journey
type AnimationState = 'idle' | 'walk' | 'attack1' | 'attack2' | 'attack3' | 'dash' | 'hurt' | 'death' | 'special';

// Non-looping states that lock input until complete
const NON_LOOPING_STATES: AnimationState[] = ['attack1', 'attack2', 'attack3', 'dash', 'hurt', 'death', 'special'];

function isNonLoopingState(state: AnimationState): boolean {
  return NON_LOOPING_STATES.includes(state);
}

// Base FPS that the ANIMATION_SPEED values were designed for
const BASE_FPS = 10;

function getAnimationSpeedMs(state: AnimationState, fps: number): number {
  // Get base duration for this animation type
  let baseDuration: number;
  switch (state) {
    case 'idle': baseDuration = ANIMATION_SPEED.IDLE; break;
    case 'walk': baseDuration = ANIMATION_SPEED.WALK; break;
    case 'attack1':
    case 'attack2':
    case 'attack3': baseDuration = ANIMATION_SPEED.ATTACK; break;
    case 'dash': baseDuration = ANIMATION_SPEED.DASH; break;
    case 'hurt': baseDuration = ANIMATION_SPEED.HURT; break;
    case 'death': baseDuration = ANIMATION_SPEED.DEATH; break;
    case 'special': baseDuration = ANIMATION_SPEED.SPECIAL; break;
    default: baseDuration = ANIMATION_SPEED.IDLE;
  }

  // Scale duration by FPS slider (higher FPS = faster animation = lower duration)
  // At fps=10 (BASE_FPS), use base values; at fps=20, use half duration (2x faster)
  return baseDuration * (BASE_FPS / fps);
}

export default function PixiSandbox({
  walkFrames,
  jumpFrames,
  attackFrames,
  idleDirectional,
  walkDirectional,
  attack1Frames,
  attack2Frames,
  attack3Frames,
  dashFrames,
  hurtFrames,
  deathFrames,
  specialFrames,
  fps,
}: PixiSandboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(true);

  // Character state matching ichigo-journey's AnimationController
  const characterState = useRef({
    x: 400,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    direction: "east" as Direction8,

    // Animation state machine (match AnimationController)
    animState: "idle" as AnimationState,
    isLocked: false,      // Animation lock - prevents input during non-looping anims
    frameIndex: 0,
    lastFrameTime: 0,     // Time-based, not frame-count

    // Combo system (match ichigo-journey)
    comboStep: 0,         // 0, 1, 2 for attack1, attack2, attack3
    lastAttackTime: 0,

    // Dash system (true dash, not jump)
    isDashing: false,
    dashStartTime: 0,
    dashDirection: { x: 0, y: 0 },
    lastDashTime: 0,
  });

  const keysPressed = useRef<Set<string>>(new Set());
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Frame storage for all animations
  type Dir8Frames = Record<Direction8, HTMLImageElement[]>;
  type Dir8FrameData = Record<Direction8, Frame[]>;

  const emptyDir8Frames = (): Dir8Frames => ({
    south: [], south_west: [], west: [], north_west: [],
    north: [], north_east: [], east: [], south_east: [],
  });
  const emptyDir8FrameData = (): Dir8FrameData => ({
    south: [], south_west: [], west: [], north_west: [],
    north: [], north_east: [], east: [], south_east: [],
  });

  const framesRef = useRef<{
    idle: Dir8Frames;
    walk: Dir8Frames;
    attack1: HTMLImageElement[];
    attack2: HTMLImageElement[];
    attack3: HTMLImageElement[];
    dash: HTMLImageElement[];
    hurt: HTMLImageElement[];
    death: HTMLImageElement[];
    special: HTMLImageElement[];
    legacyWalk: HTMLImageElement[];
    legacyJump: HTMLImageElement[];
    legacyAttack: HTMLImageElement[];
  }>({
    idle: emptyDir8Frames(),
    walk: emptyDir8Frames(),
    attack1: [],
    attack2: [],
    attack3: [],
    dash: [],
    hurt: [],
    death: [],
    special: [],
    legacyWalk: [],
    legacyJump: [],
    legacyAttack: [],
  });

  const frameDataRef = useRef<{
    idle: Dir8FrameData;
    walk: Dir8FrameData;
    attack1: Frame[];
    attack2: Frame[];
    attack3: Frame[];
    dash: Frame[];
    hurt: Frame[];
    death: Frame[];
    special: Frame[];
    legacyWalk: Frame[];
    legacyJump: Frame[];
    legacyAttack: Frame[];
  }>({
    idle: emptyDir8FrameData(),
    walk: emptyDir8FrameData(),
    attack1: [],
    attack2: [],
    attack3: [],
    dash: [],
    hurt: [],
    death: [],
    special: [],
    legacyWalk: [],
    legacyJump: [],
    legacyAttack: [],
  });

  const bgLayersRef = useRef<HTMLImageElement[]>([]);
  const bgLoadedRef = useRef(false);
  const cameraX = useRef(0);

  const WORLD_WIDTH = 800;
  const WORLD_HEIGHT = 400;
  const GROUND_Y = 340;
  const MOVE_SPEED = 200; // Match ichigo-journey: 200 px/sec

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

  // Load directional idle frames
  useEffect(() => {
    if (!idleDirectional) return;

    const loadDirectionalFrames = async () => {
      for (const dir of DIRECTION_ROW_ORDER_8) {
        const dirFrames = idleDirectional[dir];
        if (!dirFrames || dirFrames.length === 0) continue;
        const images: HTMLImageElement[] = [];
        for (const frame of dirFrames) {
          const img = new Image();
          img.src = frame.dataUrl;
          await new Promise((resolve) => { img.onload = resolve; });
          images.push(img);
        }
        framesRef.current.idle[dir] = images;
        frameDataRef.current.idle[dir] = dirFrames;
      }
    };

    loadDirectionalFrames();
  }, [idleDirectional]);

  // Load directional walk frames
  useEffect(() => {
    if (!walkDirectional) return;

    const loadDirectionalFrames = async () => {
      for (const dir of DIRECTION_ROW_ORDER_8) {
        const dirFrames = walkDirectional[dir];
        if (!dirFrames || dirFrames.length === 0) continue;
        const images: HTMLImageElement[] = [];
        for (const frame of dirFrames) {
          const img = new Image();
          img.src = frame.dataUrl;
          await new Promise((resolve) => { img.onload = resolve; });
          images.push(img);
        }
        framesRef.current.walk[dir] = images;
        frameDataRef.current.walk[dir] = dirFrames;
      }
    };

    loadDirectionalFrames();
  }, [walkDirectional]);

  // Load legacy walk frames (backwards compatibility)
  useEffect(() => {
    if (!walkFrames || walkFrames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of walkFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current.legacyWalk = images;
      frameDataRef.current.legacyWalk = walkFrames;
    };

    loadImages();
  }, [walkFrames]);

  // Load legacy jump frames (backwards compatibility)
  useEffect(() => {
    if (!jumpFrames || jumpFrames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of jumpFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current.legacyJump = images;
      frameDataRef.current.legacyJump = jumpFrames;
    };

    loadImages();
  }, [jumpFrames]);

  // Load attack frames
  useEffect(() => {
    const loadAttackFrames = async (frames: Frame[] | undefined, key: 'attack1' | 'attack2' | 'attack3' | 'legacyAttack') => {
      if (!frames || frames.length === 0) return;

      const images: HTMLImageElement[] = [];
      for (const frame of frames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current[key] = images;
      frameDataRef.current[key] = frames;
    };

    loadAttackFrames(attack1Frames, 'attack1');
    loadAttackFrames(attack2Frames, 'attack2');
    loadAttackFrames(attack3Frames, 'attack3');
    loadAttackFrames(attackFrames, 'legacyAttack');
  }, [attack1Frames, attack2Frames, attack3Frames, attackFrames]);

  // Load dash frames
  useEffect(() => {
    if (!dashFrames || dashFrames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of dashFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current.dash = images;
      frameDataRef.current.dash = dashFrames;
    };

    loadImages();
  }, [dashFrames]);

  // Load hurt frames
  useEffect(() => {
    if (!hurtFrames || hurtFrames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of hurtFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current.hurt = images;
      frameDataRef.current.hurt = hurtFrames;
    };

    loadImages();
  }, [hurtFrames]);

  // Load death frames
  useEffect(() => {
    if (!deathFrames || deathFrames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of deathFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current.death = images;
      frameDataRef.current.death = deathFrames;
    };

    loadImages();
  }, [deathFrames]);

  // Load special frames
  useEffect(() => {
    if (!specialFrames || specialFrames.length === 0) return;

    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of specialFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      framesRef.current.special = images;
      frameDataRef.current.special = specialFrames;
    };

    loadImages();
  }, [specialFrames]);

  // Get direction vector for dash
  const getDirectionVector = useCallback((direction: Direction8): { x: number; y: number } => {
    switch (direction) {
      case 'east':       return { x: 1, y: 0 };
      case 'west':       return { x: -1, y: 0 };
      case 'north':      return { x: 0, y: -1 };
      case 'south':      return { x: 0, y: 1 };
      case 'north_east': return { x: 0.707, y: -0.707 };
      case 'north_west': return { x: -0.707, y: -0.707 };
      case 'south_east': return { x: 0.707, y: 0.707 };
      case 'south_west': return { x: -0.707, y: 0.707 };
      default: return { x: 1, y: 0 };
    }
  }, []);

  // Main game loop with time-based animation
  const gameLoop = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const state = characterState.current;
    const frames = framesRef.current;
    const frameData = frameDataRef.current;
    const bgLayers = bgLayersRef.current;

    // Calculate delta time
    const deltaTime = lastTimeRef.current ? currentTime - lastTimeRef.current : 16.67;
    lastTimeRef.current = currentTime;

    // Clear
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Handle dash movement
    if (state.isDashing) {
      const elapsed = currentTime - state.dashStartTime;
      if (elapsed < DASH_CONFIG.DURATION) {
        // True dash: constant velocity in facing direction
        const speed = DASH_CONFIG.SPEED * (deltaTime / 1000);
        state.x += state.dashDirection.x * speed;
        state.y += state.dashDirection.y * speed * 0.3; // Reduced vertical for sandbox
        cameraX.current += state.dashDirection.x * speed;
      } else {
        // Dash complete
        state.isDashing = false;
        state.isLocked = false;
        state.animState = 'idle';
        state.frameIndex = 0;
      }
    }

    // Handle movement if not locked
    if (!state.isLocked) {
      const movingRight = keysPressed.current.has("right");
      const movingLeft = keysPressed.current.has("left");
      const movingUp = keysPressed.current.has("up");
      const movingDown = keysPressed.current.has("down");
      const movingHorizontally = movingRight || movingLeft;
      const movingVertically = movingUp || movingDown;

      let newDirection = state.direction;
      if (movingHorizontally && movingVertically) {
        // Diagonal
        const h = movingRight ? 'east' : 'west';
        const v = movingDown ? 'south' : 'north';
        newDirection = `${v}_${h}` as Direction8;
      } else if (movingHorizontally) {
        newDirection = movingRight ? 'east' : 'west';
      } else if (movingVertically) {
        newDirection = movingDown ? 'south' : 'north';
      }

      state.direction = newDirection;

      // Apply movement
      const speed = MOVE_SPEED * (deltaTime / 1000);
      if (keysPressed.current.has("right")) {
        state.x += speed;
        cameraX.current += speed;
      }
      if (keysPressed.current.has("left")) {
        state.x -= speed;
        cameraX.current -= speed;
      }
      if (keysPressed.current.has("up")) {
        state.y -= speed * 0.3;
      }
      if (keysPressed.current.has("down")) {
        state.y += speed * 0.3;
      }

      // Determine animation state
      const isMoving = movingHorizontally || movingVertically;
      if (isMoving) {
        state.animState = "walk";
      } else {
        state.animState = "idle";
      }
    }

    // Clamp position
    state.x = Math.max(50, Math.min(WORLD_WIDTH - 50, state.x));
    state.y = Math.max(-100, Math.min(50, state.y));

    // Get current frame images and data based on state
    let currentImages: HTMLImageElement[] = [];
    let currentFrameData: Frame[] = [];

    if (state.animState === 'attack1' || state.animState === 'attack2' || state.animState === 'attack3') {
      const attackKey = state.animState;
      if (frames[attackKey]?.length > 0) {
        currentImages = frames[attackKey];
        currentFrameData = frameData[attackKey];
      } else if (frames.legacyAttack?.length > 0) {
        currentImages = frames.legacyAttack;
        currentFrameData = frameData.legacyAttack;
      }
    } else if (state.animState === 'dash') {
      if (frames.dash?.length > 0) {
        currentImages = frames.dash;
        currentFrameData = frameData.dash;
      } else if (frames.legacyJump?.length > 0) {
        currentImages = frames.legacyJump;
        currentFrameData = frameData.legacyJump;
      }
    } else if (state.animState === 'hurt') {
      if (frames.hurt?.length > 0) {
        currentImages = frames.hurt;
        currentFrameData = frameData.hurt;
      }
    } else if (state.animState === 'death') {
      if (frames.death?.length > 0) {
        currentImages = frames.death;
        currentFrameData = frameData.death;
      }
    } else if (state.animState === 'special') {
      if (frames.special?.length > 0) {
        currentImages = frames.special;
        currentFrameData = frameData.special;
      }
    } else if (state.animState === "walk") {
      const dir = state.direction;
      if (frames.walk[dir]?.length > 0) {
        currentImages = frames.walk[dir];
        currentFrameData = frameData.walk[dir];
      } else if (frames.legacyWalk?.length > 0) {
        currentImages = frames.legacyWalk;
        currentFrameData = frameData.legacyWalk;
      }
    } else {
      // Idle
      const dir = state.direction;
      if (frames.idle[dir]?.length > 0) {
        currentImages = frames.idle[dir];
        currentFrameData = frameData.idle[dir];
      } else if (frames.legacyWalk?.length > 0) {
        currentImages = [frames.legacyWalk[0]];
        currentFrameData = [frameData.legacyWalk[0]];
      }
    }

    // Time-based frame advancement (fps prop controls speed)
    const animSpeed = getAnimationSpeedMs(state.animState, fps);
    if (currentTime - state.lastFrameTime >= animSpeed) {
      state.lastFrameTime = currentTime;
      state.frameIndex++;

      if (state.frameIndex >= currentImages.length) {
        if (isNonLoopingState(state.animState)) {
          // Non-looping animation complete
          state.isLocked = false;
          state.animState = 'idle';
        }
        state.frameIndex = 0;
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

    // Draw character
    if (currentImages.length > 0 && currentFrameData.length > 0) {
      const idx = Math.min(state.frameIndex, currentImages.length - 1);
      const currentImg = currentImages[idx];
      const currentFrame = currentFrameData[idx];

      if (currentImg && currentFrame) {
        const targetContentHeight = 80;
        const referenceContentHeight = currentFrame.contentBounds.height;
        const scale = targetContentHeight / referenceContentHeight;

        const drawWidth = currentImg.width * scale;
        const drawHeight = currentImg.height * scale;

        const contentBounds = currentFrame.contentBounds;
        const feetY = (contentBounds.y + contentBounds.height) * scale;

        const bob = (state.animState === "walk" && !state.isLocked) ? Math.sin(currentTime * 0.01) * 2 : 0;
        const drawY = GROUND_Y - feetY + bob + state.y;

        const contentCenterX = (contentBounds.x + contentBounds.width / 2) * scale;
        const drawX = state.x - contentCenterX;

        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(state.x, GROUND_Y + 2, contentBounds.width * scale / 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        // Flip for west direction (only for non-directional sprites)
        const useDirectional = frames.walk[state.direction]?.length > 0 || frames.idle[state.direction]?.length > 0;
        if (state.direction === "west" && !useDirectional) {
          ctx.translate(state.x * 2, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(currentImg, state.x - contentCenterX, drawY, drawWidth, drawHeight);
        } else {
          ctx.drawImage(currentImg, drawX, drawY, drawWidth, drawHeight);
        }
        ctx.restore();
      }
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

    // Debug overlay
    if (showDebugInfo) {
      const dashCooldownRemaining = Math.max(0, DASH_CONFIG.COOLDOWN - (currentTime - state.lastDashTime));
      const comboWindowRemaining = Math.max(0, COMBO_WINDOW_MS - (currentTime - state.lastAttackTime));

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(5, 5, 180, 110);
      ctx.fillStyle = '#0f0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`State: ${state.animState}`, 10, 20);
      ctx.fillText(`Frame: ${state.frameIndex}/${currentImages.length || 0}`, 10, 34);
      ctx.fillText(`Direction: ${state.direction}`, 10, 48);
      ctx.fillText(`Locked: ${state.isLocked}`, 10, 62);
      ctx.fillText(`Combo: ${state.comboStep + 1}/${MAX_COMBO}`, 10, 76);
      ctx.fillText(`Combo Window: ${comboWindowRemaining.toFixed(0)}ms`, 10, 90);
      ctx.fillText(`Dash CD: ${dashCooldownRemaining.toFixed(0)}ms`, 10, 104);
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [fps, showDebugInfo, getDirectionVector]);

  // Initialize
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if we have any frames
    const hasFrames =
      (walkFrames && walkFrames.length > 0) ||
      idleDirectional ||
      walkDirectional;

    if (!hasFrames) return;

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
    characterState.current.frameIndex = 0;
    characterState.current.isLocked = false;
    characterState.current.animState = 'idle';
    characterState.current.comboStep = 0;
    characterState.current.lastAttackTime = 0;
    characterState.current.lastDashTime = 0;
    characterState.current.isDashing = false;
    cameraX.current = 0;
    lastTimeRef.current = 0;

    animationRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = characterState.current;

      // Movement - WASD + Arrows (only if not locked)
      if (!state.isLocked) {
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
          keysPressed.current.add("right");
        }
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
          keysPressed.current.add("left");
        }
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
          keysPressed.current.add("up");
        }
        if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
          keysPressed.current.add("down");
        }
      }

      // Attack - J or Z (combo system)
      if ((e.key === "j" || e.key === "J" || e.key === "z" || e.key === "Z") && !state.isLocked) {
        const now = performance.now();

        // Check if within combo window
        if (now - state.lastAttackTime < COMBO_WINDOW_MS && state.comboStep < MAX_COMBO - 1) {
          state.comboStep++;
        } else {
          state.comboStep = 0;
        }

        state.lastAttackTime = now;
        state.isLocked = true;
        state.frameIndex = 0;
        state.lastFrameTime = now;

        // Set attack type based on combo
        const attackTypes: AnimationState[] = ['attack1', 'attack2', 'attack3'];
        state.animState = attackTypes[state.comboStep];
      }

      // Dash - K or X (true dash: 450 px/sec for 180ms)
      if ((e.key === "k" || e.key === "K" || e.key === "x" || e.key === "X") && !state.isLocked) {
        const now = performance.now();

        // Check cooldown
        if (now - state.lastDashTime >= DASH_CONFIG.COOLDOWN) {
          state.isDashing = true;
          state.isLocked = true;
          state.dashStartTime = now;
          state.lastDashTime = now;
          state.animState = 'dash';
          state.frameIndex = 0;
          state.lastFrameTime = now;
          state.dashDirection = getDirectionVector(state.direction);
        }
      }

      // Special - L or C
      if ((e.key === "l" || e.key === "L" || e.key === "c" || e.key === "C") && !state.isLocked) {
        const now = performance.now();
        state.isLocked = true;
        state.animState = 'special';
        state.frameIndex = 0;
        state.lastFrameTime = now;
      }

      // Test triggers for hurt/death (H for hurt, number keys for death)
      if (e.key === "h" || e.key === "H") {
        if (!state.isLocked || state.animState !== 'death') {
          const now = performance.now();
          state.isLocked = true;
          state.animState = 'hurt';
          state.frameIndex = 0;
          state.lastFrameTime = now;
        }
      }

      // Toggle debug with G key
      if (e.key === "g" || e.key === "G") {
        setShowDebugInfo(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.delete("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.delete("left");
      }
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        keysPressed.current.delete("up");
      }
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        keysPressed.current.delete("down");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [walkFrames, idleDirectional, walkDirectional, gameLoop, getDirectionVector]);

  return (
    <div className="relative">
      <div ref={containerRef} className="border border-stroke rounded-lg overflow-hidden" />
      <div className="mt-2 text-xs text-content-secondary">
        <kbd>G</kbd> toggle debug | <kbd>H</kbd> hurt test | <kbd>L</kbd>/<kbd>C</kbd> special
      </div>
    </div>
  );
}
