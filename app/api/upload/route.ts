import { NextResponse } from "next/server";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ASSETS_DIR, listAssets } from "@/lib/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const MAX_BYTES = 500 * 1024 * 1024;

const FOLDERS = { video: "video", image: "images", audio: "audio" } as const;

const EXT_KIND: Record<string, "video" | "image" | "audio"> = {
  ".mp4": "video",
  ".mov": "video",
  ".webm": "video",
  ".mkv": "video",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".avif": "image",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".aac": "audio",
  ".flac": "audio",
  ".ogg": "audio",
};

function kindOf(name: string, mime: string): "video" | "image" | "audio" | null {
  const byExt = EXT_KIND[path.extname(name).toLowerCase()];
  if (byExt) return byExt;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

/** Nom de fichier propre : sans accents, sans espaces, sans traversée de dossier. */
function safeName(original: string): string {
  const ext = path.extname(original).toLowerCase();
  const base = path
    .basename(original, ext)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "fichier"}${ext}`;
}

async function uniquePath(dir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = path.join(dir, name);
  let index = 2;
  while (true) {
    try {
      await stat(candidate);
      candidate = path.join(dir, `${base}-${index}${ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envoi invalide (multipart attendu)." }, { status: 400 });
  }

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  const saved: Array<{ file: string; name: string; bytes: number }> = [];
  const rejected: Array<{ name: string; reason: string }> = [];

  for (const file of files) {
    const kind = kindOf(file.name, file.type);
    if (!kind) {
      rejected.push({ name: file.name, reason: "format non pris en charge" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      rejected.push({ name: file.name, reason: `trop lourd (max ${MAX_BYTES / 1024 / 1024} Mo)` });
      continue;
    }

    const folder = path.join(ASSETS_DIR, FOLDERS[kind]);
    await mkdir(folder, { recursive: true });
    const destination = await uniquePath(folder, safeName(file.name));
    await writeFile(destination, Buffer.from(await file.arrayBuffer()));

    saved.push({
      file: path.relative(ASSETS_DIR, destination).split(path.sep).join("/"),
      name: path.basename(destination),
      bytes: file.size,
    });
  }

  const assets = await listAssets();
  return NextResponse.json({ saved, rejected, assets }, { status: saved.length > 0 ? 201 : 400 });
}

export async function DELETE(request: Request) {
  const file = new URL(request.url).searchParams.get("file");
  if (!file) return NextResponse.json({ error: "Paramètre file manquant." }, { status: 400 });

  const absolute = path.resolve(ASSETS_DIR, path.posix.normalize(file));
  if (!absolute.startsWith(path.resolve(ASSETS_DIR))) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }
  try {
    await unlink(absolute);
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, assets: await listAssets() });
}
