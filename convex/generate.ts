import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { fal } from "@fal-ai/client";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

/**
 * Character style prompt for consistent pixel art generation
 */
const CHARACTER_STYLE_PROMPT = `Generate a single character only, centered in the frame on a plain white background.
The character should be rendered in pixel art style with clean edges, suitable for use as a 2D game sprite.
Use a 32-bit retro game aesthetic. The character should be shown in a front-facing or 3/4 view pose,
standing idle and ready to be used in a sprite sheet animation.`;

/**
 * Base style prompt for all sprite generations
 */
const BASE_STYLE_PROMPT = `
Pixel art style, 16-bit JRPG aesthetic, clean defined edges, visible pixels, no anti-aliasing.
Each frame must be exactly 32x48 pixels in visual proportion.
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

// Type definitions for fal.ai responses
interface FalImageResult {
  images: Array<{ url: string; width: number; height: number }>;
}

interface FalBgRemoveResult {
  image: { url: string; width: number; height: number };
}

/**
 * Generate base character image
 */
export const generateCharacterImage = internalAction({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const fullPrompt = `${args.prompt}. ${CHARACTER_STYLE_PROMPT}`;

    const result = await fal.subscribe("fal-ai/nano-banana-pro", {
      input: {
        prompt: fullPrompt,
        num_images: 1,
        aspect_ratio: "1:1",
        output_format: "png",
        resolution: "1K",
      },
    });

    const data = result.data as FalImageResult;
    if (!data.images?.length) {
      throw new Error("No image generated");
    }

    return {
      imageUrl: data.images[0].url,
      width: data.images[0].width,
      height: data.images[0].height,
    };
  },
});

/**
 * Build prompt for full directional sheet (idle or walk)
 */
function buildDirectionalSheetPrompt(
  characterDescription: string,
  animationType: "idle" | "walk"
): string {
  const config =
    animationType === "idle"
      ? { frameCount: 4, columns: 4, rows: 4 }
      : { frameCount: 6, columns: 6, rows: 4 };

  const animDesc =
    animationType === "idle"
      ? "subtle cloth/wind animation with signature pose"
      : "walking cycle with clear leg movement";

  return `
Create a complete ${config.columns}x${config.rows} grid pixel art ${animationType.toUpperCase()} sprite sheet.

EXACT LAYOUT - ${config.columns * 32}x${config.rows * 48} pixels total:
- ${config.columns} columns (frames per direction)
- 4 rows (one per direction)

Row order (IMPORTANT - must follow exactly):
- Row 1 (top): DOWN/Front view - character facing toward viewer, head looking at camera
- Row 2: UP/Back view - character facing away from viewer, showing back of head
- Row 3: LEFT - character facing left, HEAD MUST FACE LEFT (showing left side of face only, NOT looking at viewer)
- Row 4 (bottom): RIGHT - character facing right, HEAD MUST FACE RIGHT (showing right side of face only, NOT looking at viewer)

HEAD DIRECTION CRITICAL FOR LEFT/RIGHT ROWS:
- In Row 3 (LEFT): Head faces LEFT direction in ALL frames - we see the LEFT side of the face
- In Row 4 (RIGHT): Head faces RIGHT direction in ALL frames - we see the RIGHT side of the face
- NO head turning toward the viewer or opposite direction in side-view rows

Each row shows the same ${animDesc} from a different viewing angle.

Frame size: 32x48 pixels per frame.
Total: ${config.frameCount * 4} frames in ${config.columns}x4 grid on white background.

CRITICAL: All frames must maintain EXACT same character proportions.
The character must not drift horizontally within frames.
Each direction must be clearly distinguishable.

${characterDescription}
${BASE_STYLE_PROMPT}
Same character, same animation timing, 4 different viewing angles.
`.trim();
}

/**
 * Build prompt for combined attack sheet (3 rows, 8 frames each)
 */
function buildCombinedAttackPrompt(characterDescription: string): string {
  return `
Create an 8x3 grid pixel art COMBO ATTACK sprite sheet (256x144 pixels).

Character facing right (side profile view) throughout all 24 frames.

EXACT LAYOUT - 8 columns x 3 rows:
Each frame: 32x48 pixels

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
 * Build prompt for single-row combat animations
 */
function buildCombatPrompt(
  characterDescription: string,
  type: "dash" | "hurt" | "death" | "special"
): string {
  const configs: Record<
    string,
    { frames: number; prompt: string; timing: string }
  > = {
    dash: {
      frames: 6,
      timing: "40ms per frame - VERY FAST",
      prompt: `
Create a 6-frame pixel art FLASH STEP/DASH animation sprite sheet.

Character facing right (side profile view).

Arrange the 6 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Dash sequence (ultra-fast evasive burst):
Frame 1: Crouch start - low stance, preparing to burst
Frame 2: Launch crouch - maximum coil, about to explode forward
Frame 3: Explosion - body launching forward, motion blur begins
Frame 4: Mid-dash - maximum speed, afterimage/ghost effect
Frame 5: Deceleration - slowing down, body returning upright
Frame 6: Recovery - stable stance regained

INVINCIBILITY FRAMES: This is a dodge move.
Fastest animation - near-instant feel.
Add speed lines or blur effect to emphasize velocity.`,
    },
    hurt: {
      frames: 4,
      timing: "80ms per frame",
      prompt: `
Create a 4-frame pixel art HURT/DAMAGE reaction animation sprite sheet.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Hurt sequence (taking damage reaction):
Frame 1: Impact moment - head/body snapping back from hit, eyes closed
Frame 2: Maximum recoil - furthest lean-back, arms flailing
Frame 3: Recovery start - beginning to regain composure
Frame 4: Stabilizing - nearly upright, ready to continue

Clear damage reaction. Character is briefly vulnerable during this.`,
    },
    death: {
      frames: 10,
      timing: "100ms per frame - DRAMATIC",
      prompt: `
Create a 10-frame pixel art DEATH animation sprite sheet.

Character facing right (side profile view).

Arrange the 10 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Death sequence (defeat and collapse):
Frame 1: Final hit - head snapping back dramatically
Frame 2: Stagger back - losing footing
Frame 3: Balance lost - knees beginning to buckle
Frame 4: Falling start - body clearly falling
Frame 5: Mid-fall - body at 45-degree angle
Frame 6: Almost ground - body nearly horizontal
Frame 7: Impact - hitting ground, slight bounce
Frame 8: Settling 1 - bounce recoil
Frame 9: Settling 2 - coming to rest
Frame 10: Final pose - lying motionless

Dramatic, cinematic death. Character ends up lying down in Frame 10.`,
    },
    special: {
      frames: 12,
      timing: "60ms per frame",
      prompt: `
Create a 12-frame pixel art SPECIAL ATTACK (Getsuga Tensho style) animation sprite sheet.

Character facing right (side profile view).

Arrange the 12 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Special attack sequence (ultimate ability):
Frame 1: Stance change - gripping weapon tightly
Frame 2: Energy gathering start - aura beginning to form
Frame 3: Power building - visible energy crackling
Frame 4: Energy surge - aura growing, wind effect
Frame 5: Maximum charge - glowing with power, dramatic pose
Frame 6: Pre-release - energy concentrating, brief pause
Frame 7: Swing start - weapon/arm moving in arc
Frame 8: Release moment - energy blast beginning
Frame 9: Maximum release - full energy wave leaving character
Frame 10: Full extension - follow-through of swing
Frame 11: Energy dissipating - power fading
Frame 12: Recovery - returning to ready stance

ULTIMATE ABILITY: Most visually impressive attack in the game.
Energy/aura effects encouraged. Flashy and satisfying!`,
    },
  };

  const config = configs[type];

  return `
${config.prompt}

${config.timing}

${characterDescription}
${BASE_STYLE_PROMPT}
`.trim();
}

/**
 * Get aspect ratio for animation type
 */
function getAspectRatio(type: string): string {
  switch (type) {
    case "walk-full":
      return "4:3"; // 6x4 grid
    case "idle-full":
      return "1:1"; // 4x4 grid
    case "attack-combined":
      return "16:9"; // 8x3 grid
    case "dash":
      return "16:9"; // 6 frames wide
    case "hurt":
      return "16:9"; // 4 frames wide
    case "death":
      return "21:9"; // 10 frames wide
    case "special":
      return "21:9"; // 12 frames wide
    default:
      return "16:9";
  }
}

/**
 * Generate sprite sheet with fal.ai
 */
export const generateSpriteSheet = internalAction({
  args: {
    characterImageUrl: v.string(),
    characterDescription: v.string(),
    type: v.string(), // 'walk-full' | 'idle-full' | 'attack-combined' | 'dash' | 'hurt' | 'death' | 'special'
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let prompt: string;

    if (args.customPrompt) {
      prompt = args.customPrompt;
    } else if (args.type === "walk-full") {
      prompt = buildDirectionalSheetPrompt(args.characterDescription, "walk");
    } else if (args.type === "idle-full") {
      prompt = buildDirectionalSheetPrompt(args.characterDescription, "idle");
    } else if (args.type === "attack-combined") {
      prompt = buildCombinedAttackPrompt(args.characterDescription);
    } else if (["dash", "hurt", "death", "special"].includes(args.type)) {
      prompt = buildCombatPrompt(
        args.characterDescription,
        args.type as "dash" | "hurt" | "death" | "special"
      );
    } else {
      throw new Error(`Unknown animation type: ${args.type}`);
    }

    const aspectRatio = getAspectRatio(args.type);

    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt,
        image_urls: [args.characterImageUrl],
        num_images: 1,
        aspect_ratio: aspectRatio,
        output_format: "png",
        resolution: "1K",
      },
    });

    const data = result.data as FalImageResult;
    if (!data.images?.length) {
      throw new Error(`No sprite sheet generated for type: ${args.type}`);
    }

    return {
      imageUrl: data.images[0].url,
      width: data.images[0].width,
      height: data.images[0].height,
      type: args.type,
    };
  },
});

/**
 * Remove background from sprite sheet
 */
export const removeBackground = internalAction({
  args: {
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await fal.subscribe("fal-ai/bria/background/remove", {
      input: {
        image_url: args.imageUrl,
      },
    });

    const data = result.data as FalBgRemoveResult;
    if (!data.image) {
      throw new Error("Background removal failed");
    }

    return {
      imageUrl: data.image.url,
      width: data.image.width,
      height: data.image.height,
    };
  },
});
