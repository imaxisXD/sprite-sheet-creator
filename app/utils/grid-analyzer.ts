/**
 * Grid Analyzer Utility
 *
 * Provides smart grid detection and recommendations for sprite sheets.
 * Helps ensure consistency across different animation types.
 *
 * Imports configuration from animation-types.ts (single source of truth)
 */

import { ANIMATION_SPEEDS, FRAME_SIZE } from '../config/animation-types';

// Re-export for convenience
export { ANIMATION_SPEEDS };

export interface GridAnalysisResult {
  detectedColumns: number;
  detectedRows: number;
  frameWidth: number;
  frameHeight: number;
  confidence: number; // 0-1 score of detection confidence
  warnings: string[];
  recommendations: string[];
}

export interface GridRecommendation {
  animationType: string;
  recommendedColumns: number;
  recommendedRows: number;
  frameCount: number;
  isDirectional: boolean;
  description: string;
  targetFrameSize: { width: number; height: number };
  /** Frame duration in milliseconds (for smooth animation) */
  frameDuration: number;
  /** Total animation duration in milliseconds */
  totalDuration: number;
  /** Whether animation should loop */
  loop: boolean;
  /** Category for grouping in UI */
  category: 'movement' | 'combat' | 'reaction';
}

/**
 * Standard frame size for ichigo-journey game engine
 * Imported from animation-types.ts (single source of truth)
 */
export const STANDARD_FRAME_SIZE = FRAME_SIZE;

/**
 * Animation type recommendations - matches ichigo-journey game configuration exactly
 * Use these settings to ensure sprites work correctly in the game
 */
export const GRID_RECOMMENDATIONS: Record<string, GridRecommendation> = {
  idle: {
    animationType: 'idle',
    recommendedColumns: 4,
    recommendedRows: 8,
    frameCount: 32, // 4 frames × 8 directions
    isDirectional: true,
    description: 'Idle animation with 4 frames per direction (8 directions)',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.IDLE,
    totalDuration: 4 * ANIMATION_SPEEDS.IDLE, // 600ms per direction
    loop: true,
    category: 'movement',
  },
  walk: {
    animationType: 'walk',
    recommendedColumns: 6,
    recommendedRows: 8,
    frameCount: 48, // 6 frames × 8 directions
    isDirectional: true,
    description: 'Walk cycle with 6 frames per direction (8 directions)',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.WALK,
    totalDuration: 6 * ANIMATION_SPEEDS.WALK, // 600ms per direction
    loop: true,
    category: 'movement',
  },
  attack: {
    animationType: 'attack',
    recommendedColumns: 4,
    recommendedRows: 3,
    frameCount: 12, // 4 frames × 3 attack combos
    isDirectional: false,
    description: '3-hit combo attack sheet (all attacks in one image)',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    totalDuration: 4 * ANIMATION_SPEEDS.ATTACK, // 200ms per attack
    loop: false,
    category: 'combat',
  },
  attack1: {
    animationType: 'attack1',
    recommendedColumns: 4,
    recommendedRows: 1,
    frameCount: 4,
    isDirectional: false,
    description: 'First attack in 3-hit combo - quick slash',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    totalDuration: 4 * ANIMATION_SPEEDS.ATTACK, // 200ms total
    loop: false,
    category: 'combat',
  },
  attack2: {
    animationType: 'attack2',
    recommendedColumns: 4,
    recommendedRows: 1,
    frameCount: 4,
    isDirectional: false,
    description: 'Second attack in 3-hit combo - follow-up strike',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    totalDuration: 4 * ANIMATION_SPEEDS.ATTACK, // 200ms total
    loop: false,
    category: 'combat',
  },
  attack3: {
    animationType: 'attack3',
    recommendedColumns: 4,
    recommendedRows: 1,
    frameCount: 4,
    isDirectional: false,
    description: 'Third attack in 3-hit combo - finishing blow',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.ATTACK,
    totalDuration: 4 * ANIMATION_SPEEDS.ATTACK, // 200ms total
    loop: false,
    category: 'combat',
  },
  dash: {
    animationType: 'dash',
    recommendedColumns: 4,
    recommendedRows: 1,
    frameCount: 4,
    isDirectional: false,
    description: 'Flash Step dash with invulnerability (180ms game duration)',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.DASH,
    totalDuration: 4 * ANIMATION_SPEEDS.DASH, // 160ms total (matches DASH_DURATION)
    loop: false,
    category: 'movement',
  },
  hurt: {
    animationType: 'hurt',
    recommendedColumns: 3,
    recommendedRows: 1,
    frameCount: 3,
    isDirectional: false,
    description: 'Damage reaction with knockback effect',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.HURT,
    totalDuration: 3 * ANIMATION_SPEEDS.HURT, // 240ms total
    loop: false,
    category: 'reaction',
  },
  death: {
    animationType: 'death',
    recommendedColumns: 4,
    recommendedRows: 2,
    frameCount: 8, // 4x2 = 8 frames
    isDirectional: false,
    description: 'Death sequence - character falls and fades (AI generates 2 rows)',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.DEATH,
    totalDuration: 8 * ANIMATION_SPEEDS.DEATH, // 800ms total
    loop: false,
    category: 'reaction',
  },
  special: {
    animationType: 'special',
    recommendedColumns: 6,
    recommendedRows: 2,
    frameCount: 12, // 6x2 = 12 frames
    isDirectional: false,
    description: 'Special ability (Getsuga Tensho) - AI generates 2 rows due to aspect ratio',
    targetFrameSize: STANDARD_FRAME_SIZE,
    frameDuration: ANIMATION_SPEEDS.SPECIAL,
    totalDuration: 12 * ANIMATION_SPEEDS.SPECIAL, // 720ms total
    loop: false,
    category: 'combat',
  },
};

/**
 * Get recommendations grouped by category
 */
export function getRecommendationsByCategory(): Record<string, GridRecommendation[]> {
  const grouped: Record<string, GridRecommendation[]> = {
    movement: [],
    combat: [],
    reaction: [],
  };

  for (const rec of Object.values(GRID_RECOMMENDATIONS)) {
    grouped[rec.category].push(rec);
  }

  return grouped;
}

/**
 * Calculate expected sprite sheet dimensions for an animation type
 */
export function getExpectedDimensions(animationType: string): { width: number; height: number } | null {
  const config = GRID_RECOMMENDATIONS[animationType];
  if (!config) return null;

  return {
    width: config.recommendedColumns * config.targetFrameSize.width,
    height: config.recommendedRows * config.targetFrameSize.height,
  };
}

/**
 * Generate sprite-config.json compatible configuration
 */
export function generateSpriteConfig(animationType: string): object | null {
  const config = GRID_RECOMMENDATIONS[animationType];
  if (!config) return null;

  const dimensions = getExpectedDimensions(animationType);
  if (!dimensions) return null;

  // 8-direction row order: down, down-left, left, up-left, up, up-right, right, down-right
  const directionNames = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right'];

  const directionalMapping: Record<string, object> = {};
  if (config.isDirectional) {
    for (let i = 0; i < directionNames.length; i++) {
      directionalMapping[directionNames[i]] = {
        sheet: animationType,
        startFrame: i * config.recommendedColumns,
        frameCount: config.recommendedColumns,
        frameDuration: config.frameDuration,
        loop: config.loop,
      };
    }
  }

  return {
    sheets: {
      [animationType]: {
        path: `./\${characterName}/${animationType}.png`,
        columns: config.recommendedColumns,
        rows: config.recommendedRows,
        frameWidth: config.targetFrameSize.width,
        frameHeight: config.targetFrameSize.height,
      },
    },
    animations: config.isDirectional
      ? { [animationType]: directionalMapping }
      : {
          [animationType]: {
            sheet: animationType,
            startFrame: 0,
            frameCount: config.frameCount,
            frameDuration: config.frameDuration,
            loop: config.loop,
          },
        },
  };
}

/**
 * Analyze an image to detect its grid structure
 */
export async function analyzeGridFromImage(
  imageUrl: string,
  expectedAnimationType?: string
): Promise<GridAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const result = analyzeImageGrid(img, expectedAnimationType);
      resolve(result);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for grid analysis'));
    };

    img.src = imageUrl;
  });
}

/**
 * Analyze an already-loaded image for grid structure
 */
export function analyzeImageGrid(
  img: HTMLImageElement,
  expectedAnimationType?: string
): GridAnalysisResult {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Try to detect grid by finding vertical and horizontal gaps
  const verticalGaps = findVerticalGaps(imageData);
  const horizontalGaps = findHorizontalGaps(imageData);

  // Estimate columns and rows from gaps
  let detectedColumns = verticalGaps.length + 1;
  let detectedRows = horizontalGaps.length + 1;

  // If gap detection failed, try to estimate from standard frame sizes
  if (detectedColumns <= 1) {
    detectedColumns = Math.round(img.width / STANDARD_FRAME_SIZE.width);
  }
  if (detectedRows <= 1) {
    detectedRows = Math.round(img.height / STANDARD_FRAME_SIZE.height);
  }

  // Calculate frame dimensions
  const frameWidth = Math.round(img.width / detectedColumns);
  const frameHeight = Math.round(img.height / detectedRows);

  // Calculate confidence based on how well the dimensions align
  let confidence = 1.0;

  // Check if dimensions divide evenly
  if (img.width % detectedColumns !== 0) {
    confidence -= 0.2;
    warnings.push(`Image width (${img.width}px) doesn't divide evenly into ${detectedColumns} columns`);
  }
  if (img.height % detectedRows !== 0) {
    confidence -= 0.2;
    warnings.push(`Image height (${img.height}px) doesn't divide evenly into ${detectedRows} rows`);
  }

  // Check against expected animation type
  if (expectedAnimationType && GRID_RECOMMENDATIONS[expectedAnimationType]) {
    const expected = GRID_RECOMMENDATIONS[expectedAnimationType];
    if (detectedColumns !== expected.recommendedColumns) {
      confidence -= 0.15;
      warnings.push(
        `Detected ${detectedColumns} columns, but ${expectedAnimationType} recommends ${expected.recommendedColumns} columns`
      );
      recommendations.push(
        `Consider using ${expected.recommendedColumns} columns for ${expectedAnimationType} animation`
      );
    }
    if (detectedRows !== expected.recommendedRows) {
      confidence -= 0.15;
      warnings.push(
        `Detected ${detectedRows} rows, but ${expectedAnimationType} recommends ${expected.recommendedRows} rows`
      );
      recommendations.push(
        `Consider using ${expected.recommendedRows} rows for ${expectedAnimationType} animation`
      );
    }
  }

  // Check frame size against standard
  if (frameWidth !== STANDARD_FRAME_SIZE.width || frameHeight !== STANDARD_FRAME_SIZE.height) {
    recommendations.push(
      `Frame size is ${frameWidth}×${frameHeight}px. Standard size is ${STANDARD_FRAME_SIZE.width}×${STANDARD_FRAME_SIZE.height}px`
    );
  }

  // Suggest animation type based on detected grid
  const suggestedType = suggestAnimationType(detectedColumns, detectedRows);
  if (suggestedType && suggestedType !== expectedAnimationType) {
    recommendations.push(
      `Grid layout (${detectedColumns}×${detectedRows}) matches "${suggestedType}" animation pattern`
    );
  }

  return {
    detectedColumns,
    detectedRows,
    frameWidth,
    frameHeight,
    confidence: Math.max(0, Math.min(1, confidence)),
    warnings,
    recommendations,
  };
}

/**
 * Find vertical gaps (separators between columns) in the image
 */
function findVerticalGaps(imageData: ImageData): number[] {
  const { width, height, data } = imageData;
  const gaps: number[] = [];
  const threshold = 0.95; // 95% transparent column = gap

  for (let x = 1; x < width - 1; x++) {
    let transparentPixels = 0;

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 10) {
        transparentPixels++;
      }
    }

    const transparentRatio = transparentPixels / height;
    if (transparentRatio > threshold) {
      // Check if this is a new gap (not adjacent to previous gap)
      if (gaps.length === 0 || x - gaps[gaps.length - 1] > 5) {
        gaps.push(x);
      }
    }
  }

  return gaps;
}

/**
 * Find horizontal gaps (separators between rows) in the image
 */
function findHorizontalGaps(imageData: ImageData): number[] {
  const { width, height, data } = imageData;
  const gaps: number[] = [];
  const threshold = 0.95; // 95% transparent row = gap

  for (let y = 1; y < height - 1; y++) {
    let transparentPixels = 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 10) {
        transparentPixels++;
      }
    }

    const transparentRatio = transparentPixels / width;
    if (transparentRatio > threshold) {
      // Check if this is a new gap (not adjacent to previous gap)
      if (gaps.length === 0 || y - gaps[gaps.length - 1] > 5) {
        gaps.push(y);
      }
    }
  }

  return gaps;
}

/**
 * Suggest animation type based on grid dimensions
 */
export function suggestAnimationType(columns: number, rows: number): string | null {
  for (const [type, config] of Object.entries(GRID_RECOMMENDATIONS)) {
    if (config.recommendedColumns === columns && config.recommendedRows === rows) {
      return type;
    }
  }

  // Fuzzy matching
  if (rows === 8) {
    if (columns === 4) return 'idle';
    if (columns === 6) return 'walk';
  }
  if (rows === 1) {
    if (columns === 3) return 'hurt';
    if (columns === 4) return 'attack1';
  }
  if (rows === 2) {
    if (columns === 4) return 'death';
    if (columns === 5 || columns === 6) return 'special';
  }
  if (rows === 3 && columns === 4) return 'attack';

  return null;
}

/**
 * Get all grid recommendations as an array for display
 */
export function getAllRecommendations(): GridRecommendation[] {
  return Object.values(GRID_RECOMMENDATIONS);
}

/**
 * Validate if a sprite sheet matches expected configuration
 */
export function validateSpriteSheet(
  imageWidth: number,
  imageHeight: number,
  animationType: string
): { isValid: boolean; errors: string[]; suggestions: string[] } {
  const config = GRID_RECOMMENDATIONS[animationType];
  if (!config) {
    return {
      isValid: false,
      errors: [`Unknown animation type: ${animationType}`],
      suggestions: [`Valid types: ${Object.keys(GRID_RECOMMENDATIONS).join(', ')}`],
    };
  }

  const errors: string[] = [];
  const suggestions: string[] = [];

  const expectedWidth = config.recommendedColumns * config.targetFrameSize.width;
  const expectedHeight = config.recommendedRows * config.targetFrameSize.height;

  if (imageWidth !== expectedWidth) {
    errors.push(
      `Width mismatch: got ${imageWidth}px, expected ${expectedWidth}px (${config.recommendedColumns} columns × ${config.targetFrameSize.width}px)`
    );
    suggestions.push(`Resize image width to ${expectedWidth}px`);
  }

  if (imageHeight !== expectedHeight) {
    errors.push(
      `Height mismatch: got ${imageHeight}px, expected ${expectedHeight}px (${config.recommendedRows} rows × ${config.targetFrameSize.height}px)`
    );
    suggestions.push(`Resize image height to ${expectedHeight}px`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
  };
}

/**
 * Extract frames from a sprite sheet with given grid configuration
 */
export async function extractFramesFromSpriteSheet(
  imageUrl: string,
  columns: number,
  rows: number
): Promise<{
  frames: { dataUrl: string; x: number; y: number; width: number; height: number }[];
  frameWidth: number;
  frameHeight: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const frameWidth = Math.floor(img.width / columns);
      const frameHeight = Math.floor(img.height / rows);
      const frames: { dataUrl: string; x: number; y: number; width: number; height: number }[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = frameWidth;
          canvas.height = frameHeight;

          ctx.drawImage(
            img,
            col * frameWidth,
            row * frameHeight,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          frames.push({
            dataUrl: canvas.toDataURL('image/png'),
            x: col * frameWidth,
            y: row * frameHeight,
            width: frameWidth,
            height: frameHeight,
          });
        }
      }

      resolve({ frames, frameWidth, frameHeight });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for frame extraction'));
    };

    img.src = imageUrl;
  });
}
