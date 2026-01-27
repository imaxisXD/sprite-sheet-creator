/**
 * Animation type definitions for Ichigo Journey sprite format
 *
 * SINGLE SOURCE OF TRUTH for all animation configuration.
 * Both prompts.ts and grid-analyzer.ts import from this file.
 *
 * This matches the SpriteSheetCharacterLoader format from ichigo-journey:
 * - Directional animations: idle (4x4), walk (6x4) with rows for down, up, left, right
 * - Combat animations: attack (4x3), dash (4x1), hurt (3x1), death (8x1), special (10x1)
 *
 * Frame size: 32x48 pixels
 */

export type Direction = 'down' | 'up' | 'left' | 'right';

export type AnimationType =
  | 'idle'
  | 'walk'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'dash'
  | 'hurt'
  | 'death'
  | 'special';

export type DirectionalAnimationType = 'idle' | 'walk';
export type NonDirectionalAnimationType = Exclude<AnimationType, DirectionalAnimationType>;

/**
 * Animation timing configuration - matches ichigo-journey GAME_CONFIG.ANIMATION_SPEED
 * Frame durations in milliseconds
 */
export const ANIMATION_SPEEDS = {
  IDLE: 150,    // Slow, subtle breathing
  WALK: 100,    // Smooth walk cycle
  ATTACK: 50,   // Fast, snappy attacks
  DASH: 40,     // Very fast dash (180ms game duration)
  HURT: 80,     // Quick hit reaction
  DEATH: 100,   // Dramatic death
  SPECIAL: 60,  // Flashy special move
} as const;

/**
 * Configuration for how animations are laid out in sprite sheets
 */
export interface AnimationGridConfig {
  /** Number of frames in this animation */
  frameCount: number;
  /** Number of columns in the sprite sheet */
  columns: number;
  /** Number of rows in the sprite sheet (4 for directional, 1 for non-directional) */
  rows: number;
  /** Whether this animation has 4 directions */
  isDirectional: boolean;
  /** Frame duration in milliseconds */
  frameDuration: number;
  /** Whether this animation loops */
  loop: boolean;
  /** Description for AI prompts */
  description: string;
}

/**
 * Animation configurations matching ichigo-journey's SpriteSheetCharacterLoader
 */
export const ANIMATION_CONFIGS: Record<AnimationType, AnimationGridConfig> = {
  idle: {
    frameCount: 4,
    columns: 4,
    rows: 4, // down, up, left, right
    isDirectional: true,
    frameDuration: ANIMATION_SPEEDS.IDLE,
    loop: true,
    description: 'Standing idle breathing animation',
  },
  walk: {
    frameCount: 6,
    columns: 6,
    rows: 4, // down, up, left, right
    isDirectional: true,
    frameDuration: ANIMATION_SPEEDS.WALK,
    loop: true,
    description: 'Walking cycle animation',
  },
  attack1: {
    frameCount: 4,
    columns: 4,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    loop: false,
    description: 'First attack combo - light slash',
  },
  attack2: {
    frameCount: 4,
    columns: 4,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    loop: false,
    description: 'Second attack combo - medium strike',
  },
  attack3: {
    frameCount: 4,
    columns: 4,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    loop: false,
    description: 'Third attack combo - heavy finisher',
  },
  dash: {
    frameCount: 4,
    columns: 4,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.DASH,
    loop: false,
    description: 'Quick dash/dodge movement',
  },
  hurt: {
    frameCount: 3,
    columns: 3,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.HURT,
    loop: false,
    description: 'Taking damage reaction',
  },
  death: {
    frameCount: 8,
    columns: 8,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.DEATH,
    loop: false,
    description: 'Death/defeat animation',
  },
  special: {
    frameCount: 10,
    columns: 10,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.SPECIAL,
    loop: false,
    description: 'Special ability/ultimate attack',
  },
};

/**
 * Order of direction rows in directional sprite sheets
 * Row 0: down, Row 1: up, Row 2: left, Row 3: right
 */
export const DIRECTION_ROW_ORDER: Direction[] = ['down', 'up', 'left', 'right'];

/**
 * Frame dimensions for character sprites (matches GAME_CONFIG)
 */
export const FRAME_SIZE = {
  width: 32,
  height: 48,
};

/**
 * Calculate total sprite sheet dimensions for an animation type
 */
export function getSheetDimensions(animType: AnimationType): { width: number; height: number } {
  const config = ANIMATION_CONFIGS[animType];
  return {
    width: config.columns * FRAME_SIZE.width,
    height: config.rows * FRAME_SIZE.height,
  };
}

/**
 * Get aspect ratio string for fal.ai API based on animation type
 */
export function getAspectRatio(animType: AnimationType): string {
  const config = ANIMATION_CONFIGS[animType];
  const { width, height } = getSheetDimensions(animType);

  // Simplify common ratios
  const ratio = width / height;
  if (ratio === 1) return '1:1';
  if (ratio >= 2.3 && ratio <= 2.4) return '21:9';
  if (ratio >= 1.7 && ratio <= 1.8) return '16:9';
  if (ratio >= 1.3 && ratio <= 1.4) return '4:3';
  if (ratio >= 0.55 && ratio <= 0.6) return '9:16';

  // For directional sheets (wider than tall)
  if (config.isDirectional) {
    if (animType === 'idle') return '1:1'; // 4x4 grid, effectively 128x192, close to 2:3
    if (animType === 'walk') return '4:3'; // 6x4 grid, 192x192
  }

  // For combat animations (single row, very wide)
  if (config.rows === 1) {
    if (config.columns >= 8) return '21:9';
    if (config.columns >= 4) return '16:9';
  }

  return '16:9'; // Default
}

/**
 * Combined attack sheet config (attack1 + attack2 + attack3 stacked)
 */
export const COMBINED_ATTACK_SHEET = {
  columns: 4,
  rows: 3,
  frameWidth: FRAME_SIZE.width,
  frameHeight: FRAME_SIZE.height,
};

/**
 * All animation types that need to be generated
 */
export const DIRECTIONAL_ANIMATIONS: DirectionalAnimationType[] = ['idle', 'walk'];
export const COMBAT_ANIMATIONS: NonDirectionalAnimationType[] = [
  'attack1', 'attack2', 'attack3', 'dash', 'hurt', 'death', 'special'
];
export const ALL_ANIMATIONS: AnimationType[] = [
  ...DIRECTIONAL_ANIMATIONS,
  ...COMBAT_ANIMATIONS,
];
