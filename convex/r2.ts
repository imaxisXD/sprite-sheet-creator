import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

export const r2 = new R2(components.r2);

// Export client API for uploads
export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async () => {
    // Allow all uploads for now (no auth)
    // In production, you'd validate the user here
  },
  onUpload: async (ctx, bucket, key) => {
    // Called after successful upload
    console.log(`File uploaded to ${bucket} with key: ${key}`);
  },
});

// Helper to generate R2 keys for creations
export function getR2Key(
  creationId: string,
  imageType: string,
  extension: string = "png"
): string {
  return `creations/${creationId}/${imageType}.${extension}`;
}

export function getThumbnailKey(creationId: string): string {
  return `creations/${creationId}/thumbnail.png`;
}
