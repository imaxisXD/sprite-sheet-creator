"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Creation {
  _id: Id<"creations">;
  presetId: string;
  presetName: string;
  customPrompt?: string;
  characterName: string;
  currentStep: number;
  completedSteps: number[];
  status: "in_progress" | "completed";
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
}

interface RecentCreationsGalleryProps {
  onContinue: (creation: Creation, imageUrls: Record<string, string>) => void;
  onViewOutput: (creation: Creation, imageUrls: Record<string, string>) => void;
  currentCreationId?: Id<"creations"> | null;
  onOpenHistory: () => void;
}

interface ThumbnailCardProps {
  creation: Creation;
  onContinue: () => void;
  onViewOutput: () => void;
  isLoading: boolean;
  isCurrentCreation: boolean;
}

function ThumbnailCard({
  creation,
  onContinue,
  onViewOutput,
  isLoading,
  isCurrentCreation,
}: ThumbnailCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const getThumbnailUrl = useAction(api.images.getThumbnailUrl);

  useEffect(() => {
    async function fetchThumbnail() {
      try {
        const url = await getThumbnailUrl({ creationId: creation._id });
        setThumbnailUrl(url);
      } catch (e) {
        // Thumbnail not available
      }
    }
    fetchThumbnail();
  }, [creation._id, getThumbnailUrl]);

  const maxStep = 8;
  const progressPercent = (creation.currentStep / maxStep) * 100;
  const isComplete = creation.status === "completed" || creation.currentStep >= 7;

  return (
    <div
      className={`bg-surface-tertiary border rounded-lg p-2.5 flex flex-col gap-2 transition-all hover:border-stroke-hover ${
        isCurrentCreation
          ? "border-fal-purple-light bg-fal-purple-light/5"
          : "border-stroke"
      } max-sm:p-2`}
    >
      <div className="relative w-full aspect-square rounded-md overflow-hidden bg-surface-elevated">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={creation.characterName}
            className="w-full h-full object-cover pixelated"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fal-purple-deep to-fal-purple-light text-white text-2xl font-semibold">
            <span>{creation.characterName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {isCurrentCreation && (
          <div className="absolute top-1 right-1 bg-fal-purple-light text-white text-[0.6rem] font-semibold px-1.5 py-0.5 rounded">
            Current
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-xs font-medium text-content-primary truncate max-sm:text-[0.7rem]">
          {creation.characterName}
        </div>
        <div className="h-0.5 bg-surface-elevated rounded mt-1 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fal-purple-deep to-fal-purple-light rounded transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-[0.65rem] text-content-tertiary mt-1">
          {creation.status === "completed" ? "Complete" : `Step ${creation.currentStep}/8`}
        </div>
      </div>
      <div className="flex justify-center">
        {isComplete ? (
          <button
            className="py-1.5 px-2.5 text-[0.7rem] rounded bg-fal-cyan text-white border-none flex items-center gap-1 transition-all hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onViewOutput}
            disabled={isLoading || isCurrentCreation}
            title="View final output"
          >
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View
              </>
            )}
          </button>
        ) : (
          <button
            className="py-1.5 px-2.5 text-[0.7rem] rounded bg-fal-purple-deep text-white border-none flex items-center gap-1 transition-all hover:bg-fal-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onContinue}
            disabled={isLoading || isCurrentCreation}
            title="Continue editing"
          >
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Continue
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecentCreationsGallery({
  onContinue,
  onViewOutput,
  currentCreationId,
  onOpenHistory,
}: RecentCreationsGalleryProps) {
  const [loadingId, setLoadingId] = useState<Id<"creations"> | null>(null);

  // Query all recent creations (limited to 6 for the gallery)
  const creations = useQuery(api.creations.listRecent, { limit: 6 });

  const getImageUrls = useAction(api.images.getCreationImageUrls);

  const handleContinue = async (creation: Creation) => {
    if (loadingId) return;
    setLoadingId(creation._id);

    try {
      const imageUrls = await getImageUrls({ creationId: creation._id });
      onContinue(creation, imageUrls);
    } catch (e) {
      console.error("Failed to load creation:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleViewOutput = async (creation: Creation) => {
    if (loadingId) return;
    setLoadingId(creation._id);

    try {
      const imageUrls = await getImageUrls({ creationId: creation._id });
      onViewOutput(creation, imageUrls);
    } catch (e) {
      console.error("Failed to load creation:", e);
    } finally {
      setLoadingId(null);
    }
  };

  // Don't show if no creations or still loading
  if (!creations || creations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-stroke">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[0.95rem] font-semibold text-content-primary m-0">
          Recent Creations
        </h3>
        <button
          className="bg-transparent border-none text-content-secondary text-xs flex items-center gap-1 py-1 px-2 rounded transition-all hover:text-fal-purple-light hover:bg-fal-purple-light/10"
          onClick={onOpenHistory}
        >
          View all
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 max-sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] max-sm:gap-2">
        {creations.map((creation) => (
          <ThumbnailCard
            key={creation._id}
            creation={creation}
            onContinue={() => handleContinue(creation)}
            onViewOutput={() => handleViewOutput(creation)}
            isLoading={loadingId === creation._id}
            isCurrentCreation={currentCreationId === creation._id}
          />
        ))}
      </div>
    </div>
  );
}
