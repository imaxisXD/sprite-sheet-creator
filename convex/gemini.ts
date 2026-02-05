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

// Gemini API configuration
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-3-pro-image-preview";

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

// Helper to call Gemini API and get back image buffer
async function callGeminiApi(
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  aspectRatio?: string
): Promise<Uint8Array> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set");
  }

  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
    },
  };

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (!candidate) {
    throw new Error("No image generated");
  }

  // Find image part in response
  const responseParts = candidate.content?.parts || [];
  const imagePart = responseParts.find(
    (p: any) => p.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart) {
    throw new Error("No image generated");
  }

  // Decode base64 to buffer
  const binaryString = atob(imagePart.inlineData.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to fetch an image URL and convert to base64 for Gemini
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch reference image: ${imageResponse.statusText}`);
  }
  const blob = await imageResponse.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// Generate character image, save to R2, and create creation record
export const generateCharacter = action({
  args: {
    prompt: v.string(),
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const fullPrompt = `${args.prompt}. ${CHARACTER_STYLE_PROMPT}`;

    const buffer = await callGeminiApi(
      [{ text: fullPrompt }],
      "1:1"
    );

    // Save character image to R2
    const characterKey = getR2Key(args.creationId, "character");
    await safeR2Store(ctx, buffer, { key: characterKey, type: "image/png" });

    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType: "character",
      r2Key: characterKey,
      originalUrl: "gemini-generated",
      width: 1024,
      height: 1024,
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

    return { success: true, width: 1024, height: 1024 };
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

    // Fetch reference image as base64 (Gemini needs inline data, not URLs)
    const imageBase64 = await fetchImageAsBase64(characterImageUrl);

    // Call Gemini
    const buffer = await callGeminiApi(
      [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: imageBase64 } },
      ],
      aspectRatio
    );

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
      originalUrl: "gemini-generated",
      width: 1024,
      height: 1024,
    });

    return { success: true, imageType, width: 1024, height: 1024 };
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
    const imageBase64 = await fetchImageAsBase64(characterImageUrl);

    const results: { cardinal?: { width: number; height: number }; diagonal?: { width: number; height: number } } = {};

    // Cardinal directions (S, W, N, E)
    try {
      const cardinalBuffer = await callGeminiApi(
        [
          { text: cardinalPrompt },
          { inlineData: { mimeType: "image/png", data: imageBase64 } },
        ],
        aspectRatio
      );

      const cardinalKey = getR2Key(args.creationId, `${animationType}_cardinal_raw`);
      await safeR2Store(ctx, cardinalBuffer, { key: cardinalKey, type: "image/png" });

      await ctx.runMutation(internal.images.saveImageRecordInternal, {
        creationId: args.creationId,
        imageType: `${animationType}_cardinal_raw`,
        r2Key: cardinalKey,
        originalUrl: "gemini-generated",
        width: 1024,
        height: 1024,
      });

      results.cardinal = { width: 1024, height: 1024 };
    } catch (err) {
      console.error(`[Gemini] Cardinal generation failed:`, err);
    }

    // Diagonal directions (SW, NW, NE, SE)
    try {
      const diagonalBuffer = await callGeminiApi(
        [
          { text: diagonalPrompt },
          { inlineData: { mimeType: "image/png", data: imageBase64 } },
        ],
        aspectRatio
      );

      const diagonalKey = getR2Key(args.creationId, `${animationType}_diagonal_raw`);
      await safeR2Store(ctx, diagonalBuffer, { key: diagonalKey, type: "image/png" });

      await ctx.runMutation(internal.images.saveImageRecordInternal, {
        creationId: args.creationId,
        imageType: `${animationType}_diagonal_raw`,
        r2Key: diagonalKey,
        originalUrl: "gemini-generated",
        width: 1024,
        height: 1024,
      });

      results.diagonal = { width: 1024, height: 1024 };
    } catch (err) {
      console.error(`[Gemini] Diagonal generation failed:`, err);
    }

    return {
      success: results.cardinal !== undefined && results.diagonal !== undefined,
      cardinal: results.cardinal,
      diagonal: results.diagonal,
    };
  },
});
