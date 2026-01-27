import { WorkflowManager } from "@convex-dev/workflow";
import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

/**
 * Workflow Manager for sprite generation orchestration
 * Handles multi-step generation flows with automatic retries
 */
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
    retryActionsByDefault: true,
  },
});

/**
 * Workpool for parallel image generation
 * Rate limits concurrent fal.ai requests to avoid API limits
 */
export const imagePool = new Workpool(components.imageGeneration, {
  maxParallelism: 5, // Limit concurrent fal.ai requests
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 2000,
    base: 2,
  },
});
