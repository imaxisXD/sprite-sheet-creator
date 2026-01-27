import { v } from "convex/values";
import { workflow } from "./workflowManager";
import { internal } from "./_generated/api";
import { mutation, internalMutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Animation types to generate in the workflow
 */
const SPRITE_ANIMATION_TYPES = [
  "walk-full",
  "idle-full",
  "attack-combined",
  "dash",
  "hurt",
  "death",
  "special",
] as const;

/**
 * Maps workflow animation types to database image types
 */
function getProcessedImageType(animationType: string): string {
  const mapping: Record<string, string> = {
    "walk-full": "walk_processed",
    "idle-full": "idle_processed",
    "attack-combined": "attack_processed",
    dash: "dash_processed",
    hurt: "hurt_processed",
    death: "death_processed",
    special: "special_processed",
  };
  return mapping[animationType] || `${animationType}_processed`;
}

/**
 * Maps workflow animation types to original (pre-bg-removal) image types
 */
function getOriginalImageType(animationType: string): string {
  const mapping: Record<string, string> = {
    "walk-full": "walk",
    "idle-full": "idle",
    "attack-combined": "attack",
    dash: "dash",
    hurt: "hurt",
    death: "death",
    special: "special",
  };
  return mapping[animationType] || animationType;
}

// Type for sprite sheet result
interface SpriteSheetResult {
  imageUrl: string;
  width: number;
  height: number;
  type: string;
}

// Type for background removal result
interface BgRemovedResult {
  imageUrl: string;
  width: number;
  height: number;
}

/**
 * Define the sprite generation workflow
 * Orchestrates the full generation pipeline:
 * 1. Generate character image
 * 2. Store to R2
 * 3. Generate all sprite sheets in parallel
 * 4. Remove backgrounds
 * 5. Store processed images to R2
 * 6. Mark workflow complete
 */
export const spriteGenerationWorkflow = workflow.define({
  args: {
    creationId: v.id("creations"),
    characterPrompt: v.string(),
    characterDescription: v.string(),
    animationTypes: v.array(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    characterImageUrl: v.string(),
    spriteSheetCount: v.number(),
  }),
  handler: async (step, args): Promise<{
    success: boolean;
    characterImageUrl: string;
    spriteSheetCount: number;
  }> => {
    // Update workflow status to running
    await step.runMutation(internal.spriteWorkflow.updateWorkflowStatus, {
      creationId: args.creationId,
      status: "running" as const,
    });

    try {
      // Step 1: Generate character image
      const characterResult: { imageUrl: string; width: number; height: number } =
        await step.runAction(internal.generate.generateCharacterImage, {
          prompt: args.characterPrompt,
        });

      // Step 2: Store character to R2
      await step.runAction(internal.storage.storeImageToR2, {
        creationId: args.creationId,
        imageType: "character",
        sourceUrl: characterResult.imageUrl,
        width: characterResult.width,
        height: characterResult.height,
      });

      // Also store as thumbnail
      await step.runAction(internal.storage.storeThumbnailToR2, {
        creationId: args.creationId,
        sourceUrl: characterResult.imageUrl,
        width: characterResult.width,
        height: characterResult.height,
      });

      // Update progress
      await step.runMutation(internal.spriteWorkflow.updateCreationProgress, {
        creationId: args.creationId,
        currentStep: 2,
        completedSteps: [1, 2],
      });

      // Step 3: Generate all sprite sheets in parallel
      const spriteSheetPromises: Promise<SpriteSheetResult>[] =
        args.animationTypes.map((type: string) =>
          step.runAction(internal.generate.generateSpriteSheet, {
            characterImageUrl: characterResult.imageUrl,
            characterDescription: args.characterDescription,
            type,
          }) as Promise<SpriteSheetResult>
        );
      const spriteSheets: SpriteSheetResult[] =
        await Promise.all(spriteSheetPromises);

      // Store original sprite sheets to R2 (before bg removal)
      for (const sheet of spriteSheets) {
        await step.runAction(internal.storage.storeImageToR2, {
          creationId: args.creationId,
          imageType: getOriginalImageType(sheet.type),
          sourceUrl: sheet.imageUrl,
          width: sheet.width,
          height: sheet.height,
        });
      }

      // Update progress
      await step.runMutation(internal.spriteWorkflow.updateCreationProgress, {
        creationId: args.creationId,
        currentStep: 5,
        completedSteps: [1, 2, 3, 4, 5],
      });

      // Step 4: Remove backgrounds in parallel
      const bgRemovedPromises: Promise<BgRemovedResult>[] = spriteSheets.map(
        (sheet: SpriteSheetResult) =>
          step.runAction(internal.generate.removeBackground, {
            imageUrl: sheet.imageUrl,
          }) as Promise<BgRemovedResult>
      );
      const bgRemovedSheets: BgRemovedResult[] =
        await Promise.all(bgRemovedPromises);

      // Step 5: Store all processed images to R2
      for (let i = 0; i < bgRemovedSheets.length; i++) {
        await step.runAction(internal.storage.storeImageToR2, {
          creationId: args.creationId,
          imageType: getProcessedImageType(args.animationTypes[i]),
          sourceUrl: bgRemovedSheets[i].imageUrl,
          width: bgRemovedSheets[i].width,
          height: bgRemovedSheets[i].height,
        });
      }

      // Update progress
      await step.runMutation(internal.spriteWorkflow.updateCreationProgress, {
        creationId: args.creationId,
        currentStep: 7,
        completedSteps: [1, 2, 3, 4, 5, 6, 7],
      });

      // Step 6: Mark workflow complete
      await step.runMutation(internal.spriteWorkflow.markWorkflowComplete, {
        creationId: args.creationId,
      });

      return {
        success: true,
        characterImageUrl: characterResult.imageUrl,
        spriteSheetCount: spriteSheets.length,
      };
    } catch (error) {
      // Mark workflow as failed
      await step.runMutation(internal.spriteWorkflow.updateWorkflowStatus, {
        creationId: args.creationId,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

/**
 * Start a new sprite generation workflow
 * Called from the frontend to begin the generation process
 */
export const startSpriteGeneration = mutation({
  args: {
    presetId: v.string(),
    presetName: v.string(),
    characterPrompt: v.string(),
    characterDescription: v.string(),
    customPrompt: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    characterName: v.string(),
    animationTypes: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ creationId: Id<"creations">; workflowId: string }> => {
    const now = Date.now();

    // Create creation record
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
      workflowStatus: "pending",
    });

    // Start the workflow - returns workflowId directly
    const workflowId = await workflow.start(
      ctx,
      internal.spriteWorkflow.spriteGenerationWorkflow,
      {
        creationId,
        characterPrompt: args.characterPrompt,
        characterDescription: args.characterDescription,
        animationTypes: args.animationTypes || [...SPRITE_ANIMATION_TYPES],
      }
    );

    // Store workflow ID in creation for tracking
    await ctx.db.patch(creationId, { workflowId: String(workflowId) });

    return { creationId, workflowId: String(workflowId) };
  },
});

/**
 * Start workflow for an existing creation (e.g., regenerate)
 */
export const startWorkflowForCreation = mutation({
  args: {
    creationId: v.id("creations"),
    characterPrompt: v.string(),
    characterDescription: v.string(),
    animationTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    // Reset creation status
    await ctx.db.patch(args.creationId, {
      currentStep: 1,
      completedSteps: [1],
      status: "in_progress",
      workflowStatus: "pending",
      workflowError: undefined,
      updatedAt: Date.now(),
    });

    // Start the workflow - returns workflowId directly
    const workflowId = await workflow.start(
      ctx,
      internal.spriteWorkflow.spriteGenerationWorkflow,
      {
        creationId: args.creationId,
        characterPrompt: args.characterPrompt,
        characterDescription: args.characterDescription,
        animationTypes: args.animationTypes || [...SPRITE_ANIMATION_TYPES],
      }
    );

    // Store workflow ID
    await ctx.db.patch(args.creationId, { workflowId: String(workflowId) });

    return { workflowId: String(workflowId) };
  },
});

/**
 * Internal mutation to update workflow status
 */
export const updateWorkflowStatus = internalMutation({
  args: {
    creationId: v.id("creations"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creationId, {
      workflowStatus: args.status,
      workflowError: args.error,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to update creation progress
 */
export const updateCreationProgress = internalMutation({
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

/**
 * Internal mutation to mark workflow complete
 */
export const markWorkflowComplete = internalMutation({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creationId, {
      status: "completed",
      workflowStatus: "completed",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Query to get workflow status
 */
export const getWorkflowStatus = query({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const creation = await ctx.db.get(args.creationId);
    if (!creation) return null;

    return {
      workflowId: creation.workflowId,
      workflowStatus: creation.workflowStatus,
      workflowError: creation.workflowError,
      currentStep: creation.currentStep,
      completedSteps: creation.completedSteps,
      status: creation.status,
    };
  },
});

/**
 * Query to get creation with all images
 * Useful for reactive UI updates
 */
export const getCreationWithImages = query({
  args: {
    creationId: v.id("creations"),
  },
  handler: async (ctx, args) => {
    const creation = await ctx.db.get(args.creationId);
    if (!creation) return null;

    const images = await ctx.db
      .query("creationImages")
      .withIndex("by_creation_all", (q) => q.eq("creationId", args.creationId))
      .collect();

    const thumbnail = await ctx.db
      .query("thumbnails")
      .withIndex("by_creation", (q) => q.eq("creationId", args.creationId))
      .first();

    return {
      ...creation,
      images,
      thumbnail,
    };
  },
});
