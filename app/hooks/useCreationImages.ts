"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Custom hook to get reactive image URLs for a creation.
 * Combines a query (to detect image changes) with an action (to get presigned URLs).
 *
 * @param creationId - The creation ID to get images for
 * @returns Object with imageUrls, loading state, and refetch function
 */
export function useCreationImages(creationId: Id<"creations"> | null | undefined) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query to get image records (reactive - updates when images are added/removed)
  const images = useQuery(
    api.creations.getImages,
    creationId ? { creationId } : "skip"
  );

  // Action to get presigned URLs
  const getImageUrls = useAction(api.images.getCreationImageUrls);

  // Fetch presigned URLs when images change
  const fetchUrls = useCallback(async () => {
    if (!creationId || !images) return;

    setIsLoading(true);
    setError(null);

    try {
      const urls = await getImageUrls({ creationId });
      console.log("[useCreationImages] Fetched URLs:", Object.keys(urls));
      setImageUrls(urls);
    } catch (e) {
      console.error("[useCreationImages] Failed to fetch URLs:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch image URLs");
    } finally {
      setIsLoading(false);
    }
  }, [creationId, images, getImageUrls]);

  // Refetch URLs when images change (detected by query)
  useEffect(() => {
    if (images && images.length > 0) {
      fetchUrls();
    } else if (images && images.length === 0) {
      setImageUrls({});
    }
  }, [images, fetchUrls]);

  // Manual refetch function
  const refetch = useCallback(() => {
    fetchUrls();
  }, [fetchUrls]);

  return {
    imageUrls,
    isLoading,
    error,
    refetch,
    // Also expose the raw image records for components that need metadata
    imageRecords: images,
  };
}

/**
 * Hook to get a single image URL for a creation.
 * Useful for thumbnails or specific image types.
 */
export function useCreationImage(
  creationId: Id<"creations"> | null | undefined,
  imageType: string
) {
  const { imageUrls, isLoading, error, refetch } = useCreationImages(creationId);

  return {
    imageUrl: imageUrls[imageType] || null,
    isLoading,
    error,
    refetch,
  };
}
