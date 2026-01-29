"use client";

import { useState, useCallback } from "react";

interface PromptEditorProps {
  /** The default/original prompt */
  defaultPrompt: string;
  /** Current prompt value (may be edited) */
  value: string;
  /** Called when prompt changes */
  onChange: (newPrompt: string) => void;
  /** Whether the prompt is currently being used (generating) */
  isGenerating?: boolean;
  /** Animation type label for display */
  animationLabel: string;
}

export default function PromptEditor({
  defaultPrompt,
  value,
  onChange,
  isGenerating = false,
  animationLabel,
}: PromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const isModified = value !== defaultPrompt;

  const handleSave = useCallback(() => {
    onChange(editValue);
    setIsEditing(false);
  }, [editValue, onChange]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleReset = useCallback(() => {
    onChange(defaultPrompt);
    setEditValue(defaultPrompt);
    setIsEditing(false);
  }, [defaultPrompt, onChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }, [value]);

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        type="button"
        className={`w-full px-2.5 py-1.5 rounded text-xs font-medium transition-all inline-flex items-center justify-between gap-1.5 ${
          isExpanded
            ? "bg-fal-purple-deep/20 text-fal-purple-light border border-fal-purple-deep/30"
            : "bg-transparent text-content-tertiary border border-stroke/50 hover:bg-white/[0.03] hover:border-stroke"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={isGenerating}
      >
        <span className="flex items-center gap-1.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {isExpanded ? "Hide Prompt" : "View Prompt"}
          {isModified && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-fal-cyan/20 text-fal-cyan rounded">
              Modified
            </span>
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 bg-surface-primary border border-stroke rounded-md overflow-hidden">
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-stroke bg-surface-secondary/50">
            <span className="text-xs text-content-secondary font-medium">
              {animationLabel} Prompt
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="p-1.5 rounded text-content-tertiary hover:text-content-primary hover:bg-white/[0.05] transition-colors"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              {!isEditing ? (
                <button
                  type="button"
                  className="px-2 py-1 rounded text-xs text-content-secondary hover:text-content-primary hover:bg-white/[0.05] transition-colors flex items-center gap-1"
                  onClick={() => {
                    setEditValue(value);
                    setIsEditing(true);
                  }}
                  disabled={isGenerating}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
              ) : null}
              {isModified && !isEditing && (
                <button
                  type="button"
                  className="px-2 py-1 rounded text-xs text-fal-red/80 hover:text-fal-red hover:bg-fal-red/10 transition-colors"
                  onClick={handleReset}
                  disabled={isGenerating}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          {isEditing ? (
            <div className="p-3">
              <textarea
                className="w-full h-48 p-3 bg-surface-tertiary border border-stroke rounded-md text-xs text-content-primary font-mono resize-none focus:outline-none focus:border-fal-purple-light"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter custom prompt..."
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-content-tertiary">
                  {editValue.length} characters
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded text-xs font-medium text-content-secondary border border-stroke hover:bg-white/[0.03] transition-colors"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded text-xs font-medium bg-fal-purple-deep text-white hover:bg-fal-purple-light transition-colors"
                    onClick={handleSave}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-content-secondary font-mono whitespace-pre-wrap leading-relaxed">
                {value}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
