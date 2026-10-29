/**
 * Presets de style, versionnés.
 * Un preset = format + règles de montage + direction artistique + consignes du Director.
 * Changer un preset sans bumper sa version invalide les rendus déjà produits.
 *
 * Les règles de montage (`edit`) appartiennent au preset : l'utilisateur choisit un style,
 * pas une liste d'options. Tout est déterministe sauf l'accroche et les mots-clés (Director).
 */

export type CaptionLook = {
  /** karaoke : mot par mot, mot actif surligné · line : phrase posée sur un bandeau. */
  style: "karaoke" | "line";
  maxWords: number;
  maxChars: number;
  /** Position verticale du haut du bloc, en fraction de la hauteur. */
  top: number;
  uppercase: boolean;
  /** Taille du texte, en px dans le canvas du preset. */
  size: number;
};

export type EditRules = {
  /** Coupe les silences plus longs que `silenceGap` secondes (jump cuts). */
  cutSilences: boolean;
  silenceGap: number;
  /** Durée max d'un plan avant un changement de cadrage (sans retirer de temps). */
  maxShot: number;
  /** Punch-in alterné à chaque coupe (échelle), ou null pour garder le cadre. */
  punchIn: number | null;
  /** Poussée lente sur chaque plan (ajout d'échelle sur la durée du plan). */
  push: number;
  /** Titre d'accroche au début : badge (bloc blanc incliné) ou title (texte posé), ou rien. */
  hook: "badge" | "title" | null;
  /** Nombre max de mots-clés surlignés ; 0 = aucun. Un au plus toutes les 4 s. */
  keywords: number;
  /** Position verticale des mots-clés, en fraction de la hauteur (sous les visages). */
  keywordTop: number;
  /** Light leak sur les coupes. */
  leak: boolean;
  progressBar: boolean;
  sfx: { cut: boolean; hook: boolean; keyword: boolean };
  captions: CaptionLook;
};

export type Preset = {
  id: string;
  version: string;
  label: string;
  /** Une ligne, affichée dans le sélecteur de style. */
  tagline: string;
  width: number;
  height: number;
  fps: number;
  /** Durée cible et borne haute, en secondes (mode montage multi-assets). */
  targetSeconds: number;
  maxSeconds: number;
  /** Marges de sécurité pour l'UI des plateformes (px, dans le canvas du preset). */
  safe: { top: number; bottom: number; left: number; right: number };
  /** Règles injectées dans le prompt système. */
  ruleset: string;
  /** Consigne éditoriale du Director (accroche + mots-clés) pour ce style. */
  director: string;
  typography: {
    kickerSize: number;
    titleSize: number;
    subtitleSize: number;
    captionSize: number;
    family: string;
  };
  palette: { ink: string; muted: string; accent: string; scrim: string };
  edit: EditRules;
};

const FAMILY = '"Inter", "Segoe UI", system-ui, sans-serif';

export const PRESETS: Record<string, Preset> = {
  instagram: {
    id: "instagram",
    version: "1.1.0",
    label: "Instagram / Reels",
    tagline: "9:16 · jump cuts, sous-titres mot par mot, mots-clés, sons",
    width: 1080,
    height: 1920,
    fps: 30,
    targetSeconds: 24,
    maxSeconds: 30,
    safe: { top: 250, bottom: 250, left: 64, right: 64 },
    ruleset: `Format vertical 9:16, pensé pour un visionnage sans son.
- Chaque plan doit tenir debout muet : le texte porte le sens.
- 6 à 8 plans pour ~24 s. Plans de 2 à 4 s. Jamais plus de 4 s sur un même plan.
- Le premier plan doit accrocher en moins d'une seconde : question, contraste ou geste.
- Les sources vidéo sont souvent horizontales : privilégier les plans larges ou centrés, éviter de couper un visage sur les bords.
- Sous-titres courts (6–9 mots max), 2 lignes maximum, dans la zone sûre.
- Pas d'effets gratuits : une seule intention par plan (zoom lent, pan lent, ou rien).`,
    director: "Reel vertical rythmé. Accroche courte et intrigante (question ou affirmation forte). Mots-clés : mots forts, chiffres, émotions.",
    typography: { kickerSize: 34, titleSize: 84, subtitleSize: 40, captionSize: 54, family: FAMILY },
    palette: { ink: "#FAFAFA", muted: "#D4D4D8", accent: "#FFE14D", scrim: "rgba(10,10,10,0.80)" },
    edit: {
      cutSilences: true,
      silenceGap: 0.35,
      maxShot: 4.5,
      punchIn: 1.12,
      push: 0.03,
      hook: "badge",
      keywords: 6,
      keywordTop: 0.47,
      leak: true,
      progressBar: true,
      sfx: { cut: true, hook: true, keyword: true },
      captions: { style: "karaoke", maxWords: 3, maxChars: 18, top: 0.62, uppercase: true, size: 73 },
    },
  },
  gaming: {
    id: "gaming",
    version: "1.0.0",
    label: "Gaming",
    tagline: "16:9 · coupes serrées, punch-in forts, néon, sons appuyés",
    width: 1920,
    height: 1080,
    fps: 30,
    targetSeconds: 45,
    maxSeconds: 60,
    safe: { top: 60, bottom: 70, left: 96, right: 96 },
    ruleset: `Format 16:9, énergie haute. Coupes serrées, réactions mises en avant, pas de temps mort.`,
    director: "Vidéo gaming nerveuse. Accroche en 2 à 4 mots, punchy, en majuscules d'esprit. Mots-clés : réactions, exclamations, chiffres, noms de jeu.",
    typography: { kickerSize: 30, titleSize: 96, subtitleSize: 40, captionSize: 52, family: FAMILY },
    palette: { ink: "#FAFAFA", muted: "#D4D4D8", accent: "#7CFF4F", scrim: "rgba(10,10,10,0.80)" },
    edit: {
      cutSilences: true,
      silenceGap: 0.25,
      maxShot: 3.5,
      punchIn: 1.18,
      push: 0.04,
      hook: "badge",
      keywords: 8,
      keywordTop: 0.14,
      leak: true,
      progressBar: false,
      sfx: { cut: true, hook: true, keyword: true },
      captions: { style: "karaoke", maxWords: 3, maxChars: 20, top: 0.74, uppercase: true, size: 70 },
    },
  },
  explainer: {
    id: "explainer",
    version: "1.0.0",
    label: "Explicatif",
    tagline: "16:9 · rythme posé, mots-clés surlignés, sous-titres lisibles",
    width: 1920,
    height: 1080,
    fps: 30,
    targetSeconds: 60,
    maxSeconds: 120,
    safe: { top: 60, bottom: 70, left: 96, right: 96 },
    ruleset: `Format 16:9, pédagogique. Une idée par plan, le texte souligne les notions clés sans distraire.`,
    director: "Vidéo explicative claire. Accroche = la question à laquelle la vidéo répond (4 à 7 mots). Mots-clés : notions, termes techniques, chiffres.",
    typography: { kickerSize: 30, titleSize: 76, subtitleSize: 38, captionSize: 46, family: FAMILY },
    palette: { ink: "#FAFAFA", muted: "#D4D4D8", accent: "#60A5FA", scrim: "rgba(10,10,10,0.80)" },
    edit: {
      cutSilences: true,
      silenceGap: 0.5,
      maxShot: 6,
      punchIn: 1.06,
      push: 0.02,
      hook: "title",
      keywords: 5,
      keywordTop: 0.12,
      leak: false,
      progressBar: true,
      sfx: { cut: false, hook: false, keyword: true },
      captions: { style: "karaoke", maxWords: 6, maxChars: 40, top: 0.8, uppercase: false, size: 52 },
    },
  },
  documentary: {
    id: "documentary",
    version: "1.0.0",
    label: "Documentaire",
    tagline: "16:9 · respirations gardées, cadre stable, sous-titres sobres",
    width: 1920,
    height: 1080,
    fps: 25,
    targetSeconds: 90,
    maxSeconds: 180,
    safe: { top: 60, bottom: 70, left: 120, right: 120 },
    ruleset: `Format 16:9, sobre. On laisse respirer la parole, pas d'effets, sous-titres de lecture.`,
    director: "Documentaire sobre. Accroche = un titre de sujet factuel (3 à 6 mots), sans effet d'annonce. Pas de mots-clés.",
    typography: { kickerSize: 28, titleSize: 64, subtitleSize: 34, captionSize: 42, family: FAMILY },
    palette: { ink: "#FAFAFA", muted: "#D4D4D8", accent: "#E7E5E4", scrim: "rgba(10,10,10,0.72)" },
    edit: {
      cutSilences: true,
      silenceGap: 1.2,
      maxShot: 12,
      punchIn: null,
      push: 0.02,
      hook: "title",
      keywords: 0,
      keywordTop: 0.14,
      leak: false,
      progressBar: false,
      sfx: { cut: false, hook: false, keyword: false },
      captions: { style: "line", maxWords: 9, maxChars: 48, top: 0.84, uppercase: false, size: 42 },
    },
  },
};

export function getPreset(id: string): Preset {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`Preset inconnu : ${id}`);
  return preset;
}

export const DEFAULT_PRESET = "instagram";
