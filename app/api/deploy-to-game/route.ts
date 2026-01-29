import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface DeploySheet {
  /** Sheet name (e.g. "idle", "walk", "attack") */
  name: string;
  /** Base64 PNG data URL */
  dataUrl: string;
  /** Sheet config to merge into sprite-config.json */
  sheetConfig: {
    columns: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
  };
  /** Animation mapping(s) to merge */
  animations: Record<string, unknown>;
}

interface DeployRequest {
  gamePath?: string;
  character: string;
  sheets: DeploySheet[];
}

/**
 * POST /api/deploy-to-game
 *
 * Deploys sprite sheets and updates sprite-config.json in the game project.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as DeployRequest;
  const gamePath =
    body.gamePath ||
    process.env.GAME_PROJECT_PATH ||
    path.resolve(process.cwd(), "../ichigo-journey");

  const charDir = path.join(
    gamePath,
    "public/assets/sprites/characters",
    body.character
  );

  // Ensure character directory exists
  if (!existsSync(charDir)) {
    await mkdir(charDir, { recursive: true });
  }

  const configPath = path.join(charDir, "sprite-config.json");

  // Load existing config or create new one
  let config: { sheets: Record<string, unknown>; animations: Record<string, unknown> };
  if (existsSync(configPath)) {
    const raw = await readFile(configPath, "utf-8");
    config = JSON.parse(raw);
  } else {
    config = { sheets: {}, animations: {} };
  }

  const deployedFiles: string[] = [];

  for (const sheet of body.sheets) {
    // Write PNG
    const pngName = `${sheet.name}.png`;
    const pngPath = path.join(charDir, pngName);

    const base64 = sheet.dataUrl.replace(/^data:image\/\w+;base64,/, "");
    await writeFile(pngPath, Buffer.from(base64, "base64"));
    deployedFiles.push(pngName);

    // Update sheet config
    config.sheets[sheet.name] = {
      path: `./${pngName}`,
      ...sheet.sheetConfig,
    };

    // Merge animation mappings (deep merge at top level only)
    for (const [animKey, animValue] of Object.entries(sheet.animations)) {
      if (
        typeof animValue === "object" &&
        animValue !== null &&
        typeof config.animations[animKey] === "object" &&
        config.animations[animKey] !== null
      ) {
        // Directional: merge direction keys
        config.animations[animKey] = {
          ...(config.animations[animKey] as Record<string, unknown>),
          ...(animValue as Record<string, unknown>),
        };
      } else {
        // Non-directional: replace entirely
        config.animations[animKey] = animValue;
      }
    }
  }

  // Write updated config
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  deployedFiles.push("sprite-config.json");

  return NextResponse.json({
    success: true,
    character: body.character,
    deployedFiles,
    configPath,
  });
}
