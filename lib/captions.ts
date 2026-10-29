import type { Word } from "./transcribe";

/**
 * Format de sous-titres, aligné sur le type `Caption` de @remotion/captions
 * (sans dépendance) : un mot par entrée, en millisecondes, dans le temps de la source.
 *
 * - `text` porte l'espace qui précède le mot (sauf le premier) : le rendu est sensible aux espaces.
 * - `timestampMs` : instant représentatif du mot (milieu), utilisé pour le surlignage.
 * - `pageBreakAfter` : fin d'une « page » (groupe affiché ensemble).
 */
export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
  pageBreakAfter?: boolean;
};

const PAGE_MAX_GAP_MS = 450;

export function wordsToCaptions(words: Word[]): Caption[] {
  return words.map((w, i) => {
    const startMs = Math.round(w.start * 1000);
    const endMs = Math.round(w.end * 1000);
    return {
      text: i === 0 ? w.text : ` ${w.text}`,
      startMs,
      endMs,
      timestampMs: Math.round((startMs + endMs) / 2),
      confidence: null,
    };
  });
}

/**
 * Pagination selon le preset (ex. 1 à 3 mots pour un Reel, une phrase pour un documentaire),
 * coupure sur la ponctuation et les pauses. Renvoie une copie avec `pageBreakAfter`.
 */
export function paginate(captions: Caption[], maxWords: number, maxChars: number): Caption[] {
  const out = captions.map((c) => ({ ...c, pageBreakAfter: false }));
  let count = 0;
  let chars = 0;
  for (let i = 0; i < out.length; i += 1) {
    const current = out[i];
    const next = out[i + 1];
    count += 1;
    chars += current.text.trim().length + 1;
    const shouldBreak =
      !next ||
      count >= maxWords ||
      /[.!?…]$/u.test(current.text) ||
      (maxWords <= 4 && /[,;:]$/u.test(current.text)) ||
      next.startMs - current.endMs > PAGE_MAX_GAP_MS ||
      chars + next.text.trim().length > maxChars;
    if (shouldBreak) {
      current.pageBreakAfter = true;
      count = 0;
      chars = 0;
    }
  }
  return out;
}

/** Regroupe en pages selon `pageBreakAfter`. */
export function toPages(captions: Caption[]): Caption[][] {
  const pages: Caption[][] = [];
  let page: Caption[] = [];
  for (const caption of captions) {
    page.push(caption);
    if (caption.pageBreakAfter) {
      pages.push(page);
      page = [];
    }
  }
  if (page.length > 0) pages.push(page);
  return pages;
}
