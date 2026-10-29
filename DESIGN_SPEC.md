# DESIGN_SPEC — Frame

**Design system et revue des mockups v1.**
Dernière mise à jour : 2026-10-29 · Statut : **spécification — implémentation non démarrée**.
Sources : `design/landing-v1.html`, `design/editor-v1.html` (mockups fournis par le user).

---

## 1. Principes

1. **Sombre, calme, précis.** Le contenu (la vidéo) est la seule source de couleur forte ; l'UI reste neutre.
2. **Une seule action primaire par écran.** Dégradé indigo/violet réservé aux CTA principaux et à l'état actif.
3. **Densité maîtrisée.** L'éditeur est dense mais lisible ; la landing respire.
4. **Le chat est un panneau, pas un modal.** Il reste visible pendant la lecture.
5. **Pas de fausse promesse.** Les coûts, durées et états doivent être réels et visibles avant confirmation.

---

## 2. Tokens

### 2.1 Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#0A0A0A` | Fond global |
| `--bg-elevated` | `#0F0F11` | Fenêtre preview hero, surfaces enfoncées |
| `--surface` | `#18181B` | Cartes, champs, bulles assistant |
| `--surface-2` | `#27272A` | Élément actif, onglet sélectionné, icônes |
| `--border` | `#27272A` | Bordures standard |
| `--border-strong` | `#3F3F46` | Boutons ghost, champs, séparateurs forts |
| `--text` | `#FAFAFA` | Texte principal |
| `--text-secondary` | `#D4D4D8` | Texte secondaire |
| `--text-muted` | `#A1A1AA` | Texte tertiaire, métadonnées |
| `--accent` | `#A5B4FC` | Liens, icônes, progression, accents |
| `--primary` | `#4F46E5` | Début du dégradé, bulle utilisateur |
| `--primary-2` | `#7C3AED` | Fin du dégradé |
| `--success` | `#4ADE80` | Statut `ready`, point « enregistré » |
| `--warning` | `#FBBF24` | Crédits bas, avertissements |
| `--danger` | `#F87171` | Erreurs, échec de rendu |
| `--focus` | `#A5B4FC` | Anneau de focus (2 px + offset 2 px) |

- **Dégradé primaire** : `linear-gradient(90deg, #4F46E5, #7C3AED)`.
- **Glow CTA** : `0 0 40px rgba(124, 58, 237, 0.35)`.
- **Glow hero** : `0 40px 120px rgba(79, 70, 229, 0.18)`.
- **Fond hero** : `radial-gradient(closest-side, rgba(99, 102, 241, 0.28), transparent)`.
- **Scrim sous-titres** : `rgba(10, 10, 10, 0.80)` avec bordure gauche `--accent`.

Contrastes vérifiés : `#A1A1AA` sur `#18181B` ≈ 7:1 ; `#FAFAFA` sur `#0A0A0A` ≈ 19:1 ; blanc sur `#4F46E5` ≈ 6:1 ; blanc sur `#7C3AED` ≈ 5:1. Les CTA restent lisibles.

### 2.2 Typographie

- **Famille UI** : Inter (400, 500, 600, 700, 800), auto-hébergée via `next/font`.
- **Chiffres** : `font-variant-numeric: tabular-nums` pour les timecodes, crédits, prix.
- **Échelle** :

| Rôle | Taille | Line-height | Tracking | Poids |
|---|---|---|---|---|
| Display hero | `clamp(38px, 6vw, 72px)` | 1.03 | -0.045em | 700 |
| H1 landing | `clamp(38px, 6vw, 72px)` | 1.03 | -0.045em | 700 |
| H2 section | `clamp(28px, 3.6vw, 42px)` | 1.10 | -0.03em | 700 |
| H3 carte | 19px | 1.3 | -0.01em | 600/700 |
| Body large | 19px | 1.5 | 0 | 400 |
| Body | 15px | 1.5 | 0 | 400 |
| Body small | 14px | 1.5 | 0 | 400 |
| Meta | 13px | 1.5 | 0 | 400/600 |
| Micro | 11px | 1.4 | 0.08em, uppercase | 600 |
| Prix | 38px | 1.1 | -0.03em | 700 |

- **Éditeur** : base 14px, chat 14px, métadonnées 12px, micro 11px.
- Les polices des **presets vidéo** sont distinctes de l'UI (voir D10b) et embarquées dans les templates.

### 2.3 Espacement

Échelle : `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 112`.

- **Landing** : container `max-width: 1200px`, gutter `32px`, header `64px`, hero top `96px`, sections `112px`.
- **Éditeur** : topbar `56px`, colonnes `280px / minmax(0,1fr) / 360px`, player `max-width: 900px`, padding panneaux `14–20px`, gap `12–14px`.

### 2.4 Rayons

`6` (input inline), `7` (logo), `8` (onglet), `9` (bouton small), `10` (bouton ghost), `12` (CTA, bulle, composer), `14` (player), `16` (carte), `999` (pill).

### 2.5 Ombres

- CTA : glow violet.
- Hero preview : glow indigo + bordure `--border`.
- Modales : `0 24px 80px rgba(0,0,0,0.6)` (à ajouter, absent des mockups).

### 2.6 Motion

- Durées : `150ms` (hover), `200ms` (panneau), `250ms` (modal).
- Courbe : `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Respecter `prefers-reduced-motion: reduce` : désactiver les glows animés, les translations et le scroll smooth.
- Pas d'animation sur la progression de rendu au-delà d'une transition de largeur.

---

## 3. Composants

### 3.1 Boutons

| Variante | Spec | États |
|---|---|---|
| **Primary** | H 40/44/48/52, px 16/24/32, radius 12, dégradé, texte 14–16/600, glow | hover (luminosité +5 %), active (scale .99), focus ring, disabled (opacity .5), loading (spinner + label) |
| **Ghost** | H 36/40, px 14/16, radius 9/10, bordure `--border-strong`, fond transparent | hover `--surface`, focus, disabled |
| **Subtle** | H 36, fond `--surface`, bordure `--border` | hover `--surface-2` |
| **Icon** | 36×36 ou 40×40, radius 9/50 % | aria-label obligatoire |
| **Link** | `--accent`, underline au hover | focus visible |

- Les CTA de la landing ont un glow ; dans l'éditeur, **pas de glow** (sobriété).
- Interdit : `<div onclick>`, `outline: none` sans remplacement.

### 3.2 Cartes

- `--surface`, bordure `--border`, radius 16, padding 24.
- Carte feature : icône 44×44 radius 12 (`--surface-2`, `--accent`), titre 19, texte 14 muted.
- Carte pricing : prix 38, description 14, CTA pleine largeur ; carte mise en avant : bordure `#6366F1` (à aligner sur `--primary`).
- Carte projet (à créer) : miniature 16:9, nom, preset, durée, statut, date.

### 3.3 Pills & statuts

- Pill : h ~24, px 10, radius 999, fond `--surface`, bordure `--border`, texte 12 `--text-secondary`.
- Point de statut : 6×6, `--success` pour `ready/enregistré`, `--warning` pour `preparing`, `--danger` pour `failed`.
- Pills d'outils (`setText`, `setTiming`…) : mêmes tokens, mais **non interactives** (ce sont des traces d'exécution). Si cliquables, les distinguer.

### 3.4 Navigation

- Header landing : logo 26×26 radius 7 (F blanc sur fond clair inversé), nom 18/700, badge `v0.8`, nav 14, CTA.
- Nav mobile : masquée < 700px ; prévoir un menu (absent du mockup).
- Footer : 3 zones, texte 14, bordures `--border`.

### 3.5 Éditeur

- **Topbar** : fil d'Ariane, nom de projet éditable, pill « Enregistré », sélecteur de version `v3`, undo, coût d'aperçu, export, solde de crédits, avatar.
- **Panneau gauche** : onglets Médias/Scènes, liste de fichiers, bouton d'ajout, liste de scènes.
- **Player** : badge « Live preview · gratuite », sélecteur de format (à retirer, D11), zone 16:9, lower-third, transport (play, scrub, timecode).
- **Panneau droit** : en-tête Director, fil de chat, pills d'outils, suggestions, composer.
- **Modales manquantes** : export, achat de crédits, historique de versions, suppression de projet, upload.

### 3.6 Chat

- Bulle utilisateur : fond `--primary`, texte blanc, radius `12 12 4 12`, max 88 %.
- Bulle assistant : `--surface`, bordure `--border`, radius `12 12 12 4`, max 92 %.
- Trace d'outils : pills 11–12px, gap 6, wrap.
- Streaming : curseur/clignotement + `aria-live="polite"` ; ne pas voler le scroll si l'utilisateur est remonté.
- Erreur : bulle `--danger` + bouton « Réessayer » ; ne pas perdre le message.
- Composer : input + bouton 36×36, radius 12, bordure `--border-strong` ; disabled si rendu en cours ? Non : le chat peut rester actif, mais le commit est bloqué si un job tourne.

### 3.7 Crédits

- Badge topbar : `24 cr`, cliquable → popover (solde, coût des prochaines actions, lien historique/achat).
- Coût avant action : `Aperçu 720p · 1 crédit` (dynamique), `Export 1080p · 4 crédits/min` ; si solde insuffisant, désactiver + lien « Recharger ».
- Modale d'export : résolution, durée, coût, ETA, confirmation, mention « la consultation reste gratuite ».
- Historique : date, type, projet, bucket, montant, solde après.

### 3.8 Formulaires

- Input h 40, fond `--surface`, bordure `--border-strong`, radius 10, texte 14, placeholder `--text-muted`.
- Label visible (pas seulement sr-only) pour les formulaires hors éditeur ; le mockup utilise des labels sr-only pour le nom de projet et le message, acceptable car placeholder + aria-label.
- Select, checkbox, radio : mêmes tokens ; focus ring.
- Dropzone upload : bordure dashed, icône, texte, progression, annulation, erreurs.

### 3.9 Feedback

- Toast : bas-droite, `--surface`, bordure, radius 12, 4 s, `role="status"`.
- Skeleton : blocs `--surface-2` avec pulse ; pas de spinner plein écran.
- Empty state : icône, titre, texte, action.
- Error state : message actionnable + `requestId` copiable.
- Confirmation destructive : modal, pas `confirm()`.

---

## 4. Écrans

### 4.1 Existants (mockups)

| Écran | Fichier | Couverture |
|---|---|---|
| Landing | `design/landing-v1.html` | Header, hero + preview, 4 presets, 3 étapes, tarifs (placeholders), footer |
| Éditeur | `design/editor-v1.html` | Topbar, médias/scènes, player, chat, crédits |

### 4.2 À concevoir avant M3/M6

1. **Auth** : login, signup, vérification email, mot de passe oublié.
2. **Dashboard projets** : liste, création, empty state, suppression.
3. **Nouveau projet** : choix du preset (4 cartes), format (lecture seule), durée cible, brief, coût de transcription.
4. **Upload** : dropzone, progression par fichier, probe, erreurs, réorganisation.
5. **Préparation** : transcription en cours, coût, échec/retry.
6. **Planification** : étapes de l'agent, streaming, annulation, échec/réparation.
7. **Export** : modale de coût/confirmation, progression, téléchargement, expiration du lien.
8. **Crédits** : solde, historique, packs, abonnement, factures, portail.
9. **Versions** : liste v1..vN, diff résumé, revert.
10. **Paramètres** : profil, email, suppression de compte, préférences.
11. **Légal** : CGU, confidentialité, mentions, DPA, cookies.
12. **Erreurs** : 404, 500, 402, 429, offline.
13. **Emails** : vérification, échec de rendu, crédits épuisés.

---

## 5. Responsive

| Breakpoint | Comportement |
|---|---|
| ≥ 1280px | Éditeur 3 colonnes 280/1fr/360 ; landing 4 cartes |
| 1100–1279px | Éditeur 3 colonnes, panneaux réduits (240/1fr/320) |
| 700–1099px | Éditeur : onglets Médias/Scènes/Chat, player plein écran ; landing 2 colonnes |
| < 700px | Landing 1 colonne, nav masquée + menu ; éditeur : preview + chat en onglets, topbar compacte |
| < 480px | CTA pleine largeur, prix 32px, timecodes 12px |

- L'éditeur est **desktop-first**. Si le mobile n'est pas prioritaire, afficher un bandeau « Pour éditer, ouvrez sur desktop » mais garantir la lecture et le chat.
- Ne pas empiler les 3 colonnes comme le mockup : l'ordre Médias → Player → Chat sur mobile est mauvais (le chat passe après le player, très long).

---

## 6. Accessibilité (WCAG 2.2 AA)

- **Focus visible** partout : `outline: 2px solid var(--focus); outline-offset: 2px`.
- **Clavier** : navigation logique, `Esc` ferme les modales, `Enter` envoie, `Shift+Enter` nouvelle ligne, `Space` play/pause sur le player (hors input).
- **ARIA** : `aria-live="polite"` pour le chat et la progression ; `aria-busy` pendant le rendu ; `role="status"` pour les toasts ; labels explicites pour les icon-buttons.
- **Contraste** : vérifier les textes muted sur surfaces ; ne pas descendre sous 4.5:1 pour le corps.
- **Cibles** : 24×24 minimum (WCAG 2.2), viser 44×44 pour les actions tactiles.
- **Mouvement** : `prefers-reduced-motion`.
- **Zoom** : 200 % sans perte de fonctionnalité ; éviter les hauteurs fixes sur les panneaux.
- **Sémantique** : un seul `h1` par page, hiérarchie de titres, listes réelles, boutons réels.
- **Formulaires** : erreurs associées via `aria-describedby`, pas seulement couleur.

---

## 7. Copy & ton

- Français, tutoiement ? **Non** : vouvoiement (« Décrivez », « Importez »). Le mockup est cohérent.
- Vocabulaire : **preset** (garder), **aperçu rendu** (pas « preview »), **live preview** (garder, c'est le player), **crédits**, **export**, **retouches**.
- Éviter « Studio » si le plan n'existe pas ; éviter « Pro / Studio ».
- Les coûts sont toujours annoncés avant l'action : « 1 crédit », « 4 crédits/min », « X crédits ».
- Les échecs expliquent quoi faire : « Le rendu a échoué. Vos crédits ont été restitués. Réessayer. »
- Mention IA : « Planifié par Director. Vérifiez avant export. »

---

## 8. Problèmes relevés dans les mockups

| # | Problème | Impact | Correctif |
|---|---|---|---|
| 1 | Prix `[PRIX]`, `[N]` | Ne peut pas ship | Brancher D6/D6d/D6e |
| 2 | « Pro / Studio » vs 3 plans | Incohérence | 4 cartes ou toggle Starter/Pro |
| 3 | Sélecteur 16:9/9:16/1:1 | Contredit D11 | Retirer/désactiver |
| 4 | « Scènes détectées » | Promesse non implémentée | Détection FFmpeg ou renommer |
| 5 | « 1 crédit » en dur | Faux pour >30 s | Calcul dynamique |
| 6 | Pas d'états loading/error/empty | UX incomplète | Ajouter (§3.9/§4.2) |
| 7 | Pas de modale export/credits | Parcours incomplet | Ajouter |
| 8 | Mobile éditeur empilé | Chat inaccessible | Onglets |
| 9 | Google Fonts runtime | Dépendance réseau, RGPD | `next/font` + WOFF2 locaux |
| 10 | Focus non stylé | A11y | Ajouter |
| 11 | `outline:0` sur l'input message | A11y | Focus ring |
| 12 | Pills d'outils sans sémantique | Confusion | `aria-label` / rôle trace |
| 13 | Pas de `aria-live` sur le chat | Streaming inaccessible | Ajouter |
| 14 | Hero preview statique | Ne montre pas le player | Acceptable pour la landing, mais prévoir une vraie démo |
| 15 | « v0.8 » badge | Ambigu (produit vs HyperFrames) | Clarifier ou retirer |
| 16 | Liens footer « Documentation » morts | Confiance | Créer ou retirer |

---

## 9. Implémentation

- **Tailwind 4** : tokens dans `@theme` / variables CSS ; pas de couleurs en dur dans les composants.
- **shadcn** : primitives Dialog, Popover, Toast, Tabs, Select, Tooltip, Skeleton ; style aligné sur les tokens.
- **Polices** : `next/font/local` ou `next/font/google` (build-time, auto-hébergé). Inter + polices display des presets.
- **Icônes** : SVG inline (mockups) ou `lucide-react` (version à épingler) ; ne pas mélanger les deux styles.
- **Composants** : `components/ui/*` pour les primitives, `components/marketing/*`, `components/editor/*`.
- **RSC** : landing et pages de contenu en Server Components ; éditeur, chat, player en Client Components.
- **Player** : import dynamique de `@hyperframes/player` (web component), fallback `video` pour les MP4.
- **Pas de CSS inline** dans l'app (les mockups en contiennent) ; utiliser les classes/tokens.
- **Tests visuels** : Playwright screenshots sur landing + éditeur (desktop 1440, mobile 390).

---

## 10. En attente

- **D6/D6d/D6e** : prix, plans, packs → landing + page crédits.
- **D10b** : prompts/skills + direction artistique des 4 presets → palettes/polices des templates.
- **D11** : formats par preset → sélecteur du player.
- **D12** : plafond d'aperçu → libellé du bouton et modale d'export.
- **D6b** : facturation des retouches → copy du chat et du panneau crédits.
