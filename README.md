# Frame — étape 1 (banc d'essai local)

Objectif : **juger le rendu et la latence**, pas le produit. Pas d'auth, pas de base de données, pas de crédits, pas de déploiement.

## Lancer

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Ce qui existe

| Élément | Fichier | Rôle |
|---|---|---|
| Schéma `EditPlan` | `lib/schema.ts` | Zod. Seul format accepté de l'agent. Timings calculés côté serveur. |
| Preset Instagram | `lib/presets.ts` | 1080×1920, 30 fps, 24 s cible, zones sûres, ruleset. Versionné. |
| Agent | `lib/plan.ts` | Claude (`claude-opus-5-5`) → `EditPlan` validé, garde-fous sur les fichiers. |
| Compilateur | `lib/compile.ts` | `EditPlan` → HTML + timeline GSAP. Aucun HTML libre. |
| Rendu | `lib/render.ts` | CLI `hyperframes render` en process séparé, sortie `.work/renders/<id>/out.mp4`. |
| UI | `app/page.tsx` | Assets · aperçu · brief. |

## Montage d'une vidéo parlée

Une vidéo + un style → MP4. Les règles de montage appartiennent au style (`lib/presets.ts`, champ `edit`) :

| Style | Format | Coupes | Cadrage | Sous-titres | Effets |
|---|---|---|---|---|---|
| Instagram / Reels | 9:16 | silences > 0,35 s | punch-in ×1,12 | mot par mot, 1–3 mots | accroche badge, mots-clés, light leak, sons, barre |
| Gaming | 16:9 | silences > 0,25 s | punch-in ×1,18 | mot par mot, majuscules | accroche badge, mots-clés, light leak, sons |
| Explicatif | 16:9 | silences > 0,5 s | punch-in ×1,06 | mot par mot, phrases | titre, mots-clés, pop, barre |
| Documentaire | 16:9 | silences > 1,2 s | poussée lente | bandeau de lecture | titre seul |

Pipeline (`lib/reel.ts`) :

1. **Transcription** locale (Parakeet via `hyperframes transcribe`), timings mot par mot, langue détectée.
2. **Silences** mesurés par ffmpeg (seuil adaptatif `loudnorm` → `silencedetect`, `lib/silence.ts`) : l'ASR étire le dernier mot d'une phrase sur la pause, on recale les mots dessus.
3. **Coupes et plans** selon le style. Une source dont le ratio diffère du format est posée sur un fond flouté.
4. **Director** (Claude) : accroche + mots-clés, avec la consigne facultative du chat. Sans crédit/clé : heuristique, signalée dans l'UI.
5. **Compilation** HyperFrames : chaque `<video>` porte son propre `data-start` (sinon HyperFrames le joue à 0 s et le son se décale).

Le moteur reste HyperFrames (HTML + GSAP). Les règles de montage suivent les skills Remotion (`.claude/skills/remotion-*`), transposées :

| Pratique Remotion | Ici |
|---|---|
| Sous-titres au format `Caption` (ms, espaces en tête, `pageBreakAfter`) | `lib/captions.ts` |
| Vidéo et sous-titres d'un plan sur la même frontière (`<Sequence trimBefore>`) | `ReelFx.shots[]` : chaque plan porte ses `Caption` en temps source |
| `Easing.bezier(0.16, 1, 0.3, 1)`, pas de rebond | `expo.out` |
| `output: "perceptual-scale"` | helper `pscale()` (interpolation log) |
| `TransitionSeries.Overlay` (light leak sur la coupe, sans raccourcir) | `ReelFx.cuts[]` |
| Surligneur `@remotion/rough-notation` | marqueur qui se dessine derrière les mots-clés |
| Grouper un visuel et son son, durée naturelle du son | `FxSound` rattaché à l'accroche, aux mots-clés, aux coupes |

Effets sonores : dépose tes fichiers dans `test-assets/sfx/` (`whoosh*.wav|mp3`, `pop*.wav|mp3`). Sans eux, des sons de secours synthétisés par ffmpeg sont utilisés (`.work/sfx/`) : ils valident le placement, pas la qualité.

## Assets

Dépose tes fichiers dans `test-assets/` :

```
test-assets/video/     2–3 clips (mp4, mov)
test-assets/images/    photos (jpg, png)
test-assets/audio/     musique (mp3, wav)
```

Les placeholders actuels sont générés par ffmpeg (dégradés animés) : ils valident le pipeline, pas l'esthétique.

## Clé API

```
.env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Sans clé, l'API renvoie une erreur explicite. Pour forcer un plan figé sans appel réseau :

```bash
FRAME_PLAN_MODE=mock pnpm dev
```

## Mesures du 2026-10-29

Machine locale, Windows, sans GPU dédié :

| Test | Résultat |
|---|---|
| 6 s · 1920×1080 · draft, 2 workers software | 10,0 s de rendu |
| 24 s · 1080×1920 · draft, preset Instagram, 6 plans vidéo | 52,4 s de rendu (plan inclus : 52,9 s) |
| Débit | ~2,2× la durée de sortie |
| Poids | 6,6 Mo pour 24 s (H.264, CRF draft, AAC 188 kb/s) |

## Limites connues

- **Pas de transcription** : les sous-titres viennent de l'agent, pas d'un ASR. `hyperframes transcribe` existe et mérite un test avant de garder Deepgram.
- **Polices système** : `Segoe UI` par défaut. À remplacer par des polices embarquées (OFL) avant tout rendu de production.
- **Jobs en mémoire + JSON** : un redémarrage du serveur interrompt un rendu en cours. Acceptable en local.
- **Un seul preset**, une seule timeline, pas de retouche conversationnelle.
