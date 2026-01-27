import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { r2, getR2Key } from "./r2";
import { internal } from "./_generated/api";

/**
 * Store image from URL to R2 and save DB record
 * Used by workflows to persist generated images
 */
export const storeImageToR2 = internalAction({
  args: {
    creationId: v.id("creations"),
    imageType: v.string(),
    sourceUrl: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    // Fetch image from fal.ai URL
    const response = await fetch(args.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const buffer = new Uint8Array(await blob.arrayBuffer());

    // Store in R2
    const key = getR2Key(args.creationId, args.imageType);
    await r2.store(ctx, buffer, {
      key,
      type: blob.type || "image/png",
    });

    // Save DB record
    await ctx.runMutation(internal.images.saveImageRecordInternal, {
      creationId: args.creationId,
      imageType: args.imageType,
      r2Key: key,
      originalUrl: args.sourceUrl,
      width: args.width,
      height: args.height,
    });

    return { key };
  },
});

/**
 * Store thumbnail from URL to R2
 */
export const storeThumbnailToR2 = internalAction({
  args: {
    creationId: v.id("creations"),
    sourceUrl: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    // Fetch image
    const response = await fetch(args.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
    }

    const blob = await response.blob();
    const buffer = new Uint8Array(await blob.arrayBuffer());

    // Store in R2
    const key = `creations/${args.creationId}/thumbnail.png`;
    await r2.store(ctx, buffer, {
      key,
      type: blob.type || "image/png",
    });

    // Save DB record
    await ctx.runMutation(internal.images.saveThumbnailRecordInternal, {
      creationId: args.creationId,
      r2Key: key,
      width: args.width,
      height: args.height,
    });

    return { key };
  },
});
