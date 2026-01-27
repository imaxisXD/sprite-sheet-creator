import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { Direction, DIRECTION_ROW_ORDER } from "../../config/animation-types";
import { DIRECTION_PROMPTS, BASE_STYLE_PROMPT } from "../../config/prompts";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

interface GenerateDirectionalRequest {
  /** Base character image URL to maintain consistency */
  characterImageUrl: string;
  /** Character description for prompt */
  characterDescription?: string;
  /** Direction to generate */
  direction: Direction;
  /** Generate all 4 directions at once */
  generateAll?: boolean;
}

/**
 * Generate a directional variant of the character
 * Uses img2img to maintain character consistency while changing the view angle
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateDirectionalRequest = await request.json();
    const {
      characterImageUrl,
      characterDescription = "",
      direction,
      generateAll = false,
    } = body;

    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "Character image URL is required" },
        { status: 400 }
      );
    }

    if (generateAll) {
      // Generate all 4 directions in parallel
      const results = await Promise.all(
        DIRECTION_ROW_ORDER.map(async (dir) => {
          const prompt = buildDirectionalPrompt(characterDescription, dir);

          const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
            input: {
              prompt,
              image_urls: [characterImageUrl],
              num_images: 1,
              aspect_ratio: "1:1",
              output_format: "png",
              resolution: "1K",
            },
          });

          const data = result.data as {
            images: Array<{ url: string; width: number; height: number }>;
          };

          if (!data.images || data.images.length === 0) {
            throw new Error(`Failed to generate ${dir} direction`);
          }

          return {
            direction: dir,
            imageUrl: data.images[0].url,
            width: data.images[0].width,
            height: data.images[0].height,
          };
        })
      );

      // Convert to record keyed by direction
      const directionalImages: Record<Direction, { imageUrl: string; width: number; height: number }> = {
        down: results.find(r => r.direction === 'down')!,
        up: results.find(r => r.direction === 'up')!,
        left: results.find(r => r.direction === 'left')!,
        right: results.find(r => r.direction === 'right')!,
      };

      return NextResponse.json({
        success: true,
        images: directionalImages,
      });
    }

    // Generate single direction
    if (!direction) {
      return NextResponse.json(
        { error: "Direction is required" },
        { status: 400 }
      );
    }

    const prompt = buildDirectionalPrompt(characterDescription, direction);

    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt,
        image_urls: [characterImageUrl],
        num_images: 1,
        aspect_ratio: "1:1",
        output_format: "png",
        resolution: "1K",
      },
    });

    const data = result.data as {
      images: Array<{ url: string; width: number; height: number }>;
    };

    if (!data.images || data.images.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate directional variant" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: data.images[0].url,
      direction,
      width: data.images[0].width,
      height: data.images[0].height,
    });
  } catch (error) {
    console.error("Error generating directional variant:", error);
    return NextResponse.json(
      { error: "Failed to generate directional variant" },
      { status: 500 }
    );
  }
}

/**
 * Build prompt for directional character generation
 */
function buildDirectionalPrompt(characterDescription: string, direction: Direction): string {
  const directionView = DIRECTION_PROMPTS[direction];

  return `
Same character, different viewing angle.

${directionView}

Show the character in a standing idle pose from this angle.
Single character only, centered in the frame.
Plain white background.

${characterDescription}
${BASE_STYLE_PROMPT}

IMPORTANT: This is the same character as the reference image, just viewed from a different angle.
Maintain exact same outfit, colors, proportions, and style.
`.trim();
}
