"use client";

import { useState, useEffect, useCallback } from "react";
import { useProvider } from "../context/ProviderContext";

export interface GameSettings {
  gamePath: string;
  characterName: string;
  isValid: boolean;
}

const STORAGE_KEY = "ichigo-studio-settings";

function loadSettings(): GameSettings {
  if (typeof window === "undefined") {
    return { gamePath: "", characterName: "ichigo", isValid: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { gamePath: "", characterName: "ichigo", isValid: false };
}

function saveSettings(settings: GameSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: GameSettings) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  onSettingsChange,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<string | null>(null);
  const { provider, setProvider } = useProvider();

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  const updateField = useCallback(
    (field: keyof GameSettings, value: string | boolean) => {
      setSettings((prev) => {
        const next = { ...prev, [field]: value };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const handleDetect = useCallback(async () => {
    setIsDetecting(true);
    setDetectResult(null);
    try {
      const params = new URLSearchParams({
        gamePath: settings.gamePath || "",
        character: settings.characterName,
      });
      const res = await fetch(`/api/game-config?${params}`);
      const data = await res.json();

      if (res.ok) {
        setDetectResult("Valid game project detected");
        updateField("isValid", true);
      } else {
        setDetectResult(data.error || "Not found");
        updateField("isValid", false);
      }
    } catch {
      setDetectResult("Connection error");
      updateField("isValid", false);
    }
    setIsDetecting(false);
  }, [settings.gamePath, settings.characterName, updateField]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="bg-surface-secondary border border-stroke rounded-xl p-6 w-full max-w-md flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-content-primary">
            Game Settings
          </h2>
          <button
            onClick={onClose}
            className="text-content-tertiary hover:text-content-secondary text-sm"
          >
            Close
          </button>
        </div>

        {/* Game path */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">
            Game project path
          </span>
          <input
            type="text"
            value={settings.gamePath}
            onChange={(e) => updateField("gamePath", e.target.value)}
            placeholder="Leave blank for auto-detect (../ichigo-journey)"
            className="px-3 py-2 rounded-md bg-surface-tertiary border border-stroke text-sm text-content-primary placeholder:text-content-tertiary"
          />
          <span className="text-[10px] text-content-tertiary">
            Defaults to ../ichigo-journey relative to the studio
          </span>
        </label>

        {/* Character name */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">Character name</span>
          <input
            type="text"
            value={settings.characterName}
            onChange={(e) => updateField("characterName", e.target.value)}
            className="px-3 py-2 rounded-md bg-surface-tertiary border border-stroke text-sm text-content-primary"
          />
          <span className="text-[10px] text-content-tertiary">
            Folder name under public/assets/sprites/characters/
          </span>
        </label>

        {/* Detect button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDetect}
            disabled={isDetecting}
            className="px-4 py-2 rounded-md text-sm font-medium bg-surface-tertiary text-content-secondary hover:bg-surface-elevated disabled:opacity-50 transition-colors"
          >
            {isDetecting ? "Detecting..." : "Detect Game Project"}
          </button>

          {detectResult && (
            <span
              className={`text-xs ${
                settings.isValid ? "text-fal-cyan" : "text-red-400"
              }`}
            >
              {detectResult}
            </span>
          )}
        </div>

        {settings.isValid && (
          <div className="text-xs text-fal-cyan flex items-center gap-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Game project connected
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-stroke" />

        {/* AI Provider */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-content-tertiary">
            Image generation provider
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setProvider("fal")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                provider === "fal"
                  ? "bg-fal-purple-deep text-white"
                  : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
              }`}
            >
              Fal AI
            </button>
            <button
              onClick={() => setProvider("seedream")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                provider === "seedream"
                  ? "bg-green-600 text-white"
                  : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
              }`}
            >
              SeedReam
            </button>
            <button
              onClick={() => setProvider("gemini")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                provider === "gemini"
                  ? "bg-blue-600 text-white"
                  : "bg-surface-tertiary text-content-secondary hover:bg-surface-elevated"
              }`}
            >
              Gemini
            </button>
          </div>
          <span className="text-[10px] text-content-tertiary">
            Fal AI uses nano-banana-pro. SeedReam uses ByteDance v4.5. Gemini uses gemini-3-pro-image-preview.
          </span>
        </div>
      </div>
    </div>
  );
}
