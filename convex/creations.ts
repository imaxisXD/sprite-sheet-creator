import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Create a new creation record
export const create = mutation({
  args: {
    presetId: v.string(),
    presetName: v.string(),
    customPrompt: v.optional(v.string()),
    characterName: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const creationId = await ctx.db.insert("creations", {
      presetId: args.presetId,
      presetName: args.presetName,
      customPrompt: args.customPrompt,
      characterName: args.characterName,
      currentStep: 1,
      completedSteps: [1],
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
      sessionId: args.sessionId,
    });
    return creationId;
  },
});

// Update creation progress
export const updateProgress = mutation({
  args: {
    creationId: v.id("creations"),
    currentStep: v.number(),
    completedSteps: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creationId, {
      currentStep: args.currentStep,
      completedSteps: args.completedSteps,
      updatedAt: Date.now(),
    });
  },
});

// Mark creation as completed
export const markCompleted = mutation({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creationId, {
      status: "completed",
      updatedAt: Date.now(),
    });
  },
});

// Save grid configurations for frame extraction
export const saveGridConfigs = mutation({
  args: {
    creationId: v.id("creations"),
    gridConfigs: v.record(
      v.string(),
      v.object({
        cols: v.number(),
        rows: v.number(),
        verticalDividers: v.array(v.number()),
        horizontalDividers: v.array(v.number()),
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
        mode: v.optional(v.union(v.literal("grid"), v.literal("custom"))),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creationId, {
      gridConfigs: args.gridConfigs,
      updatedAt: Date.now(),
    });
  },
});

// Get a single creation by ID
export const get = query({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.creationId);
  },
});

// List all creations for a session (most recent first)
export const listBySession = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const creations = await ctx.db
      .query("creations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
    return creations;
  },
});

// List recent creations (for all users, most recent first)
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const creations = await ctx.db
      .query("creations")
      .withIndex("by_updated")
      .order("desc")
      .take(limit);
    return creations;
  },
});

// Delete a creation and all associated images
export const remove = mutation({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    // Delete all associated images
    const images = await ctx.db
      .query("creationImages")
      .withIndex("by_creation_all", (q) => q.eq("creationId", args.creationId))
      .collect();

    for (const image of images) {
      await ctx.db.delete(image._id);
    }

    // Delete thumbnail
    const thumbnails = await ctx.db
      .query("thumbnails")
      .withIndex("by_creation", (q) => q.eq("creationId", args.creationId))
      .collect();

    for (const thumbnail of thumbnails) {
      await ctx.db.delete(thumbnail._id);
    }

    // Delete the creation record
    await ctx.db.delete(args.creationId);
  },
});

// Get all images for a creation
export const getImages = query({
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

// Get thumbnail for a creation
export const getThumbnail = query({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const thumbnail = await ctx.db
      .query("thumbnails")
      .withIndex("by_creation", (q) => q.eq("creationId", args.creationId))
      .first();
    return thumbnail;
  },
});

// Get character image for a creation (used as thumbnail fallback)
export const getCharacterImage = query({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("creationImages")
      .withIndex("by_creation", (q) =>
        q.eq("creationId", args.creationId).eq("imageType", "character")
      )
      .first();
  },
});

// Rename a creation
export const rename = mutation({
  args: {
    creationId: v.id("creations"),
    characterName: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedName = args.characterName.trim();
    if (!trimmedName) {
      throw new Error("Character name cannot be empty");
    }

    const creation = await ctx.db.get(args.creationId);
    if (!creation) {
      throw new Error("Creation not found");
    }

    await ctx.db.patch(args.creationId, {
      characterName: trimmedName,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Update the custom prompt of a creation
export const updatePrompt = mutation({
  args: {
    creationId: v.id("creations"),
    customPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const creation = await ctx.db.get(args.creationId);
    if (!creation) {
      throw new Error("Creation not found");
    }

    await ctx.db.patch(args.creationId, {
      customPrompt: args.customPrompt.trim() || undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
