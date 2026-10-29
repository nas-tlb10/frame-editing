import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileToHtml, sfxPublicPath, type ReelFx } from "./compile";
import type { Preset } from "./presets";
import type { EditPlan } from "./schema";
import { resolveAsset } from "./assets";
import type { Word } from "./transcribe";

const ROOT = process.cwd();
const WORK_DIR = path.join(ROOT, ".work");
const RENDERS_DIR = path.join(WORK_DIR, "renders");
const CLI = path.join(ROOT, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
const GSAP = path.join(ROOT, "node_modules", "gsap", "dist", "gsap.min.js");

export type RenderResult = {
  file: string;
  url: string;
  bytes: number;
  ms: number;
  duration: number;
  captionCount: number;
};

export type ProgressHandler = (progress: number, stage: string) => void;

async function ensureAssetCopied(projectDir: string, relative: string): Promise<void> {
  const destination = path.join(projectDir, "assets", relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(resolveAsset(relative), destination);
}

/**
 * Écrit le projet HyperFrames sur disque puis lance le CLI.
 * Le rendu tourne dans un processus séparé : un crash de Chrome ne tue pas le serveur Next.
 */
export async function renderPlan(
  plan: EditPlan,
  preset: Preset,
  jobId: string,
  transcripts: Map<string, Word[]> = new Map(),
  onProgress?: ProgressHandler,
  quality: "draft" | "looks" = "draft",
  fx: ReelFx | null = null,
): Promise<RenderResult> {
  const projectDir = path.join(RENDERS_DIR, jobId);
  await mkdir(projectDir, { recursive: true });

  const compiled = compileToHtml(plan, preset, transcripts, fx);
  const used = [...compiled.usedAssets];
  if (plan.audio) used.push(plan.audio.file);

  for (const rel of new Set(used)) {
    await ensureAssetCopied(projectDir, rel);
  }
  const sounds = fx
    ? [fx.hook?.sound, ...fx.pops.map((p) => p.sound), ...fx.cuts.map((c) => c.sound)]
    : [];
  for (const source of new Set(sounds.flatMap((s) => (s ? [s.path] : [])))) {
    const destination = path.join(projectDir, sfxPublicPath(source));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  await copyFile(GSAP, path.join(projectDir, "gsap.min.js"));
  await writeFile(path.join(projectDir, "index.html"), compiled.html, "utf8");

  const output = path.join(projectDir, "out.mp4");
  const startedAt = Date.now();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [CLI, "render", projectDir, "-o", output, "-q", quality, "-f", String(preset.fps)],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );

    let stderr = "";
    let stdoutBuffer = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const marker = line.indexOf("@hf-progress ");
        if (marker === -1) continue;
        try {
          const payload = JSON.parse(line.slice(marker + "@hf-progress ".length)) as {
            code?: string;
            pct?: number;
          };
          if (typeof payload.pct === "number") {
            // Le rendu occupe 10–95 % de la barre : le reste couvre compilation et assemblage.
            onProgress?.(Math.min(95, 10 + payload.pct * 0.85), payload.code ?? "render");
          }
        } catch {
          // ligne de progression illisible : on ignore
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 40_000) stderr = stderr.slice(-40_000);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`hyperframes render a échoué (code ${code})\n${stderr.slice(-4000)}`));
    });
  });

  const info = await stat(output);
  const ms = Date.now() - startedAt;
  onProgress?.(100, "done");

  return {
    file: output,
    url: `/api/media/${jobId}.mp4`,
    bytes: info.size,
    ms,
    duration: compiled.duration,
    captionCount: compiled.captionCount,
  };
}

export async function readRender(jobId: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(RENDERS_DIR, jobId, "out.mp4"));
  } catch {
    return null;
  }
}

export { WORK_DIR, RENDERS_DIR };
