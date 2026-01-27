import { v } from "convex/values";
import { action, mutation, internalMutation, query } from "./_generated/server";
import { r2, getR2Key, getThumbnailKey } from "./r2";
import { api } from "./_generated/api";

// Generate an upload URL with a custom key
export const getUploadUrl = action({
  args: {
    creationId: v.string(),
    imageType: v.string(),
  },
  handler: async (ctx, args) => {
    const customKey = getR2Key(args.creationId, args.imageType);
    const { url, key } = await r2.generateUploadUrl(customKey);
    return { url, key };
  },
});

// Get a download URL for a stored image
export const getDownloadUrl = action({
  args: {
    r2Key: v.string(),
  },
  handler: async (ctx, args) => {
    const url = await r2.getUrl(args.r2Key, {
      expiresIn: 3600, // 1 hour
    });
    return url;
  },
});

// Save an image record after upload
export const saveImageRecord = mutation({
  args: {
    creationId: v.id("creations"),
    imageType: v.string(),
    r2Key: v.string(),
    originalUrl: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if an image of this type already exists for this creation
    const existing = await ctx.db
      .query("creationImages")
      .withIndex("by_creation", (q) =>
        q.eq("creationId", args.creationId).eq("imageType", args.imageType)
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        r2Key: args.r2Key,
        originalUrl: args.originalUrl,
        width: args.width,
        height: args.height,
        createdAt: Date.now(),
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("creationImages", {
      creationId: args.creationId,
      imageType: args.imageType,
      r2Key: args.r2Key,
      originalUrl: args.originalUrl,
      width: args.width,
      height: args.height,
      createdAt: Date.now(),
    });
  },
});

// Save thumbnail record
export const saveThumbnailRecord = mutation({
  args: {
    creationId: v.id("creations"),
    r2Key: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if thumbnail already exists
    const existing = await ctx.db
      .query("thumbnails")
      .withIndex("by_creation", (q) => q.eq("creationId", args.creationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        r2Key: args.r2Key,
        width: args.width,
        height: args.height,
      });
      return existing._id;
    }

    return await ctx.db.insert("thumbnails", {
      creationId: args.creationId,
      r2Key: args.r2Key,
      width: args.width,
      height: args.height,
    });
  },
});

// Get thumbnail upload URL
export const getThumbnailUploadUrl = action({
  args: {
    creationId: v.string(),
  },
  handler: async (ctx, args) => {
    const customKey = getThumbnailKey(args.creationId);
    const { url, key } = await r2.generateUploadUrl(customKey);
    return { url, key };
  },
});

// Store an image from URL directly in R2 (server-side)
export const uploadFromUrl = action({
  args: {
    creationId: v.string(),
    imageType: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch the image
    const response = await fetch(args.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Generate key and store in R2
    const key = getR2Key(args.creationId, args.imageType);
    await r2.store(ctx, buffer, {
      key,
      type: blob.type || "image/png",
    });

    return { key, size: arrayBuffer.byteLength };
  },
});

// Get all image URLs for a creation (returns presigned URLs)
export const getCreationImageUrls = action({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    // Get all image records
    const images = await ctx.runQuery(api.creations.getImages, {
      creationId: args.creationId,
    });

    // Get presigned URLs for each
    const imageUrls: Record<string, string> = {};
    for (const image of images) {
      const url = await r2.getUrl(image.r2Key, {
        expiresIn: 3600,
      });
      if (url) {
        imageUrls[image.imageType] = url;
      }
    }

    return imageUrls;
  },
});

// Get thumbnail URL for a creation
export const getThumbnailUrl = action({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const thumbnail = await ctx.runQuery(api.creations.getThumbnail, {
      creationId: args.creationId,
    });

    if (!thumbnail) {
      return null;
    }

    const url = await r2.getUrl(thumbnail.r2Key, {
      expiresIn: 3600,
    });

    return url;
  },
});

// Delete all images for a creation from R2
// Note: R2 deletion is not directly supported by the component yet
// Images will be orphaned but R2 lifecycle rules can clean them up
export const deleteCreationImages = action({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    // For now, we just log that we're "deleting" - actual R2 cleanup
    // would require direct S3 API access or lifecycle rules
    const images = await ctx.runQuery(api.creations.getImages, {
      creationId: args.creationId,
    });

    console.log(`Would delete ${images.length} images for creation ${args.creationId}`);

    // The database records will be deleted by the creations.remove mutation
    // R2 objects remain but can be cleaned up with lifecycle rules
  },
});

// Internal mutation for saving image records (used by storage.ts)
export const saveImageRecordInternal = internalMutation({
  args: {
    creationId: v.id("creations"),
    imageType: v.string(),
    r2Key: v.string(),
    originalUrl: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if an image of this type already exists for this creation
    const existing = await ctx.db
      .query("creationImages")
      .withIndex("by_creation", (q) =>
        q.eq("creationId", args.creationId).eq("imageType", args.imageType)
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        r2Key: args.r2Key,
        originalUrl: args.originalUrl,
        width: args.width,
        height: args.height,
        createdAt: Date.now(),
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("creationImages", {
      creationId: args.creationId,
      imageType: args.imageType,
      r2Key: args.r2Key,
      originalUrl: args.originalUrl,
      width: args.width,
      height: args.height,
      createdAt: Date.now(),
    });
  },
});

// Internal mutation for saving thumbnail records (used by storage.ts)
export const saveThumbnailRecordInternal = internalMutation({
  args: {
    creationId: v.id("creations"),
    r2Key: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if thumbnail already exists
    const existing = await ctx.db
      .query("thumbnails")
      .withIndex("by_creation", (q) => q.eq("creationId", args.creationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        r2Key: args.r2Key,
        width: args.width,
        height: args.height,
      });
      return existing._id;
    }

    return await ctx.db.insert("thumbnails", {
      creationId: args.creationId,
      r2Key: args.r2Key,
      width: args.width,
      height: args.height,
    });
  },
});

// Save custom regions and grid config for an image
export const saveImageRegions = mutation({
  args: {
    creationId: v.id("creations"),
    imageType: v.string(),
    customRegions: v.optional(
      v.array(
        v.object({
          id: v.string(),
          x: v.number(),
          y: v.number(),
          width: v.number(),
          height: v.number(),
        })
      )
    ),
    gridConfig: v.optional(
      v.object({
        cols: v.number(),
        rows: v.number(),
        mode: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Find the image record
    const image = await ctx.db
      .query("creationImages")
      .withIndex("by_creation", (q) =>
        q.eq("creationId", args.creationId).eq("imageType", args.imageType)
      )
      .first();

    if (!image) {
      throw new Error(`Image not found: ${args.imageType}`);
    }

    // Update with regions and grid config
    await ctx.db.patch(image._id, {
      customRegions: args.customRegions,
      gridConfig: args.gridConfig,
    });

    return image._id;
  },
});

// Get image with regions
export const getImageWithRegions = query({
  args: {
    creationId: v.id("creations"),
    imageType: v.string(),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("creationImages")
      .withIndex("by_creation", (q) =>
        q.eq("creationId", args.creationId).eq("imageType", args.imageType)
      )
      .first();

    return image;
  },
});

// Get all images with regions for a creation
export const getAllImagesWithRegions = query({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("creationImages")
      .withIndex("by_creation_all", (q) => q.eq("creationId", args.creationId))
      .collect();

    return images;
  },
});
