/**
 * Animation type definitions for Ichigo Journey sprite format
 * Shared between Convex and frontend
 * 
 * Updated for 8-directional sprites (Legacy of Goku / Pokemon style)
 */

// 8 directions for isometric top-down RPG movement
export type Direction = 
  | 'south' | 'south_west' | 'west' | 'north_west'
  | 'north' | 'north_east' | 'east' | 'south_east';

// Groupings for split generation (Option B)
export type CardinalDirection = 'south' | 'west' | 'north' | 'east';
export type DiagonalDirection = 'south_west' | 'north_west' | 'north_east' | 'south_east';

// Legacy 4-direction support for backwards compatibility
export type Direction4 = 'down' | 'up' | 'left' | 'right';

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

export const ANIMATION_SPEEDS = {
  IDLE: 150,
  WALK: 100,
  ATTACK: 50,
  DASH: 40,
  HURT: 80,
  DEATH: 100,
  SPECIAL: 60,
} as const;

export interface AnimationGridConfig {
  frameCount: number;
  columns: number;
  rows: number;
  isDirectional: boolean;
  frameDuration: number;
  loop: boolean;
  description: string;
}

// 8-direction configs (full sheet = 8 rows)
// Split generation creates 4-row sheets (cardinal or diagonal)
export const ANIMATION_CONFIGS: Record<AnimationType, AnimationGridConfig> = {
  idle: {
    frameCount: 4,
    columns: 4,
    rows: 8, // 8 directions
    isDirectional: true,
    frameDuration: ANIMATION_SPEEDS.IDLE,
    loop: true,
    description: 'Standing idle breathing animation',
  },
  walk: {
    frameCount: 6,
    columns: 6,
    rows: 8, // 8 directions
    isDirectional: true,
    frameDuration: ANIMATION_SPEEDS.WALK,
    loop: true,
    description: 'Walking cycle animation',
  },
  attack1: {
    frameCount: 8, // Increased from 6 for smoother animation
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
    frameCount: 6, // Increased from 4 for smoother motion
    columns: 6,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.DASH,
    loop: false,
    description: 'Quick dash/dodge movement',
  },
  hurt: {
    frameCount: 4, // Increased from 3 for smoother recoil
    columns: 4,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.HURT,
    loop: false,
    description: 'Taking damage reaction',
  },
  death: {
    frameCount: 10, // Increased from 8 for more dramatic death
    columns: 10,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.DEATH,
    loop: false,
    description: 'Death/defeat animation',
  },
  special: {
    frameCount: 12, // Increased from 10 for more elaborate ultimate
    columns: 12,
    rows: 1,
    isDirectional: false,
    frameDuration: ANIMATION_SPEEDS.SPECIAL,
    loop: false,
    description: 'Special ability/ultimate attack',
  },
};

// 4-direction legacy configs (for backwards compatibility)
export const ANIMATION_CONFIGS_4DIR: Record<'idle' | 'walk', AnimationGridConfig> = {
  idle: { ...ANIMATION_CONFIGS.idle, rows: 4 },
  walk: { ...ANIMATION_CONFIGS.walk, rows: 4 },
};

// 8-direction row order (clockwise from South/Front)
export const DIRECTION_ROW_ORDER_8: Direction[] = [
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

// Legacy 4-direction order (for backwards compatibility)
export const DIRECTION_ROW_ORDER: Direction4[] = ['down', 'up', 'left', 'right'];

// Map legacy directions to new 8-direction format
export const LEGACY_DIRECTION_MAP: Record<Direction4, Direction> = {
  'down': 'south',
  'up': 'north',
  'left': 'west',
  'right': 'east',
};

export const FRAME_SIZE = {
  width: 32,
  height: 48,
};

export function getSheetDimensions(animType: AnimationType, use8Dir: boolean = true): { width: number; height: number } {
  const config = ANIMATION_CONFIGS[animType];
  const rows = use8Dir ? config.rows : (config.isDirectional ? 4 : config.rows);
  return {
    width: config.columns * FRAME_SIZE.width,
    height: rows * FRAME_SIZE.height,
  };
}

export function getAspectRatio(animType: AnimationType, use8Dir: boolean = true): string {
  const config = ANIMATION_CONFIGS[animType];

  if (config.isDirectional) {
    // For 8-direction sheets (8 rows)
    if (use8Dir) {
      if (animType === 'idle') return '1:2'; // 4 cols x 8 rows = 128x384
      if (animType === 'walk') return '3:4'; // 6 cols x 8 rows = 192x384
    }
    // For 4-direction sheets (legacy)
    if (animType === 'idle') return '1:1';
    if (animType === 'walk') return '4:3';
  }

  // Non-directional (single row)
  if (config.rows === 1) {
    if (config.columns >= 10) return '21:9';
    if (config.columns >= 6) return '16:9';
  }

  return '16:9';
}

// Get 4-direction aspect ratio for split generation
export function getSplitAspectRatio(animType: 'idle' | 'walk'): string {
  if (animType === 'idle') return '1:1'; // 4 cols x 4 rows
  return '4:3'; // 6 cols x 4 rows
}

// Direction index helpers
export function getDirectionIndex8(direction: Direction): number {
  return DIRECTION_ROW_ORDER_8.indexOf(direction);
}

export function isCardinalDirection(direction: Direction): direction is CardinalDirection {
  return CARDINAL_DIRECTIONS.includes(direction as CardinalDirection);
}

export function isDiagonalDirection(direction: Direction): direction is DiagonalDirection {
  return DIAGONAL_DIRECTIONS.includes(direction as DiagonalDirection);
}
