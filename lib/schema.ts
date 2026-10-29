import { z } from "zod";

/**
 * EditPlan — le seul format que l'agent a le droit de produire.
 * Tout ce qui n'est pas décrit ici est refusé à la validation.
 * Le rendu ne lit jamais de HTML libre : il compile ce JSON.
 *
 * v1 : pas de keyframes libres, pas de transitions exotiques, pas de texte riche.
 * Les timings de scène sont *déduits* (somme des durées) pour éviter les erreurs d'arithmétique du modèle.
 */

const VideoSource = z.object({
  type: z.literal("video"),
  /** Chemin relatif à test-assets/, ex. "video/plage.mp4" */
  file: z.string().min(1),
  /** Point d'entrée dans la source, en secondes. */
  in: z.number().min(0).max(600).default(0),
  /** Volume du son d'origine. 0 = muet (défaut). */
  volume: z.number().min(0).max(1).default(0),
});

const ImageSource = z.object({
  type: z.literal("image"),
  file: z.string().min(1),
  fit: z.enum(["cover", "contain"]).default("cover"),
});

const ColorSource = z.object({
  type: z.literal("color"),
  /** Couleur CSS hexadécimale. */
  value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const SceneSourceSchema = z.discriminatedUnion("type", [
  VideoSource,
  ImageSource,
  ColorSource,
]);

export const SceneSchema = z.object({
  id: z.string().min(1).max(40),
  /** Durée du plan, en secondes. */
  duration: z.number().min(0.6).max(12),
  source: SceneSourceSchema,
  motion: z.enum(["none", "zoom-in", "zoom-out", "pan-left", "pan-right"]).default("zoom-in"),
  transition: z.enum(["cut", "fade"]).default("fade"),
  /** Surtitre, 2–4 mots, optionnel. */
  kicker: z.string().max(60).nullable().default(null),
  /** Titre principal du plan, optionnel. */
  title: z.string().max(90).nullable().default(null),
  /** Ligne secondaire, optionnel. */
  subtitle: z.string().max(120).nullable().default(null),
});

export const CaptionSchema = z.object({
  /** Plan sur lequel le sous-titre s'affiche. */
  sceneId: z.string().min(1).max(40),
  /** Premier mot (index dans la transcription de la source du plan). */
  fromWord: z.number().int().min(0).max(5000),
  /** Dernier mot inclus. */
  toWord: z.number().int().min(0).max(5000),
  /** Texte affiché, nettoyé (sans ponctuation finale, 9 mots max). */
  text: z.string().min(1).max(90),
});

export const AudioSchema = z.object({
  /** Chemin relatif à test-assets/, ex. "audio/musique.mp3" */
  file: z.string().min(1),
  volume: z.number().min(0).max(1).default(0.35),
  fadeOut: z.number().min(0).max(10).default(1.5),
});

export const EditPlanSchema = z.object({
  version: z.literal("1"),
  preset: z.string().min(1),
  /** Titre interne du montage (non incrusté à l'image). */
  title: z.string().min(1).max(120),
  scenes: z.array(SceneSchema).min(1).max(12),
  captions: z.array(CaptionSchema).max(30).default([]),
  audio: AudioSchema.nullable().default(null),
});

export type EditPlan = z.infer<typeof EditPlanSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneSource = z.infer<typeof SceneSourceSchema>;

export function totalDuration(plan: EditPlan): number {
  return plan.scenes.reduce((sum, s) => sum + s.duration, 0);
}

/** Les sous-titres doivent référencer un plan existant, avec une plage de mots cohérente. */
export function normalizePlan(plan: EditPlan): EditPlan {
  const ids = new Set(plan.scenes.map((s) => s.id));
  return {
    ...plan,
    captions: plan.captions.filter(
      (c) => ids.has(c.sceneId) && c.toWord >= c.fromWord && c.text.trim().length > 0,
    ),
  };
}
