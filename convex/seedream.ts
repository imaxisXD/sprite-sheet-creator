import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { r2, getR2Key, getThumbnailKey } from "./r2";
import {
  AnimationType,
  Direction,
  ANIMATION_CONFIGS,
  getAspectRatio,
  getSplitAspectRatio,
} from "./lib/animation_types";
import {
  CHARACTER_STYLE_PROMPT,
  getAnimationPrompt,
  getFullDirectionalSheetPrompt,
  getCombinedAttackPrompt,
  get4DirectionalSheetPrompt,
  get8DirectionalPrompts,
} from "./lib/prompts";

// SeedReam v4.5 endpoints on fal.ai
const FAL_API_BASE = "https://fal.run";
const SEEDREAM_TEXT_TO_IMAGE = "fal-ai/bytedance/seedream/v4.5/text-to-image";
const SEEDREAM_EDIT = "fal-ai/bytedance/seedream/v4.5/edit";

// Helper to safely store to R2 (delete existing key first if it exists)
async function safeR2Store(
  ctx: any,
  buffer: Uint8Array,
  options: { key: string; type: string }
) {
  try {
    await r2.deleteObject(ctx, options.key);
  } catch {
    // Key doesn't exist, that's fine
  }
  await r2.store(ctx, buffer, options);
}

// Helper to call fal.ai API (same auth as nano-banana-pro)
async function callFalApi(
  endpoint: string,
  input: Record<string, unknown>
): Promise<{ images?: Array<{ url: string; width: number; height: number }>; image?: { url: string; width: number; height: number } }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY environment variable not set");
  }

  const response = await fetch(`${FAL_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`fal.ai API error: ${error}`);
  }

  return await response.json();
}

// Map aspect ratio string to SeedReam image_size preset
// SeedReam uses named presets instead of ratio strings
function toImageSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    "1:1": "square_hd",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "21:9": "landscape_16_9",
    "1:2": "portrait_16_9",
  };
  return map[aspectRatio] || "square_hd";
}

// Generate character image, save to R2, and create creation record
export const generateCharacter = action({
  args: {
    prompt: v.string(),
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const fullPrompt = `${args.prompt}. ${CHARACTER_STYLE_PROMPT}`;

    const result = await callFalApi(SEEDREAM_TEXT_TO_IMAGE, {
      prompt: fullPrompt,
      image_size: "square_hd",
      num_images: 1,
    });

    if (!result.images || result.images.length === 0) {
      throw new Error("No image generated");
    }

    const imageData = result.images[0];
    const width = imageData.width ?? 1024;
    const height = imageData.height ?? 1024;

    // Fetch the image and save to R2
    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
    }

    const blob = await imageResponse.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Save character image to R2
    const characterKey = getR2Key(args.creationId, "character");
    await safeR2Store(ctx, buffer, { key: characterKey, type: "image/png" });

    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType: "character",
      r2Key: characterKey,
      originalUrl: imageData.url,
      width,
      height,
    });

    // Save thumbnail
    const thumbnailKey = getThumbnailKey(args.creationId);
    await safeR2Store(ctx, buffer, { key: thumbnailKey, type: "image/png" });

    await ctx.runMutation(internal.images.saveThumbnailRecordInternal, {
      creationId: args.creationId,
      r2Key: thumbnailKey,
      width: 128,
      height: 128,
    });

    return { success: true, width, height };
  },
});

// Generate sprite sheet, save to R2
export const generateSpriteSheet = action({
  args: {
    creationId: v.id("creations"),
    characterImageUrl: v.string(),
    characterDescription: v.optional(v.string()),
    type: v.string(),
    direction: v.optional(v.string()),
    customPrompt: v.optional(v.string()),
    directionSet: v.optional(v.union(v.literal("cardinal"), v.literal("diagonal"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const {
      characterImageUrl,
      characterDescription = "",
      type,
      direction,
      customPrompt,
      directionSet,
    } = args;

    // Build prompt — identical logic to fal.ts
    let prompt: string;
    let aspectRatio: string;

    if (customPrompt && customPrompt.trim()) {
      prompt = customPrompt;
      if (type === 'walk' || type === 'walk-full' || type === 'walk-cardinal' || type === 'walk-diagonal') {
        aspectRatio = '4:3';
      } else if (type === 'idle' || type === 'idle-full' || type === 'idle-cardinal' || type === 'idle-diagonal') {
        aspectRatio = '1:1';
      } else if (type === 'attack-combined') {
        aspectRatio = '16:9';
      } else {
        const animType = type.split('-')[0] as AnimationType;
        aspectRatio = getAspectRatio(animType, false);
      }
    } else if (type === 'walk-cardinal' || type === 'idle-cardinal') {
      const animType = type.split('-')[0] as 'idle' | 'walk';
      prompt = get4DirectionalSheetPrompt(characterDescription, animType, 'cardinal');
      aspectRatio = getSplitAspectRatio(animType);
    } else if (type === 'walk-diagonal' || type === 'idle-diagonal') {
      const animType = type.split('-')[0] as 'idle' | 'walk';
      prompt = get4DirectionalSheetPrompt(characterDescription, animType, 'diagonal');
      aspectRatio = getSplitAspectRatio(animType);
    } else if (type === 'walk' || type === 'walk-full') {
      prompt = getFullDirectionalSheetPrompt(characterDescription, 'walk');
      aspectRatio = '4:3';
    } else if (type === 'idle' || type === 'idle-full') {
      prompt = getFullDirectionalSheetPrompt(characterDescription, 'idle');
      aspectRatio = '1:1';
    } else if (type === 'attack-combined') {
      prompt = getCombinedAttackPrompt(characterDescription);
      aspectRatio = '16:9';
    } else {
      const animType = type as AnimationType;
      const config = ANIMATION_CONFIGS[animType];

      if (!config) {
        throw new Error(`Unknown animation type: ${type}`);
      }

      if (config.isDirectional && !direction && directionSet) {
        prompt = get4DirectionalSheetPrompt(
          characterDescription,
          animType as 'idle' | 'walk',
          directionSet as 'cardinal' | 'diagonal'
        );
        aspectRatio = getSplitAspectRatio(animType as 'idle' | 'walk');
      } else if (config.isDirectional && !direction) {
        prompt = getFullDirectionalSheetPrompt(characterDescription, animType as 'idle' | 'walk');
        aspectRatio = animType === 'idle' ? '1:1' : '4:3';
      } else {
        prompt = getAnimationPrompt(characterDescription, animType, direction as Direction | undefined);
        aspectRatio = getAspectRatio(animType, false);
      }
    }

    // Call SeedReam v4.5 edit endpoint (image-to-image)
    const result = await callFalApi(SEEDREAM_EDIT, {
      prompt,
      image_urls: [characterImageUrl],
      image_size: toImageSize(aspectRatio),
      num_images: 1,
    });

    if (!result.images || result.images.length === 0) {
      throw new Error("No sprite sheet generated");
    }

    const imageData = result.images[0];
    const width = imageData.width ?? 1024;
    const height = imageData.height ?? 1024;

    // Fetch and save to R2
    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch generated sprite sheet: ${imageResponse.statusText}`);
    }

    const blob = await imageResponse.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Map type to storage key (same as fal.ts)
    const imageTypeMap: Record<string, string> = {
      'walk-full': 'walk_raw',
      'idle-full': 'idle_raw',
      'walk-cardinal': 'walk_cardinal_raw',
      'walk-diagonal': 'walk_diagonal_raw',
      'idle-cardinal': 'idle_cardinal_raw',
      'idle-diagonal': 'idle_diagonal_raw',
      'attack-combined': 'attack_raw',
      'dash': 'dash_raw',
      'hurt': 'hurt_raw',
      'death': 'death_raw',
      'special': 'special_raw',
    };
    const imageType = imageTypeMap[type] || `${type}_raw`;

    const key = getR2Key(args.creationId, imageType);
    await safeR2Store(ctx, buffer, { key, type: "image/png" });

    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType,
      r2Key: key,
      originalUrl: imageData.url,
      width,
      height,
    });

    return { success: true, imageType, width, height };
  },
});

// Generate 8-directional sprite sheets (split generation)
export const generate8DirectionalSheet = action({
  args: {
    creationId: v.id("creations"),
    characterImageUrl: v.string(),
    characterDescription: v.optional(v.string()),
    animationType: v.union(v.literal("idle"), v.literal("walk")),
  },
  handler: async (ctx, args) => {
    const { characterImageUrl, characterDescription = "", animationType } = args;

    const [cardinalPrompt, diagonalPrompt] = get8DirectionalPrompts(characterDescription, animationType);
    const aspectRatio = getSplitAspectRatio(animationType);
    const imageSize = toImageSize(aspectRatio);

    const results: { cardinal?: { width: number; height: number }; diagonal?: { width: number; height: number } } = {};

    // Cardinal directions (S, W, N, E)
    const cardinalResult = await callFalApi(SEEDREAM_EDIT, {
      prompt: cardinalPrompt,
      image_urls: [characterImageUrl],
      image_size: imageSize,
      num_images: 1,
    });

    if (cardinalResult.images && cardinalResult.images.length > 0) {
      const cardinalImage = cardinalResult.images[0];
      const cardinalWidth = cardinalImage.width ?? 1024;
      const cardinalHeight = cardinalImage.height ?? 1024;

      const cardinalResponse = await fetch(cardinalImage.url);
      if (cardinalResponse.ok) {
        const blob = await cardinalResponse.blob();
        const buffer = new Uint8Array(await blob.arrayBuffer());

        const cardinalKey = getR2Key(args.creationId, `${animationType}_cardinal_raw`);
        await safeR2Store(ctx, buffer, { key: cardinalKey, type: "image/png" });

        await ctx.runMutation(internal.images.saveImageRecordInternal, {
          creationId: args.creationId,
          imageType: `${animationType}_cardinal_raw`,
          r2Key: cardinalKey,
          originalUrl: cardinalImage.url,
          width: cardinalWidth,
          height: cardinalHeight,
        });

        results.cardinal = { width: cardinalWidth, height: cardinalHeight };
      }
    }

    // Diagonal directions (SW, NW, NE, SE)
    const diagonalResult = await callFalApi(SEEDREAM_EDIT, {
      prompt: diagonalPrompt,
      image_urls: [characterImageUrl],
      image_size: imageSize,
      num_images: 1,
    });

    if (diagonalResult.images && diagonalResult.images.length > 0) {
      const diagonalImage = diagonalResult.images[0];
      const diagWidth = diagonalImage.width ?? 1024;
      const diagHeight = diagonalImage.height ?? 1024;

      const diagonalResponse = await fetch(diagonalImage.url);
      if (diagonalResponse.ok) {
        const blob = await diagonalResponse.blob();
        const buffer = new Uint8Array(await blob.arrayBuffer());

        const diagonalKey = getR2Key(args.creationId, `${animationType}_diagonal_raw`);
        await safeR2Store(ctx, buffer, { key: diagonalKey, type: "image/png" });

        await ctx.runMutation(internal.images.saveImageRecordInternal, {
          creationId: args.creationId,
          imageType: `${animationType}_diagonal_raw`,
          r2Key: diagonalKey,
          originalUrl: diagonalImage.url,
          width: diagWidth,
          height: diagHeight,
        });

        results.diagonal = { width: diagWidth, height: diagHeight };
      }
    }

    return {
      success: results.cardinal !== undefined && results.diagonal !== undefined,
      cardinal: results.cardinal,
      diagonal: results.diagonal,
    };
  },
});
