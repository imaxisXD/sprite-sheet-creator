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
Same character design maintained with consistent proportions throughout ALL frames.
Plain solid white background (#FFFFFF) for easy background removal.
Character should be centered in each frame with consistent positioning.
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
      ? "subtle breathing animation"
      : "walking cycle with clear leg movement";

  return `
Create a complete ${config.columns}x${config.rows} grid pixel art ${animationType.toUpperCase()} sprite sheet.

EXACT LAYOUT - ${config.columns * 32}x${config.rows * 48} pixels total:
- ${config.columns} columns (frames per direction)
- 4 rows (one per direction)

Row order (IMPORTANT - must follow exactly):
- Row 1 (top): DOWN/Front view - character facing toward viewer
- Row 2: UP/Back view - character facing away from viewer
- Row 3: LEFT - character facing left (left profile)
- Row 4 (bottom): RIGHT - character facing right (right profile)

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
 * Build prompt for combined attack sheet (3 rows)
 */
function buildCombinedAttackPrompt(characterDescription: string): string {
  return `
Create a 4x3 grid pixel art COMBO ATTACK sprite sheet (128x144 pixels).

Character facing right (side profile view) throughout all 12 frames.

EXACT LAYOUT - 4 columns × 3 rows:
Each frame: 32x48 pixels

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

COMBO SYSTEM: These play in sequence at 50ms per frame.
Each row must flow smoothly into the next for combo chaining.
Progressive power increase - Row 3 should look most powerful!

${characterDescription}
${BASE_STYLE_PROMPT}
12 frames total on solid white background.
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
      frames: 4,
      timing: "40ms per frame - VERY FAST",
      prompt: `
Create a 4-frame pixel art FLASH STEP/DASH animation sprite sheet.

Character facing right (side profile view).

Arrange the 4 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Dash sequence (ultra-fast evasive burst):
Frame 1: Crouch/anticipation - low stance, preparing to burst
Frame 2: Launch - explosive start, body leaning forward heavily
Frame 3: Mid-dash - motion blur effect, afterimage feeling, maximum speed
Frame 4: Recovery - decelerating, regaining stable stance

INVINCIBILITY FRAMES: This is a dodge move.
Fastest animation - near-instant feel.
Add speed lines or blur effect to emphasize velocity.`,
    },
    hurt: {
      frames: 3,
      timing: "80ms per frame",
      prompt: `
Create a 3-frame pixel art HURT/DAMAGE reaction animation sprite sheet.

Character facing right (side profile view).

Arrange the 3 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Hurt sequence (taking damage reaction):
Frame 1: Impact - head/body snapping back from hit, eyes closed
Frame 2: Stagger - maximum recoil, pained expression, arms flailing
Frame 3: Recovery - starting to regain composure, determined look

Clear damage reaction. Character is briefly vulnerable during this.`,
    },
    death: {
      frames: 8,
      timing: "100ms per frame - DRAMATIC",
      prompt: `
Create an 8-frame pixel art DEATH animation sprite sheet.

Character facing right (side profile view).

Arrange the 8 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Death sequence (defeat and collapse):
Frame 1: Final hit reaction - head snapping back
Frame 2: Stagger back - losing footing
Frame 3: Losing balance - arms reaching out
Frame 4: Beginning to fall - knees buckling
Frame 5: Mid-fall - body tilting toward ground
Frame 6: Hitting ground - impact with floor
Frame 7: Settling - bouncing slightly
Frame 8: Final resting pose - lying motionless on ground

Dramatic, cinematic death. Character ends up lying down in Frame 8.`,
    },
    special: {
      frames: 10,
      timing: "60ms per frame",
      prompt: `
Create a 10-frame pixel art SPECIAL ATTACK (Getsuga Tensho style) animation sprite sheet.

Character facing right (side profile view).

Arrange the 10 frames in a single horizontal row on white background.
Each frame must be exactly 32x48 pixels.

Special attack sequence (ultimate ability):
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
      return "4:3"; // 4x3 grid
    case "dash":
      return "16:9"; // 4 frames wide
    case "hurt":
      return "16:9"; // 3 frames wide
    case "death":
      return "21:9"; // 8 frames wide
    case "special":
      return "21:9"; // 10 frames wide
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
