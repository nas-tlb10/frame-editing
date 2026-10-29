import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import type { Word } from "./transcribe";

const execFileAsync = promisify(execFile);

/**
 * Détection de silences adaptative (méthode du skill Remotion « silence-detection ») :
 * 1. `loudnorm` mesure le seuil de gating EBU R128 du fichier (`input_thresh`) ;
 * 2. `silencedetect` utilise ce seuil comme niveau de bruit.
 *
 * Pourquoi : l'ASR étire souvent le dernier mot d'une phrase sur le silence qui suit
 * (« test. » 2,24 → 4,64 s pour 0,3 s réellement prononcées). Sans ce recalage,
 * les silences ne sont ni vus ni coupés, et le mot reste surligné pendant la pause.
 */

export type Silence = { start: number; end: number };

const MIN_SILENCE = 0.3;
const cache = new Map<string, Silence[]>();

async function gatingThreshold(file: string): Promise<number | null> {
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "loudnorm=print_format=json", "-f", "null", "-"],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const match = /"input_thresh"\s*:\s*"(-?[\d.]+|-inf)"/.exec(stderr);
    if (!match || match[1] === "-inf") return null;
    return Number(match[1]);
  } catch {
    return null;
  }
}

export async function detectSilences(file: string): Promise<Silence[]> {
  const info = await stat(file);
  const key = `${file}:${info.mtimeMs}:${info.size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Seuil adaptatif ; −40 dB si la mesure échoue (fichier très court ou silencieux).
  const threshold = (await gatingThreshold(file)) ?? -40;
  let silences: Silence[] = [];
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner", "-nostats", "-i", file, "-map", "0:a:0",
        "-af", `silencedetect=noise=${threshold.toFixed(1)}dB:d=${MIN_SILENCE}`,
        "-f", "null", "-",
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    let start: number | null = null;
    for (const line of stderr.split(/\r?\n/)) {
      const s = /silence_start: (-?[\d.]+)/.exec(line);
      if (s) start = Math.max(0, Number(s[1]));
      const e = /silence_end: ([\d.]+)/.exec(line);
      if (e && start !== null) {
        silences.push({ start, end: Number(e[1]) });
        start = null;
      }
    }
  } catch {
    silences = [];
  }

  cache.set(key, silences);
  return silences;
}

/**
 * Recale les mots sur les silences mesurés : un mot ne peut pas se prolonger dans un silence
 * qui commence pendant qu'il est « prononcé », ni démarrer au milieu d'un silence.
 */
export function snapWordsToSilences(words: Word[], silences: Silence[], margin = 0.06): Word[] {
  return words.map((word) => {
    let { start, end } = word;
    for (const silence of silences) {
      if (silence.start > start + margin && silence.start < end) end = silence.start + margin;
      if (start > silence.start && start < silence.end - margin && silence.end < end) start = silence.end - margin;
    }
    return end > start ? { ...word, start, end } : word;
  });
}
