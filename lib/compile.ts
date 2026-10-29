import type { EditPlan, Scene } from "./schema";
import { totalDuration } from "./schema";
import type { Preset } from "./presets";
import { toPages, type Caption } from "./captions";
import type { Word } from "./transcribe";

/**
 * Compilateur déterministe EditPlan -> HTML HyperFrames.
 *
 * Contraintes :
 * - aucun HTML fourni par le modèle, uniquement des valeurs validées par Zod ;
 * - les timings sont calculés ici, jamais par l'agent ;
 * - pas de CDN : GSAP est copié à côté du rendu (Cloud Run est hors ligne) ;
 * - une seule timeline nommée "main", en pause, seek(0) au chargement.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const FADE = 0.28;

function sceneStartTimes(plan: EditPlan): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const scene of plan.scenes) {
    starts.push(Number(cursor.toFixed(3)));
    cursor += scene.duration;
  }
  return starts;
}

function motionFor(scene: Scene): { from: gsapVars; to: gsapVars } {
  const overscan = 1.12;
  switch (scene.motion) {
    case "zoom-in":
      return { from: { scale: 1.0 }, to: { scale: 1.08 } };
    case "zoom-out":
      return { from: { scale: 1.08 }, to: { scale: 1.0 } };
    case "pan-left":
      return { from: { scale: overscan, xPercent: 3 }, to: { scale: overscan, xPercent: -3 } };
    case "pan-right":
      return { from: { scale: overscan, xPercent: -3 }, to: { scale: overscan, xPercent: 3 } };
    default:
      return { from: {}, to: {} };
  }
}

type gsapVars = Record<string, number | string>;

/**
 * Le média est le clip minuté (data-start/duration sur l'élément lui-même) ; son conteneur
 * .media n'est pas minuté et porte les zooms. Règle HyperFrames : minuter le média OU son
 * conteneur, jamais un média sans data-start dans un conteneur minuté (il serait joué à 0 s).
 */
function mediaMarkup(scene: Scene, start: number, index: number, fill: "cover" | "blur" = "cover"): string {
  const common = `inset:0;width:100%;height:100%;position:absolute;`;
  const id = escapeHtml(scene.id);
  const timing = `data-start="${start}" data-duration="${scene.duration}" data-track-index="${index}"`;
  switch (scene.source.type) {
    case "video": {
      const muted = scene.source.volume <= 0;
      if (fill === "blur") {
        // Ratio trop différent du format : copie floutée et muette en fond, source entière devant.
        return `<video id="vb-${id}" class="clip" src="assets/${escapeHtml(scene.source.file)}" ${timing}
        data-media-start="${scene.source.in}" muted playsinline preload="auto"
        style="${common}object-fit:cover;filter:blur(48px) brightness(.55);transform:scale(1.15);"></video>
      <video id="v-${id}" class="clip" src="assets/${escapeHtml(scene.source.file)}" ${timing}
        data-media-start="${scene.source.in}"
        ${muted ? "muted" : `data-has-audio="true" data-volume="${scene.source.volume}"`}
        playsinline preload="auto"
        style="${common}object-fit:contain;"></video>`;
      }
      return `<video id="v-${id}" class="clip" src="assets/${escapeHtml(scene.source.file)}" ${timing}
        data-media-start="${scene.source.in}"
        ${muted ? "muted" : `data-has-audio="true" data-volume="${scene.source.volume}"`}
        playsinline preload="auto"
        style="${common}object-fit:cover;"></video>`;
    }
    case "image":
      return `<img id="v-${id}" class="clip" src="assets/${escapeHtml(scene.source.file)}" alt="" ${timing}
        style="${common}object-fit:${scene.source.fit};" />`;
    case "color":
      return `<div id="v-${id}" class="clip" ${timing} style="${common}background:${escapeHtml(scene.source.value)};"></div>`;
  }
}

function overlayMarkup(scene: Scene, preset: Preset, start: number): string {
  const { kicker, title, subtitle } = scene;
  if (!kicker && !title && !subtitle) return "";
  const t = preset.typography;
  const parts: string[] = [];
  if (kicker) parts.push(`<div class="kick">${escapeHtml(kicker)}</div>`);
  if (title) parts.push(`<h2 class="ttl">${escapeHtml(title)}</h2>`);
  if (subtitle) parts.push(`<p class="sub">${escapeHtml(subtitle)}</p>`);
  return `<div class="overlay clip" data-start="${start}" data-duration="${scene.duration}" data-track-index="50" style="font-size:${t.titleSize}px;">
      <div class="overlay-inner" style="padding:0 ${preset.safe.left}px;">${parts.join("")}</div>
    </div>`;
}

function styleBlock(preset: Preset): string {
  const { width, height, safe, typography, palette } = preset;
  return `
    :root {
      --ink: ${palette.ink};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --scrim: ${palette.scrim};
      --safe-x: ${safe.left}px;
      --safe-top: ${safe.top}px;
      --safe-bottom: ${safe.bottom}px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px; height: ${height}px;
      overflow: hidden; background: #000;
      font-family: ${typography.family};
      -webkit-font-smoothing: antialiased;
    }
    #stage { position: absolute; inset: 0; overflow: hidden; background: #000; }
    .scene { position: absolute; inset: 0; overflow: hidden; }
    .scene .media { position: absolute; inset: 0; overflow: hidden; transform-origin: center center; will-change: transform; }
    .vignette {
      position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 52%, rgba(0,0,0,.72) 100%);
    }
    .overlay { position: absolute; left: 0; right: 0; bottom: ${Math.round(height * 0.36)}px; }
    .kick {
      display: inline-block;
      color: var(--accent);
      font-size: ${typography.kickerSize}px;
      font-weight: 700;
      letter-spacing: .18em;
      text-transform: uppercase;
      margin-bottom: ${Math.round(typography.titleSize * 0.28)}px;
    }
    .ttl {
      color: var(--ink);
      font-size: ${typography.titleSize}px;
      line-height: 1.02;
      letter-spacing: -.03em;
      font-weight: 800;
      max-width: ${width - safe.left * 2}px;
    }
    .sub {
      color: var(--muted);
      font-size: ${typography.subtitleSize}px;
      line-height: 1.3;
      margin-top: ${Math.round(typography.titleSize * 0.22)}px;
      max-width: ${width - safe.left * 2}px;
    }
    .caption {
      position: absolute; left: var(--safe-x); right: var(--safe-x);
      bottom: ${safe.bottom + 60}px;
      display: flex;
    }
    .caption span {
      background: var(--scrim);
      border-left: 6px solid var(--accent);
      border-radius: 10px;
      padding: 20px 26px;
      color: var(--ink);
      font-size: ${typography.captionSize}px;
      font-weight: 700;
      line-height: 1.22;
      letter-spacing: -.01em;
      backdrop-filter: blur(6px);
    }
  `;
}

/**
 * Un son rattaché à l'élément qui le provoque (règle Remotion : grouper le visuel et son son).
 * `offset` est relatif au début de l'élément ; `duration` est la durée naturelle du fichier.
 */
export type FxSound = { path: string; offset: number; duration: number; volume: number };

/**
 * Effets du mode Reel, calculés côté serveur (lib/reel.ts) à partir des timings de parole.
 * Temps en secondes sur la timeline de sortie, sauf les sous-titres (temps de la source, en ms).
 */
export type ReelFx = {
  /**
   * Un groupe par plan : cadrage + sous-titres, sur la même frontière de temps.
   * Les `Caption` gardent les timestamps de la source, comme sous un <Sequence trimBefore>.
   */
  shots: Array<{ sceneId: string; zoom: { from: number; to: number } | null; captions: Caption[] }>;
  /** cover : source recadrée · blur : source entière sur un fond flouté (ratio trop différent). */
  fill: "cover" | "blur";
  /** Titre d'accroche au début : badge (bloc blanc incliné) ou title (texte posé). */
  hook: { text: string; style: "badge" | "title"; start: number; end: number; sound: FxSound | null } | null;
  /** Mots-clés surlignés qui surgissent au centre quand ils sont prononcés. */
  pops: Array<{ text: string; start: number; duration: number; sound: FxSound | null }>;
  /** Overlays posés sur les coupes (light leak) : ils ne raccourcissent pas la timeline. */
  cuts: Array<{ at: number; leak: boolean; sound: FxSound | null }>;
  progressBar: boolean;
};

export function sfxPublicPath(absolute: string): string {
  return `sfx/${absolute.split(/[\\/]/).pop()}`;
}

/** Entrée sans rebond : équivalent GSAP de Easing.bezier(0.16, 1, 0.3, 1). */
const EASE_IN = "expo.out";
const EASE_OUT = "power2.in";

const LEAK_DURATION = 0.55;

function fxStyle(preset: Preset): string {
  const { height, safe, typography, palette, edit } = preset;
  const look = edit.captions;
  const accent = palette.accent;
  const stroke = Math.max(6, Math.round(look.size * 0.16));
  return `
    .reel-caption {
      position: absolute; left: var(--safe-x); right: var(--safe-x);
      top: ${Math.round(height * look.top)}px;
      z-index: 18;
    }
    .reel-caption .page {
      display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start;
      gap: 0 ${Math.round(look.size * 0.3)}px;
      text-align: center;
    }
    .reel-caption .w {
      display: inline-block;
      color: #FFFFFF;
      font-size: ${look.size}px;
      font-weight: 900; line-height: 1.14; letter-spacing: -.01em;
      ${look.uppercase ? "text-transform: uppercase;" : ""}
      -webkit-text-stroke: ${stroke}px #000; paint-order: stroke fill;
      text-shadow: 0 6px 18px rgba(0,0,0,.55);
      transform-origin: center 60%;
    }
    .line-caption {
      position: absolute; left: var(--safe-x); right: var(--safe-x);
      top: ${Math.round(height * look.top)}px;
      display: flex; justify-content: center;
      z-index: 18;
    }
    .line-caption span {
      display: inline-block; max-width: 100%;
      background: ${palette.scrim};
      border-radius: 10px;
      padding: ${Math.round(look.size * 0.28)}px ${Math.round(look.size * 0.5)}px;
      color: ${palette.ink};
      font-size: ${look.size}px; font-weight: 600; line-height: 1.3;
      text-align: center;
    }
    .fx-hook {
      position: absolute; left: var(--safe-x); right: var(--safe-x);
      top: ${safe.top + 40}px;
      display: flex; justify-content: center;
      z-index: 20;
    }
    .fx-hook.badge span {
      display: inline-block;
      background: #FFFFFF; color: #0A0A0A;
      font-size: ${Math.round(typography.titleSize * 0.82)}px;
      font-weight: 900; line-height: 1.08; letter-spacing: -.02em;
      text-transform: uppercase; text-align: center;
      padding: 18px 30px 22px; border-radius: 18px;
      box-shadow: 0 18px 50px rgba(0,0,0,.45);
    }
    .fx-hook.title { justify-content: flex-start; }
    .fx-hook.title span {
      display: inline-block;
      color: ${palette.ink};
      font-size: ${typography.titleSize}px;
      font-weight: 800; line-height: 1.05; letter-spacing: -.03em;
      text-shadow: 0 4px 30px rgba(0,0,0,.7);
      border-left: 8px solid ${accent}; padding-left: 28px;
    }
    .fx-pop {
      position: absolute; left: 0; right: 0;
      top: ${Math.round(height * edit.keywordTop)}px;
      display: flex; justify-content: center;
      z-index: 15;
    }
    .fx-pop .inner { position: relative; display: inline-block; padding: 6px 34px 14px; }
    .fx-pop .mark {
      position: absolute; left: 0; right: 0; top: 14%; bottom: 6%;
      background: ${accent};
      border-radius: 14px 22px 12px 26px / 20px 12px 24px 14px;
      transform-origin: left center;
      box-shadow: 0 16px 40px rgba(0,0,0,.45);
    }
    .fx-pop .txt {
      position: relative; display: inline-block;
      color: #0A0A0A;
      font-size: ${Math.round(typography.titleSize * 1.4)}px;
      font-weight: 900; line-height: 1; letter-spacing: -.03em;
      text-transform: uppercase;
    }
    .fx-flash { position: absolute; inset: 0; background: #FFFFFF; opacity: 0; pointer-events: none; z-index: 30; }
    .fx-leak-host { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 12; mix-blend-mode: screen; }
    .fx-leak { position: absolute; inset: -20%; opacity: 0; }
    .fx-leak.a { background: radial-gradient(circle at 35% 40%, rgba(255,176,84,.95), rgba(255,92,64,.55) 30%, rgba(255,92,64,0) 60%); }
    .fx-leak.b { background: radial-gradient(circle at 65% 55%, rgba(255,214,120,.9), rgba(236,72,153,.5) 32%, rgba(236,72,153,0) 62%); }
    .fx-progress-host { position: absolute; left: 0; top: 0; height: ${Math.max(8, Math.round(height / 160))}px; width: 100%; z-index: 25; }
    .fx-progress { width: 100%; height: 100%; background: ${accent}; transform-origin: left center; }
  `;
}

/** Retire la ponctuation faible en fin de mot ; garde ? et ! qui portent le ton. */
function cleanWord(text: string): string {
  return text.trim().replace(/[.,;:…]+$/u, "");
}

type Page = { start: number; end: number; words: Array<{ text: string; start: number; end: number }> };

/** Pages de sous-titres d'un plan, converties du temps source au temps de sortie. */
function shotPages(captions: Caption[], scene: { start: number; duration: number; in: number }): Page[] {
  const offset = scene.start - scene.in;
  const sceneEnd = scene.start + scene.duration;
  return toPages(captions)
    .map((page) => {
      const words = page
        .map((c) => ({
          text: cleanWord(c.text),
          start: Math.max(scene.start, c.startMs / 1000 + offset),
          end: Math.min(sceneEnd, c.endMs / 1000 + offset),
        }))
        .filter((w) => w.text.length > 0 && w.end > w.start);
      return words.length === 0 ? null : { start: words[0].start, end: words[words.length - 1].end, words };
    })
    .filter((page): page is Page => page !== null);
}

/** Une page reste affichée jusqu'à la suivante si le silence est court (évite le clignotement). */
function holdPages(pages: Page[], sceneEnd: number): Page[] {
  for (let i = 0; i < pages.length; i += 1) {
    const nextStart = pages[i + 1]?.start ?? sceneEnd;
    const gap = nextStart - pages[i].end;
    if (gap > 0 && gap < 0.6) pages[i].end = nextStart;
    if (pages[i].end > nextStart) pages[i].end = nextStart;
  }
  return pages.filter((p) => p.end - p.start >= 0.1);
}

function soundTag(id: string, sound: FxSound, at: number): string {
  const start = Math.max(0, at + sound.offset);
  return `<audio id="${id}" src="${escapeHtml(sfxPublicPath(sound.path))}" data-start="${start.toFixed(3)}" data-duration="${sound.duration.toFixed(3)}" data-volume="${sound.volume}" preload="auto"></audio>`;
}

function fxMarkup(
  fx: ReelFx,
  preset: Preset,
  duration: number,
  scenes: Map<string, { start: number; duration: number; in: number }>,
): { html: string; audio: string; timeline: string[]; captionCount: number } {
  const r = (n: number) => Number(n.toFixed(3));
  const accent = preset.palette.accent;
  const karaoke = preset.edit.captions.style === "karaoke";
  const html: string[] = [];
  const audio: string[] = [];
  const timeline: string[] = [];
  let captionCount = 0;

  for (const shot of fx.shots) {
    const scene = scenes.get(shot.sceneId);
    if (!scene) continue;
    const sid = escapeHtml(shot.sceneId);

    if (shot.zoom) {
      // Punch-in : la poussée lente est interpolée en échelle perceptuelle.
      timeline.push(
        `pscale("#scene-${sid} .media", ${shot.zoom.from}, ${shot.zoom.to}, ${r(scene.duration)}, "none", ${r(scene.start)});`,
      );
    }

    holdPages(shotPages(shot.captions, scene), scene.start + scene.duration).forEach((page, p) => {
      const id = `cg-${sid}-${p}`;
      captionCount += 1;
      if (!karaoke) {
        // Sous-titre de lecture : la phrase entière, posée sur un bandeau, en fondu.
        html.push(
          `<div class="line-caption clip" data-shot="${sid}" data-start="${r(page.start)}" data-duration="${r(page.end - page.start)}" data-track-index="100"><span id="${id}">${escapeHtml(page.words.map((w) => w.text).join(" "))}</span></div>`,
        );
        timeline.push(`tl.fromTo("#${id}", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "${EASE_IN}" }, ${r(page.start)});`);
        return;
      }
      const words = page.words
        .map((w, j) => `<span class="w" id="${id}-${j}">${escapeHtml(w.text)}</span>`)
        .join("");
      html.push(
        `<div class="reel-caption clip" data-shot="${sid}" data-start="${r(page.start)}" data-duration="${r(page.end - page.start)}" data-track-index="100"><div class="page" id="${id}">${words}</div></div>`,
      );
      timeline.push(
        `tl.fromTo("#${id}", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "${EASE_IN}" }, ${r(page.start)});`,
        `pscale("#${id}", 0.82, 1, 0.22, "${EASE_IN}", ${r(page.start)});`,
      );
      page.words.forEach((w, j) => {
        const sel = `#${id}-${j}`;
        timeline.push(`tl.to("${sel}", { color: "${accent}", scale: 1.05, duration: 0.08, ease: "${EASE_IN}" }, ${r(w.start)});`);
        const next = page.words[j + 1];
        if (next) {
          timeline.push(
            `tl.to("${sel}", { color: "#FFFFFF", scale: 1, duration: 0.06, ease: "${EASE_OUT}" }, ${r(Math.max(w.start + 0.08, next.start - 0.06))});`,
          );
        }
      });
    });
  }

  fx.cuts.forEach((cut, i) => {
    if (cut.leak) {
      // Overlay centré sur la coupe, comme un <TransitionSeries.Overlay> : la timeline ne raccourcit pas.
      const start = Math.max(0, cut.at - LEAK_DURATION / 2);
      const [from, to] = i % 2 === 0 ? [-12, 10] : [12, -10];
      const half = LEAK_DURATION / 2;
      html.push(
        `<div class="fx-leak-host clip" data-start="${r(start)}" data-duration="${LEAK_DURATION}" data-track-index="200"><div class="fx-leak ${i % 2 === 0 ? "a" : "b"}" id="fx-leak-${i}"></div></div>`,
      );
      timeline.push(
        `tl.fromTo("#fx-leak-${i}", { xPercent: ${from} }, { xPercent: ${to}, duration: ${LEAK_DURATION}, ease: "none" }, ${r(start)});`,
        `tl.fromTo("#fx-leak-${i}", { opacity: 0 }, { opacity: 0.6, duration: ${half}, ease: "sine.out" }, ${r(start)});`,
        `tl.to("#fx-leak-${i}", { opacity: 0, duration: ${half}, ease: "sine.in" }, ${r(start + half)});`,
      );
    }
    if (cut.sound) audio.push(soundTag(`sfx-cut-${i}`, cut.sound, cut.at));
  });

  if (fx.hook) {
    const { text, style, start, end, sound } = fx.hook;
    html.push(
      `<div class="fx-hook ${style} clip" id="fx-hook" data-start="${r(start)}" data-duration="${r(end - start)}" data-track-index="300"><span>${escapeHtml(text)}</span></div>`,
    );
    timeline.push(
      `tl.set("#fx-hook span", { rotation: ${style === "badge" ? -2 : 0} }, 0);`,
      `tl.fromTo("#fx-hook span", { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "${EASE_IN}" }, ${r(start + 0.05)});`,
      `pscale("#fx-hook span", 0.85, 1, 0.45, "${EASE_IN}", ${r(start + 0.05)});`,
      `tl.to("#fx-hook span", { y: -30, opacity: 0, duration: 0.25, ease: "${EASE_OUT}" }, ${r(Math.max(start + 0.5, end - 0.25))});`,
    );
    if (sound) audio.push(soundTag("sfx-hook", sound, start + 0.05));
  }

  fx.pops.forEach((pop, i) => {
    html.push(
      `<div class="fx-pop clip" id="fx-pop-${i}" data-start="${r(pop.start)}" data-duration="${r(pop.duration)}" data-track-index="${310 + i}"><span class="inner"><span class="mark"></span><span class="txt">${escapeHtml(pop.text)}</span></span></div>`,
      `<div class="fx-flash clip" id="fx-flash-${i}" data-start="${r(pop.start)}" data-duration="0.25" data-track-index="${360 + i}"></div>`,
    );
    const tilt = i % 2 === 0 ? -3 : 3;
    timeline.push(
      `pscale("#fx-pop-${i} .inner", 0.55, 1, 0.32, "${EASE_IN}", ${r(pop.start)});`,
      `tl.fromTo("#fx-pop-${i} .inner", { opacity: 0, rotation: ${-tilt} }, { opacity: 1, rotation: ${tilt}, duration: 0.32, ease: "${EASE_IN}" }, ${r(pop.start)});`,
      // Surligneur qui se dessine derrière le mot (progress 0 → 1), à la rough-notation.
      `tl.fromTo("#fx-pop-${i} .mark", { scaleX: 0, rotation: -2 }, { scaleX: 1, rotation: -2, duration: 0.3, ease: "${EASE_IN}" }, ${r(pop.start + 0.04)});`,
      `tl.to("#fx-pop-${i} .inner", { opacity: 0, y: -24, duration: 0.2, ease: "${EASE_OUT}" }, ${r(pop.start + pop.duration - 0.2)});`,
      `tl.fromTo("#fx-flash-${i}", { opacity: 0.32 }, { opacity: 0, duration: 0.22, ease: "power1.out" }, ${r(pop.start)});`,
    );
    if (pop.sound) audio.push(soundTag(`sfx-pop-${i}`, pop.sound, pop.start));
  });

  if (fx.progressBar) {
    html.push(
      `<div class="fx-progress-host clip" data-start="0" data-duration="${r(duration)}" data-track-index="390"><div class="fx-progress" id="fx-progress"></div></div>`,
    );
    timeline.push(`tl.fromTo("#fx-progress", { scaleX: 0 }, { scaleX: 1, duration: ${r(duration)}, ease: "none" }, 0);`);
  }

  return { html: html.join("\n"), audio: audio.join("\n    "), timeline, captionCount };
}

/**
 * Interpolation d'échelle perceptuelle (cf. Remotion `output: "perceptual-scale"`) :
 * une interpolation linéaire de scale paraît ralentir quand l'objet grossit ; on interpole
 * donc en log, scale = from × (to / from)^t. Le proxy est rejoué à chaque seek.
 */
const PSCALE_HELPER = `
      function pscale(sel, from, to, duration, ease, at) {
        const p = { t: 0 };
        const apply = () => gsap.set(sel, { scale: from * Math.pow(to / from, p.t) });
        tl.fromTo(p, { t: 0 }, { t: 1, duration, ease, immediateRender: false, onUpdate: apply, onStart: apply }, at);
      }`;

export type CompiledComposition = {
  html: string;
  duration: number;
  usedAssets: string[];
  captionCount: number;
};

type TimedCaption = { start: number; end: number; text: string };

/**
 * Les sous-titres sont ancrés sur des mots transcrits, pas sur des secondes
 * inventées par le modèle. On convertit (plan, plage de mots) → temps global :
 *   t = début du plan + (temps du mot dans la source − point d'entrée du plan)
 */
function timingCaption(
  plan: EditPlan,
  starts: number[],
  transcripts: Map<string, Word[]>,
): TimedCaption[] {
  const index = new Map(plan.scenes.map((scene, i) => [scene.id, { scene, start: starts[i] }]));
  const out: TimedCaption[] = [];

  for (const caption of plan.captions) {
    const entry = index.get(caption.sceneId);
    if (!entry) continue;
    const { scene, start } = entry;
    if (scene.source.type !== "video") continue;
    const words = transcripts.get(scene.source.file);
    if (!words || words.length === 0) continue;

    const from = Math.min(Math.max(caption.fromWord, 0), words.length - 1);
    const to = Math.min(Math.max(caption.toWord, from), words.length - 1);
    const sceneEnd = start + scene.duration;

    const rawStart = start + (words[from].start - scene.source.in);
    const rawEnd = start + (words[to].end - scene.source.in);
    const begin = Math.max(start, rawStart);
    const end = Math.min(sceneEnd, rawEnd);

    if (end - begin < 0.35) continue;
    out.push({ start: Number(begin.toFixed(3)), end: Number(end.toFixed(3)), text: caption.text });
  }

  return out.sort((a, b) => a.start - b.start);
}

export function compileToHtml(
  plan: EditPlan,
  preset: Preset,
  transcripts: Map<string, Word[]> = new Map(),
  fx: ReelFx | null = null,
): CompiledComposition {
  const duration = Number(totalDuration(plan).toFixed(3));
  const starts = sceneStartTimes(plan);
  const usedAssets = new Set<string>();

  const scenes = plan.scenes
    .map((scene, index) => {
      const start = starts[index];
      if (scene.source.type !== "color") usedAssets.add(scene.source.file);
      return `<section class="scene" id="scene-${escapeHtml(scene.id)}">
        <div class="media">${mediaMarkup(scene, start, index, fx?.fill)}</div>
        ${overlayMarkup(scene, preset, start)}
      </section>`;
    })
    .join("\n");
  // Un seul vignettage, non minuté, au-dessus de tous les plans.
  const vignette = `<div class="vignette"></div>`;

  // Mode Reel : les sous-titres viennent des plans (fx.shots), au format Caption.
  const timedCaptions = fx ? [] : timingCaption(plan, starts, transcripts);

  const captions = timedCaptions
    .map(
      (c, i) => `<div class="caption clip" data-start="${c.start.toFixed(3)}" data-duration="${(c.end - c.start).toFixed(3)}" data-track-index="${100 + i}">
        <span>${escapeHtml(c.text)}</span>
      </div>`,
    )
    .join("\n");

  const audio = plan.audio
    ? `<audio id="music" src="assets/${escapeHtml(plan.audio.file)}"
        data-start="0" data-duration="${duration}"
        data-volume="${plan.audio.volume}" data-fade-out="${plan.audio.fadeOut}"
        preload="auto"></audio>`
    : "";

  // --- Timeline GSAP, construite à partir des mêmes nombres que le HTML ---
  const timeline: string[] = [];
  plan.scenes.forEach((scene, index) => {
    const start = starts[index];
    const sel = `#scene-${scene.id}`;

    if (scene.motion !== "none") {
      const { from, to } = motionFor(scene);
      timeline.push(
        `tl.fromTo("${sel} .media", ${JSON.stringify({ ...from })}, ${JSON.stringify({
          ...to,
          duration: scene.duration,
          ease: "none",
        })}, ${start});`,
      );
    }

    // Entrée en fondu (sauf premier plan) et sortie en fondu (sauf dernier).
    if (scene.transition === "fade") {
      if (index > 0) {
        timeline.push(`tl.fromTo("${sel}", { opacity: 0 }, { opacity: 1, duration: ${FADE}, ease: "power1.out" }, ${start});`);
      }
      if (index < plan.scenes.length - 1) {
        timeline.push(
          `tl.to("${sel}", { opacity: 0, duration: ${FADE}, ease: "power1.in" }, ${Math.max(start + 0.1, start + scene.duration - FADE)});`,
        );
      }
    }

    if (scene.title) {
      timeline.push(
        `tl.fromTo("${sel} .ttl", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${start + 0.12});`,
      );
    }
    if (scene.kicker) {
      timeline.push(
        `tl.fromTo("${sel} .kick", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, ${start + 0.05});`,
      );
    }
  });

  const sceneTimes = new Map(
    plan.scenes.map((scene, i) => [
      scene.id,
      { start: starts[i], duration: scene.duration, in: scene.source.type === "video" ? scene.source.in : 0 },
    ]),
  );
  const effects = fx
    ? fxMarkup(fx, preset, duration, sceneTimes)
    : { html: "", audio: "", timeline: [], captionCount: 0 };
  timeline.push(...effects.timeline);
  const captionCount = fx ? effects.captionCount : timedCaptions.length;

  const html = `<!doctype html>
<html lang="fr" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${preset.width}, height=${preset.height}" />
    <script src="gsap.min.js"></script>
    <style>${styleBlock(preset)}${fx ? fxStyle(preset) : ""}</style>
  </head>
  <body>
    <div id="stage"
      data-composition-id="main"
      data-start="0"
      data-duration="${duration}"
      data-width="${preset.width}"
      data-height="${preset.height}"
      data-fps="${preset.fps}">
      ${scenes}
      ${vignette}
      ${captions}
      ${effects.html}
    </div>
    ${audio}
    ${effects.audio}
    <script>
      const tl = gsap.timeline({ paused: true });${fx ? PSCALE_HELPER : ""}
      ${timeline.join("\n      ")}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>`;

  return { html, duration, usedAssets: [...usedAssets], captionCount };
}
