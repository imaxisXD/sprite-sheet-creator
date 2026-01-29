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
  ATTACK: { frameDuration: ANIMATION_SPEEDS.ATTACK, totalFrames: 6, totalDuration: 6 * ANIMATION_SPEEDS.ATTACK, description: 'smooth, responsive' },
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
`.trim();

/**
 * Direction-specific view prompts with anatomical anchors
 */
export const DIRECTION_PROMPTS: Record<Direction, string> = {
  down: 'Character facing forward toward the viewer (front view), both eyes visible, looking straight at camera',
  up: 'Character facing away from the viewer (back view), showing back of head, no face visible',
  left: 'Character facing left - nose points toward LEFT edge of frame, RIGHT EAR visible, LEFT EAR hidden, we see the RIGHT side of their face',
  right: 'Character facing right - nose points toward RIGHT edge of frame, LEFT EAR visible, RIGHT EAR hidden, we see the LEFT side of their face',
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

Frame sequence (${timing.description} cloth/wind animation, ${timing.totalDuration}ms total):
Frame 1: Neutral standing pose - relaxed confident stance, cloth/cape at rest
Frame 2: Subtle wind effect - cloth/cape gently flowing to one side, hair slightly moving
Frame 3: Wind continues - cloth/cape billowing softly, character shifts into signature pose (hand on weapon/hip, crossing arms, or characteristic gesture)
Frame 4: Settling back - cloth returning to rest, transitioning back to neutral stance

CLOTH ANIMATION FOCUS:
- Cloth, cape, scarf, or loose clothing should have fluid movement responding to gentle breeze
- Hair should have subtle wind sway
- Body stays mostly still - movement is in the fabric and accessories
- Head stays facing the same direction - NO head turning

CRITICAL: Keep body movements VERY SUBTLE - cloth/fabric animation is the main focus.
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

HEAD DIRECTION - CRITICAL (ANATOMICAL ANCHORS):
- Head MUST face the same direction as the body throughout ALL frames
- NO head turning to look at the viewer or opposite direction
- For LEFT walk: nose points toward LEFT edge, RIGHT EAR visible, LEFT EAR hidden (we see right side of face)
- For RIGHT walk: nose points toward RIGHT edge, LEFT EAR visible, RIGHT EAR hidden (we see left side of face)
- Head and body must be aligned - character looks where they are walking

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
Create a 6-frame pixel art LIGHT ATTACK animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 6 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (quick light slash - smooth 6-frame animation):
Frame 1: Ready stance - weight centered, weapon/arm at rest position
Frame 2: Anticipation - slight crouch, pulling weapon/fist back, weight shifting to back foot
Frame 3: Swing start - arm/weapon beginning forward motion, body starting to rotate
Frame 4: Mid-swing - arm/weapon at halfway point, maximum speed, body fully committed
Frame 5: Impact/Contact - full extension of attack, slight lean forward, hit lands
Frame 6: Follow-through - arm continues past target, beginning to recover stance

COMBO STARTER: First hit in 3-attack combo.
SMOOTH ANIMATION: Each frame should flow naturally into the next with clear motion progression.
Frame 6 should transition smoothly into attack2 or return to Frame 1 ready stance for looping.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  attack2: (charDesc: string) => {
    const timing = ANIMATION_TIMING.ATTACK;
    return `
Create a 6-frame pixel art MEDIUM ATTACK animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 6 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (strong horizontal strike - smooth 6-frame animation):
Frame 1: Transition from attack1 - catching momentum from previous attack
Frame 2: Coiling - shifting weight back, hips/shoulders rotating for power, weapon drawn back
Frame 3: Power build-up - body tensing, about to explode forward, maximum coil
Frame 4: Strike unleashed - explosive forward motion, weapon/arm swinging horizontally
Frame 5: Impact - powerful horizontal slash connects, full extension, body weight behind it
Frame 6: Recovery - following through, starting to return to ready position

COMBO SECOND HIT: More powerful than attack1, shows weight and momentum.
SMOOTH ANIMATION: Each frame should flow naturally into the next with clear motion progression.
Frame 6 should transition smoothly into attack3 or return to ready stance for looping.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  attack3: (charDesc: string) => {
    const timing = ANIMATION_TIMING.ATTACK;
    return `
Create a 6-frame pixel art HEAVY FINISHER attack animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 6 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (powerful combo finisher - smooth 6-frame animation):
Frame 1: Dramatic wind-up start - big preparation, raising weapon/arm high
Frame 2: Maximum charge - weapon/arm at peak height, body coiled, gathering all force
Frame 3: Power surge - visible tension, slight pause before unleashing (anticipation frame)
Frame 4: Devastating swing - explosive downward/diagonal strike, maximum speed
Frame 5: Impact moment - strike lands with full force, dramatic pose, slight camera shake feel
Frame 6: Triumphant finish - follow-through complete, powerful ending stance, ready to return to idle

COMBO FINISHER: Most powerful and dramatic attack in the combo.
SMOOTH ANIMATION: Each frame should flow naturally into the next with clear motion progression.
Frame 6 MUST return to the same ready stance as attack1 Frame 1 - this enables seamless combo looping.
Make this attack feel IMPACTFUL and SATISFYING as the combo ender!
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
    ? `subtle cloth/wind animation with signature pose (${timing.description}, ${timing.frameDuration}ms per frame)`
    : `walking cycle with clear leg movement (${timing.description}, ${timing.frameDuration}ms per frame)`;

  const sheetWidth = config.columns * FRAME_SIZE.width;
  const sheetHeight = config.rows * FRAME_SIZE.height;

  return `
Create a complete ${config.columns}x${config.rows} grid pixel art ${animationType.toUpperCase()} sprite sheet.

EXACT LAYOUT - ${sheetWidth}x${sheetHeight} pixels total:
- ${config.columns} columns (frames per direction)
- 4 rows (one per direction)

Row order (IMPORTANT - must follow exactly):
- Row 1 (top): DOWN/Front view - character facing toward viewer, both eyes visible, looking at camera
- Row 2: UP/Back view - character facing away from viewer, showing back of head, no face visible
- Row 3: LEFT - character walking left, nose points toward LEFT edge of frame
- Row 4 (bottom): RIGHT - character walking right, nose points toward RIGHT edge of frame

ANATOMICAL ANCHORS FOR LEFT/RIGHT ROWS (CRITICAL):
- Row 3 (LEFT walking): Character's RIGHT EAR visible, LEFT EAR hidden. Nose points to LEFT edge of frame. We see the RIGHT side of their face.
- Row 4 (RIGHT walking): Character's LEFT EAR visible, RIGHT EAR hidden. Nose points to RIGHT edge of frame. We see the LEFT side of their face.

MIRROR RELATIONSHIP:
- Row 3 and Row 4 MUST be HORIZONTAL MIRRORS of each other
- If you drew a vertical line and flipped Row 3, it should look like Row 4
- The sword/weapon switches hands between these rows (appears on opposite sides)

Each row shows the same ${animDesc} from a different viewing angle.

${animationType === 'walk' ? `
WALK CYCLE FRAMES - LEGS MUST MOVE (6-frame standard walk cycle per row):
Frame 1: RIGHT foot forward, LEFT foot back - legs spread apart in stride
Frame 2: Legs passing - RIGHT foot moving back, LEFT foot moving forward
Frame 3: LEFT foot forward, RIGHT foot back - opposite of Frame 1
Frame 4: Contact pose - LEFT heel touching down, weight shifting
Frame 5: Legs passing again - feet close together, mid-stride
Frame 6: RIGHT foot forward again - completing the cycle back to Frame 1

LEG MOVEMENT IS MANDATORY:
- Each frame MUST show a DIFFERENT leg position
- Legs should be visibly spread apart in walking stride (Frames 1, 3)
- Arms swing opposite to legs naturally
- Body has slight up-down bobbing motion
- DO NOT make all frames look the same - this is a WALKING animation, not standing still
` : ''}

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
  const sheetWidth = 6 * FRAME_SIZE.width; // 192px
  const sheetHeight = 3 * FRAME_SIZE.height; // 144px

  return `
Create a 6x3 grid pixel art COMBO ATTACK sprite sheet (${sheetWidth}x${sheetHeight} pixels).

Character facing right (side profile view) throughout all 18 frames.

EXACT LAYOUT - 6 columns × 3 rows:
Each frame: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels

Row 1 - LIGHT ATTACK (combo starter) - 6 frames for smooth animation:
  Frame 1: Ready stance - weight centered, weapon/arm at rest
  Frame 2: Anticipation - slight crouch, pulling back, weight to back foot
  Frame 3: Swing start - arm/weapon beginning forward, body rotating
  Frame 4: Mid-swing - halfway point, maximum speed, body committed
  Frame 5: Impact - full extension, slight lean forward, hit lands
  Frame 6: Follow-through - arm continues past, beginning recovery

Row 2 - MEDIUM ATTACK (combo second hit) - 6 frames for smooth animation:
  Frame 1: Transition - catching momentum from previous attack
  Frame 2: Coiling - weight back, hips/shoulders rotating, weapon drawn back
  Frame 3: Power build-up - body tensing, maximum coil, about to explode
  Frame 4: Strike unleashed - explosive forward, weapon swinging horizontally
  Frame 5: Impact - powerful slash connects, full extension, weight behind it
  Frame 6: Recovery - following through, returning to ready position

Row 3 - HEAVY FINISHER (combo ender) - 6 frames for smooth animation:
  Frame 1: Dramatic wind-up - raising weapon/arm high, big preparation
  Frame 2: Maximum charge - peak height, body coiled, gathering force
  Frame 3: Power surge - tension visible, slight pause before unleashing
  Frame 4: Devastating swing - explosive downward strike, maximum speed
  Frame 5: Impact moment - strike lands with full force, dramatic pose
  Frame 6: Triumphant finish - follow-through complete, powerful ending stance

SMOOTH ANIMATION CRITICAL:
- Each frame must flow naturally into the next
- Clear motion progression between frames
- No sudden jumps or skipped poses
- Each row should chain smoothly into the next for combo feel
- IMPORTANT: Row 1 Frame 1 and Row 3 Frame 6 should be similar neutral/ready stance
- This allows the combo to loop seamlessly back to the start

Progressive power increase - Row 3 should look most powerful and dramatic!

${characterDescription}
${BASE_STYLE_PROMPT}
18 frames total on solid white background.
`.trim();
}
