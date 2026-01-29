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

// fal.ai API base URL - use synchronous endpoint for direct results
const FAL_API_BASE = "https://fal.run";

// Helper to safely store to R2 (delete existing key first if it exists)
async function safeR2Store(
  ctx: any,
  buffer: Uint8Array,
  options: { key: string; type: string }
) {
  try {
    // Try to delete existing key first (ignore errors if it doesn't exist)
    await r2.deleteObject(ctx, options.key);
  } catch {
    console.error("Key doesn't exist, that's fine");
    // Key doesn't exist, that's fine
  }

  // Now store the new data
  await r2.store(ctx, buffer, options);
}

// Helper to call fal.ai API (synchronous - waits for result)
async function callFalApi(
  endpoint: string,
  input: Record<string, unknown>
): Promise<{ images?: Array<{ url: string; width: number; height: number }>; image?: { url: string; width: number; height: number } }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY environment variable not set");
  }

  // Call the synchronous API endpoint
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

// Generate character image, save to R2, and create creation record
export const generateCharacter = action({
  args: {
    prompt: v.string(),
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const fullPrompt = `${args.prompt}. ${CHARACTER_STYLE_PROMPT}`;

    // Call fal.ai to generate character
    const result = await callFalApi("fal-ai/nano-banana-pro", {
      prompt: fullPrompt,
      num_images: 1,
      aspect_ratio: "1:1",
      output_format: "png",
      resolution: "1K",
    });

    if (!result.images || result.images.length === 0) {
      throw new Error("No image generated");
    }

    const imageData = result.images[0];
    // fal.ai may return null for dimensions - default to 1024 for 1:1 character images
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
    await safeR2Store(ctx, buffer, {
      key: characterKey,
      type: "image/png",
    });

    // Save character image record
    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType: "character",
      r2Key: characterKey,
      originalUrl: imageData.url,
      width,
      height,
    });

    // Save thumbnail (same image for now)
    const thumbnailKey = getThumbnailKey(args.creationId);
    await safeR2Store(ctx, buffer, {
      key: thumbnailKey,
      type: "image/png",
    });

    await ctx.runMutation(internal.images.saveThumbnailRecordInternal, {
      creationId: args.creationId,
      r2Key: thumbnailKey,
      width: 128,
      height: 128,
    });

    return {
      success: true,
      width,
      height,
    };
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
    // New: 8-direction mode flag
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

    let prompt: string;
    let aspectRatio: string;

    // Use custom prompt if provided, otherwise generate default
    if (customPrompt && customPrompt.trim()) {
      prompt = customPrompt;
      // Determine aspect ratio based on type even with custom prompt
      if (type === 'walk' || type === 'walk-full' || type === 'walk-cardinal' || type === 'walk-diagonal') {
        aspectRatio = '4:3';
      } else if (type === 'idle' || type === 'idle-full' || type === 'idle-cardinal' || type === 'idle-diagonal') {
        aspectRatio = '1:1';
      } else if (type === 'attack-combined') {
        aspectRatio = '4:3'; // Updated for 8x3 grid
      } else {
        const animType = type.split('-')[0] as AnimationType;
        aspectRatio = getAspectRatio(animType, false);
      }
    } else if (type === 'walk-cardinal' || type === 'idle-cardinal') {
      // 8-direction mode: Cardinal directions (S, W, N, E)
      const animType = type.split('-')[0] as 'idle' | 'walk';
      prompt = get4DirectionalSheetPrompt(characterDescription, animType, 'cardinal');
      aspectRatio = getSplitAspectRatio(animType);
    } else if (type === 'walk-diagonal' || type === 'idle-diagonal') {
      // 8-direction mode: Diagonal directions (SW, NW, NE, SE)
      const animType = type.split('-')[0] as 'idle' | 'walk';
      prompt = get4DirectionalSheetPrompt(characterDescription, animType, 'diagonal');
      aspectRatio = getSplitAspectRatio(animType);
    } else if (type === 'walk' || type === 'walk-full') {
      // Legacy 4-direction mode
      prompt = getFullDirectionalSheetPrompt(characterDescription, 'walk');
      aspectRatio = '4:3';
    } else if (type === 'idle' || type === 'idle-full') {
      // Legacy 4-direction mode
      prompt = getFullDirectionalSheetPrompt(characterDescription, 'idle');
      aspectRatio = '1:1';
    } else if (type === 'attack-combined') {
      prompt = getCombinedAttackPrompt(characterDescription);
      aspectRatio = '4:3'; // 8 cols x 3 rows
    } else {
      // Standard animation type (combat animations)
      const animType = type as AnimationType;
      const config = ANIMATION_CONFIGS[animType];

      if (!config) {
        throw new Error(`Unknown animation type: ${type}`);
      }

      if (config.isDirectional && !direction && directionSet) {
        // 8-direction mode with directionSet
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

    // Call fal.ai to generate sprite sheet
    const result = await callFalApi("fal-ai/nano-banana-pro/edit", {
      prompt,
      image_urls: [characterImageUrl],
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: "png",
      resolution: "1K",
    });

    if (!result.images || result.images.length === 0) {
      throw new Error("No sprite sheet generated");
    }

    const imageData = result.images[0];
    // fal.ai may return null for dimensions - default to 1024
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

    // Map type to storage key (updated for 8-direction)
    const imageTypeMap: Record<string, string> = {
      // Legacy 4-direction
      'walk-full': 'walk_raw',
      'idle-full': 'idle_raw',
      // 8-direction split
      'walk-cardinal': 'walk_cardinal_raw',
      'walk-diagonal': 'walk_diagonal_raw',
      'idle-cardinal': 'idle_cardinal_raw',
      'idle-diagonal': 'idle_diagonal_raw',
      // Combat
      'attack-combined': 'attack_raw',
      'dash': 'dash_raw',
      'hurt': 'hurt_raw',
      'death': 'death_raw',
      'special': 'special_raw',
    };
    const imageType = imageTypeMap[type] || `${type}_raw`;

    const key = getR2Key(args.creationId, imageType);
    await safeR2Store(ctx, buffer, {
      key,
      type: "image/png",
    });

    // Save image record
    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType,
      r2Key: key,
      originalUrl: imageData.url,
      width,
      height,
    });

    return {
      success: true,
      imageType,
      width,
      height,
    };
  },
});

// NEW: Generate 8-directional sprite sheets (Option B - split generation)
// This generates both cardinal and diagonal sheets and returns both
export const generate8DirectionalSheet = action({
  args: {
    creationId: v.id("creations"),
    characterImageUrl: v.string(),
    characterDescription: v.optional(v.string()),
    animationType: v.union(v.literal("idle"), v.literal("walk")),
  },
  handler: async (ctx, args) => {
    const {
      characterImageUrl,
      characterDescription = "",
      animationType,
    } = args;

    const [cardinalPrompt, diagonalPrompt] = get8DirectionalPrompts(characterDescription, animationType);
    const aspectRatio = getSplitAspectRatio(animationType);
    
    const results: { cardinal?: { width: number; height: number }; diagonal?: { width: number; height: number } } = {};

    // Generate cardinal directions (S, W, N, E)
    console.log(`Generating ${animationType} cardinal directions...`);
    const cardinalResult = await callFalApi("fal-ai/nano-banana-pro/edit", {
      prompt: cardinalPrompt,
      image_urls: [characterImageUrl],
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: "png",
      resolution: "1K",
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

    // Generate diagonal directions (SW, NW, NE, SE)
    console.log(`Generating ${animationType} diagonal directions...`);
    const diagonalResult = await callFalApi("fal-ai/nano-banana-pro/edit", {
      prompt: diagonalPrompt,
      image_urls: [characterImageUrl],
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: "png",
      resolution: "1K",
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

// Remove background from image and save to R2
export const removeBackground = action({
  args: {
    creationId: v.id("creations"),
    imageUrl: v.string(),
    imageType: v.string(), // e.g., "walk", "idle", "attack"
  },
  handler: async (ctx, args) => {
    // Call fal.ai to remove background
    const result = await callFalApi("fal-ai/bria/background/remove", {
      image_url: args.imageUrl,
    });

    if (!result.image) {
      throw new Error("Background removal failed");
    }

    const imageData = result.image;
    // fal.ai may return null for dimensions - default to 1024
    const width = imageData.width ?? 1024;
    const height = imageData.height ?? 1024;

    // Fetch and save to R2
    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch processed image: ${imageResponse.statusText}`);
    }

    const blob = await imageResponse.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Save as processed version
    const processedType = `${args.imageType}_processed`;
    const key = getR2Key(args.creationId, processedType);
    await safeR2Store(ctx, buffer, {
      key,
      type: "image/png",
    });

    // Save image record
    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType: processedType,
      r2Key: key,
      originalUrl: imageData.url,
      width,
      height,
    });

    return {
      success: true,
      imageType: processedType,
      width,
      height,
    };
  },
});

// Remove backgrounds from multiple images at once
export const removeBackgrounds = action({
  args: {
    creationId: v.id("creations"),
    images: v.array(v.object({
      url: v.string(),
      type: v.string(), // e.g., "walk", "idle", "attack"
    })),
  },
  handler: async (ctx, args) => {
    const results: Array<{ type: string; success: boolean; error?: string }> = [];

    // Process each image
    for (const image of args.images) {
      try {
        // Call fal.ai to remove background
        const result = await callFalApi("fal-ai/bria/background/remove", {
          image_url: image.url,
        });

        if (!result.image) {
          results.push({ type: image.type, success: false, error: "No image returned" });
          continue;
        }

        const imageData = result.image;
        // fal.ai may return null for dimensions - default to 1024
        const width = imageData.width ?? 1024;
        const height = imageData.height ?? 1024;

        // Fetch and save to R2
        const imageResponse = await fetch(imageData.url);
        if (!imageResponse.ok) {
          results.push({ type: image.type, success: false, error: `Failed to fetch: ${imageResponse.statusText}` });
          continue;
        }

        const blob = await imageResponse.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Save as processed version
        const processedType = `${image.type}_processed`;
        const key = getR2Key(args.creationId, processedType);
        await safeR2Store(ctx, buffer, {
          key,
          type: "image/png",
        });

        // Save image record
        await ctx.runMutation(internal.images.saveImageRecordInternal, {
          creationId: args.creationId,
          imageType: processedType,
          r2Key: key,
          originalUrl: imageData.url,
          width,
          height,
        });

        results.push({ type: image.type, success: true });
      } catch (e) {
        results.push({ type: image.type, success: false, error: String(e) });
      }
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      results,
    };
  },
});
