import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import {
  AnimationType,
  Direction,
  ANIMATION_CONFIGS,
  getAspectRatio,
  getSplitAspectRatio,
} from "../../config/animation-types";
import {
  getAnimationPrompt,
  getFullDirectionalSheetPrompt,
  getCombinedAttackPrompt,
  get4DirectionalSheetPrompt,
} from "../../config/prompts";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

interface GenerateRequest {
  characterImageUrl: string;
  characterDescription?: string;
  type: AnimationType | 'walk' | 'jump' | 'attack' | 'idle-full' | 'walk-full' | 'attack-combined' | 'walk-cardinal' | 'walk-diagonal' | 'idle-cardinal' | 'idle-diagonal';
  direction?: Direction;
  customPrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const {
      characterImageUrl,
      characterDescription = "",
      type,
      direction,
      customPrompt,
    } = body;

    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "Character image URL is required" },
        { status: 400 }
      );
    }

    let prompt: string;
    let aspectRatio: string;

    // Handle legacy types for backwards compatibility
    if (type === 'walk') {
      // Legacy walk type - generate single direction walk
      prompt = getAnimationPrompt(characterDescription, 'walk', direction || 'right');
      aspectRatio = '4:3';
    } else if (type === 'jump') {
      // Legacy jump type - map to dash for ichigo-journey
      prompt = getAnimationPrompt(characterDescription, 'dash');
      aspectRatio = '16:9';
    } else if (type === 'attack') {
      // Legacy attack type - generate attack1
      prompt = getAnimationPrompt(characterDescription, 'attack1');
      aspectRatio = '16:9';
    } else if (type === 'walk-cardinal' || type === 'idle-cardinal') {
      const animType = type.split('-')[0] as 'idle' | 'walk';
      prompt = get4DirectionalSheetPrompt(characterDescription, animType, 'cardinal');
      aspectRatio = getSplitAspectRatio(animType);
    } else if (type === 'walk-diagonal' || type === 'idle-diagonal') {
      const animType = type.split('-')[0] as 'idle' | 'walk';
      prompt = get4DirectionalSheetPrompt(characterDescription, animType, 'diagonal');
      aspectRatio = getSplitAspectRatio(animType);
    } else if (type === 'idle-full' || type === 'walk-full') {
      // Full directional sheet (4 rows)
      const animType = type === 'idle-full' ? 'idle' : 'walk';
      prompt = getFullDirectionalSheetPrompt(characterDescription, animType);
      // 4 frames x 4 directions for idle = 4:4 = 1:1
      // 6 frames x 4 directions for walk = 6:4 = 3:2
      aspectRatio = animType === 'idle' ? '1:1' : '4:3';
    } else if (type === 'attack-combined') {
      // Combined attack sheet (attack1 + attack2 + attack3)
      prompt = getCombinedAttackPrompt(characterDescription);
      aspectRatio = '16:9'; // 8x3 grid
    } else {
      // Standard animation type
      const animType = type as AnimationType;
      const config = ANIMATION_CONFIGS[animType];

      if (!config) {
        return NextResponse.json(
          { error: `Unknown animation type: ${type}` },
          { status: 400 }
        );
      }

      if (config.isDirectional && !direction) {
        // For directional animations without direction, generate the full sheet
        prompt = getFullDirectionalSheetPrompt(characterDescription, animType as 'idle' | 'walk');
        aspectRatio = animType === 'idle' ? '1:1' : '4:3';
      } else {
        prompt = customPrompt || getAnimationPrompt(characterDescription, animType, direction);
        aspectRatio = getAspectRatio(animType);
      }
    }

    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt,
        image_urls: [characterImageUrl],
        num_images: 1,
        aspect_ratio: aspectRatio,
        output_format: "png",
        resolution: "1K",
      },
    });

    const data = result.data as {
      images: Array<{ url: string; width: number; height: number }>;
    };

    if (!data.images || data.images.length === 0) {
      return NextResponse.json(
        { error: "No sprite sheet generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: data.images[0].url,
      width: data.images[0].width,
      height: data.images[0].height,
      type,
      direction,
    });
  } catch (error) {
    console.error("Error generating sprite sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate sprite sheet" },
      { status: 500 }
    );
  }
}
