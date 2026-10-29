import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { listAssets } from "./assets";
import { createPlan } from "./plan";
import { buildReel } from "./reel";
import { getPreset } from "./presets";
import { renderPlan } from "./render";
import type { EditPlan } from "./schema";
import { transcribeAsset, type Transcript } from "./transcribe";

export type JobMode = "reel" | "montage";

export type JobStatus = "transcribing" | "planning" | "rendering" | "done" | "error";

export type Job = {
  id: string;
  status: JobStatus;
  progress: number;
  stage: string;
  /** Texte de statut lisible (ex. « Transcription de 04-interview.mp4 »). */
  detail?: string;
  brief: string;
  presetId: string;
  /** reel = vidéo entière + sous-titres animés, sans LLM ; montage = Director (Claude). */
  mode: JobMode;
  /** Vidéo source du mode reel. */
  file?: string;
  /** Consigne libre pour le Director (mode reel), facultative. */
  instruction?: string;
  /** Plans du montage (mode reel) et texte prononcé, pour l'onglet Scènes. */
  outline?: Array<{ id: string; start: number; end: number; source: number; text: string }>;
  /** Effets appliqués (mode reel), pour l'affichage. */
  fxSummary?: { cuts: number; pops: number; sfx: number; hook: string | null };
  plan?: EditPlan;
  planSource?: "claude" | "mock" | "transcript";
  model?: string;
  notice?: string;
  transcript?: { files: number; words: number; engine: string | null; model?: string; language?: string };
  captionCount?: number;
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  video?: { url: string; bytes: number; duration: number };
  timings: { planningMs?: number; renderMs?: number; totalMs?: number };
  error?: string;
  createdAt: number;
  updatedAt: number;
  /** PID du serveur propriétaire : permet de détecter un job orphelin après un redémarrage. */
  ownerPid: number;
};

type Store = Map<string, Job>;
const globalStore = globalThis as unknown as { __frameJobs?: Store };
const jobs: Store = (globalStore.__frameJobs ??= new Map());

const MAX_JOBS = 25;
const JOBS_DIR = path.join(process.cwd(), ".work", "jobs");

mkdirSync(JOBS_DIR, { recursive: true });

function fileFor(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`);
}

function persist(job: Job): void {
  try {
    writeFileSync(fileFor(job.id), JSON.stringify(job, null, 2), "utf8");
  } catch {
    // un job non persisté reste visible en mémoire
  }
}

export function getJob(id: string): Job | undefined {
  const cached = jobs.get(id);
  if (cached) return cached;
  try {
    const parsed = JSON.parse(readFileSync(fileFor(id), "utf8")) as Job;
    // Le serveur qui a lancé ce job n'existe plus (redémarrage / crash).
    if (
      parsed.ownerPid !== process.pid &&
      (parsed.status === "transcribing" || parsed.status === "planning" || parsed.status === "rendering")
    ) {
      parsed.status = "error";
      parsed.stage = "error";
      parsed.progress = 100;
      parsed.error =
        "Rendu interrompu : le serveur a redémarré pendant la génération. Relance la génération.";
      persist(parsed);
    }
    jobs.set(id, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

function touch(job: Job, patch: Partial<Job>): void {
  Object.assign(job, patch, { updatedAt: Date.now() });
  persist(job);
}

export function listJobs(): Job[] {
  if (jobs.size === 0) {
    try {
      for (const file of readdirSync(JOBS_DIR)) {
        if (file.endsWith(".json")) getJob(file.slice(0, -".json".length));
      }
    } catch {
      // dossier absent : aucun job
    }
  }
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function prune(): void {
  const sorted = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  while (sorted.length > MAX_JOBS) {
    const oldest = sorted.shift();
    if (!oldest) break;
    jobs.delete(oldest.id);
    try {
      rmSync(fileFor(oldest.id), { force: true });
    } catch {
      // ignoré
    }
  }
}

export function startJob(
  brief: string,
  presetId: string,
  mode: JobMode = "montage",
  file?: string,
  instruction = "",
): Job {
  const job: Job = {
    id: randomUUID(),
    status: "transcribing",
    progress: 4,
    stage: "transcribe",
    detail: "Préparation",
    brief,
    presetId,
    mode,
    file,
    instruction: mode === "reel" && instruction ? instruction : undefined,
    timings: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerPid: process.pid,
  };
  jobs.set(job.id, job);
  persist(job);
  prune();

  void run(job);
  return job;
}

async function run(job: Job): Promise<void> {
  if (job.mode === "reel") return runReel(job);
  const startedAt = Date.now();
  try {
    // 1. Transcription locale des vidéos (mise en cache par fichier).
    touch(job, { status: "transcribing", stage: "transcribe", progress: 6, detail: "Analyse des vidéos" });
    const assets = await listAssets();
    const videos = assets.filter((a) => a.kind === "video");
    const transcripts = new Map<string, Transcript>();

    for (const [index, video] of videos.entries()) {
      touch(job, {
        progress: 6 + Math.round((index / Math.max(videos.length, 1)) * 8),
        detail: `Transcription de ${video.name}`,
      });
      const transcript = await transcribeAsset(video.file, (message) => touch(job, { detail: message }));
      if (transcript) transcripts.set(video.file, transcript);
    }

    const totalWords = [...transcripts.values()].reduce((sum, t) => sum + t.words.length, 0);
    touch(job, {
      transcript: {
        files: transcripts.size,
        words: totalWords,
        engine: transcripts.size > 0 ? [...transcripts.values()][0].engine : null,
      },
      detail: transcripts.size > 0 ? "Parole transcrite" : "Aucune parole détectée",
    });

    // 2. Planification.
    touch(job, { status: "planning", progress: 16, stage: "plan", detail: "Écriture du plan" });
    const planned = await createPlan(job.brief, job.presetId, transcripts);
    touch(job, {
      plan: planned.plan,
      planSource: planned.source,
      model: planned.model,
      notice: planned.notice,
      usage: planned.usage,
      status: "rendering",
      progress: 22,
      stage: "compile",
      detail: "Compilation de la composition",
      timings: { ...job.timings, planningMs: planned.ms },
    });

    // 3. Rendu.
    const words = new Map([...transcripts].map(([file, transcript]) => [file, transcript.words]));
    const result = await renderPlan(
      planned.plan,
      getPreset(job.presetId),
      job.id,
      words,
      (progress, stage) => {
        touch(job, { progress: Math.max(job.progress, Math.round(progress)), stage });
      },
    );

    touch(job, {
      status: "done",
      progress: 100,
      stage: "done",
      detail: undefined,
      captionCount: result.captionCount,
      video: { url: result.url, bytes: result.bytes, duration: result.duration },
      timings: { ...job.timings, renderMs: result.ms, totalMs: Date.now() - startedAt },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    touch(job, { status: "error", stage: "error", error: message, progress: 100, detail: undefined });
  }
}

/** Mode reel : transcription de la vidéo choisie → sous-titres animés → rendu. Aucun appel au LLM. */
async function runReel(job: Job): Promise<void> {
  const startedAt = Date.now();
  try {
    const assets = await listAssets();
    const asset = assets.find((a) => a.kind === "video" && a.file === job.file);
    if (!asset) throw new Error(`Vidéo introuvable dans test-assets/ : ${job.file ?? "(aucune)"}`);

    touch(job, { status: "transcribing", stage: "transcribe", progress: 6, detail: `Transcription de ${asset.name}` });
    const transcript = await transcribeAsset(asset.file, (message) => touch(job, { detail: message }));
    if (!transcript || transcript.words.length === 0) {
      throw new Error("Aucune parole détectée dans cette vidéo : impossible de générer des sous-titres.");
    }
    touch(job, {
      transcript: {
        files: 1,
        words: transcript.words.length,
        engine: transcript.engine,
        model: transcript.model,
        // Parakeet détecte la langue ; FRAME_ASR_LANGUAGE ne sert qu'au repli Whisper.
        language: transcript.engine === "parakeet" ? "auto" : (process.env.FRAME_ASR_LANGUAGE ?? "fr"),
      },
      progress: 18,
      detail: "Parole transcrite",
    });

    const preset = getPreset(job.presetId);
    touch(job, { status: "planning", stage: "plan", progress: 19, detail: "Director : coupes, accroche et effets" });
    const reel = await buildReel(asset, preset, transcript, job.instruction ?? "");
    const { plan, fx } = reel;
    touch(job, {
      plan,
      planSource: reel.source,
      model: reel.model,
      usage: reel.usage,
      notice: reel.notice,
      outline: (() => {
        let at = 0;
        return plan.scenes.map((scene, i) => {
          const start = at;
          at += scene.duration;
          return {
            id: scene.id,
            start: Number(start.toFixed(2)),
            end: Number(at.toFixed(2)),
            source: scene.source.type === "video" ? scene.source.in : 0,
            text: fx.shots[i]?.captions.map((c) => c.text).join("").trim() ?? "",
          };
        });
      })(),
      fxSummary: {
        cuts: plan.scenes.length - 1,
        pops: fx.pops.length,
        sfx: [fx.hook?.sound, ...fx.pops.map((p) => p.sound), ...fx.cuts.map((c) => c.sound)].filter(Boolean).length,
        hook: fx.hook?.text ?? null,
      },
      status: "rendering",
      progress: 22,
      stage: "compile",
      detail: "Compilation du montage",
      timings: { ...job.timings, planningMs: reel.ms },
    });

    const result = await renderPlan(
      plan,
      preset,
      job.id,
      new Map([[asset.file, transcript.words]]),
      (progress, stage) => touch(job, { progress: Math.max(job.progress, Math.round(progress)), stage }),
      "draft",
      fx,
    );

    touch(job, {
      status: "done",
      progress: 100,
      stage: "done",
      detail: undefined,
      captionCount: result.captionCount,
      video: { url: result.url, bytes: result.bytes, duration: result.duration },
      timings: { ...job.timings, renderMs: result.ms, totalMs: Date.now() - startedAt },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    touch(job, { status: "error", stage: "error", error: message, progress: 100, detail: undefined });
  }
}
