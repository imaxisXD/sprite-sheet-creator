/**
 * Character presets for Ichigo Journey sprite creation
 */

import { CharacterPreset } from '../types';

/**
 * Bleach-inspired character presets
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'ichigo-kurosaki',
    name: 'Ichigo Kurosaki',
    description: 'Substitute Soul Reaper with orange hair and black shihakusho',
    prompt: `Ichigo Kurosaki from Bleach anime, young man with spiky orange hair, determined brown eyes, wearing black shihakusho (soul reaper uniform) with a large sword on his back, athletic build`,
    styleModifiers: 'anime style, cel shaded, clean lines',
  },
  {
    id: 'ichigo-bankai',
    name: 'Ichigo (Bankai)',
    description: 'Ichigo in Bankai form with Tensa Zangetsu',
    prompt: `Ichigo Kurosaki Bankai form, spiky orange hair, wearing long black coat with red interior, holding slender black katana Tensa Zangetsu, intense expression, spiritual energy aura`,
    styleModifiers: 'anime style, cel shaded, dramatic lighting',
  },
  {
    id: 'rukia-kuchiki',
    name: 'Rukia Kuchiki',
    description: 'Soul Reaper with ice-type Zanpakuto',
    prompt: `Rukia Kuchiki from Bleach anime, petite young woman with short black hair, violet eyes, wearing black shihakusho soul reaper uniform, elegant bearing`,
    styleModifiers: 'anime style, cel shaded, clean lines',
  },
  {
    id: 'hollow-basic',
    name: 'Basic Hollow',
    description: 'Standard hollow enemy with white mask',
    prompt: `Hollow creature from Bleach anime, monstrous humanoid with white skull-like mask, dark shadowy body, glowing yellow eyes, menacing pose`,
    styleModifiers: 'anime style, dark atmosphere, eerie',
  },
  {
    id: 'soul-reaper-generic',
    name: 'Soul Reaper (Generic)',
    description: 'Generic Soul Reaper character',
    prompt: `Soul Reaper shinigami warrior, wearing black shihakusho uniform with white obi sash, katana sword at hip, mysterious appearance`,
    styleModifiers: 'anime style, cel shaded, clean lines',
  },
  {
    id: 'custom',
    name: 'Custom Character',
    description: 'Create your own character from scratch',
    prompt: '',
    styleModifiers: '',
  },
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): CharacterPreset | undefined {
  return CHARACTER_PRESETS.find(p => p.id === id);
}

/**
 * Check if a preset is the custom preset
 */
export function isCustomPreset(preset: CharacterPreset): boolean {
  return preset.id === 'custom';
}

/**
 * Get the full prompt for a preset (including style modifiers)
 */
export function getFullPrompt(preset: CharacterPreset, customPrompt?: string): string {
  if (isCustomPreset(preset)) {
    return customPrompt || '';
  }

  const basePrompt = preset.prompt;
  const style = preset.styleModifiers || '';

  return style ? `${basePrompt}. ${style}` : basePrompt;
}

/**
 * Default pixel art style to append to all prompts
 */
export const PIXEL_ART_STYLE = `
Render in pixel art style with clean edges, suitable for use as a 2D game sprite.
Use a 16-bit retro game aesthetic with visible pixels.
The character should be centered on a plain white background.
Front-facing or 3/4 view pose, standing idle and ready for sprite sheet animation.
`.trim();

/**
 * Build the complete prompt for character generation
 */
export function buildCharacterPrompt(preset: CharacterPreset, customPrompt?: string): string {
  const characterDescription = getFullPrompt(preset, customPrompt);

  if (!characterDescription.trim()) {
    return '';
  }

  return `${characterDescription}. ${PIXEL_ART_STYLE}`;
}
