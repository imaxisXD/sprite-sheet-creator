/**
 * AI prompt templates for sprite sheet generation
 *
 * These prompts are designed to work with fal.ai's nano-banana-pro model
 * to generate consistent sprite animations.
 *
 * GAME CONFIGURATION REFERENCE (ichigo-journey):
 * - Frame size: 32x48 pixels
 * - Animation speeds (ms per frame):
 *   - IDLE: 150ms (slow, subtle breathing)
 *   - WALK: 100ms (smooth locomotion)
 *   - ATTACK: 50ms (quick, snappy)
 *   - DASH: 40ms (very fast)
 *   - HURT: 80ms (brief recoil)
 *   - DEATH: 100ms (dramatic fall)
 *   - SPECIAL: 60ms (flashy ultimate)
 *
 * - Grid layouts (split sheets for 8-direction support):
 *   - idle-cardinal.png: 4 columns x 4 rows (16 frames, 4 per direction)
 *   - idle-diagonal.png: 4 columns x 4 rows (16 frames, 4 per direction)
 *   - walk-cardinal.png: 6 columns x 4 rows (24 frames, 6 per direction)
 *   - walk-diagonal.png: 6 columns x 4 rows (24 frames, 6 per direction)
 *   - attack.png: 8 columns x 3 rows (24 frames, 8 per attack type)
 *   - dash.png: 6 columns x 1 row
 *   - hurt.png: 4 columns x 1 row
 *   - death.png: 10 columns x 1 row
 *   - special.png: 12 columns x 1 row
 */

import {
  AnimationType,
  Direction,
  Direction8,
  CardinalDirection,
  DiagonalDirection,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  ANIMATION_SPEEDS,
  CARDINAL_DIRECTIONS,
  DIAGONAL_DIRECTIONS,
} from './animation-types';

/**
 * Animation timing reference for smooth animations
 * Derived from ANIMATION_SPEEDS (single source of truth in animation-types.ts)
 */
export const ANIMATION_TIMING = {
  IDLE: { frameDuration: ANIMATION_SPEEDS.IDLE, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.IDLE, description: 'very slow, subtle' },
  WALK: { frameDuration: ANIMATION_SPEEDS.WALK, totalFrames: 6, totalDuration: 6 * ANIMATION_SPEEDS.WALK, description: 'smooth, natural' },
  ATTACK: { frameDuration: ANIMATION_SPEEDS.ATTACK, totalFrames: 8, totalDuration: 8 * ANIMATION_SPEEDS.ATTACK, description: 'smooth, responsive' },
  DASH: { frameDuration: ANIMATION_SPEEDS.DASH, totalFrames: 6, totalDuration: 6 * ANIMATION_SPEEDS.DASH, description: 'very fast, blur' },
  HURT: { frameDuration: ANIMATION_SPEEDS.HURT, totalFrames: 4, totalDuration: 4 * ANIMATION_SPEEDS.HURT, description: 'brief recoil' },
  DEATH: { frameDuration: ANIMATION_SPEEDS.DEATH, totalFrames: 10, totalDuration: 10 * ANIMATION_SPEEDS.DEATH, description: 'dramatic collapse' },
  SPECIAL: { frameDuration: ANIMATION_SPEEDS.SPECIAL, totalFrames: 12, totalDuration: 12 * ANIMATION_SPEEDS.SPECIAL, description: 'flashy, elaborate' },
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

/**
 * 8-direction view prompts
 */
export const DIRECTION_PROMPTS_8: Record<Direction8, string> = {
  south: 'Character facing forward toward the viewer (FRONT view) - we see their face clearly, body facing camera',
  south_west: 'Character facing front-left at 45-degree angle (3/4 FRONT-LEFT view) - we see most of face, body angled toward front-left',
  west: 'Character facing left side (LEFT PROFILE view) - we see left side of face only, body facing left',
  north_west: 'Character facing back-left at 45-degree angle (3/4 BACK-LEFT view) - we see back of head angled left, showing mostly back',
  north: 'Character facing away from viewer (BACK view) - we see back of head and body, no face visible',
  north_east: 'Character facing back-right at 45-degree angle (3/4 BACK-RIGHT view) - we see back of head angled right, showing mostly back',
  east: 'Character facing right side (RIGHT PROFILE view) - we see right side of face only, body facing right',
  south_east: 'Character facing front-right at 45-degree angle (3/4 FRONT-RIGHT view) - we see most of face, body angled toward front-right',
};

/**
 * Legacy 4-direction prompts (down/up/left/right)
 */
export const DIRECTION_PROMPTS: Record<Direction, string> = {
  down: DIRECTION_PROMPTS_8.south,
  up: DIRECTION_PROMPTS_8.north,
  left: DIRECTION_PROMPTS_8.west,
  right: DIRECTION_PROMPTS_8.east,
};

/**
 * Generate 4-direction sheet prompt for split generation
 * Creates either cardinal (S, W, N, E) or diagonal (SW, NW, NE, SE) directions
 */
export function get4DirectionalSheetPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk',
  directionSet: 'cardinal' | 'diagonal'
): string {
  const config = ANIMATION_CONFIGS[animationType];
  const frameCount = config.frameCount;
  const timing = animationType === 'idle' ? ANIMATION_TIMING.IDLE : ANIMATION_TIMING.WALK;

  const directions: readonly (CardinalDirection | DiagonalDirection)[] =
    directionSet === 'cardinal' ? CARDINAL_DIRECTIONS : DIAGONAL_DIRECTIONS;
  const directionLabels = directions.map((d) => DIRECTION_PROMPTS_8[d]);

  const sheetWidth = config.columns * FRAME_SIZE.width;
  const sheetHeight = 4 * FRAME_SIZE.height;

  const animDesc = animationType === 'idle'
    ? `subtle idle breathing with cloth/wind animation (${timing.description}, ${timing.frameDuration}ms per frame)`
    : `walking cycle with clear leg movement (${timing.description}, ${timing.frameDuration}ms per frame)`;

  const walkFrameGuide = animationType === 'walk' ? `
WALK CYCLE FRAMES (6-frame loop):
Frame 1: Contact - right foot forward, heel touching ground, left foot back
Frame 2: Passing - weight shifts, legs passing each other, body slightly higher
Frame 3: High point - left leg lifted behind, right leg bent, peak of bob
Frame 4: Contact - left foot forward, heel touching ground, right foot back
Frame 5: Passing - weight shifts opposite, legs passing, body slightly higher
Frame 6: High point - right leg lifted behind, left leg bent, peak of bob

Each frame incrementally progresses the walk - NO sudden position changes.
Arms swing naturally opposite to legs. Body has subtle up-down bob.
` : `
IDLE BREATHING FRAMES (4-frame loop):
Frame 1: Neutral stance - relaxed pose, cloth at rest
Frame 2: Inhale start - chest rises slightly, cloth begins gentle movement
Frame 3: Full inhale - maximum subtle expansion, cloth flows with breeze
Frame 4: Exhale - returning to neutral, cloth settling

Extremely subtle movement - this is breathing, not action.
`;

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
${walkFrameGuide}
Frame size: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels per frame.
Total: ${frameCount * 4} frames in ${config.columns}x4 grid on white background.

ANIMATION SMOOTHNESS - CRITICAL:
- Frame 1 to Frame 2 to Frame 3 must flow like a video slowed down
- Each frame is an incremental step, not a separate pose
- When looped, the animation should play seamlessly
- NO teleporting limbs or sudden position changes

DIRECTION CONSISTENCY:
- Each direction must be clearly distinguishable
- Diagonals show proper 45-degree angle, not just rotated versions
- Head and body MUST face the same direction in ALL frames of each row
- Character stays horizontally centered - walking/idle in place

${characterDescription}
${BASE_STYLE_PROMPT}
Same character, same animation timing, 4 different viewing angles.
`.trim();
}

/**
 * Prompt for generating a full directional sprite sheet (legacy 4-direction)
 */
export function getFullDirectionalSheetPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk'
): string {
  return get4DirectionalSheetPrompt(characterDescription, animationType, 'cardinal');
}

/**
 * Generate prompt for a single directional animation (idle/walk)
 */
export function getDirectionalAnimationPrompt(
  characterDescription: string,
  animationType: 'idle' | 'walk',
  direction: Direction
): string {
  const config = ANIMATION_CONFIGS[animationType];
  const directionView = DIRECTION_PROMPTS[direction];
  const timing = animationType === 'idle' ? ANIMATION_TIMING.IDLE : ANIMATION_TIMING.WALK;

  const frameGuide = animationType === 'idle' ? `
Frame sequence (subtle breathing, cloth animation):
Frame 1: Neutral standing pose - relaxed confident stance, cloth/cape at rest
Frame 2: Inhale - chest rises subtly, cloth/cape gently flowing, hair slightly moving
Frame 3: Hold - cloth billowing softly, character at ease, subtle pose shift
Frame 4: Exhale - settling back, cloth returning to rest, seamless loop to Frame 1
` : `
Frame sequence (smooth 6-frame walk cycle):
Frame 1: Contact - right foot forward touching ground, left foot back, body centered
Frame 2: Low point - weight shifting forward, both feet on ground, body at lowest point
Frame 3: Passing - left leg swinging forward, right leg straight, legs passing each other
Frame 4: Contact - left foot forward touching ground, right foot back, body centered
Frame 5: Low point - weight shifting forward, both feet on ground, body at lowest point
Frame 6: Passing - right leg swinging forward, left leg straight, legs passing each other

Arms swing naturally opposite to legs. Body bobs up-down with each step.
`;

  return `
Create a ${config.frameCount}-frame pixel art ${animationType} animation sprite sheet of this character.

${directionView}

Arrange the ${config.frameCount} frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.
${frameGuide}
SMOOTH ANIMATION REQUIREMENTS:
- Each frame MUST connect smoothly to the next
- Frame ${config.frameCount} must loop seamlessly back to Frame 1
- Use proper easing - slow in, slow out for natural motion
- Cloth and hair have secondary motion with slight delay (follow-through)

HEAD DIRECTION - CRITICAL:
- Head MUST face the same direction as the body throughout ALL frames
- NO head turning to look at the viewer or opposite direction
- Maintain eye direction consistent with body facing

Animation plays at ${timing.frameDuration}ms per frame - ${timing.description} pace.

${characterDescription}
${BASE_STYLE_PROMPT}
`.trim();
}

/**
 * Combat animation prompts - face right for combo system
 */
export const COMBAT_ANIMATION_PROMPTS: Record<string, (charDesc: string) => string> = {
  attack1: (charDesc: string) => {
    return `
Create an 8-frame pixel art LIGHT ATTACK animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 8 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (quick light slash - smooth 8-frame animation):
Frame 1: Ready stance - weight centered, weapon/arm at rest, neutral pose
Frame 2: Anticipation - slight crouch beginning, weight shifting back, preparing
Frame 3: Wind-up peak - maximum pull-back, weapon/fist drawn back, coiled tension
Frame 4: Forward start - explosive start of attack, body beginning rotation
Frame 5: Mid-swing - arm/weapon at halfway, maximum velocity, blur lines optional
Frame 6: Impact - full extension of attack, slight lean forward, hit lands
Frame 7: Follow-through - arm continues past target, deceleration begins
Frame 8: Recovery - returning to ready stance, seamless transition to Frame 1

SMOOTH ANIMATION REQUIREMENTS:
- Each frame flows INTO the next - think motion blur between poses
- Frame 1 and Frame 8 should be nearly identical for looping
- Use anticipation (Frames 2-3) before action (Frames 4-6)
- Follow-through (Frames 7-8) shows deceleration, not sudden stop
- Cloth/hair trails behind the motion with delay

COMBO STARTER: First hit in 3-attack combo.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  attack2: (charDesc: string) => {
    return `
Create an 8-frame pixel art MEDIUM ATTACK animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 8 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (powerful horizontal strike - smooth 8-frame animation):
Frame 1: Transition pose - catching momentum from previous attack, slight crouch
Frame 2: Weight shift - hips and shoulders begin rotating for power
Frame 3: Coiling - weapon/arm drawn back horizontally, maximum tension
Frame 4: Power build-up - body tensing, about to explode forward, brief pause feel
Frame 5: Strike unleashed - explosive forward motion, weapon slashing horizontally
Frame 6: Maximum extension - full horizontal slash, body weight behind it
Frame 7: Impact/Connect - powerful hit lands, slight recoil in stance
Frame 8: Recovery start - following through, returning toward ready position

SMOOTH ANIMATION REQUIREMENTS:
- This attack is MORE POWERFUL than attack1 - show weight and momentum
- Rotation should be visible in shoulder/hip throughout frames 2-6
- Each frame is an incremental step, NOT a separate pose
- Hair and cloth trail behind with physics delay
- Frame 8 should transition smoothly into attack3 or loop to ready stance

COMBO SECOND HIT: More impact than attack1, builds momentum.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  attack3: (charDesc: string) => {
    return `
Create an 8-frame pixel art HEAVY FINISHER attack animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 8 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Attack sequence (devastating combo finisher - smooth 8-frame animation):
Frame 1: Power gathering - rising from previous attack, beginning big wind-up
Frame 2: Wind-up rise - weapon/arm raising high, body lifting
Frame 3: Maximum height - weapon at peak, body fully coiled, dramatic pause feel
Frame 4: Power surge - visible tension, slight glow/aura optional, about to unleash
Frame 5: Devastating swing - explosive downward/diagonal strike, maximum speed
Frame 6: Impact moment - strike lands with full force, dramatic pose, weight forward
Frame 7: Shockwave - follow-through of hit, slight screen-shake feel in pose
Frame 8: Triumphant finish - powerful ending stance, ready to return to idle

SMOOTH ANIMATION REQUIREMENTS:
- This is the BIGGEST and MOST DRAMATIC attack in the combo
- Wind-up (Frames 1-4) should build anticipation
- Strike (Frames 5-7) should feel EXPLOSIVE and impactful
- Show weight transfer through the body
- Frame 8 MUST match attack1 Frame 1 for seamless combo looping
- Optional: Add impact lines, dust, or visual effects

COMBO FINISHER: Most powerful attack - make it feel SATISFYING!
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  dash: (charDesc: string) => {
    const timing = ANIMATION_TIMING.DASH;
    return `
Create a 6-frame pixel art FLASH STEP/DASH animation sprite sheet of this character.

Character facing right (side profile view).

Arrange the 6 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Dash sequence (ultra-fast evasive burst - smooth 6-frame animation):
Frame 1: Crouch start - low stance, weight dropping, preparing to burst
Frame 2: Launch crouch - maximum coil, about to explode forward
Frame 3: Explosion - body launching forward, motion blur effect begins
Frame 4: Mid-dash - maximum speed, afterimage/ghost effect, body stretched
Frame 5: Deceleration - slowing down, body returning to upright
Frame 6: Recovery - stable stance regained, ready for next action

SMOOTH ANIMATION REQUIREMENTS:
- This is VERY FAST - use motion blur and speed lines
- Frames 3-4 should show afterimage/ghost trail effect
- Character essentially teleports 200+ pixels
- Body lean should progress naturally through frames
- Hair and cloth trail dramatically behind

INVINCIBILITY FRAMES: This is a dodge move.
Fastest animation at ${timing.frameDuration}ms per frame - near-instant feel.
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

Hurt sequence (taking damage reaction - smooth 4-frame animation):
Frame 1: Impact moment - head/body snapping back from hit, eyes closed, shock
Frame 2: Maximum recoil - body at furthest lean-back, arms flailing, pain expression
Frame 3: Recovery start - beginning to regain footing, pushing back
Frame 4: Stabilizing - nearly upright, determined expression, ready to continue

SMOOTH ANIMATION REQUIREMENTS:
- Frame 1 shows sudden impact - face grimacing
- Frame 2 is maximum stagger - body bent back
- Frames 3-4 show recovery without sudden snapping
- Hair and cloth follow physics with delay

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

Death sequence (defeat and collapse - smooth 10-frame animation):
Frame 1: Final hit - head snapping back dramatically, eyes wide
Frame 2: Stagger back - losing footing, arms reaching out
Frame 3: Balance lost - knees beginning to buckle, body tilting
Frame 4: Falling start - body clearly falling backward/sideways
Frame 5: Mid-fall - body at 45-degree angle, arms limp
Frame 6: Almost ground - body nearly horizontal, about to hit
Frame 7: Impact - hitting ground, slight bounce effect
Frame 8: Settling 1 - bounce recoil, body adjusting
Frame 9: Settling 2 - very small movement, coming to rest
Frame 10: Final pose - lying motionless, peaceful or defeated expression

SMOOTH ANIMATION REQUIREMENTS:
- This is DRAMATIC and CINEMATIC - take your time
- Fall physics should feel natural with acceleration
- Each frame is a natural progression of gravity's effect
- Cloth and hair follow with secondary motion throughout
- Final pose should be memorable

Dramatic death sequence. Character ends lying down.
Plays at ${timing.frameDuration}ms per frame - deliberate, impactful.
${charDesc}
${BASE_STYLE_PROMPT}
`.trim();
  },

  special: (charDesc: string) => {
    const timing = ANIMATION_TIMING.SPECIAL;
    return `
Create a 12-frame pixel art SPECIAL ATTACK (Getsuga Tensho style ultimate) animation sprite sheet.

Character facing right (side profile view).

Arrange the 12 frames in a single horizontal row on white background.
Each frame must be exactly ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels.

Special attack sequence (ultimate ability - smooth 12-frame animation):
Frame 1: Stance change - gripping weapon tightly, intense expression
Frame 2: Energy gathering start - faint aura appearing, wind effect begins
Frame 3: Power building - aura growing, hair beginning to lift
Frame 4: Energy crackling - visible energy particles, cloth billowing
Frame 5: Maximum charge - glowing with power, dramatic pose, slight levitation
Frame 6: Pre-release - energy concentrating toward weapon, brief pause
Frame 7: Swing start - weapon/arm moving in arc, energy trailing
Frame 8: Release moment - energy blast beginning to discharge
Frame 9: Maximum release - full energy wave leaving character
Frame 10: Full extension - follow-through of swing, blast traveling
Frame 11: Energy fading - power dissipating, body relaxing
Frame 12: Recovery - returning to ready stance, aura gone

SMOOTH ANIMATION REQUIREMENTS:
- This is the MOST VISUALLY IMPRESSIVE attack
- Energy/aura should build progressively through frames 1-6
- Release (frames 7-10) should feel explosive and powerful
- Each frame must flow smoothly - no sudden energy appearance
- Hair and cloth react to energy dramatically
- Use particle effects, energy auras, wind effects

ULTIMATE ABILITY: Flashy, satisfying, memorable!
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
 * Prompt for generating combined attack sheet (attack1 + attack2 + attack3)
 */
export function getCombinedAttackPrompt(characterDescription: string): string {
  const sheetWidth = 8 * FRAME_SIZE.width;
  const sheetHeight = 3 * FRAME_SIZE.height;

  return `
Create an 8x3 grid pixel art COMBO ATTACK sprite sheet (${sheetWidth}x${sheetHeight} pixels).

Character facing right (side profile view) throughout all 24 frames.

EXACT LAYOUT - 8 columns x 3 rows:
Each frame: ${FRAME_SIZE.width}x${FRAME_SIZE.height} pixels

Row 1 - LIGHT ATTACK (combo starter) - 8 frames:
  Frame 1: Ready stance - neutral, weight centered
  Frame 2: Anticipation - slight crouch, pulling back
  Frame 3: Wind-up peak - maximum pull-back, coiled
  Frame 4: Forward start - explosive start of swing
  Frame 5: Mid-swing - weapon at halfway, max speed
  Frame 6: Impact - full extension, hit lands
  Frame 7: Follow-through - arm past target, slowing
  Frame 8: Recovery - returning toward ready

Row 2 - MEDIUM ATTACK (combo second hit) - 8 frames:
  Frame 1: Transition - catching momentum from Row 1
  Frame 2: Weight shift - hips/shoulders rotating
  Frame 3: Coiling - weapon drawn back horizontally
  Frame 4: Power build - maximum tension, pause feel
  Frame 5: Unleashed - explosive horizontal slash
  Frame 6: Max extension - full slash, weight behind
  Frame 7: Impact - powerful hit connects
  Frame 8: Recovery - following through

Row 3 - HEAVY FINISHER (combo ender) - 8 frames:
  Frame 1: Power gathering - rising, big wind-up starts
  Frame 2: Wind-up rise - weapon raising high
  Frame 3: Maximum height - peak, fully coiled
  Frame 4: Power surge - tension, about to explode
  Frame 5: Devastating swing - explosive downward
  Frame 6: Impact moment - strike lands, dramatic
  Frame 7: Shockwave - follow-through of impact
  Frame 8: Triumphant finish - powerful stance

SMOOTH ANIMATION CRITICAL:
- Each frame MUST flow naturally into the next
- Row 1 Frame 8 -> Row 2 Frame 1: smooth combo link
- Row 2 Frame 8 -> Row 3 Frame 1: smooth combo link
- Row 1 Frame 1 ~= Row 3 Frame 8: enables full loop
- NO sudden jumps or skipped poses
- Progressive power increase - Row 3 most dramatic!

${characterDescription}
${BASE_STYLE_PROMPT}
24 frames total on solid white background.
`.trim();
}

/**
 * Get 8-directional sheet prompts for both cardinal and diagonal sets
 */
export function get8DirectionalPrompts(
  characterDescription: string,
  animationType: 'idle' | 'walk'
): [string, string] {
  return [
    get4DirectionalSheetPrompt(characterDescription, animationType, 'cardinal'),
    get4DirectionalSheetPrompt(characterDescription, animationType, 'diagonal'),
  ];
}
