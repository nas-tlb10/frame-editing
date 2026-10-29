import { execFile } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ASSETS_DIR } from "./assets";

const execFileAsync = promisify(execFile);

/**
 * Bibliothèque d'effets sonores du mode Reel.
 *
 * Priorité aux fichiers de l'utilisateur dans test-assets/sfx/ (nommés whoosh*, pop*).
 * À défaut, des effets de secours sont synthétisés une fois par ffmpeg dans .work/sfx/ :
 * ils valident le placement et le mixage, pas la qualité sonore.
 */

export type SfxKind = "whoosh" | "pop";
/** Un effet et sa durée naturelle : la piste dure ce que dure le son, sans couper sa queue. */
export type SfxFile = { path: string; duration: number };
export type SfxLibrary = Record<SfxKind, SfxFile[]>;
type SfxPaths = Record<SfxKind, string[]>;

export const USER_SFX_DIR = path.join(ASSETS_DIR, "sfx");
const GENERATED_DIR = path.join(process.cwd(), ".work", "sfx");
const AUDIO_EXT = new Set([".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"]);

/** Moment, en secondes après le début du fichier, où l'effet « frappe ». */
export const SFX_PEAK: Record<SfxKind, number> = { whoosh: 0.26, pop: 0.01 };

const GENERATED: Array<{ kind: SfxKind; name: string; args: string[] }> = [
  {
    kind: "whoosh",
    name: "gen-whoosh-1-v2.wav",
    args: [
      "-f", "lavfi", "-i", "anoisesrc=d=0.55:c=pink:a=0.7:r=48000",
      "-af", "highpass=f=350,lowpass=f=4200,afade=t=in:d=0.26:curve=exp,afade=t=out:st=0.26:d=0.29:curve=exp,volume=1.6",
    ],
  },
  {
    kind: "whoosh",
    name: "gen-whoosh-2-v2.wav",
    args: [
      "-f", "lavfi", "-i", "anoisesrc=d=0.5:c=brown:a=0.9:r=48000",
      "-af", "highpass=f=180,lowpass=f=2600,afade=t=in:d=0.26:curve=qsin,afade=t=out:st=0.26:d=0.24:curve=exp,volume=2.2",
    ],
  },
  {
    kind: "pop",
    name: "gen-pop-1-v2.wav",
    args: ["-f", "lavfi", "-i", "aevalsrc=0.8*sin(2*PI*(820-2600*t)*t)*exp(-38*t):d=0.14:s=48000"],
  },
  {
    kind: "pop",
    name: "gen-pop-2-v2.wav",
    args: ["-f", "lavfi", "-i", "aevalsrc=0.8*sin(2*PI*(1050-3400*t)*t)*exp(-46*t):d=0.12:s=48000"],
  },
];

const SFX_PEAK_DB = -3;

async function peakDb(file: string): Promise<number> {
  const { stderr } = await execFileAsync("ffmpeg", ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"]);
  const match = /max_volume: (-?[\d.]+) dB/.exec(stderr);
  return match ? Number(match[1]) : SFX_PEAK_DB;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function durationOf(file: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
    ]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

async function userSfx(): Promise<SfxPaths> {
  const library: SfxPaths = { whoosh: [], pop: [] };
  let entries: string[];
  try {
    entries = await readdir(USER_SFX_DIR);
  } catch {
    return library;
  }
  for (const name of entries.sort()) {
    if (!AUDIO_EXT.has(path.extname(name).toLowerCase())) continue;
    const lower = name.toLowerCase();
    const kind: SfxKind | null = lower.startsWith("whoosh") ? "whoosh" : lower.startsWith("pop") ? "pop" : null;
    if (kind) library[kind].push(path.join(USER_SFX_DIR, name));
  }
  return library;
}

async function generatedSfx(): Promise<SfxPaths> {
  await mkdir(GENERATED_DIR, { recursive: true });
  const library: SfxPaths = { whoosh: [], pop: [] };
  for (const sound of GENERATED) {
    const output = path.join(GENERATED_DIR, sound.name);
    if (!(await exists(output))) {
      const raw = `${output}.raw.wav`;
      await execFileAsync("ffmpeg", ["-v", "error", "-y", ...sound.args, "-ac", "2", raw]);
      // Normalisation crête à SFX_PEAK_DB : le niveau dans le mix se règle ensuite par data-volume.
      const gain = SFX_PEAK_DB - (await peakDb(raw));
      await execFileAsync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `volume=${gain.toFixed(2)}dB`, output]);
      await rm(raw, { force: true });
    }
    library[sound.kind].push(output);
  }
  return library;
}

/** Fichiers absolus par type d'effet ; les fichiers utilisateur remplacent ceux de secours. */
export async function sfxLibrary(): Promise<SfxLibrary> {
  const [user, generated] = await Promise.all([userSfx(), generatedSfx()]);
  const withDurations = (paths: string[]) =>
    Promise.all(paths.map(async (file) => ({ path: file, duration: await durationOf(file) })));
  return {
    whoosh: await withDurations(user.whoosh.length > 0 ? user.whoosh : generated.whoosh),
    pop: await withDurations(user.pop.length > 0 ? user.pop : generated.pop),
  };
}
