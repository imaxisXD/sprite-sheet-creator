"use client";

import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(creation.characterName);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState(creation.customPrompt || "");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const getThumbnailUrl = useAction(api.images.getThumbnailUrl);
  const renameCreation = useMutation(api.creations.rename);
  const updatePrompt = useMutation(api.creations.updatePrompt);

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

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update editName when creation changes (e.g., from another source)
  useEffect(() => {
    setEditName(creation.characterName);
  }, [creation.characterName]);

  // Update editPrompt when creation changes
  useEffect(() => {
    setEditPrompt(creation.customPrompt || "");
  }, [creation.customPrompt]);

  // Focus textarea when entering prompt edit mode
  useEffect(() => {
    if (isEditingPrompt && promptTextareaRef.current) {
      promptTextareaRef.current.focus();
      promptTextareaRef.current.select();
    }
  }, [isEditingPrompt]);

  const handleStartEditing = () => {
    setEditName(creation.characterName);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditName(creation.characterName);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName === creation.characterName) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      await renameCreation({
        creationId: creation._id,
        characterName: trimmedName,
      });
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to rename:", e);
      // Reset to original name on error
      setEditName(creation.characterName);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Prompt editing handlers
  const handleStartEditingPrompt = () => {
    setEditPrompt(creation.customPrompt || "");
    setIsEditingPrompt(true);
  };

  const handleCancelEditPrompt = () => {
    setEditPrompt(creation.customPrompt || "");
    setIsEditingPrompt(false);
  };

  const handleSavePrompt = async () => {
    const trimmedPrompt = editPrompt.trim();
    if (trimmedPrompt === (creation.customPrompt || "")) {
      handleCancelEditPrompt();
      return;
    }

    setIsSavingPrompt(true);
    try {
      await updatePrompt({
        creationId: creation._id,
        customPrompt: trimmedPrompt,
      });
      setIsEditingPrompt(false);
    } catch (e) {
      console.error("Failed to update prompt:", e);
      setEditPrompt(creation.customPrompt || "");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSavePrompt();
    } else if (e.key === "Escape") {
      handleCancelEditPrompt();
    }
  };

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
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            disabled={isSaving}
            className="text-sm font-medium text-content-primary bg-surface-elevated border border-fal-purple-light rounded px-1.5 py-0.5 outline-none focus:border-fal-purple-deep disabled:opacity-50"
          />
        ) : (
          <div
            className="text-sm font-medium text-content-primary truncate cursor-pointer group/name flex items-center gap-1.5 hover:text-fal-purple-light transition-colors"
            onClick={handleStartEditing}
            title="Click to rename"
          >
            <span className="truncate">{creation.characterName}</span>
            <svg
              className="w-3 h-3 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </div>
        )}
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

        {/* Prompt toggle button */}
        <button
          className="mt-1.5 text-[0.65rem] text-content-tertiary flex items-center gap-1 hover:text-fal-purple-light transition-colors bg-transparent border-none p-0 cursor-pointer"
          onClick={() => setShowPrompt(!showPrompt)}
        >
          <svg
            className={`w-3 h-3 transition-transform ${showPrompt ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          {showPrompt ? "Hide prompt" : "Show prompt"}
        </button>

        {/* Prompt display/edit */}
        {showPrompt && (
          <div className="mt-1.5">
            {isEditingPrompt ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  ref={promptTextareaRef}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  disabled={isSavingPrompt}
                  placeholder="Enter custom prompt..."
                  className="text-[0.7rem] text-content-primary bg-surface-elevated border border-fal-purple-light rounded px-2 py-1.5 outline-none focus:border-fal-purple-deep disabled:opacity-50 resize-none min-h-[60px]"
                  rows={3}
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    className="text-[0.65rem] px-2 py-0.5 rounded bg-surface-elevated border border-stroke text-content-tertiary hover:border-stroke-hover transition-all disabled:opacity-50"
                    onClick={handleCancelEditPrompt}
                    disabled={isSavingPrompt}
                  >
                    Cancel
                  </button>
                  <button
                    className="text-[0.65rem] px-2 py-0.5 rounded bg-fal-purple-deep text-white border-none hover:bg-fal-purple-light transition-all disabled:opacity-50 flex items-center gap-1"
                    onClick={handleSavePrompt}
                    disabled={isSavingPrompt}
                  >
                    {isSavingPrompt ? (
                      <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="group/prompt cursor-pointer"
                onClick={handleStartEditingPrompt}
              >
                <div className="text-[0.7rem] text-content-secondary bg-surface-elevated rounded px-2 py-1.5 border border-stroke hover:border-stroke-hover transition-all flex items-start gap-1.5">
                  <span className="flex-1 break-words">
                    {creation.customPrompt || (
                      <span className="italic text-content-tertiary">
                        No custom prompt
                      </span>
                    )}
                  </span>
                  <svg
                    className="w-3 h-3 opacity-0 group-hover/prompt:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
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
