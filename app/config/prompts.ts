/**
 * AI prompt templates for sprite sheet generation
 *
 * These prompts are designed to work with fal.ai's nano-banana-pro model
 * to generate consistent sprite animations.
 *
 * GAME CONFIGURATION REFERENCE (ichigo-journey):
 * - Frame size: 32×48 pixels
 * - Animation speeds (ms per frame):
 *   - IDLE: 150ms (slow, subtle breathing)
 *   - WALK: 100ms (smooth locomotion)
 *   - ATTACK: 50ms (quick, snappy)
 *   - DASH: 40ms (very fast)
 *   - HURT: 80ms (brief recoil)
 *   - DEATH: 100ms (dramatic fall)
 *   - SPECIAL: 60ms (flashy ultimate)
 *
 * - Grid layouts:
 *   - idle.png: 4 columns × 4 rows (16 frames, 4 per direction)
 *   - walk.png: 6 columns × 4 rows (24 frames, 6 per direction)
 *   - attack.png: 4 columns × 3 rows (12 frames, 4 per attack type)
 *   - dash.png: 4 columns × 1 row
 *   - hurt.png: 3 columns × 1 row
 *   - death.png: 8 columns × 1 row
 *   - special.png: 10 columns × 1 row
 */

import { AnimationType, Direction, ANIMATION_CONFIGS, FRAME_SIZE, ANIMATION_SPEEDS } from './animation-types';

/**
 * Animation timing reference for smooth animations
 * Derived from ANIMATION_SPEEDS (single source of truth in animation-types.ts)
 */
export const ANIMATION_TIMING = {
  IDLE: { frameDuration: ANIMATION_SPEEDS.IDLE, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.IDLE, description: 'very slow, subtle' },
  WALK: { frameDuration: ANIMATION_SPEEDS.WALK, totalFrames: 6, totalDuration: 6 * ANIMATION_SPEEDS.WALK, description: 'smooth, natural' },
  ATTACK: { frameDuration: ANIMATION_SPEEDS.ATTACK, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.ATTACK, description: 'quick, snappy' },
  DASH: { frameDuration: ANIMATION_SPEEDS.DASH, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.DASH, description: 'very fast, blur' },
  HURT: { frameDuration: ANIMATION_SPEEDS.HURT, totalFrames: 3, totalDuration: 3 * ANIMATION_SPEEDS.HURT, description: 'brief recoil' },
  DEATH: { frameDuration: ANIMATION_SPEEDS.DEATH, totalFrames: 8, totalDuration: 8 * ANIMATION_SPEEDS.DEATH, description: 'dramatic collapse' },
  SPECIAL: { frameDuration: ANIMATION_SPEEDS.SPECIAL, totalFrames: 10, totalDuration: 10 * ANIMATION_SPEEDS.SPECIAL, description: 'flashy, elaborate' },
} as const;

/**
 * Base style prompt for all sprite generations
 */
export const BASE_STYLE_PROMPT = `
Pixel art style, 16-bit JRPG aesthetic, clean defined edges, visible pixels, no anti-aliasing.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels in visual proportion.
Same character design maintained with consistent proportions throughout ALL frames.
Plain solid white background (#FFFFFF) for easy background removal.
Character should be centered in each frame with consistent positioning.
`.trim();

/**
 * Direction-specific view prompts
 */
export const DIRECTION_PROMPTS: Record<Direction, string> = {
  down: 'Character facing forward toward the viewer (front view), looking straight ahead',
  up: 'Character facing away from the viewer (back view), showing their back',
  left: 'Character facing left side (left profile view), looking to the left',
  right: 'Character facing right side (right profile view), looking to the right',
};

/**
 * Generate prompt for a directional animation (idle/walk)
 */
export function getDirectionalAnimationPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk',
  direction: Direction
): string {
  const config = ANIMATION_CONFIGS[animationType];
  const directionView = DIRECTION_PROMPTS[direction];

  if (animationType === 'idle') {
    const timing = ANIMATION_TIMING.IDLE;
    return `
Create a ${config.frameCount}-frame pixel art idle animation sprite sheet of this character.

${directionView}

Arrange the ${config.frameCount} frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Frame sequence (${timing.description} breathing cycle, ${timing.totalDuration}ms total):
Frame 1: Neutral standing pose - relaxed stance
Frame 2: Slight body rise (breathing in) - very subtle upward shift
Frame 3: Peak of breath - maximum inhale, barely noticeable lift
Frame 4: Returning to neutral (breathing out) - settling back down

CRITICAL: Keep movements VERY SUBTLE - maximum 1-2 pixel vertical shift between frames.
The character should NOT appear to slide or drift horizontally.
All frames must have the character in the EXACT same horizontal position.
This plays at ${timing.frameDuration}ms per frame - slow and peaceful.

${characterDescription}
${BASE_STYLE_PROMPT}
`.trim();
  }

  // Walk animation
  const timing = ANIMATION_TIMING.WALK;
  return `
Create a ${config.frameCount}-frame pixel art walk cycle sprite sheet of this character.

${directionView}

Arrange the ${config.frameCount} frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Walk cycle frames (standard 6-frame walk, ${timing.totalDuration}ms total loop):
Frame 1: Contact - right foot forward, heel touching ground
Frame 2: Passing - weight shifting, legs passing each other
Frame 3: High point - left leg lifted behind, right leg bent
Frame 4: Contact - left foot forward, heel touching ground
Frame 5: Passing - weight shifting, legs passing (opposite)
Frame 6: High point - right leg lifted behind, left leg bent

IMPORTANT: Clear leg movement showing walking motion.
Arms should swing naturally opposite to legs.
Body should have slight up-down bob during walk cycle.
Character stays horizontally centered - walking in place animation.
Plays at ${timing.frameDuration}ms per frame - smooth, natural pace.

${characterDescription}
${BASE_STYLE_PROMPT}
`.trim();
}

/**
 * Combat animation prompts - all face right for combo system
 * These animations are used in the game's 3-hit combo: attack1 → attack2 → attack3
 * Total combo time: ~600ms (200ms × 3 attacks)
 */
export const COMBAT_ANIMATION_PROMPTS: Record<string, (charDesc: string) => string> = {
  attack1: (charDesc: string) => {
    const timing = ANIMATION_TIMING.ATTACK;
    return `
Create a 4-frame pixel art LIGHT ATTACK animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (quick light slash, ${timing.totalDuration}ms total - FAST):
Frame 1: Wind-up - pulling weapon/fist back, weight on back foot
Frame 2: Swing begins - arm/weapon moving forward rapidly
Frame 3: Impact - full extension of attack, slight lean forward
Frame 4: Follow-through - slight overshoot, beginning to recover

COMBO STARTER: This is the first hit in a 3-attack combo.
Quick, snappy motion at ${timing.frameDuration}ms per frame - feels responsive.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  attack2: (charDesc: string) => {
    const timing = ANIMATION_TIMING.ATTACK;
    return `
Create a 4-frame pixel art MEDIUM ATTACK animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (strong horizontal strike, ${timing.totalDuration}ms total):
Frame 1: Preparation - shifting weight back, coiling
Frame 2: Power build-up - rotating hips/shoulders for power
Frame 3: Strike - powerful horizontal slash/punch, full extension
Frame 4: Recovery - following through, returning stance

COMBO SECOND HIT: More powerful than attack1, shows weight behind strike.
Plays at ${timing.frameDuration}ms per frame - same speed as attack1 for combo flow.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  attack3: (charDesc: string) => {
    const timing = ANIMATION_TIMING.ATTACK;
    return `
Create a 4-frame pixel art HEAVY FINISHER attack animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (powerful combo finisher, ${timing.totalDuration}ms total):
Frame 1: Dramatic wind-up - big preparation pose, gathering force
Frame 2: Power surge - visible energy/tension, about to unleash
Frame 3: Devastating strike - maximum force attack, dramatic pose
Frame 4: Impact pose - landing the finisher, triumphant stance

COMBO FINISHER: Most powerful attack, dramatic and impactful.
This ends the 3-hit combo. Make it visually satisfying!
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  dash: (charDesc: string) => {
    const timing = ANIMATION_TIMING.DASH;
    return `
Create a 4-frame pixel art FLASH STEP/DASH animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Dash sequence (ultra-fast evasive burst, ${timing.totalDuration}ms total - VERY FAST):
Frame 1: Crouch/anticipation - low stance, preparing to burst
Frame 2: Launch - explosive start, body leaning forward heavily
Frame 3: Mid-dash - motion blur effect, afterimage feeling, maximum speed
Frame 4: Recovery - decelerating, regaining stable stance

INVINCIBILITY FRAMES: This is a dodge move. Character moves 200+ pixels.
Fastest animation at ${timing.frameDuration}ms per frame - near-instant feel.
Add speed lines or blur effect to emphasize velocity.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  hurt: (charDesc: string) => {
    const timing = ANIMATION_TIMING.HURT;
    return `
Create a 3-frame pixel art HURT/DAMAGE reaction animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 3 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Hurt sequence (taking damage reaction, ${timing.totalDuration}ms total):
Frame 1: Impact - head/body snapping back from hit, eyes closed
Frame 2: Stagger - maximum recoil, pained expression, arms flailing
Frame 3: Recovery - starting to regain composure, determined look

Clear damage reaction. Character is briefly vulnerable during this.
Plays at ${timing.frameDuration}ms per frame - short stagger.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  death: (charDesc: string) => {
    const timing = ANIMATION_TIMING.DEATH;
    return `
Create an 8-frame pixel art DEATH animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 8 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Death sequence (defeat and collapse, ${timing.totalDuration}ms total - DRAMATIC):
Frame 1: Final hit reaction - head snapping back
Frame 2: Stagger back - losing footing
Frame 3: Losing balance - arms reaching out
Frame 4: Beginning to fall - knees buckling
Frame 5: Mid-fall - body tilting toward ground
Frame 6: Hitting ground - impact with floor
Frame 7: Settling - bouncing slightly
Frame 8: Final resting pose - lying motionless on ground

Dramatic, cinematic death. Character ends up lying down in Frame 8.
Plays at ${timing.frameDuration}ms per frame - deliberate, impactful.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  special: (charDesc: string) => {
    const timing = ANIMATION_TIMING.SPECIAL;
    return `
Create a 10-frame pixel art SPECIAL ATTACK (Getsuga Tensho style) animation sprite sheet.

Character facing right (side profile view).

Arrange the 10 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Special attack sequence (ultimate ability, ${timing.totalDuration}ms total):
Frame 1: Stance change - gripping weapon tightly
Frame 2: Gathering energy - aura beginning to form
Frame 3: Power building - visible energy crackling, wind effect
Frame 4: Maximum charge - glowing with power, dramatic pose
Frame 5: Beginning release - energy starting to discharge
Frame 6: Swing start - weapon/arm moving in arc
Frame 7: Maximum release - energy blast leaving character
Frame 8: Full extension - follow-through of swing
Frame 9: Energy dissipating - power fading
Frame 10: Recovery - returning to ready stance

ULTIMATE ABILITY: Most visually impressive attack in the game.
Energy/aura effects encouraged. Flashy and satisfying!
Plays at ${timing.frameDuration}ms per frame - fast but readable.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },
};

/**
 * Get the prompt for any animation type
 */
export function getAnimationPrompt(
  characterDescription: string,
  animationType: AnimationType,
  direction?: Direction
): string {
  const config = ANIMATION_CONFIGS[animationType];

  if (config.isDirectional && direction) {
    return getDirectionalAnimationPrompt(
      characterDescription,
      animationType as 'idle' | 'walk',
      direction
    );
  }

  const promptFn = COMBAT_ANIMATION_PROMPTS[animationType];
  if (promptFn) {
    return promptFn(characterDescription);
  }

  // Fallback generic prompt
  return `
Create a ${config.frameCount}-frame pixel art ${animationType} animation sprite sheet.
Arrange frames in a single horizontal row on white background.
${characterDescription}
${BASE_STYLE_PROMPT}
`.trim();
}

/**
 * Prompt for generating a full directional sprite sheet (all 4 directions at once)
 * This creates the complete idle.png or walk.png file in one generation
 */
export function getFullDirectionalSheetPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk'
): string {
  const config = ANIMATION_CONFIGS[animationType];
  const frameCount = config.frameCount;
  const timing = animationType === 'idle' ? ANIMATION_TIMING.IDLE : ANIMATION_TIMING.WALK;

  const animDesc = animationType === 'idle'
    ? `subtle breathing animation (${timing.description}, ${timing.frameDuration}ms per frame)`
    : `walking cycle with clear leg movement (${timing.description}, ${timing.frameDuration}ms per frame)`;

  const sheetWidth = config.columns * FRAME_SIZE.width;
  const sheetHeight = config.rows * FRAME_SIZE.height;

  return `
Create a complete ${config.columns}x${config.rows} grid pixel art ${animationType.toUpperCase()} sprite sheet.

EXACT LAYOUT - ${sheetWidth}x${sheetHeight} pixels total:
- ${config.columns} columns (frames per direction)
- 4 rows (one per direction)

Row order (IMPORTANT - must follow exactly):
- Row 1 (top): DOWN/Front view - character facing toward viewer
- Row 2: UP/Back view - character facing away from viewer
- Row 3: LEFT - character facing left (left profile)
- Row 4 (bottom): RIGHT - character facing right (right profile)

Each row shows the same ${animDesc} from a different viewing angle.

Frame size: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels per frame.
Total: ${frameCount * 4} frames in ${config.columns}x4 grid on white background.

CRITICAL: All frames must maintain EXACT same character proportions.
The character must not drift horizontally within frames.
Each direction must be clearly distinguishable.

${characterDescription}
${BASE_STYLE_PROMPT}
Same character, same animation timing, 4 different viewing angles.
`.trim();
}

/**
 * Prompt for generating combined attack sheet (attack1 + attack2 + attack3)
 * Creates the complete attack.png file for the 3-hit combo system
 */
export function getCombinedAttackPrompt(characterDescription: string): string {
  const timing = ANIMATION_TIMING.ATTACK;
  const sheetWidth = 4 * FRAME_SIZE.width; // 128px
  const sheetHeight = 3 * FRAME_SIZE.height; // 144px

  return `
Create a 4x3 grid pixel art COMBO ATTACK sprite sheet (${sheetWidth}x${sheetHeight} pixels).

Character facing right (side profile view) throughout all 12 frames.

EXACT LAYOUT - 4 columns × 3 rows:
Each frame: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels

Row 1 - LIGHT ATTACK (combo starter):
  Frame 1: Wind-up - pulling back
  Frame 2: Swing start - arm moving forward
  Frame 3: Impact - full extension
  Frame 4: Follow-through - slight overshoot

Row 2 - MEDIUM ATTACK (combo second hit):
  Frame 1: Preparation - shifting weight
  Frame 2: Power build-up - coiling
  Frame 3: Strike - powerful horizontal slash
  Frame 4: Recovery - returning stance

Row 3 - HEAVY FINISHER (combo ender):
  Frame 1: Dramatic wind-up - big preparation
  Frame 2: Power surge - energy building
  Frame 3: Devastating strike - maximum force
  Frame 4: Impact pose - triumphant finish

COMBO SYSTEM: These play in sequence at ${timing.frameDuration}ms per frame.
Total combo: ${timing.totalDuration * 3}ms for all 3 attacks.
Each row must flow smoothly into the next for combo chaining.
Progressive power increase - Row 3 should look most powerful!

${characterDescription}
${BASE_STYLE_PROMPT}
12 frames total on solid white background.
`.trim();
}
