/**
 * Animation type definitions for Ichigo Journey sprite format
 *
 * SINGLE SOURCE OF TRUTH for all animation configuration.
 * Both prompts.ts and grid-analyzer.ts import from this file.
 *
 * Supports both 4-direction and 8-direction sprites:
 * - 4-direction (legacy/current UI): down, up, left, right
 * - 8-direction (new generation): south, south_west, west, north_west, north, north_east, east, south_east
 *
 * Frame size: 32x48 pixels
 */

// 8 directions for isometric top-down RPG movement (used by generation)
export type Direction8 = 
  | 'south' | 'south_west' | 'west' | 'north_west'
  | 'north' | 'north_east' | 'east' | 'south_east';

// 4 directions (used by current UI) - maps to cardinal directions
export type Direction = 'down' | 'up' | 'left' | 'right';

// Combined type for flexibility
export type AnyDirection = Direction | Direction8;

// Cardinal vs Diagonal groupings for split generation
export type CardinalDirection = 'south' | 'west' | 'north' | 'east';
export type DiagonalDirection = 'south_west' | 'north_west' | 'north_east' | 'south_east';

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
 * Animation timing configuration
 * Frame durations in milliseconds
 */
export const ANIMATION_SPEEDS = {
  IDLE: 150,    // Slow, subtle breathing
  WALK: 100,    // Smooth walk cycle
  ATTACK: 50,   // Fast, snappy attacks
  DASH: 40,     // Very fast dash
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
  /** Number of rows in the sprite sheet */
  rows: number;
  /** Whether this animation has directional variants */
  isDirectional: boolean;
  /** Frame duration in milliseconds */
  frameDuration: number;
  /** Whether this animation loops */
  loop: boolean;
  /** Description for AI prompts */
  description: string;
}

/**
 * Animation configurations - Optimized for smooth animations
 * Note: rows for directional animations can be 4 (for split sheets) or 8 (for full 8-dir)
 */
export const ANIMATION_CONFIGS: Record<AnimationType, AnimationGridConfig> = {
  idle: {
    frameCount: 4,
    columns: 4,
    rows: 8, // 8 rows for 8-direction
    isDirectional: true,
    frameDuration: ANIMATION_SPEEDS.IDLE,
    loop: true,
    description: 'Standing idle breathing animation',
  },
  walk: {
    frameCount: 6,
    columns: 6,
    rows: 8, // 8 rows for 8-direction
    isDirectional: true,
    frameDuration: ANIMATION_SPEEDS.WALK,
    loop: true,
    description: 'Walking cycle animation',
  },
  attack1: {
    frameCount: 8, // Increased for smoother animation
    columns: 8,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    loop: false,
    description: 'First attack combo - light slash',
  },
  attack2: {
    frameCount: 8,
    columns: 8,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    loop: false,
    description: 'Second attack combo - medium strike',
  },
  attack3: {
    frameCount: 8,
    columns: 8,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    loop: false,
    description: 'Third attack combo - heavy finisher',
  },
  dash: {
    frameCount: 6, // Increased for smoother motion
    columns: 6,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.DASH,
    loop: false,
    description: 'Quick dash/dodge movement',
  },
  hurt: {
    frameCount: 4, // Increased for smoother recoil
    columns: 4,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.HURT,
    loop: false,
    description: 'Taking damage reaction',
  },
  death: {
    frameCount: 10, // Increased for dramatic death
    columns: 10,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.DEATH,
    loop: false,
    description: 'Death/defeat animation',
  },
  special: {
    frameCount: 12, // Increased for elaborate ultimate
    columns: 12,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.SPECIAL,
    loop: false,
    description: 'Special ability/ultimate attack',
  },
};

/**
 * 8-direction row order (clockwise from South/Front)
 */
export const DIRECTION_ROW_ORDER_8: Direction8[] = [
  'south',       // Row 0 - Front facing
  'south_west',  // Row 1 - Front-left diagonal
  'west',        // Row 2 - Left side
  'north_west',  // Row 3 - Back-left diagonal
  'north',       // Row 4 - Back facing
  'north_east',  // Row 5 - Back-right diagonal
  'east',        // Row 6 - Right side
  'south_east',  // Row 7 - Front-right diagonal
];

// Cardinal directions (for Option B split generation)
export const CARDINAL_DIRECTIONS: CardinalDirection[] = ['south', 'west', 'north', 'east'];
export const DIAGONAL_DIRECTIONS: DiagonalDirection[] = ['south_west', 'north_west', 'north_east', 'south_east'];

/**
 * 4-direction row order (current UI)
 * Row 0: down, Row 1: up, Row 2: left, Row 3: right
 */
export const DIRECTION_ROW_ORDER: Direction[] = ['down', 'up', 'left', 'right'];

// Map 4-direction to 8-direction format
export const DIRECTION_MAP_4_TO_8: Record<Direction, Direction8> = {
  'down': 'south',
  'up': 'north',
  'left': 'west',
  'right': 'east',
};

// Map 8-direction to 4-direction (only cardinals map)
export const DIRECTION_MAP_8_TO_4: Partial<Record<Direction8, Direction>> = {
  'south': 'down',
  'north': 'up',
  'west': 'left',
  'east': 'right',
};

/**
 * Frame dimensions for character sprites
 */
export const FRAME_SIZE = {
  width: 32,
  height: 48,
};

/**
 * Calculate total sprite sheet dimensions for an animation type
 */
export function getSheetDimensions(animType: AnimationType, use8Dir: boolean = false): { width: number; height: number } {
  const config = ANIMATION_CONFIGS[animType];
  const rows = use8Dir && config.isDirectional ? 8 : config.rows;
  return {
    width: config.columns * FRAME_SIZE.width,
    height: rows * FRAME_SIZE.height,
  };
}

/**
 * Get aspect ratio string for fal.ai API based on animation type
 */
export function getAspectRatio(animType: AnimationType, use8Dir: boolean = false): string {
  const config = ANIMATION_CONFIGS[animType];

  // For directional sheets
  if (config.isDirectional) {
    if (use8Dir) {
      // 8-direction sheets (8 rows)
      if (animType === 'idle') return '1:2'; // 4 cols x 8 rows
      if (animType === 'walk') return '3:4'; // 6 cols x 8 rows
    } else {
      // 4-direction sheets (4 rows)
      if (animType === 'idle') return '1:1'; // 4 cols x 4 rows
      if (animType === 'walk') return '4:3'; // 6 cols x 4 rows
    }
  }

  // For combat animations (single row, wide)
  if (config.rows === 1) {
    if (config.columns >= 10) return '21:9';
    if (config.columns >= 6) return '16:9';
  }

  return '16:9';
}

/**
 * Get aspect ratio for split generation (4 directions at a time)
 */
export function getSplitAspectRatio(animType: 'idle' | 'walk'): string {
  if (animType === 'idle') return '1:1'; // 4 cols x 4 rows
  return '4:3'; // 6 cols x 4 rows
}

/**
 * Combined attack sheet config (attack1 + attack2 + attack3 stacked)
 */
export const COMBINED_ATTACK_SHEET = {
  columns: 8, // Updated for smoother animations
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

/**
 * 8-direction animation types for generation UI
 */
export const EIGHT_DIR_ANIMATION_TYPES = [
  'idle-cardinal',
  'idle-diagonal', 
  'walk-cardinal',
  'walk-diagonal',
] as const;

export type EightDirAnimationType = typeof EIGHT_DIR_ANIMATION_TYPES[number];

// Direction helpers
export function getDirectionIndex(direction: Direction): number {
  return DIRECTION_ROW_ORDER.indexOf(direction);
}

export function getDirectionIndex8(direction: Direction8): number {
  return DIRECTION_ROW_ORDER_8.indexOf(direction);
}

export function isCardinalDirection(direction: Direction8): direction is CardinalDirection {
  return (CARDINAL_DIRECTIONS as readonly string[]).includes(direction);
}

export function isDiagonalDirection(direction: Direction8): direction is DiagonalDirection {
  return (DIAGONAL_DIRECTIONS as readonly string[]).includes(direction);
}
