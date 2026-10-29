# PROJECT_MAP — Frame

**SaaS de montage vidéo automatisé par agents IA, dans le navigateur.**
Dernière mise à jour : 2026-10-29 · Statut : **planification — D6–D10 intégrées, design v1 revu, modèle de coûts complété, implémentation non démarrée**.
Propriétaire : Tech Lead. Toute déviation doit être répercutée ici.

> **Porte d'entrée :** aucune ligne de code avant validation des arbitrages D6b–D13 (§5) et approbation explicite de M0.

---

## 0. DÉCISIONS & HYPOTHÈSES

### Décisions acquises (2026-10-29)

| # | Décision | Conséquence |
|---|---|---|
| D1 | **HyperFrames** (HTML/CSS + Chrome headless) pour la composition, le preview et le rendu | Apache 2.0, aucun coût par render ; stack 0.8.x à épingler |
| D2 | **Presets de style** (prompt système + ruleset + template dédiés) + **chat de retouche**, facturé en **crédits** au rendu d'aperçu | Ledger de crédits, réservations, micro-paiements Stripe |
| D2b | **Pas de timeline NLE** au MVP | Périmètre maîtrisé ; preview + chat + liste de scènes |
| D3 | **Vercel** (web/API) + **Supabase** (Postgres) + **Cloudflare R2** (médias) + **Cloud Run Jobs** (préparation + rendu, scale-to-zero) | File d'attente en DB, pas de worker permanent |
| D4 | Environnement de dev sur **services managés** (Supabase/R2 de dev) + rendu local | Aucun Docker requis au quotidien |
| D5 | **Créateurs solo** uniquement | Pas d'organisations, de sièges ni de rôles |
| D6 | **Offre proposée** : Free 10 crédits ; Starter 9,99 €/100 cr ; Pro 24,99 €/300 cr ; Business 59,99 €/900 cr **à arbitrer** (D6d) ; packs one-shot ; annuel = 2 mois offerts. **Barème proposé** : aperçu 720p 1 cr/30 s (minimum 1, plafond à arbitrer D12) ; export 720p 2 cr/min ; export 1080p 4 cr/min ; transcription 1 cr/min source | Prix = hypothèses, à calibrer en M6/M8 ; le chat IA n'est pas encore couvert (D6b) |
| D7 | **Réserver → capturer → libérer** les crédits ; identifiant d'opération unique ; expiration des réservations ; journal consultable ; cache des aperçus identiques | Remplace le « débit à la génération » du plan précédent |
| D8 | **API Claude via AI SDK** ; `claude-opus-5-5` pour la planification ; `claude-sonnet-5-5` recommandé pour la retouche (D8b) ; adaptateur fournisseur ; **plan de montage JSON validé** ; transcription séparée (Deepgram Nova-3 proposé, D8c) | Le moteur de montage ne dépend pas du LLM ; le HTML reste généré par compilation déterministe |
| D9 | **Vercel** pour le web et les API courtes ; **Cloud Run Jobs** pour la préparation média et les rendus ; **streaming uniquement pour l'agent** ; tâches et reprise durables | **Hobby = développement uniquement (non commercial)** ; **Pro obligatoire avant tout lancement payant** ; Cloud Scheduler remplace le cron Vercel pour le sweeper |
| D10 | Presets **configurables et versionnés**, pas seulement dans les skills du LLM ; polices **OFL auto-hébergées en WOFF2** dans les templates | Prompts/rules en DB, templates et polices en code ; les prompts définitifs seront fournis par le user |

### Arbitrages ouverts (bloquants)

| # | Sujet | Recommandation | Bloque |
|---|---|---|---|
| **D6b** | Facturation des retouches IA | **1 crédit par modification commitée** (le plan initial reste inclus), ou allocation mensuelle puis 1 crédit. Sans cela, Opus + plusieurs retouches peut coûter plus que les crédits d'aperçu/export. | M1, M5 |
| **D6c** | Expiration et comptes de crédits | Deux buckets : `plan` (remis à zéro chaque mois, non reportable) et `pack` (permanent). Débit : plan puis pack. Free = pack, 90 jours. | M1 |
| **D6d** | Plan Business | **Reporter** : D5 = solo, pas d'équipes. Le garder comme « Studio » mono-siège, ou l'ajouter après validation. | M1, landing |
| **D6e** | Prix annuels et packs | Annuel = 10 × mensuel ; packs 50/150/400 crédits avec remise volume. À valider. | M1, landing |
| **D8b** | Modèle de retouche | **Sonnet 5.5** par défaut, Opus 5.5 pour les demandes complexes, Haiku 5.5 pour les ops simples. Opus partout = marge quasi nulle. | M4, M5 |
| **D8c** | Fournisseur de transcription | **Deepgram Nova-3** (pré-enregistré, word timestamps, endpoint EU). Alternative : OpenAI Whisper. Tester qualité FR avant de figer. | M2 |
| **D9b** | Lancement commercial | **Vercel Pro obligatoire** avant d'accepter des paiements (Hobby interdit le commercial). Hobby pour le développement seulement. | M8 |
| **D10b** | Prompts, skills et direction artistique des 4 presets | Le user fournit les prompts/skills ; proposer les polices et palettes en attendant. | M3 |
| **D11** | Formats par preset | **Un format fixe par preset** au lancement (documentaire 16:9, gaming 16:9, explicatif 16:9, Instagram 9:16). Le sélecteur 16:9/9:16/1:1 du mockup est à retirer. | M3 |
| **D12** | Durée de l'aperçu rendu | 720p, 1 cr/30 s, **plafond 3 min** (segment choisi), consultation gratuite. | M6 |
| **D13** | Durabilité du planning | Le stream agent n'est pas durable : si l'utilisateur ferme l'onglet, pas de commit ni de débit, il relance. Les rendus, eux, sont durables. Passer le planning en job si ce n'est pas acceptable. | M4 |

### Hypothèses de travail

| # | Hypothèse | Impact si invalidée |
|---|---|---|
| H1 | Greenfield, 1 équipe, ~2 ingénieurs + design, MVP **10–12 semaines** (design v1 déjà fourni) | Re-planification |
| H2 | Sortie MP4 H.264/AAC ; formats fixés par preset ; 720p/1080p ; ≤ 10 min ; transcription word-level | Encodage/quotas à revoir |
| H3 | 4 styles au lancement : **documentaire, gaming, explicatif, Instagram** | Catalogue et prompts à ajuster |
| H4 | UI FR, marché FR/EU, Stripe EUR (mensuel/annuel + packs de crédits), TVA via Stripe Tax | TVA/i18n à revoir |
| H5 | Pas de génération vidéo IA, pas de stock média, pas de collaboration temps réel | Hors périmètre |
| H6 | Aperçu rendu 720p = 1 crédit/30 s ; export = crédits/minute ; transcription = 1 crédit/minute source | Tarification à calibrer (D6) |
| H7 | Coût variable cible ≤ 40 % du revenu net ; dépend surtout du plan Opus et des retouches/projet | `COST_MODEL.md` ; D6b |
| H8 | Transcription déclenchée seulement si le preset exige des sous-titres ou si l'utilisateur l'active | Coût et UX à revoir |

### Non-objectifs (No Feature Creep)

Timeline visuelle NLE, collaboration, marketplace de templates, bibliothèque de médias, génération de plans par IA, **génération d'éléments vidéo par IA**, app mobile, panneau d'administration, multi-langue, 4K, effets créatifs libres, équipes/organisations, **multi-format par preset**, doublage/traduction, stockage média.

### Décision d'implémentation A1 (révisée)

L'agent **n'écrit pas de HTML libre**.

- **Planification** : l'agent lit les assets/transcripts puis appelle `commitPlan(EditPlan)` avec un JSON validé par Zod. Le serveur **compile** ce plan en EditOps/HTML de façon déterministe, puis passe le linter.
- **Retouche** : l'agent pilote les **opérations typées de `@hyperframes/sdk`** (`setText`, `setTiming`, `setStyle`, `addElement`, `addGsapTween`…) sur la composition versionnée.

Le HTML reste la source de vérité ; il est toujours produit par le compilateur ou le SDK, jamais par le modèle.

---

## 1. [TECH_STACK]

Versions relevées le **2026-10-29** (npm / documentation officielle). Épinglage exact, lockfile committé.

| Couche | Technologie | Version | Rôle / contrainte |
|---|---|---|---|
| Runtime | Node.js | **24.22.0** (LTS) | Vercel + Cloud Run. HyperFrames exige ≥ 22 |
| Gestionnaire | pnpm | **12.9.1** | Workspaces |
| Framework | Next.js | **16.4.3** | App Router, Server Actions, Route Handlers ; `proxy.ts` (middleware déprécié) |
| UI | React / React DOM | **19.3.1** | RSC + client components |
| Langage | TypeScript | **7.0.2** | Compilateur natif ; repli **6.0.3** si un outil casse |
| UI kit | Tailwind CSS / shadcn CLI | **4.3.3** / **4.23.0** | Design system (§6) |
| Validation | Zod | **4.6.7** | Contrats API, tools, plans, rulesets, env |
| ORM | Drizzle ORM / drizzle-kit | **0.45.4** / **0.31.11** | Schéma typé + migrations SQL |
| DB | PostgreSQL (Supabase) + `pg` | **15+** / **8.23.1** | Pooler Supavisor (transaction mode) ; pas de prepared statements nommés ; migrations en connexion directe |
| Auth | Better Auth + plugin Stripe | **1.7.14** | Sessions, abonnements, webhooks |
| Paiement | Stripe SDK | **23.0.1** (API `2026-09-30.endive`) | Checkout abonnements + packs one-shot, portail, Stripe Tax |
| IA | `ai` + `@ai-sdk/anthropic` + `@ai-sdk/react` | **7.0.157** / **4.0.92** / **4.0.161** | `ToolLoopAgent`, streaming, `useChat` ; modèles `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` |
| Transcription | `@deepgram/sdk` | **5.17.0** | Nova-3 pré-enregistré, `words[]` + `utterances[]`, endpoint EU |
| Composition | `@hyperframes/core` + `@hyperframes/sdk` | **0.8.217** | Schéma, linter, parsing, EditOps typées, undo/patches |
| Preview | `@hyperframes/player` | **0.8.217** | Web component, iframe sandboxée, seek/play |
| Rendu | `@hyperframes/producer` | **0.8.217** | Pipeline capture + encodage + audio, progression, annulation |
| CLI (dev) | `hyperframes` | **0.8.216** | `check`, `preview` en local uniquement |
| Animation | GSAP | **3.15.0** | Bundlé dans les templates, pas d'accès réseau |
| Stockage | `@aws-sdk/client-s3` + `s3-request-presigner` | **3.1159.0** | R2 : PUT/GET présignés, compatible S3 |
| Dispatch rendu | `@google-cloud/run` | **4.2.0** | Lancement d'exécutions Cloud Run Jobs |
| Logs | pino | **10.4.0** | Async, 3 niveaux, stdout |
| Tests | Vitest / Playwright | **5.0.5** / **1.64.1** | Domaine/unitaires, E2E |
| Qualité | Biome | **2.6.4** | Lint + format |
| Média | FFmpeg / ffprobe | **8.x** épinglé dans l'image | Probe, miniatures, détection de scènes, vérification |
| Polices | Inter + polices display OFL | à figer | `next/font` côté web ; WOFF2 locaux côté rendu |

**Infra :** Vercel (web/API ; **Hobby = dev non commercial**, **Pro = production**) · Supabase Postgres (EU) · Cloudflare R2 (EU, egress gratuit) · Google Cloud Run Jobs (`europe-west9`, 2 vCPU / 4 Go, `max-retries=1`, timeout 60 min) · Cloud Scheduler (1 min, sweeper) · Artifact Registry · Secret Manager · Anthropic API · Deepgram API (EU) · Stripe.

**Régions cibles :** Vercel `cdg1` (Paris) · Supabase EU · R2 EU · Cloud Run `europe-west9` (Paris) · Artifact Registry `europe-west9`.

**Écartés :** Remotion (licence par render) · `pg-boss`/BullMQ/Redis (incompatible scale-to-zero) · Supabase Auth (Better Auth retenu) · `@hyperframes/gcp-cloud-run` (Cloud Run *service* + Workflows + GCS : 2ᵉ stockage inutile) · `fluent-ffmpeg` (déprécié) · `ffmpeg.wasm` (export) · Prisma · framework d'agents générique · `middleware.ts` · `@ai-sdk/openai` (LLM unique = Anthropic ; transcription = Deepgram) · API de génération vidéo IA (hors périmètre) · **Vercel Cron pour le sweeper** (Hobby = 1×/jour) · **Vercel Workflows** (à réévaluer seulement si D13 impose un planning durable).

**Contrainte Vercel :** Hobby = 300 s max, 2 Go / 1 vCPU, cron 1×/jour, **usage non commercial**. Pro = 300 s par défaut, 800 s max, cron 1 min, commercial autorisé. Le code doit donc tenir dans 300 s en dev et pouvoir monter à 800 s en prod.

---

## 2. [SYSTEM_FLOW]

### Parcours utilisateur (objectifs vérifiables)

| # | Étape | Comportement | Objectif vérifiable |
|---|---|---|---|
| 1 | Inscription | Better Auth (email + OAuth), vérification email, plan Free, **10 crédits offerts** (bucket pack, 90 j à confirmer) | Solde consultable, grant idempotent, un seul grant Free/compte |
| 2 | Création projet | Nom, preset (format imposé), durée cible, brief ; projet `draft` | Projet rouvert à l'identique, preset + version épinglés |
| 3 | Upload | PUT présigné direct R2 → probe client (métadonnées + miniature) → asset `pending` → job `prepare` | 500 Mo accepté ; type/taille invalides rejetés ; aperçu < 10 s |
| 4 | Préparation média | Worker : `ffprobe`, miniature, **transcription Deepgram** si captions, détection de scènes optionnelle | Transcript word-level stocké ; coût affiché ; asset `ready` |
| 5 | Planification | Agent « Director » : prompt du style + ruleset + assets/transcripts → `EditPlan` Zod → compilation → linter | p95 < 60 s, cap 300 s ; durée ±10 % ; 0 URL externe ; abort sans commit ni débit |
| 6 | Live preview | `<hyperframes-player>` sur la composition (aucun rendu serveur) | 1ʳᵉ image < 2 s, seek fluide |
| 7 | Retouche | Chat streamé ; l'agent appelle des EditOps typées ; commit = **nouvelle version** ; coût selon D6b | Ops attendues, version N+1, undo exact (hash HTML), concurrence bloquée |
| 8 | Aperçu rendu (payant) | 720p, 1 cr/30 s, plafond 3 min (D12) → Cloud Run Job → MP4 | Réservation unique, capture après succès, libération si échec, MP4 relisible, revoir gratuit, cache |
| 9 | Export | 720p/1080p, crédits/minute → Cloud Run Job → MP4 sur R2 | 60 s 1080p < 3 min p95, progression ±5 %, idempotent, téléchargement signé |
| 10 | Abonnement / crédits | Checkout mensuel/annuel, packs one-shot, portail Stripe, Stripe Tax | Grants idempotents (`invoice.id`, `session.id`), quota épuisé → 402 explicite, factures |

### Fermeture du navigateur et reprise

- **Rendus et préparation média** : tâches durables en DB + Cloud Run ; l'utilisateur peut fermer l'onglet, l'état est consultable au retour (polling 2 s).
- **Planning et chat** : stream court côté Vercel. Si l'onglet est fermé, la requête est annulée, **aucun commit ni débit** ; le message utilisateur est conservé, il relance. Si D13 exige la reprise du planning, le passer en job (même table `jobs`).
- **Idempotence** : chaque action payante porte un `operation_id` (job, message de commit, `invoice.id`, `session.id`) ; les doublons sont ignorés.

### Deux niveaux de preview (choix produit)

- **Live preview (gratuit)** : lecture HTML dans le navigateur, pour itérer. Ce n'est pas un livrable.
- **Aperçu rendu (1 cr/30 s)** : MP4 720p, limité à 3 min (D12), identique à l'export, partageable, conservé ; sa consultation ultérieure est illimitée.
- **Export** : vidéo complète, 720p ou 1080p, crédits/minute.

### Flux de données

```
Navigateur ──PUT présigné──▶ R2 (uploads/)
    │  probe local (durée, résolution, miniature)
    ▼
Next.js (Vercel) ──auth / CRUD / chat streamé / EditOps──▶ Supabase Postgres
    │                                   │
    │                                   ├─ compositions (HTML versionné)
    │                                   ├─ style_presets (prompt + rules)
    │                                   └─ crédits (comptes, ledger, réservations)
    ├─▶ Cloud Run Jobs API (runJob, env JOB_ID)
    │        │
    │        ├─▶ prepare : ffprobe → Deepgram → transcript (DB)
    │        └─▶ preview/export : claim DB → Producer → MP4 ─▶ R2
    │                                 └─ progression / statut ─▶ Postgres
    ├─▶ Anthropic API (planification + retouche)
    ├─▶ Deepgram API (transcription, endpoint EU)
    └─▶ Stripe (abonnements + packs) ──webhook──▶ credits / subscriptions
```

### États

- `asset` : `pending → preparing → ready | rejected`
- `transcript` : `pending → ready | failed`
- `job` : `queued → dispatched → running → done | failed | canceled`
- `credit_reservation` : `held → captured | released | expired`
- `credit_ledger` : append-only (`grant`, `purchase`, `reserve`, `capture`, `release`, `refund`, `adjustment`)
- `composition` : immuable, `v1..vN` (revert = nouvelle version)
- `subscription` : géré par Better Auth/Stripe (`active`, `trialing`, `past_due`, `canceled`)
- `style_preset` : `draft | active | archived`, versionné

---

## 3. [ARCHITECTURE]

### Organisation (monolithe modulaire, 2 processus)

```
Frame/
├─ apps/
│  ├─ web/                          # Next.js 16 : UI, API, agent, facturation
│  │  ├─ app/
│  │  │  ├─ (marketing)/{page,pricing,legal}/page.tsx
│  │  │  ├─ (auth)/{login,signup}/page.tsx
│  │  │  ├─ (app)/projects/page.tsx
│  │  │  ├─ (app)/projects/new/page.tsx
│  │  │  ├─ (app)/projects/[projectId]/page.tsx   # player + chat + scènes + crédits
│  │  │  └─ (app)/settings/credits/page.tsx
│  │  ├─ app/api/
│  │  │  ├─ auth/[...all]/route.ts                 # Better Auth + Stripe
│  │  │  ├─ projects/route.ts
│  │  │  ├─ assets/{presign,finalize}/route.ts
│  │  │  ├─ projects/[id]/{plan,chat,preview,export}/route.ts
│  │  │  ├─ jobs/[id]/route.ts                     # polling progression
│  │  │  ├─ credits/{checkout,history}/route.ts
│  │  │  ├─ stripe/webhook/route.ts
│  │  │  ├─ cron/sweep/route.ts                    # Cloud Scheduler (OIDC)
│  │  │  └─ health/route.ts
│  │  ├─ components/{marketing,editor,chat,player,credits,ui}/
│  │  └─ src/server/
│  │     ├─ agent.ts                # ToolLoopAgent, modes plan/retouche
│  │     ├─ plan.ts                 # EditPlan Zod + compilateur → EditOps/HTML
│  │     ├─ tools.ts                # outils → EditOps (allowlist)
│  │     ├─ compositions.ts         # open/serialize/validate/commit
│  │     ├─ transcription.ts        # Deepgram, words → captions
│  │     ├─ jobs.ts                 # enqueue/dispatch/claim/poll
│  │     └─ billing.ts              # crédits, réservations, quotas, Stripe
│  ├─ worker/                       # image Cloud Run Job
│  │  └─ src/{main,claim,prepare,render}.ts
├─ packages/
│  ├─ core/src/
│  │  ├─ styles/                    # 4 presets : rules + templates + fonts
│  │  ├─ credits.ts                 # coût des actions, règles de débit
│  │  ├─ limits.ts                  # plans, quotas, résolutions, concurrence
│  │  └─ logger.ts                  # pino + corrélation
│  ├─ db/src/{schema.ts,client.ts}
│  ├─ media/src/{probe,transcribe,scenes,thumbnails}.ts
│  └─ render/src/{hyperframes.ts,r2.ts,cloudrun.ts}   # adaptateur anti-version-skew
├─ design/{landing-v1.html,editor-v1.html}
├─ DESIGN_SPEC.md
├─ COST_MODEL.md                    # coûts, marges, point mort
├─ scripts/                         # bootstrap GCP (gcloud) + seed presets
└─ PROJECT_MAP.md
```

**Règles de dépendance**
- `core` = pur, sans I/O réseau/DB (testable).
- `db` = schéma + client, zéro logique métier.
- `media` = probe/transcription/scènes ; appelé par le worker.
- `render` = unique point de contact avec HyperFrames, R2 et Cloud Run (isole la stack 0.8.x).
- `web` et `worker` orchestrent ; aucune règle dupliquée.
- La **composition HTML versionnée** est le contrat unique entre agent, player et rendu.

### Modèle de données (MVP)

`users`, `sessions`, `accounts`, `verifications` (Better Auth) · `subscriptions` (plugin Stripe) · `projects` · `style_presets` · `assets` · `transcripts` · `compositions` · `messages` · `jobs` · `credit_accounts` · `credit_ledger` · `credit_reservations` · `usage_events`.

Points structurants :
- `projects` : `user_id`, `style_preset_id`, `style_version`, `aspect`, `target_duration_sec`, `status`.
- `assets` : `kind`, `status`, `probe_json`, `transcript_id`, `scenes_json`, `size_bytes`, `mime`.
- `transcripts` : `asset_id`, `provider`, `model`, `language`, `words_json`, `utterances_json`, `cost_usd`, `status`.
- `compositions` : `project_id`, `version`, `html`, `hash`, `plan_json`, `created_by`.
- `messages` : `project_id`, `role`, `content`, `tool_calls_json`, `usage_json`, `operation_id`.
- `jobs` : `kind` (`prepare|preview|export`), `status`, `project_id`, `composition_id`, `cache_key`, `cost_credits`, `progress`, `output_key`, `error`, `attempts`, `dispatched_at`, `started_at`, `finished_at`.
- `credit_accounts` : `plan_balance`, `pack_balance`, `plan_reserved`, `pack_reserved` ; CHECK ≥ 0.
- `credit_ledger` : `bucket` (`plan|pack`), `entry_type`, `amount`, `operation_id` ; index unique `(operation_id, entry_type)`.
- `credit_reservations` : `job_id`, `amount`, `bucket`, `status`, `expires_at`.
- `usage_events` : `provider`, `model`, `input_tokens`, `output_tokens`, `audio_seconds`, `cost_usd`, `job_id`.

Chaque table métier porte `user_id` ; autorisation applicative centralisée (`requireProjectAccess`). Pas de RLS au MVP (P10).

### Presets de style (D10)

```ts
StylePreset = {
  id: 'documentary' | 'gaming' | 'explainer' | 'instagram',
  version: 1,
  label, description,
  aspect: '16:9' | '9:16',          // fixe par preset (D11)
  fps: 24 | 30,
  systemPrompt: string,              // prompt système dédié
  rules: {                           // ruleset technique, côté serveur
    minSceneSec, maxSceneSec, maxDurationSec,
    transitions: string[],
    caption: { maxCharsPerLine, maxLines, safeAreaPct, style },
    music: { duckToDb, fadeSec },
    palette, fonts, motion, safeAreaPct
  },
  templateKey: string,               // code, versionné avec le preset
  blocks: BlockTemplate[]            // titres, lower-thirds, sous-titres, CTA
}
```

- **Prompts + rules** : table `style_presets` (seed par migration), modifiables sans redéploiement.
- **Templates + polices** : code (`packages/core/src/styles/`), revus par PR.
- Le projet épingle `style_preset_id` + `style_version` ; un rendu reste reproductible après évolution.
- Les prompts/skills définitifs seront fournis par le user (D10b) ; en attendant, les 4 presets partent des intentions de la landing.

### Contrat de composition

- HTML fini, viewport explicite (`data-width/height/duration`), clips `data-start/duration/track-index`, `data-hf-id` stables.
- Assets référencés par placeholder `asset://<assetId>`, résolu en URL R2 signée au moment de servir/rendre (jamais d'URL expirante stockée).
- **Sous-titres** : blocs générés depuis `transcripts.words` ; `data-caption`, `data-speaker`, `data-start/end` ; découpage selon `rules.caption` ; safe area respectée.
- Polices : `@font-face` locales en WOFF2, chemins relatifs ; **aucune requête réseau au rendu**.
- Animations : GSAP/CSS uniquement, timeline déclarée. Aucun `<script src>` externe, aucun `fetch`.
- CSP stricte + iframe sandboxée (Player) ; le HTML de composition n'a accès ni aux cookies ni au DOM hôte.

### Agent

- Un seul `ToolLoopAgent` « Director », deux modes : **planification** (premier tour) et **retouche** (tours suivants), exécuté côté Vercel en streaming.
- **Modèles** : `claude-opus-5-5` pour la planification ; `claude-sonnet-5-5` pour la retouche (D8b) ; `claude-haiku-5-5` pour les ops simples si le routeur est activé. Tout est configurable par env, jamais codé en dur.
- **Planification** : outils de lecture (`listAssets`, `inspectAsset`, `getTranscript`, `searchTranscript`, `listScenes`) puis `commitPlan(EditPlan)` ; le serveur compile et lint. Pas de HTML libre.
- **Retouche** : outils d'écriture typés (`setText`, `setStyle`, `setTiming`, `moveElement`, `removeElement`, `addSceneBlock`, `addTween`, `setVariable`, `commitComposition`), `comp.can()` avant `dispatch`.
- **Contexte** : index d'éléments (`data-hf-id`, rôle, texte, timings) + résumé + transcript pertinent, **jamais** le HTML complet. Prompt du style en tête avec **prompt caching** Anthropic.
- **Garde-fous** : ≤ 12 steps, budget tokens entrée/sortie, abort à 240 s, validation ruleset + linter `@hyperframes/core`, **une** réparation guidée, sinon échec propre sans commit. Noms de fichiers/transcripts traités comme **données** (prompt injection).
- **Coût** : `usage_events` par appel (tokens, cache read/write, modèle) ; budget par plan et par projet ; alerte si dépassement.
- **Résilience** : retry 429/5xx avec backoff ; fallback Sonnet si Opus indisponible ; jamais de fallback silencieux vers un autre fournisseur.

### Transcription et sous-titres

- **Deepgram Nova-3 pré-enregistré**, endpoint EU (`api.eu.deepgram.com`), `words[]` avec `start/end/confidence`, `utterances[]`, détection de langue, diarisation incluse en pré-enregistré.
- Exécutée dans le job `prepare` (Cloud Run), pas dans la requête de chat.
- Sortie stockée en JSONB dans `transcripts` (ou R2 si > 1 Mo) ; coût `audio_seconds × tarif` dans `usage_events`.
- Captions générées côté serveur (découpage, ponctuation, lignes, safe area), jamais par le LLM.
- Coût : ~0,0043 $/min chez Deepgram ; facturé 1 crédit/min source (marge à calibrer).
- Données : audio envoyé à un sous-traitant (DPA, rétention) ; mention dans la politique de confidentialité (P20).

### Pipeline de rendu (Cloud Run Jobs)

- Image unique Node 24 + Chromium + FFmpeg + `@hyperframes/producer` + `@deepgram/sdk`, publiée sur Artifact Registry.
- `JOB_KIND=prepare|preview|export` via override d'environnement ; `JOB_ID` identifie la ligne DB.
- Worker : `claim` atomique (`UPDATE … WHERE status='queued' RETURNING`), `ffprobe`, résolution des assets, `executeRenderJob`, upload R2, mise à jour du statut.
- **`prepare`** : probe + miniature + transcription (si demandée) + scènes optionnelles ; timeout 10 min.
- **`preview|export`** : rendu + upload ; timeout 60 min.
- Idempotence : clé de sortie `projects/{projectId}/v{n}/{kind}-{resolution}.mp4` ; une exécution qui trouve la ligne déjà claimée sort en `0`.
- **Cache** : `cache_key = sha256(composition.hash + kind + resolution + fps + range)` ; index unique partiel sur les jobs `done` ; un hit réutilise l'output et **ne débite pas**.
- Progression : callback Producer → DB (throttle 5 s) → polling client 2 s.
- Annulation : `cancel_requested` en DB → `AbortController` côté worker → statut `canceled` + libération de la réservation.
- Concurrence : limite par plan (1/2/4) matérialisée par un compteur de jobs `running` ; `parallelism` du Job Cloud Run plafonné.
- Coût : scale-to-zero ; cold start Chromium à mesurer (P19). Montée en charge ultérieure : Producer distribué (chunks) sans changer le contrat.

### File d'attente & dispatch (sans broker)

`jobs` **est** la file. L'API insère la ligne puis appelle `runJob` ; en cas d'échec du dispatch, **Cloud Scheduler** (`/api/cron/sweep`, toutes les minutes, OIDC) relance les lignes `queued` > 60 s. `attempts` max 2. Aucun worker permanent, aucun Redis.

- Hobby ne permet pas de cron 1×/min : Cloud Scheduler est obligatoire dès le dev si l'on veut tester le sweeper.
- En production, Vercel Pro peut aussi héberger le cron ; on garde Cloud Scheduler pour ne pas coupler le plan Vercel à la fiabilité de la file.
- Le endpoint vérifie le JWT OIDC Google (audience + service account) ; pas de secret statique.

### Crédits & micro-paiements (D6/D7)

- **Deux buckets** : `plan` (allocation mensuelle, remise à zéro, non reportable) et `pack` (crédits achetés/offerts, permanents ou 90 j pour le Free). Débit : plan puis pack.
- `credit_accounts` : soldes + réservés ; `credit_ledger` append-only ; `credit_reservations` avec expiration (15 min).
- Coût centralisé dans `core/credits.ts` :
  - aperçu 720p : `max(1, ceil(durée/30))`, plafond 3 min (D12) ;
  - export 720p : `ceil(durée/60) × 2` ; 1080p : `ceil(durée/60) × 4` ;
  - transcription : `ceil(durée_source/60) × 1` ;
  - retouche IA : D6b.
- **Réserver** (vérifie le solde, déplace vers `reserved`) → **capturer** après succès → **libérer** si échec, annulation avant sortie, ou expiration.
- **Cache hit** : aucun débit ; l'output existant est réservé à l'utilisateur.
- **Consultation** d'un aperçu/export déjà rendu : gratuite.
- **Annulation** : avant claim → libération totale ; pendant le rendu → abort + libération totale (coût CPU absorbé) ; après upload → plus d'annulation.
- **Sources** : Free (10, une fois), abonnement (grant mensuel sur `invoice.paid`, idempotent par `invoice.id`), packs (Checkout one-shot, grant idempotent par `session.id`), remboursements Stripe (entrée `refund`).
- **Chat** : inclus mais rate-limité et budgeté ; les tokens sont enregistrés dans `usage_events` pour le coût. Si D6b = 1 crédit/commit, le débit se fait au commit, pas au message.
- **402** explicite (`INSUFFICIENT_CREDITS`) avec solde, coût estimé et lien d'achat ; **429** pour les rate limits.

#### Économie unitaire (modèle complet : `COST_MODEL.md`)

Chiffres au 2026-10-29, prix TTC, TVA 20 %, Stripe 2,7 % + 0,25 €, 1 USD = 0,92 €. À recalibrer en M6/M8.

- **Coûts de production** : **42 €/mois** de socle (1 siège, infra à vide, sans tokens) ; **70–122 €/mois** en démarrage réel (2 sièges Vercel, Supabase 25–35 $, R2/Cloud Run marginaux, API Claude 10–50 $, domaine). Médiane ~96 €. L'API Claude est un coût variable : ne pas la compter deux fois.
- **Coût projet standard** (5 min source, 60 s 1080p, sous-titres, 5 retouches, aperçu 30 s + export 60 s = 10 crédits) : **≈ 0,29 €**, fourchette **0,15–0,50 €** selon le modèle de retouche et le cache.
- **Revenu net après TVA + Stripe** : Starter 7,81 €/100 cr (0,078 €/cr) ; Pro 19,90 €/300 cr (0,066 €/cr) ; Business 48,12 €/900 cr (0,054 €/cr). Annuel = 10× mensuel → −14 à −16 % de net/crédit.
- **Marge à 100 % d'utilisation** : Starter 4,89 € (62,6 %) ; Pro 11,15 € (56,0 %) ; Business 21,87 € (45,5 %). À 60 % : 77,6 % / 73,6 % / 67,3 %.
- **Risque principal : le chat inclus.** Seuils de marge nulle : 22,7 retouches/projet (Starter), 18,5 (Pro), 13,8 (Business). Un projet 720p sans sous-titres (3 cr) avec 5 retouches perd 12 % (Starter), 32 % (Pro), 64 % (Business).
- **Conclusion :** facturer les retouches (D6b) et le commit du plan initial, ou imposer un minimum de 5 crédits/projet. Business est à repricer ou retirer. Détail, tableaux et point mort dans `COST_MODEL.md`.

### Design system

Voir `DESIGN_SPEC.md` (tokens, composants, états, responsive, accessibilité). Les mockups de référence sont dans `design/landing-v1.html` et `design/editor-v1.html`. Le design system est implémenté en Tailwind 4 + primitives shadcn ; les polices web sont auto-hébergées via `next/font` (pas de Google Fonts au runtime).

### Logging (Safe Logging)

- pino, niveaux `info | warn | error` (+ `debug` en dev), destination asynchrone, stdout.
- Champs : `requestId`, `userId`, `projectId`, `jobId`, `model`, `durationMs`, `outcome`.
- Rédaction : cookies, `Authorization`, URLs signées, clés R2/Stripe/Google/Anthropic/Deepgram ; jamais de HTML, prompt, transcript ou contenu de fichier.
- Corrélation web → job via `requestId` propagé dans l'env Cloud Run.
- Les métriques facturables vivent en DB (`credit_ledger`, `usage_events`), jamais dans les logs.

### Sécurité

Autorisation par ressource · URLs R2 courtes · vérification de signature Stripe · vérification OIDC Cloud Scheduler · upload limité (type, taille) · rate limits (chat, rendu, transcription) · allowlist d'outils · CSP + sandbox · aucun HTML libre · secrets Vercel/Secret Manager · service account Google dédié (`roles/run.developer` minimal) · isolation des jobs (timeout, mémoire) · transcripts et noms de fichiers non fiables (prompt injection).

---

## 4. MILESTONES & OBJECTIFS VÉRIFIABLES

| M | Livrable | Objectifs vérifiables | Est. |
|---|---|---|---|
| **M0** | Décisions, monorepo, CI, schéma DB, Supabase/R2 de dev, design system, rendu local, socle GCP | `pnpm i && pnpm test` vert ; migration appliquée ; Producer rend un MP4 local ; tokens + primitives UI ; Cloud Run Job « hello » ; Cloud Scheduler authentifié | 1,5 sem. |
| **M1** | Landing + auth + plans + crédits + Stripe | LCP < 2,5 s ; auth email/OAuth ; grant Free unique ; abonnement mensuel/annuel + pack en test Stripe ; portail ; ledger ; 402 | 2 sem. |
| **M2** | Projets + assets + préparation média | PUT présigné 500 Mo ; probe + miniature ; job `prepare` ; transcript word-level ; rejets type/taille ; suppression projet → R2 nettoyé | 1,5 sem. |
| **M3** | Composition + 4 presets + player + shell éditeur | 4 templates lint clean ; preview < 2 s ; ruleset appliqué ; versions immuables ; shell 3 colonnes ; états loading/empty/error | 2,5 sem. |
| **M4** | Agent planificateur | Brief → `EditPlan` valide → composition conforme (durée ±10 %, 0 URL externe, transitions autorisées) ; p95 < 60 s ; échec propre < 300 s ; une réparation | 1,5 sem. |
| **M5** | Chat de retouche | Ops ciblées correctes ; version N+1 ; undo identique au hash précédent ; concurrence bloquée ; coût D6b appliqué | 1 sem. |
| **M6** | Rendu Cloud Run (aperçu + export) | Aperçu 720p < 60 s ; export 60 s 1080p < 3 min ; réservation/capture/libération ; cache ; idempotence ; annulation | 2 sem. |
| **M7** | Quotas + robustesse + coûts | Quota → 402, rate limit → 429, logs corrélés, aucune fuite de secret, jobs bloqués repris, coût réel/projet instrumenté | 1 sem. |
| **M8** | Bêta privée | E2E Playwright, 10 rendus concurrents, coût réel/rendu mesuré, runbook, déploiement Vercel Pro, pages légales | 1 sem. |

**Total :** 12–14 semaines en séquentiel ; **10–12 semaines** avec 2 ingénieurs et le design déjà fourni.

**Chemin critique :** M3 → M4 → M5 → M6. L'aperçu payant n'est activé qu'à partir de M6.

**Portes de décision :**
- D6b/D6c/D6d/D6e avant M1 (facturation).
- D10b/D11 avant M3 (presets/formats).
- D8b avant M4 (modèle de retouche).
- D9b avant M8 (Vercel Pro + commercial).
- D12 avant M6 (durée d'aperçu).

---

## 5. [ORPHANS & PENDING]

### Décisions encore ouvertes

| ID | Sujet | Défaut proposé | Bloque |
|---|---|---|---|
| D6b | Facturation des retouches IA | 1 crédit par commit, plan initial inclus ; ou allocation mensuelle puis 1 crédit | M1, M5 |
| D6c | Expiration / buckets de crédits | Plan reset mensuel + pack permanent ; Free 90 j | M1 |
| D6d | Plan Business | Reporter (solo only) ; renommer « Studio » mono-siège si maintenu | M1 |
| D6e | Prix annuels / packs | Annuel = 10 × mensuel ; packs 50/150/400 | M1 |
| D8b | Modèle de retouche | Sonnet 5.5 par défaut ; Opus 5.5 sur demande complexe | M4, M5 |
| D8c | Fournisseur de transcription | Deepgram Nova-3 ; comparer Whisper sur du français | M2 |
| D9b | Vercel Pro | Obligatoire avant paiement (Hobby non commercial) | M8 |
| D10b | Prompts/skills + DA des presets | Fournir les prompts ; proposer polices/palettes | M3 |
| D11 | Formats par preset | 1 format fixe par preset ; retirer le sélecteur | M3 |
| D12 | Plafond d'aperçu | 3 min, segment choisi | M6 |
| D13 | Planning durable | Stream + retry ; job seulement si nécessaire | M4 |

### Éléments incomplets / non intégrés (avant prod)

- **P1** HyperFrames **0.8.x (pré-1.0)** : API instable → versions exactes, adaptateur `packages/render`, tests de contrat au upgrade.
- **P2** Cold start Cloud Run (image Chromium ~1–2 Go) et temps de pull à mesurer ; région Artifact Registry = région du Job.
- **P3** Coût réel par render inconnu (CPU-s, durée, preview vs export) → instrumenter en M6 avant de figer D6.
- **P4** Clé de service Google stockée côté Vercel (rotation, moindre privilège) ; Workload Identity non disponible sur Vercel.
- **P5** Pooler Supabase : mode transaction, `max` faible côté Vercel ; pas de prepared statements nommés.
- **P6** ~~Limite de durée des fonctions Vercel~~ → **résolu** : Hobby 300 s, Pro 800 s ; Hobby non commercial (D9b).
- **P7** Rétention assets/exports, suppression de compte, DPA/RGPD non définis.
- **P8** Emails transactionnels (vérification, échec de rendu, crédits épuisés) non choisis.
- **P9** Anti-abus (comptes multiples, crédits offerts, trial) et modération des contenus non traités.
- **P10** Isolation multi-tenant : autorisation applicative seulement, pas de RLS.
- **P11** Scanner antivirus à l'upload non prévu.
- **P12** Observabilité : logs seuls ; APM/Sentry différé.
- **P13** Origine dédiée pour servir les compositions (isolation cookies/CSP) différée ; MVP = route same-origin + iframe sandboxée.
- **P14** Redevances codecs H.264/H.265 selon juridiction à vérifier.
- **P15** Webhooks Stripe en local : Stripe CLI requis.
- **P16** Tests de charge du worker, stratégie d'autoscaling Cloud Run à valider en M8.
- **P17** Licence des polices embarquées dans les 4 presets (OFL à vérifier) et chargement local des WOFF2 au rendu.
- **P18** Rendu local Windows : vérifier le `chrome-headless-shell` embarqué par HyperFrames.
- **P19** **Économie unitaire IA** : Opus 5.5 ($4/$20 MTok) peut consommer plus de crédits que l'aperçu/export. Mesurer plan + retouches ; router vers Sonnet/Haiku ; décider D6b.
- **P20** Deepgram : DPA, rétention audio, endpoint EU, conformité RGPD ; durée de conservation des transcripts.
- **P21** Templates × formats : un format fixe par preset (D11) pour éviter 12 layouts ; sinon coût de design/QA.
- **P22** Design : états manquants (upload, erreurs, vide, loading, modales export/credits, historique de versions), mobile éditeur, focus visible, `aria-live` du chat, reduced motion.
- **P23** Cloud Scheduler → Vercel : vérification OIDC (audience, SA), rejeu, timeout ; à tester en M0.
- **P24** Stripe Tax / TVA UE / factures / remboursements / changements de plan : à configurer et tester.
- **P25** RGPD : DPA Vercel/Supabase/Cloudflare/Google/Anthropic/Deepgram, registre, rétention, droit à l'effacement, mention « contenu généré par IA ».
- **P26** Prompt injection via transcripts, noms de fichiers, briefs ; budget/token limits ; pas d'accès réseau dans les tools.
- **P27** `@hyperframes/player` : import dynamique, SSR, compatibilité Safari/Firefox ; tests de contrat.
- **P28** Analytics/error tracking/emails : Plausible ou Vercel Analytics, Sentry, Resend/Postmark (non choisis).
- **P29** IaC GCP : bootstrap gcloud/console en M0 ; Terraform ensuite (non choisi).
- **P30** Rate limiting sans Redis : compteurs Postgres par fenêtre ; coût/contention à valider.
- **P31** Hobby : 2 Go/1 vCPU, 100 déploiements/jour, logs 1 h ; suffisant pour dev, pas pour la prod commerciale.
- **P32** Formats de sortie et compatibilité sociale (Instagram 9:16, safe areas, sous-titres brûlés vs sidecar) à valider.

---

## 6. [DESIGN]

Le détail est dans **`DESIGN_SPEC.md`**. Résumé des points à corriger avant implémentation :

- **Prix placeholders** (`[PRIX]`, `[N]`) et carte « Pro / Studio » incohérente avec les 3 plans : à aligner sur D6/D6d.
- **Sélecteur 16:9 / 9:16 / 1:1** dans l'éditeur : contredit D11 (format fixe par preset). Le retirer ou le désactiver.
- **« Scènes détectées »** : aucune détection de scènes n'est spécifiée. Soit ajouter une détection FFmpeg dans `prepare`, soit renommer « Scènes du montage ».
- **« 1 crédit »** en dur : le coût doit être calculé (durée/résolution) et affiché avant confirmation.
- **États manquants** : upload/progress, transcription, erreur de rendu, crédits insuffisants, version history, export modal, credit history, empty project.
- **Mobile éditeur** : la media query empile les 3 colonnes ; prévoir un onglet Médias/Scènes/Chat ou un avis « desktop recommandé ».
- **Accessibilité** : focus visible, `aria-live` pour le chat, labels, contrastes (OK), `prefers-reduced-motion`.
- **Polices** : les mockups chargent Google Fonts ; le produit doit auto-héberger Inter (`next/font`) et les polices des presets (WOFF2, OFL).
