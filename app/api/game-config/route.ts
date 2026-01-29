import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * GET /api/game-config?gamePath=...&character=...
 *
 * Reads sprite-config.json from the game project folder.
 * gamePath defaults to GAME_PROJECT_PATH env var or ../ichigo-journey relative to cwd.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gamePath =
    searchParams.get("gamePath") ||
    process.env.GAME_PROJECT_PATH ||
    path.resolve(process.cwd(), "../ichigo-journey");

  const character = searchParams.get("character") || "ichigo";

  const configPath = path.join(
    gamePath,
    "public/assets/sprites/characters",
    character,
    "sprite-config.json"
  );

  if (!existsSync(configPath)) {
    return NextResponse.json(
      { error: "sprite-config.json not found", path: configPath },
      { status: 404 }
    );
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    return NextResponse.json({ config, path: configPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read config", details: message },
      { status: 500 }
    );
  }
}
