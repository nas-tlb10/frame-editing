import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { describeAssets, listAssets, type Asset } from "./assets";
import { getPreset, type Preset } from "./presets";
import { EditPlanSchema, normalizePlan, type EditPlan } from "./schema";
import { transcriptForPrompt, type Transcript } from "./transcribe";

/** Opus 5.5 : 4 $/MTok en entrée, 20 $/MTok en sortie. */
export const PRICE_IN = 4 / 1_000_000;
export const PRICE_OUT = 20 / 1_000_000;

export const PLAN_MODEL = process.env.FRAME_PLAN_MODEL ?? "claude-opus-5-5";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY manquante. Ajoute-la dans Frame/.env.local, ou lance avec FRAME_PLAN_MODE=mock.",
    );
    this.name = "MissingApiKeyError";
  }
}

export type PlanResult = {
  plan: EditPlan;
  source: "claude" | "mock";
  model?: string;
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  ms: number;
  /** Message affiché dans l'UI quand le plan n'a pas été produit par Claude. */
  notice?: string;
};

function systemPrompt(preset: Preset): string {
  return `Tu es Director, le monteur de Frame. Tu transformes un brief, une banque d'assets et leurs transcriptions en un plan de montage structuré.

PRESET : ${preset.label} — ${preset.width}×${preset.height}, ${preset.fps} fps.
${preset.ruleset}

RÈGLES DE SORTIE (impératives) :
- Tu produis uniquement l'objet demandé par le schéma. Aucun texte hors schéma.
- Les fichiers "file" doivent venir EXACTEMENT de la liste d'assets fournie. Jamais d'invention, jamais de chemin absolu.
- La somme des durées doit tomber entre ${Math.round(preset.targetSeconds * 0.8)} et ${preset.targetSeconds} secondes.
- 6 à 8 plans. Durée par plan entre 2 et 4 secondes.
- Le premier plan porte un titre fort (max 8 mots). Il doit se comprendre sans son.
- Alterne les sources : ne réutilise pas le même plan deux fois de suite.
- Si la banque d'assets est insuffisante, utilise une source de type "color" avec un texte. N'invente jamais de fichier.
- Langue du texte incrusté : celle du brief (français par défaut).
- Aucun emoji, aucune promesse commerciale, aucun nom de marque inventé.

MONTAGE PARLÉ (quand une transcription est fournie) :
- Coupe sur les mots, jamais au milieu d'une phrase : le point d'entrée "in" d'un plan vidéo doit être le "start" d'un mot, et sa fin doit tomber sur la fin d'un mot.
- Supprime les hésitations et les silences : ne sélectionne que des passages qui ont du sens seuls.
- Garde le son d'origine (source.volume = 1) pour les plans dont on entend la voix, 0 pour les plans muets.
- Les sous-titres sont ancrés sur les mots : "fromWord" et "toWord" sont des index de la transcription de LA MÊME source que le plan.
- Un sous-titre dure 1,5 à 4 s, ne chevauche pas le suivant, et reprend les mots réellement prononcés (nettoyés : sans ponctuation finale, 9 mots maximum).
- Ne sous-titre jamais un plan sans parole (image, couleur, vidéo muette).`;
}

function userPrompt(
  brief: string,
  assets: Asset[],
  preset: Preset,
  transcripts: Map<string, Transcript>,
): string {
  const spoken = [...transcripts.values()].slice(0, 3);
  const transcriptBlock =
    spoken.length === 0
      ? "Aucune parole détectée dans les vidéos : n'utilise pas de sous-titres."
      : spoken
          .map(
            (t) =>
              `### ${t.file} · ${t.duration.toFixed(1)} s · ${t.words.length} mots\n` +
              `Format : index|début|mot\n${transcriptForPrompt(t)}`,
          )
          .join("\n\n");

  return `BRIEF UTILISATEUR
${brief.trim()}

ASSETS DISPONIBLES (chemins relatifs à test-assets/)
${describeAssets(assets)}

TRANSCRIPTIONS
${transcriptBlock}

CONTRAINTES
- Preset : ${preset.id} v${preset.version}
- Durée cible : ${preset.targetSeconds} s (max ${preset.maxSeconds} s)
- Zone sûre : ${preset.safe.top} px en haut, ${preset.safe.bottom} px en bas (l'UI Instagram masque le reste)`;
}

export async function createPlan(
  brief: string,
  presetId: string,
  transcripts: Map<string, Transcript> = new Map(),
): Promise<PlanResult> {
  const preset = getPreset(presetId);
  const assets = await listAssets();
  const startedAt = Date.now();
  const mode = process.env.FRAME_PLAN_MODE ?? "auto";
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (mode === "mock" || (!hasKey && mode !== "strict")) {
    return {
      plan: mockPlan(assets, preset, brief, transcripts),
      source: "mock",
      ms: Date.now() - startedAt,
      notice: hasKey
        ? "Plan de secours : FRAME_PLAN_MODE=mock."
        : "Plan de secours : aucune ANTHROPIC_API_KEY dans .env.local.",
    };
  }
  if (!hasKey) throw new MissingApiKeyError();

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { object, usage } = await generateObject({
    model: anthropic(PLAN_MODEL),
    schema: EditPlanSchema,
    system: systemPrompt(preset),
    prompt: userPrompt(brief, assets, preset, transcripts),
    temperature: 0.5,
    maxRetries: 2,
  });

  const plan = normalizePlan({ ...object, preset: preset.id });
  enforceGuardrails(plan, preset, assets);

  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  return {
    plan,
    source: "claude",
    model: PLAN_MODEL,
    usage: {
      inputTokens,
      outputTokens,
      costUsd: Number((inputTokens * PRICE_IN + outputTokens * PRICE_OUT).toFixed(5)),
    },
    ms: Date.now() - startedAt,
  };
}

/** Filet de sécurité : ce que le schéma ne peut pas exprimer (durée totale, fichiers inconnus). */
function enforceGuardrails(plan: EditPlan, preset: Preset, assets: Asset[]): void {
  const known = new Set(assets.map((a) => a.file));
  for (const scene of plan.scenes) {
    if (scene.source.type === "color") continue;
    if (!known.has(scene.source.file)) {
      throw new Error(
        `Le plan référence un fichier absent de test-assets/ : ${scene.source.file}. ` +
          `Assets connus : ${[...known].join(", ") || "(aucun)"}`,
      );
    }
  }
  if (plan.audio && !known.has(plan.audio.file)) {
    throw new Error(`Musique absente de test-assets/ : ${plan.audio.file}`);
  }
  const total = plan.scenes.reduce((sum, s) => sum + s.duration, 0);
  if (total > preset.maxSeconds + 0.01) {
    throw new Error(`Montage trop long : ${total.toFixed(1)} s pour un maximum de ${preset.maxSeconds} s.`);
  }
}

const CAPTION_MAX_WORDS = 5;

function chunkCaptions(
  words: Transcript["words"],
  fromIndex: number,
  toIndex: number,
  sceneId: string,
): EditPlan["captions"] {
  const captions: EditPlan["captions"] = [];
  let cursor = fromIndex;
  while (cursor <= toIndex) {
    const end = Math.min(cursor + CAPTION_MAX_WORDS - 1, toIndex);
    const text = words
      .slice(cursor, end + 1)
      .map((w) => w.text)
      .join(" ")
      .replace(/[.,;:!?]+$/g, "");
    if (text) captions.push({ sceneId, fromWord: cursor, toWord: end, text });
    cursor = end + 1;
  }
  return captions;
}

/** Plan de secours déterministe : référence visuelle quand l'API n'est pas disponible. */
export function mockPlan(
  assets: Asset[],
  preset: Preset,
  brief: string,
  transcripts: Map<string, Transcript> = new Map(),
): EditPlan {
  const spoken = [...transcripts.values()].find((t) => t.words.length >= 8);
  const visuals = assets.filter((a) => a.kind === "video" || a.kind === "image");
  const music = assets.find((a) => a.kind === "audio" && !a.file.includes("voix"));

  if (spoken) {
    const words = spoken.words;
    const sceneCount = 6;
    const slot = preset.targetSeconds / sceneCount;
    const captions: EditPlan["captions"] = [];
    const scenes = Array.from({ length: sceneCount }, (_, index) => {
      const slotStart = index * slot;
      const slotEnd = slotStart + slot;
      const firstWord = words.findIndex((w) => w.start >= slotStart);
      const from = firstWord === -1 ? 0 : firstWord;
      let last = from;
      while (last + 1 < words.length && words[last + 1].end <= slotEnd) last += 1;
      const inPoint = words[from]?.start ?? 0;
      const outPoint = words[last]?.end ?? inPoint + slot;
      const duration = Math.min(slot, Math.max(1.2, outPoint - inPoint + 0.15));

      captions.push(...chunkCaptions(words, from, last, `s${index + 1}`));

      return {
        id: `s${index + 1}`,
        duration: Number(duration.toFixed(2)),
        source: { type: "video" as const, file: spoken.file, in: Number(inPoint.toFixed(2)), volume: 1 },
        motion: index % 2 === 0 ? ("zoom-in" as const) : ("none" as const),
        transition: "fade" as const,
        kicker: index === 0 ? "Test" : null,
        title: index === 0 ? "Montage parlé, sous-titré" : null,
        subtitle: index === 0 ? (brief.slice(0, 70) || null) : null,
      };
    });

    return normalizePlan({
      version: "1",
      preset: preset.id,
      title: "Test local — plan de secours (parole)",
      scenes,
      captions,
      audio: music ? { file: music.file, volume: 0.18, fadeOut: 1.5 } : null,
    });
  }

  const beats = [
    { kicker: "Test", title: "Un montage sans timeline", subtitle: brief.slice(0, 70) || "Brief vide" },
    { kicker: "Plan 2", title: "Le texte porte le sens", subtitle: null },
    { kicker: "Plan 3", title: "Coupes franches", subtitle: null },
    { kicker: "Plan 4", title: "Un seul geste par plan", subtitle: null },
    { kicker: "Plan 5", title: "Sous-titres lisibles", subtitle: null },
    { kicker: "Fin", title: "Rendu déterministe", subtitle: "HTML → MP4" },
  ] as const;

  const scenes = beats.map((beat, index) => {
    const asset = visuals.length > 0 ? visuals[index % visuals.length] : null;
    const source = asset
      ? asset.kind === "video"
        ? ({ type: "video", file: asset.file, in: 0, volume: 0 } as const)
        : ({ type: "image", file: asset.file, fit: "cover" } as const)
      : ({ type: "color", value: index % 2 === 0 ? "#18181B" : "#0F0F11" } as const);

    return {
      id: `s${index + 1}`,
      duration: 4,
      source,
      motion: index % 2 === 0 ? ("zoom-in" as const) : ("pan-left" as const),
      transition: "fade" as const,
      kicker: beat.kicker,
      title: beat.title,
      subtitle: beat.subtitle,
    };
  });

  return normalizePlan({
    version: "1",
    preset: preset.id,
    title: "Test local — plan de secours",
    scenes,
    captions: [],
    audio: music ? { file: music.file, volume: 0.3, fadeOut: 1.5 } : null,
  });
}
