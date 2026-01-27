/**
 * TypeScript types for Ichigo Sprite Creator
 */

import { AnimationType, Direction } from '../config/animation-types';

/**
 * Bounding box for content within a frame
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A single extracted frame from a sprite sheet
 */
export interface Frame {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

/**
 * A directional animation set (4 directions)
 */
export interface DirectionalFrameSet {
  down: Frame[];
  up: Frame[];
  left: Frame[];
  right: Frame[];
}

/**
 * Character preset definition
 */
export interface CharacterPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  /** Optional reference image URL */
  referenceImageUrl?: string;
  /** Style modifiers to append to prompts */
  styleModifiers?: string;
}

/**
 * Generated character data
 */
export interface GeneratedCharacter {
  preset: CharacterPreset | null;
  customPrompt?: string;
  baseImageUrl: string;
  /** Front-facing base image */
  frontImageUrl?: string;
  /** All 4 directional base poses */
  directionalBases?: {
    down: string;
    up: string;
    left: string;
    right: string;
  };
}

/**
 * Generated animation data for a single animation type
 */
export interface GeneratedAnimation {
  type: AnimationType;
  /** Original sprite sheet URL (before background removal) */
  originalUrl: string;
  /** URL after background removal */
  processedUrl?: string;
  /** Extracted frames */
  frames: Frame[];
  /** For directional animations, frames per direction */
  directionalFrames?: DirectionalFrameSet;
  /** Generation status */
  status: 'pending' | 'generating' | 'processing' | 'complete' | 'error';
  error?: string;
}

/**
 * Complete character sprite set
 */
export interface CharacterSpriteSet {
  character: GeneratedCharacter;
  animations: Record<AnimationType, GeneratedAnimation>;
}

/**
 * Export configuration for the final output
 */
export interface ExportConfig {
  /** Base name for exported files */
  baseName: string;
  /** Output format */
  format: 'png' | 'webp';
  /** Whether to include sprite-config.json */
  includeConfig: boolean;
  /** Scale factor (1 = original 32x48, 2 = 64x96, etc.) */
  scale: number;
}

/**
 * Sprite sheet file info for export
 */
export interface SpriteSheetFile {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Export package containing all sprite sheets
 */
export interface ExportPackage {
  files: SpriteSheetFile[];
  config: SpriteConfig;
}

/**
 * Sprite configuration JSON (matches ichigo-journey format)
 */
export interface SpriteConfig {
  sheets: Record<string, SheetConfig>;
  animations: AnimationMappings;
}

export interface SheetConfig {
  path: string;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
}

export interface AnimationMapping {
  sheet: string;
  startFrame: number;
  frameCount: number;
  frameDuration: number;
  loop: boolean;
}

export interface DirectionalAnimationMapping {
  up: AnimationMapping;
  down: AnimationMapping;
  left: AnimationMapping;
  right: AnimationMapping;
}

export interface AnimationMappings {
  idle: DirectionalAnimationMapping;
  walk: DirectionalAnimationMapping;
  attack1: AnimationMapping;
  attack2: AnimationMapping;
  attack3: AnimationMapping;
  dash: AnimationMapping;
  hurt: AnimationMapping;
  death: AnimationMapping;
  special: AnimationMapping;
}

/**
 * Workflow step in the UI
 */
export type WorkflowStep =
  | 'select-character'
  | 'generate-base'
  | 'generate-directional'
  | 'generate-walk'
  | 'generate-idle'
  | 'generate-combat'
  | 'remove-backgrounds'
  | 'preview-export';

/**
 * Overall app state
 */
export interface AppState {
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  character: GeneratedCharacter | null;
  animations: Map<AnimationType, GeneratedAnimation>;
  isLoading: boolean;
  error: string | null;
}

/**
 * API response types
 */
export interface GenerateCharacterResponse {
  imageUrl: string;
  width: number;
  height: number;
}

export interface GenerateSpriteSheetResponse {
  imageUrl: string;
  width: number;
  height: number;
  type: AnimationType;
}

export interface RemoveBackgroundResponse {
  imageUrl: string;
  width: number;
  height: number;
}

export interface GenerateDirectionalResponse {
  imageUrl: string;
  direction: Direction;
  width: number;
  height: number;
}
