import { NextResponse } from "next/server";
import { listAssets } from "@/lib/assets";
import { PRESETS } from "@/lib/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const assets = await listAssets();
  return NextResponse.json({
    assetsDir: "test-assets/",
    assets,
    presets: Object.values(PRESETS).map((p) => ({
      id: p.id,
      label: p.label,
      tagline: p.tagline,
      version: p.version,
      width: p.width,
      height: p.height,
      fps: p.fps,
      targetSeconds: p.targetSeconds,
      maxSeconds: p.maxSeconds,
    })),
  });
}
