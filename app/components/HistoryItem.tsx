"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Creation {
  _id: Id<"creations">;
  presetId: string;
  presetName: string;
  characterName: string;
  currentStep: number;
  completedSteps: number[];
  status: "in_progress" | "completed";
  createdAt: number;
  updatedAt: number;
}

interface HistoryItemProps {
  creation: Creation;
  onLoad: (creation: Creation) => void;
  onDelete: (creationId: Id<"creations">) => void;
  isLoading?: boolean;
}

export default function HistoryItem({
  creation,
  onLoad,
  onDelete,
  isLoading,
}: HistoryItemProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getThumbnailUrl = useAction(api.images.getThumbnailUrl);

  // Fetch thumbnail URL on mount
  useEffect(() => {
    async function fetchThumbnail() {
      try {
        const url = await getThumbnailUrl({ creationId: creation._id });
        setThumbnailUrl(url);
      } catch (e) {
        // Thumbnail not available
        console.warn("Could not fetch thumbnail:", e);
      }
    }
    fetchThumbnail();
  }, [creation._id, getThumbnailUrl]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours < 1) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }

    // Show date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(creation._id);
    } finally {
      setIsDeleting(false);
    }
  };

  const maxStep = 8;
  const progressPercent = (creation.currentStep / maxStep) * 100;

  return (
    <div className="flex gap-3 p-3 bg-surface-tertiary border border-stroke rounded-lg transition-all hover:border-stroke-hover">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-surface-elevated flex items-center justify-center">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={creation.characterName}
            className="w-full h-full object-cover pixelated"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fal-purple-deep to-fal-purple-light text-white text-xl font-semibold">
            <span>{creation.characterName.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-sm font-medium text-content-primary truncate">
          {creation.characterName}
        </div>
        <div className="text-xs text-content-tertiary truncate">
          {creation.presetName}
        </div>
        <div className="flex gap-3 text-[0.7rem] text-content-tertiary mt-0.5">
          <span className="text-fal-cyan">
            Step {creation.currentStep}/{maxStep}
          </span>
          <span>{formatDate(creation.updatedAt)}</span>
        </div>
        <div className="h-[3px] bg-surface-elevated rounded mt-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fal-purple-deep to-fal-purple-light rounded transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          className="w-7 h-7 rounded-md bg-surface-elevated border border-stroke text-content-tertiary flex items-center justify-center transition-all hover:border-stroke-hover hover:text-content-primary hover:bg-fal-purple-deep hover:border-fal-purple-deep disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onLoad(creation)}
          disabled={isLoading}
          title="Load this creation"
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-stroke border-t-fal-purple-light rounded-full animate-spin" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          )}
        </button>
        <button
          className="w-7 h-7 rounded-md bg-surface-elevated border border-stroke text-content-tertiary flex items-center justify-center transition-all hover:bg-fal-red/10 hover:border-fal-red hover:text-fal-red disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete this creation"
        >
          {isDeleting ? (
            <span className="w-3.5 h-3.5 border-2 border-stroke border-t-fal-purple-light rounded-full animate-spin" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3,6 5,6 21,6" />
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
