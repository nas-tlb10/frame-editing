import { NextResponse } from "next/server";
import { listAssets } from "@/lib/assets";
import { getJob, listJobs, startJob } from "@/lib/jobs";
import { DEFAULT_PRESET, PRESETS } from "@/lib/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dernier job, pour retrouver son rendu après un rechargement de page. */
export async function GET() {
  const [latest] = listJobs();
  return NextResponse.json({ job: latest ? getJob(latest.id) ?? null : null });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { brief, preset, mode, file, instruction } = (body ?? {}) as {
    brief?: unknown;
    preset?: unknown;
    mode?: unknown;
    file?: unknown;
    instruction?: unknown;
  };
  const presetId = typeof preset === "string" && preset in PRESETS ? preset : DEFAULT_PRESET;

  // Mode reel : pas de brief, juste une vidéo avec de la parole.
  if (mode === "reel") {
    if (typeof file !== "string" || file.length === 0) {
      return NextResponse.json({ error: "Choisis une vidéo à sous-titrer." }, { status: 400 });
    }
    const videos = (await listAssets()).filter((a) => a.kind === "video");
    if (!videos.some((a) => a.file === file)) {
      return NextResponse.json({ error: `Vidéo introuvable : ${file}` }, { status: 404 });
    }
    const note = typeof instruction === "string" ? instruction.trim().slice(0, 600) : "";
    const job = startJob("", presetId, "reel", file, note);
    return NextResponse.json({ id: job.id }, { status: 202 });
  }

  if (typeof brief !== "string" || brief.trim().length < 8) {
    return NextResponse.json({ error: "Décris le montage en une phrase (8 caractères minimum)." }, { status: 400 });
  }
  if (brief.length > 2000) {
    return NextResponse.json({ error: "Brief trop long (2000 caractères maximum)." }, { status: 400 });
  }

  const job = startJob(brief.trim(), presetId);
  return NextResponse.json({ id: job.id }, { status: 202 });
}
