import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Main creations table - stores metadata about each sprite creation session
  creations: defineTable({
    // Character selection info
    presetId: v.string(),
    presetName: v.string(),
    customPrompt: v.optional(v.string()),
    characterName: v.string(),

    // Progress tracking
    currentStep: v.number(),
    completedSteps: v.array(v.number()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Optional session identifier for anonymous users
    sessionId: v.optional(v.string()),

    // Workflow tracking
    workflowId: v.optional(v.string()),
    workflowStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    workflowError: v.optional(v.string()),

    // Grid configurations for frame extraction (per animation type)
    gridConfigs: v.optional(
      v.record(
        v.string(), // animation type: walk, idle, attack, etc.
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
      )
    ),
  })
    .index("by_session", ["sessionId", "updatedAt"])
    .index("by_updated", ["updatedAt"])
    .index("by_workflow", ["workflowId"]),

  // Stores processed sprite sheet images in R2
  creationImages: defineTable({
    creationId: v.id("creations"),
    // Image type: "character", "walk_processed", "idle_processed", etc.
    imageType: v.string(),
    // R2 storage key
    r2Key: v.string(),
    // Original fal.ai URL (may expire)
    originalUrl: v.optional(v.string()),
    // Image dimensions
    width: v.number(),
    height: v.number(),
    createdAt: v.number(),
    // Custom regions for frame extraction (user-defined)
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
    // Grid configuration for frame extraction
    gridConfig: v.optional(
      v.object({
        cols: v.number(),
        rows: v.number(),
        mode: v.string(), // 'grid' | 'custom'
      })
    ),
  })
    .index("by_creation", ["creationId", "imageType"])
    .index("by_creation_all", ["creationId"]),

  // Thumbnail images for quick preview in history
  thumbnails: defineTable({
    creationId: v.id("creations"),
    r2Key: v.string(),
    width: v.number(),
    height: v.number(),
  }).index("by_creation", ["creationId"]),
});
