import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const ASSETS_DIR = path.join(process.cwd(), "test-assets");

export type AssetKind = "video" | "image" | "audio" | "other";

export type Asset = {
  /** Chemin relatif à test-assets/, toujours en séparateurs POSIX. */
  file: string;
  name: string;
  kind: AssetKind;
  bytes: number;
  duration?: number;
  width?: number;
  height?: number;
};

const EXT_KIND: Record<string, AssetKind> = {
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

type Probe = { duration?: number; width?: number; height?: number };
const probeCache = new Map<string, Probe>();

async function probe(filePath: string): Promise<Probe> {
  const info = await stat(filePath);
  const key = `${filePath}:${info.mtimeMs}:${info.size}`;
  const cached = probeCache.get(key);
  if (cached) return cached;

  let result: Probe = {};
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
    };
    const video = parsed.streams?.find((s) => s.codec_type === "video");
    const duration = Number(parsed.format?.duration ?? video?.duration ?? 0);
    result = {
      duration: Number.isFinite(duration) && duration > 0 ? Number(duration.toFixed(3)) : undefined,
      width: video?.width,
      height: video?.height,
    };
  } catch {
    result = {};
  }

  probeCache.set(key, result);
  return result;
}

async function walk(dir: string, root: string): Promise<Asset[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: Asset[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // test-assets/sfx/ : effets sonores du mode Reel, pas des médias de montage.
      if (dir === root && entry.name === "sfx") continue;
      out.push(...(await walk(full, root)));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    const kind = EXT_KIND[ext];
    if (!kind) continue;
    const info = await stat(full);
    const relative = path.relative(root, full).split(path.sep).join("/");
    const details = await probe(full);
    out.push({ file: relative, name: entry.name, kind, bytes: info.size, ...details });
  }
  return out;
}

export async function listAssets(): Promise<Asset[]> {
  const assets = await walk(ASSETS_DIR, ASSETS_DIR);
  const order: Record<AssetKind, number> = { video: 0, image: 1, audio: 2, other: 3 };
  return assets.sort((a, b) => order[a.kind] - order[b.kind] || a.file.localeCompare(b.file));
}

export function resolveAsset(file: string): string {
  const normalized = path.posix.normalize(file).replace(/^(\.\.\/)+/, "");
  const absolute = path.resolve(ASSETS_DIR, normalized);
  if (!absolute.startsWith(path.resolve(ASSETS_DIR))) {
    throw new Error(`Chemin d'asset invalide : ${file}`);
  }
  return absolute;
}

/** Résumé compact des assets, injecté dans le prompt système. */
export function describeAssets(assets: Asset[]): string {
  if (assets.length === 0) {
    return "Aucun asset fourni. Utilise des plans de couleur unie avec du texte.";
  }
  return assets
    .map((a) => {
      const bits = [a.file];
      if (a.kind === "video") {
        bits.push(`vidéo ${a.width ?? "?"}×${a.height ?? "?"}`, `${a.duration ?? "?"} s`);
      } else if (a.kind === "image") {
        bits.push(`image ${a.width ?? "?"}×${a.height ?? "?"}`);
      } else if (a.kind === "audio") {
        bits.push(`audio ${a.duration ?? "?"} s`);
      }
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");
}
