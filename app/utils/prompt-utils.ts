/**
 * Client-side prompt utilities for displaying default prompts
 * Mirrors the server-side prompt generation logic from convex/lib/prompts.ts
 * 
 * Updated for 8-directional sprites with enhanced animation smoothness
 */

import {
  Direction8,
  CardinalDirection,
  DiagonalDirection,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  CARDINAL_DIRECTIONS,
  DIAGONAL_DIRECTIONS,
} from '../config/animation-types';

const ANIMATION_SPEEDS = {
  IDLE: 150,
  WALK: 100,
  ATTACK: 50,
  DASH: 40,
  HURT: 80,
  DEATH: 100,
  SPECIAL: 60,
} as const;

const ANIMATION_TIMING = {
  IDLE: { frameDuration: ANIMATION_SPEEDS.IDLE, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.IDLE, description: 'very slow, subtle' },
  WALK: { frameDuration: ANIMATION_SPEEDS.WALK, totalFrames: 6, totalDuration: 6 * ANIMATION_SPEEDS.WALK, description: 'smooth, natural' },
  ATTACK: { frameDuration: ANIMATION_SPEEDS.ATTACK, totalFrames: 8, totalDuration: 8 * ANIMATION_SPEEDS.ATTACK, description: 'smooth, responsive' },
  DASH: { frameDuration: ANIMATION_SPEEDS.DASH, totalFrames: 6, totalDuration: 6 * ANIMATION_SPEEDS.DASH, description: 'very fast, blur' },
  HURT: { frameDuration: ANIMATION_SPEEDS.HURT, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.HURT, description: 'brief recoil' },
  DEATH: { frameDuration: ANIMATION_SPEEDS.DEATH, totalFrames: 10, totalDuration: 10 * ANIMATION_SPEEDS.DEATH, description: 'dramatic collapse' },
  SPECIAL: { frameDuration: ANIMATION_SPEEDS.SPECIAL, totalFrames: 12, totalDuration: 12 * ANIMATION_SPEEDS.SPECIAL, description: 'flashy, elaborate' },
} as const;

const BASE_STYLE_PROMPT = `
Pixel art style, 16-bit JRPG aesthetic like Dragon Ball Z: Legacy of Goku or Pokemon.
Clean defined edges, visible pixels, no anti-aliasing.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels in visual proportion.
Plain solid white background (#FFFFFF) for easy background removal.
Character should be centered in each frame with consistent positioning.

CHARACTER CONSISTENCY - CRITICAL:
- Use the EXACT same character from the reference image
- Maintain IDENTICAL: hair color, hair style, eye color, skin tone, outfit colors, outfit design
- Keep the same face shape, body proportions, and distinctive features
- PROPORTIONS MUST MATCH: same head size, body size, arm length, leg length as reference
- Head-to-body ratio must be identical to reference image
- Do NOT change any aspect of the character's appearance
- The character must be immediately recognizable as the same person across all animations

ANIMATION SMOOTHNESS - CRITICAL:
- Each frame MUST flow smoothly into the next with natural motion progression
- Use proper animation principles: anticipation, follow-through, overlapping action
- NO sudden jumps or skipped poses between frames
- Each frame should show incremental movement from the previous frame
- Think of this as keyframe animation with proper in-betweens
- Cloth, hair, and accessories should follow physics with secondary motion
`.trim();

export const CHARACTER_STYLE_PROMPT = `Generate a single character only, centered in the frame on a plain white background.
The character should be rendered in pixel art style with clean edges, suitable for use as a 2D game sprite.
Use a 32-bit retro game aesthetic like Dragon Ball Z Legacy of Goku.
The character should be shown in a front-facing or 3/4 view pose,
standing idle and ready to be used in a sprite sheet animation.`;

// 8-direction prompt templates
const DIRECTION_PROMPTS_8: Record<Direction8, string> = {
  south: 'Character facing forward toward the viewer (FRONT view) - we see their face clearly, body facing camera',
  south_west: 'Character facing front-left at 45° angle (3/4 FRONT-LEFT view) - we see most of face, body angled toward front-left',
  west: 'Character facing left side (LEFT PROFILE view) - we see left side of face only, body facing left',
  north_west: 'Character facing back-left at 45° angle (3/4 BACK-LEFT view) - we see back of head angled left, showing mostly back',
  north: 'Character facing away from viewer (BACK view) - we see back of head and body, no face visible',
  north_east: 'Character facing back-right at 45° angle (3/4 BACK-RIGHT view) - we see back of head angled right, showing mostly back',
  east: 'Character facing right side (RIGHT PROFILE view) - we see right side of face only, body facing right',
  south_east: 'Character facing front-right at 45° angle (3/4 FRONT-RIGHT view) - we see most of face, body angled toward front-right',
};

// Animation type to API type mapping
const API_TYPE_TO_ANIMATION: Record<string, string> = {
  'walk-full': 'walk',
  'idle-full': 'idle',
  'walk-cardinal': 'walk',
  'walk-diagonal': 'walk',
  'idle-cardinal': 'idle',
  'idle-diagonal': 'idle',
  'attack-combined': 'attack',
  'dash': 'dash',
  'hurt': 'hurt',
  'death': 'death',
  'special': 'special',
};

function get4DirectionalSheetPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk',
  directionSet: 'cardinal' | 'diagonal'
): string {
  const config = ANIMATION_CONFIGS[animationType];
  const frameCount = config.frameCount;
  const timing = animationType === 'idle' ? ANIMATION_TIMING.IDLE : ANIMATION_TIMING.WALK;
  
  const directions: readonly (CardinalDirection | DiagonalDirection)[] = 
    directionSet === 'cardinal' ? CARDINAL_DIRECTIONS : DIAGONAL_DIRECTIONS;
  const directionLabels = directions.map(d => DIRECTION_PROMPTS_8[d]);
  
  const sheetWidth = config.columns * FRAME_SIZE.width;
  const sheetHeight = 4 * FRAME_SIZE.height;

  const animDesc = animationType === 'idle'
    ? `subtle idle breathing with cloth/wind animation (${timing.description}, ${timing.frameDuration}ms per frame)`
    : `walking cycle with clear leg movement (${timing.description}, ${timing.frameDuration}ms per frame)`;

  const setName = directionSet === 'cardinal' ? 'CARDINAL (S, W, N, E)' : 'DIAGONAL (SW, NW, NE, SE)';

  return `
Create a complete ${config.columns}x4 grid pixel art ${animationType.toUpperCase()} sprite sheet.
This is the ${setName} directions sheet.

EXACT LAYOUT - ${sheetWidth}x${sheetHeight} pixels total:
- ${config.columns} columns (${frameCount} frames per direction)
- 4 rows (4 directions)

Row order (MUST follow exactly):
- Row 1 (top): ${directionLabels[0]}
- Row 2: ${directionLabels[1]}
- Row 3: ${directionLabels[2]}
- Row 4 (bottom): ${directionLabels[3]}

Each row shows the SAME ${animDesc} from a different viewing angle.

Frame size: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels per frame.
Total: ${frameCount * 4} frames in ${config.columns}x4 grid on white background.

${characterDescription}
${BASE_STYLE_PROMPT}
Same character, same animation timing, 4 different viewing angles.
`.trim();
}

function getFullDirectionalSheetPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk'
): string {
  return get4DirectionalSheetPrompt(characterDescription, animationType, 'cardinal');
}

function getCombinedAttackPrompt(characterDescription: string): string {
  const timing = ANIMATION_TIMING.ATTACK;
  const sheetWidth = 8 * FRAME_SIZE.width;
  const sheetHeight = 3 * FRAME_SIZE.height;

  return `
Create an 8x3 grid pixel art COMBO ATTACK sprite sheet (${sheetWidth}x${sheetHeight} pixels).

Character facing right (side profile view) throughout all 24 frames.

EXACT LAYOUT - 8 columns × 3 rows:
Each frame: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels

Row 1 - LIGHT ATTACK (combo starter) - 8 frames for smooth animation
Row 2 - MEDIUM ATTACK (combo second hit) - 8 frames for smooth animation
Row 3 - HEAVY FINISHER (combo ender) - 8 frames for smooth animation

SMOOTH ANIMATION CRITICAL:
- Each frame MUST flow naturally into the next
- Row transitions should chain smoothly for combo feel
- Progressive power increase - Row 3 most dramatic!

${characterDescription}
${BASE_STYLE_PROMPT}
24 frames total on solid white background.
`.trim();
}

const COMBAT_PROMPTS: Record<string, (charDesc: string) => string> = {
  dash: (charDesc: string) => {
    const timing = ANIMATION_TIMING.DASH;
    return `
Create a 6-frame pixel art FLASH STEP/DASH animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 6 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Dash sequence (ultra-fast evasive burst, ${timing.totalDuration}ms total - VERY FAST):
Frame 1: Crouch start - low stance, weight dropping, preparing to burst
Frame 2: Launch crouch - maximum coil, about to explode forward
Frame 3: Explosion - body launching forward, motion blur effect begins
Frame 4: Mid-dash - maximum speed, afterimage/ghost effect, body stretched
Frame 5: Deceleration - slowing down, body returning to upright
Frame 6: Recovery - stable stance regained, ready for next action

INVINCIBILITY FRAMES: This is a dodge move. Character moves 200+ pixels.
Add speed lines or blur effect to emphasize velocity.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  hurt: (charDesc: string) => {
    const timing = ANIMATION_TIMING.HURT;
    return `
Create a 4-frame pixel art HURT/DAMAGE reaction animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Hurt sequence (taking damage reaction, ${timing.totalDuration}ms total):
Frame 1: Impact moment - head/body snapping back from hit, eyes closed, shock
Frame 2: Maximum recoil - body at furthest lean-back, arms flailing, pain expression
Frame 3: Recovery start - beginning to regain footing, pushing back
Frame 4: Stabilizing - nearly upright, determined expression, ready to continue

Clear damage reaction. Character is briefly vulnerable during this.
Plays at ${timing.frameDuration}ms per frame - short stagger.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  death: (charDesc: string) => {
    const timing = ANIMATION_TIMING.DEATH;
    return `
Create a 10-frame pixel art DEATH animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 10 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Death sequence (defeat and collapse, ${timing.totalDuration}ms total - DRAMATIC):
Frame 1: Final hit - head snapping back dramatically
Frame 2: Stagger back - losing footing
Frame 3: Balance lost - knees beginning to buckle
Frame 4: Falling start - body clearly falling
Frame 5: Mid-fall - body at 45° angle
Frame 6: Almost ground - body nearly horizontal
Frame 7: Impact - hitting ground, slight bounce
Frame 8: Settling 1 - bounce recoil
Frame 9: Settling 2 - coming to rest
Frame 10: Final pose - lying motionless

Dramatic death sequence. Character ends lying down.
Plays at ${timing.frameDuration}ms per frame - deliberate, impactful.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  special: (charDesc: string) => {
    const timing = ANIMATION_TIMING.SPECIAL;
    return `
Create a 12-frame pixel art SPECIAL ATTACK (Getsuga Tensho style) animation sprite sheet.

Character facing right (side profile view).

Arrange the 12 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Special attack sequence (ultimate ability, ${timing.totalDuration}ms total):
Frame 1-4: Energy gathering and charging
Frame 5-6: Pre-release buildup
Frame 7-10: Energy release and blast
Frame 11-12: Recovery and fade

ULTIMATE ABILITY: Most visually impressive attack in the game.
Energy/aura effects encouraged. Flashy and satisfying!
Plays at ${timing.frameDuration}ms per frame - fast but readable.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },
};

/**
 * Get the default prompt for a given API animation type
 */
export function getDefaultPrompt(apiType: string, characterDescription: string): string {
  const animType = API_TYPE_TO_ANIMATION[apiType] || apiType;

  // Handle 8-direction split types
  if (apiType === 'walk-cardinal' || apiType === 'idle-cardinal') {
    const type = apiType.split('-')[0] as 'idle' | 'walk';
    return get4DirectionalSheetPrompt(characterDescription, type, 'cardinal');
  }
  if (apiType === 'walk-diagonal' || apiType === 'idle-diagonal') {
    const type = apiType.split('-')[0] as 'idle' | 'walk';
    return get4DirectionalSheetPrompt(characterDescription, type, 'diagonal');
  }

  switch (animType) {
    case 'walk':
      return getFullDirectionalSheetPrompt(characterDescription, 'walk');
    case 'idle':
      return getFullDirectionalSheetPrompt(characterDescription, 'idle');
    case 'attack':
      return getCombinedAttackPrompt(characterDescription);
    default:
      if (COMBAT_PROMPTS[animType]) {
        return COMBAT_PROMPTS[animType](characterDescription);
      }
      return `Create a pixel art ${animType} animation sprite sheet.\n${characterDescription}\n${BASE_STYLE_PROMPT}`;
  }
}

/**
 * Get a short description of what each animation type generates
 */
export function getPromptDescription(apiType: string): string {
  const descriptions: Record<string, string> = {
    // 8-direction types
    'walk-cardinal': '6x4 grid walk cycle (S, W, N, E directions)',
    'walk-diagonal': '6x4 grid walk cycle (SW, NW, NE, SE directions)',
    'idle-cardinal': '4x4 grid idle animation (S, W, N, E directions)',
    'idle-diagonal': '4x4 grid idle animation (SW, NW, NE, SE directions)',
    // Legacy 4-direction types
    'walk-full': '6x4 grid walk cycle with 4 directions',
    'idle-full': '4x4 grid idle animation with 4 directions',
    // Combat types
    'attack-combined': '8x3 grid combo attack (3 attack variations)',
    'dash': '6-frame horizontal dash animation',
    'hurt': '4-frame horizontal hurt reaction',
    'death': '10-frame horizontal death sequence',
    'special': '12-frame horizontal special attack',
  };
  return descriptions[apiType] || 'Sprite sheet animation';
}
