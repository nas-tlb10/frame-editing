import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { resolveAsset } from "./assets";

/**
 * Transcription locale (Parakeet via HyperFrames), avec cache disque.
 *
 * Pourquoi local : aucun coût variable, aucun envoi d'audio à un tiers,
 * et ~3× plus rapide que le temps réel sur cette machine.
 */

export type Word = {
  id?: string;
  text: string;
  start: number;
  end: number;
};

export type Transcript = {
  file: string;
  words: Word[];
  engine: string;
  model: string;
  duration: number;
  cached: boolean;
};

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".work", "transcripts");
const CLI = path.join(ROOT, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
const LANGUAGE = process.env.FRAME_ASR_LANGUAGE ?? "fr";
const CONCURRENCY = 2;

const cache = new Map<string, Transcript | null>();
let active = 0;
const queue: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= CONCURRENCY) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

function keyFor(relative: string, mtimeMs: number, size: number): string {
  return createHash("sha1").update(`${relative}:${mtimeMs}:${size}:${LANGUAGE}`).digest("hex").slice(0, 16);
}

/** Extrait le JSON de la sortie CLI : une ligne par événement, préfixée ou non. */
function parseTranscriptFile(raw: string): Word[] {
  const parsed = JSON.parse(raw) as Word[] | { words?: Word[] };
  const words = Array.isArray(parsed) ? parsed : (parsed.words ?? []);
  return words
    .filter((w) => typeof w.text === "string" && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ id: w.id, text: w.text.trim(), start: w.start, end: w.end }))
    .filter((w) => w.text.length > 0 && w.end > w.start);
}

async function runTranscribe(input: string, dir: string): Promise<{ ok: boolean; stderr: string }> {
  return withSlot(
    () =>
      new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          [CLI, "transcribe", input, "-d", dir, "-l", LANGUAGE, "--json"],
          { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
        );

        let stderr = "";
        child.stdout.resume();
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => {
          stderr += chunk;
          if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
        });

        const timer = setTimeout(() => child.kill(), 15 * 60_000);
        child.on("error", () => {
          clearTimeout(timer);
          resolve({ ok: false, stderr: "spawn failed" });
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ ok: code === 0, stderr });
        });
      }),
  );
}

export async function transcribeAsset(
  relative: string,
  onStatus?: (message: string) => void,
): Promise<Transcript | null> {
  if (process.env.FRAME_ASR === "off") return null;

  const absolute = resolveAsset(relative);
  const info = await stat(absolute);
  const key = keyFor(relative, info.mtimeMs, info.size);

  if (cache.has(key)) return cache.get(key) ?? null;

  const cached = path.join(CACHE_DIR, `${key}.json`);
  try {
    const raw = await readFile(cached, "utf8");
    const meta = JSON.parse(await readFile(path.join(CACHE_DIR, `${key}.meta.json`), "utf8")) as {
      engine: string;
      model: string;
      duration: number;
    };
    const transcript: Transcript = {
      file: relative,
      words: parseTranscriptFile(raw),
      engine: meta.engine,
      model: meta.model,
      duration: meta.duration,
      cached: true,
    };
    cache.set(key, transcript);
    return transcript;
  } catch {
    // pas en cache : on transcrit
  }

  const workDir = path.join(CACHE_DIR, key);
  await mkdir(workDir, { recursive: true });
  onStatus?.(`Transcription de ${path.basename(relative)}`);

  const result = await runTranscribe(absolute, workDir);
  if (!result.ok) {
    const silent = result.stderr.includes("no_words");
    if (!silent) {
      console.warn(`[transcribe] ${relative} : ${result.stderr.slice(-500)}`);
    }
    cache.set(key, null);
    return null;
  }

  const transcriptPath = path.join(workDir, "transcript.json");
  const raw = await readFile(transcriptPath, "utf8");
  const words = parseTranscriptFile(raw);
  if (words.length === 0) {
    cache.set(key, null);
    return null;
  }

  const duration = Number((words[words.length - 1]?.end ?? 0).toFixed(3));
  const meta = { engine: "parakeet", model: "parakeet-tdt-0.6b-v3", duration };

  await copyFile(transcriptPath, cached);
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(path.join(CACHE_DIR, `${key}.meta.json`), JSON.stringify(meta), "utf8"),
  );

  const transcript: Transcript = {
    file: relative,
    words,
    engine: meta.engine,
    model: meta.model,
    duration,
    cached: false,
  };
  cache.set(key, transcript);
  return transcript;
}

/** Version texte, pour le prompt : "0|0.00|Bienvenue". */
export function transcriptForPrompt(transcript: Transcript, maxWords = 400): string {
  const words = transcript.words.slice(0, maxWords);
  return words.map((w, i) => `${i}|${w.start.toFixed(2)}|${w.text.replace(/\|/g, "/")}`).join("\n");
}

export function transcriptText(transcript: Transcript): string {
  return transcript.words.map((w) => w.text).join(" ");
}
