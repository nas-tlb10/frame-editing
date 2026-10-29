# COST_MODEL — Frame

**Modèle de coûts, marge et point mort — plan actuel.**
Dernière mise à jour : 2026-10-29 · Statut : **estimation pré-M0, à recalibrer en M6/M8**.
Périmètre : infra, IA, transcription, rendu, stockage, paiement. **Hors salaires, marketing, juridique, support, remboursements et chargebacks.**
Sources : tarifs publics consultés le 2026-10-29 (§11).

> **Lecture rapide :** le plan actuel est rentable à usage modéré — marge brute de **56–63 %** pour Starter/Pro à 100 % d'utilisation des crédits, **~71 %** à 60 % — mais il est **fragile** : le chat est inclus sans facturation, les projets 720p sans sous-titres sont loss-making **à pleine utilisation**, et Business perd de l'argent dès **~14 retouches/projet à 100 % d'utilisation**. Détail et recommandations en §10.

---

## 0. Hypothèses

| # | Hypothèse | Valeur | Impact |
|---|---|---|---|
| H1 | Prix affichés **TTC**, TVA France 20 % | 9,99 / 24,99 / 59,99 € TTC | Si les prix sont HT, le revenu net augmente de ~20 % |
| H2 | Taux de change | 1 USD = 0,92 € | ±10 % de FX = ±10 % sur les coûts USD |
| H3 | Stripe | 2,7 % + 0,25 € par transaction | 1,5 % Payments + 0,7 % Billing + 0,5 % Tax, carte EEA standard |
| H4 | Offre actuelle | Free 10 cr ; Starter 9,99 €/100 cr ; Pro 24,99 €/300 cr ; Business 59,99 €/900 cr (à arbitrer) | Annuel = 10 × mensuel |
| H5 | Barème crédits | Aperçu 720p 1 cr/30 s ; export 720p 2 cr/min ; 1080p 4 cr/min ; transcription 1 cr/min | Chat inclus, D6b non tranché |
| H6 | Projet standard | 5 min source, 60 s de sortie, 1080p, sous-titres, **5 retouches**, 1 aperçu 30 s, 1 export 60 s | **10 crédits** |
| H7 | Tokens | Plan Opus 25k in / 4k out, 80 % cache ; retouche Sonnet 12k in / 1,5k out, 80 % cache | Fourchette ±30–50 %, à mesurer |
| H8 | Rendu | Cloud Run 2 vCPU / 4 GiB, minimum 1 min/job, `europe-west9` ; egress 0,12 $/GB | Le rendu n'est pas le poste dominant |
| H9 | Stockage | 0,7 GB/projet, 5 projets retenus/utilisateur = 3,5 GB/utilisateur | R2 : 10 GB gratuits |
| H10 | Utilisation | 30 % / 60 % / 100 % des crédits du plan consommés | Le point critique est le **mix** projets/retouches |

---

## 1. Coûts mensuels de production

Deux chiffres différents, souvent confondus :

- **Socle à vide** : ce que coûte l'infra quand personne n'utilise le produit, **1 siège, 0 token**.
- **Budget réaliste de démarrage** : **2 sièges** + les tokens réellement consommés par les tests et le Free. C'est le chiffre à mettre en trésorerie.

### 1.1 Socle technique (1 siège, sans tokens)

| Technologie | Offre | Fixe / mois | Inclus / remarques |
|---|---|---:|---|
| Vercel | Pro, 1 siège | **18,40 €** (20 $) | 20 $ de crédit usage/mois, 1 TB + 1 M requêtes CDN, 1 domaine offert la 1re année |
| Supabase | Pro | **23,00 €** (25 $) | 8 GB DB, 100 GB stockage, 250 GB egress ; crédit compute 10 $ (Micro) |
| Cloudflare R2 | Standard | **0 €** | 10 GB, 1 M Class A, 10 M Class B gratuits ; egress gratuit |
| Cloud Run Jobs | Pay-as-you-go | **0 €** à l'arrêt | Scale-to-zero ; free tier 240k vCPU-s + 450k GiB-s/mois |
| Cloud Scheduler | 1 job | **0,09 €** (0,10 $) | 3 jobs gratuits |
| Artifact Registry | ~2 GB d'image | **0,18 €** (0,20 $) | 0,5 GB gratuit, puis 0,10 $/GB-mois |
| Secret Manager | 6 secrets | **0 €** | 6 versions actives gratuites |
| Domaine | .com/.fr | **0 €** an 1 | Inclus avec Vercel Pro ; ~12 €/an ensuite |
| Resend | Free | **0 €** | 3 000 emails/mois, 100/jour |
| Sentry | Free | **0 €** | 5k erreurs/mois |
| **Total** | | **≈ 41,67 € / mois** | Arrondi **42 €/mois** |

### 1.2 Budget réaliste de démarrage (2 sièges + tokens)

| Poste | Hypothèse | $/mois | €/mois |
|---|---|---:|---:|
| Vercel Pro | **2 sièges** × 20 $ | 40 | **36,80** |
| Supabase Pro | 25 $ + compute/overage (Micro → Small) | 25–35 | **23,00–32,20** |
| Cloudflare R2 | quelques GB, sous le free tier | 0–2 | **0–1,84** |
| Cloud Run Jobs | free tier + débordement | 0–5 | **0–4,60** |
| API Claude | tests + inscriptions Free + bêta | 10–50 | **9,20–46,00** |
| Domaine | an 1 offert par Vercel, ~12 $/an ensuite | 0–1 | **0–0,92** |
| **Total** | | **76–133 $** | **≈ 70–122 €** |

Médiane indicative : **~105 $ ≈ 96 €/mois**.

**Écart avec le socle 1.1 (+28 à +80 €) :**
- **2e siège Vercel : +18,40 €** — c'est le premier poste de l'écart, et il est structurel dès qu'on est deux.
- **Tokens Claude : +9,20 à +46,00 €** — variable, pas fixe (§2). 10 $ ≈ 32 projets standards ; 50 $ ≈ 160 projets. C'est le coût du Free (10 crédits/inscription) et des tests.
- **Supabase compute/overage : +0 à +9,20 €** — le crédit 10 $ couvre Micro ; Small coûte 5 $ de plus, le reste est du stockage/egress au-delà des quotas.
- **R2 + Cloud Run : +0 à +6,44 €** — nuls au début, marginaux ensuite.
- **Domaine : 0 € en an 1**, ~1 €/mois après.

> **Attention au double comptage :** l'API Claude figure ici comme enveloppe de trésorerie **et** en coût variable (§2, §8). Ne l'additionne pas deux fois : dans le compte de résultat, elle est déjà dans la ligne « Anthropic + Deepgram ».

**Le crédit usage Vercel (20 $) est par compte, pas par siège** : un 2e siège ajoute 20 $ de fixe, pas 20 $ de crédit supplémentaire.

**Variantes :** Resend Pro +18,40 €/mois ; Sentry Team +23,92 €/mois ; analytics 0–8 €/mois. Avec tout ça, compter **70–160 €/mois** en production réelle.

**Développement :** Vercel Hobby (gratuit, non commercial), Supabase Free, R2 gratuit, Cloud Run free tier, crédit Deepgram 200 $. Le coût fixe de dev est **0–20 €/mois**, hors tokens de test.

---

## 2. Coûts variables unitaires

| Technologie | Tarif public | Coût unitaire / repère | Notes |
|---|---|---:|---|
| Anthropic Opus 5.5 | 4 $/MTok in, 20 $/MTok out ; cache hit 0,20 $, write 5 $ | **0,10–0,18 $** (0,09–0,17 €) | Planification ; 25k in / 4k out, 80 % cache |
| Anthropic Sonnet 5.5 | 2 $/MTok in, 10 $/MTok out ; cache hit 0,10 $, write 2,50 $ | **0,021–0,039 $** par retouche | 12k in / 1,5k out, 80 % cache ; 5 retouches = 0,10–0,20 $ |
| Anthropic Haiku 5.5 | 0,10 $/MTok in, 0,50 $/MTok out | **0,001–0,002 $** par retouche | Option pour les ops simples |
| Deepgram Nova-3 | 0,0043 $/min | **0,0215 $** pour 5 min (0,0198 €) | Crédit 200 $ ≈ 46 500 min ≈ 9 300 projets à 5 min |
| Cloud Run Jobs | 0,000018 $/vCPU-s + 0,000002 $/GiB-s | **0,00264 $** par job d'1 min (0,00243 €) | Minimum 1 min ; free tier ≈ 1 875 jobs/mois |
| Egress GCP → R2 | 0,12 $/GB | **0,0084 $** pour 70 MB (0,0077 €) | R2 ne facture pas l'egress, mais GCP facture la sortie vers R2 |
| Cloudflare R2 | 0,015 $/GB-mois | **0,0105 $** pour 0,7 GB (0,0097 €) | 10 GB gratuits ; Class A 4,50 $/M, Class B 0,36 $/M |
| Stripe | 2,7 % + 0,25 € | Starter **0,52 €** (5,2 %) ; Pro **0,92 €** (3,7 %) ; Business **1,87 €** (3,1 %) | Cartes premium/internationales plus chères |
| Vercel Functions | 0,177 $/CPU-h ; 0,0146 $/GB-h ; 0,60 $/M invocations | ~0,0001–0,001 $ par chat | Le crédit 20 $ couvre largement le début |
| Supabase | Inclus dans le Pro | 0 | Le stockage média est dans R2, pas dans Supabase |
| Cloud Scheduler | 0,10 $/job/mois | 0,09 € | 3 gratuits |
| Artifact Registry | 0,10 $/GB-mois | ~0,18 € pour 2 GB | 0,5 GB gratuit |
| Secret Manager | 0,06 $/secret-mois après 6 | 0 | 6 gratuits ; accès 0,03 $/10k |
| Resend | 20 $/mois pour 50k | 0 en Free | 3k/mois gratuits |
| Domaine | ~12 €/an | ~1 €/mois | An 1 offert avec Vercel Pro |

---

## 3. Coût d'un projet standard

Projet : 5 min source, 60 s de sortie, 1080p, sous-titres, 5 retouches, 1 aperçu 30 s, 1 export 60 s = **10 crédits**.

| Poste | Base (Sonnet, sans cache) | Optimisé (cache 80 %) | Opus partout | Haiku |
|---|---:|---:|---:|---:|
| Plan Opus | 0,120 $ / 0,110 € | 0,104 $ / 0,096 € | 0,104 $ / 0,096 € | 0,104 $ / 0,096 € |
| 5 retouches | 0,150 $ / 0,138 € | 0,104 $ / 0,096 € | 0,390 $ / 0,359 € | 0,010 $ / 0,009 € |
| Transcription 5 min | 0,0215 $ / 0,0198 € | 0,0215 $ / 0,0198 € | 0,0215 $ / 0,0198 € | 0,0215 $ / 0,0198 € |
| Rendu + egress | 0,0184 $ / 0,0169 € | 0,0184 $ / 0,0169 € | 0,0184 $ / 0,0169 € | 0,0184 $ / 0,0169 € |
| Stockage 0,7 GB | 0,0105 $ / 0,0097 € | 0,0105 $ / 0,0097 € | 0,0105 $ / 0,0097 € | 0,0105 $ / 0,0097 € |
| **Total** | **0,320 $ / 0,295 €** | **0,258 $ / 0,238 €** | **0,544 $ / 0,501 €** | **0,164 $ / 0,151 €** |

**Fourchette retenue : 0,15–0,50 € par projet, base 0,29 €.**
Le poste dominant est l'IA (plan + retouches), pas le rendu. Une erreur de 2× sur les tokens ou les retouches déplace la marge de 10–20 points.

---

## 4. Revenu net par formule (après TVA et Stripe)

### 4.1 Mensuel

| Formule | Prix TTC | TVA 20 % | HT | Stripe | **Net** | Crédits | **€ net/crédit** | Fuite TVA+Stripe |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Starter | 9,99 € | 1,665 € | 8,325 € | 0,520 € | **7,805 €** | 100 | **0,0781 €** | 21,9 % |
| Pro | 24,99 € | 4,165 € | 20,825 € | 0,925 € | **19,900 €** | 300 | **0,0663 €** | 20,4 % |
| Business | 59,99 € | 9,998 € | 49,992 € | 1,870 € | **48,122 €** | 900 | **0,0535 €** | 19,8 % |

### 4.2 Annuel (10 × mensuel)

| Formule | Prix annuel | Net/an | **Net/mois** | **€ net/crédit** | vs mensuel |
|---|---:|---:|---:|---:|---:|
| Starter | 99,90 € | 80,303 € | **6,692 €** | **0,0669 €** | −14,3 % |
| Pro | 249,90 € | 201,253 € | **16,771 €** | **0,0559 €** | −15,7 % |
| Business | 599,90 € | 483,469 € | **40,289 €** | **0,0448 €** | −16,3 % |

**Si les prix sont HT** : le net devient 9,47 € / 24,07 € / 58,12 €, soit +20 % environ. C'est l'arbitrage le plus important à trancher avant de figer les prix.

---

## 5. Marge par formule — projet standard 10 crédits, 5 retouches

Marge = revenu net − coût variable. **Avant coûts fixes (42 €/mois de socle, ~70–120 €/mois en démarrage réel avec tokens).**

| Formule | 30 % d'utilisation | 60 % d'utilisation | 100 % d'utilisation | Annuel 100 % |
|---|---:|---:|---:|---:|
| Starter | **6,93 €** (88,8 %) | **6,06 €** (77,6 %) | **4,89 €** (62,6 %) | **3,78 €** (56,4 %) |
| Pro | **17,28 €** (86,8 %) | **14,65 €** (73,6 %) | **11,15 €** (56,0 %) | **8,02 €** (47,8 %) |
| Business | **40,25 €** (83,6 %) | **32,37 €** (67,3 %) | **21,87 €** (45,5 %) | **14,04 €** (34,9 %) |

**Lecture :** à 60 % d'utilisation, les marges sont confortables. À 100 %, Business tombe à 45,5 % et l'annuel Business à 34,9 %. Le plan annuel coûte 14–16 % de revenu net par crédit : il n'est soutenable que si l'usage reste modéré ou si les retouches sont facturées.

---

## 6. Sensibilité aux retouches — le vrai risque

Projet 10 crédits, 100 % d'utilisation, 5 retouches de référence. La marge est en % du revenu net.

| Retouches / projet | 0 | 5 | 10 | 15 | 20 | 25 | 30 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Starter** | 80,3 % | 62,6 % | 45,0 % | 27,3 % | 9,6 % | −8,1 % | −25,8 % |
| **Pro** | 76,8 % | 56,0 % | 35,2 % | 14,4 % | −6,4 % | −27,2 % | −48,0 % |
| **Business** | 71,3 % | 45,5 % | 19,6 % | −6,2 % | −32,0 % | −57,8 % | −83,6 % |

**Seuil de rentabilité (100 % d'utilisation) :**

| Formule | Retouches/projet avant marge nulle |
|---|---:|
| Starter | **22,7** |
| Pro | **18,5** |
| Business | **13,8** |

Un utilisateur qui itère beaucoup sur un seul projet peut donc consommer peu de crédits de rendu et beaucoup de retouches. **Le chat inclus est un coût non borné.** Il faut soit facturer les retouches (D6b), soit plafonner les commits par projet/mois.

En **annuel**, Business est encore plus exposé : à 10 retouches/projet, sa marge tombe à **~4 %** (40,29 € de revenu mensuel net − 38,70 € de coût variable) ; à 15 retouches, elle est négative (−10,83 €).

---

## 7. Sensibilité au type de projet — Starter à 100 %

| Projet | Crédits | Coût | Revenu net | Marge/projet | Marge % |
|---|---:|---:|---:|---:|---:|
| 720p, sans sous-titres, 5 retouches | 3 | 0,263 € | 0,234 € | **−0,029 €** | **−12 %** |
| 1080p, sans sous-titres, 5 retouches | 5 | 0,272 € | 0,390 € | **+0,118 €** | **30 %** |
| 720p, sous-titres 5 min, 5 retouches | 8 | 0,282 € | 0,625 € | **+0,343 €** | **55 %** |
| 1080p, sous-titres 5 min, 5 retouches | 10 | 0,292 € | 0,781 € | **+0,489 €** | **63 %** |
| 1080p, sous-titres, 5 retouches facturées (D6b) | 15 | 0,292 € | 1,171 € | **+0,879 €** | **75 %** |

**Conséquences :**
- Le projet **720p sans sous-titres** est loss-making pour toutes les formules : 3 crédits ne couvrent ni le plan Opus ni les retouches.
- Business est encore plus exposé : à 100 % d'utilisation et 5 crédits/projet, sa marge est déjà négative (−1,7 % au niveau du plan).
- **Le plan initial n'est pas gratuit** : il coûte ~0,10–0,18 $. Facturer 1–2 crédits au commit du plan, ou imposer un minimum de 5 crédits/projet, corrige ce trou.

---

## 8. Coût total par technologie à l'échelle

Hypothèses : mix 60 % Starter / 30 % Pro / 10 % Business, 60 % d'utilisation, projet standard 10 crédits, 14,4 projets/utilisateur/mois, 3,5 GB stockage/utilisateur, 70 MB d'egress/projet.

| Technologie | 100 utilisateurs | 1 000 utilisateurs | 10 000 utilisateurs |
|---|---:|---:|---:|
| Vercel | 18,40 € | 18,40 € | 92,00 € |
| Supabase | 23,00 € | 23,00 € | 23,00 € |
| Cloudflare R2 | 4,69 € | 48,16 € | 482,86 € |
| Cloud Run (compute) | 2,19 € | 65,15 € | 694,69 € |
| Egress GCP → R2 | 11,13 € | 111,28 € | 1 112,83 € |
| Scheduler / Artifact / Secret | 0,28 € | 0,28 € | 0,28 € |
| Anthropic + Deepgram | 386,18 € | 3 861,79 € | 38 617,92 € |
| **Total** | **445,87 €** | **4 128,06 €** | **41 023,58 €** |

### Compte de résultat simplifié (avant salaires)

| Utilisateurs payants | Projets/mois | Revenu net | Coût IA | Coût infra | **Marge brute** | **%** |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 144 | 155 € | 39 € | 43 € | **73 €** | **47,1 %** |
| 100 | 1 440 | 1 547 € | 386 € | 60 € | **1 101 €** | **71,2 %** |
| 1 000 | 14 400 | 15 465 € | 3 862 € | 266 € | **11 337 €** | **73,3 %** |
| 10 000 | 144 000 | 154 655 € | 38 618 € | 2 406 € | **113 631 €** | **73,5 %** |

**Lecture :** à partir de 100 utilisateurs, l'IA représente **87–94 %** du coût total. L'infra n'est pas le problème ; le pilotage des tokens et des retouches l'est. Le **socle de 42 €/mois** est couvert par 4 abonnés à 60 % d'utilisation ; le **budget réaliste (~96 €, 2 sièges et tokens inclus)** par ~9 abonnés. Les salaires, eux, ne sont pas couverts.

*Vercel est compté à 1 siège dans ce tableau ; un 2e siège ajoute 18,40 €/mois, soit +4 % sur le coût total à 100 utilisateurs et négligeable au-delà.*

---

## 9. Point mort

Hypothèses : mix 60/30/10, projet standard 10 crédits, 5 retouches, marge brute avant salaires.

| Utilisation | Projets/utilisateur | Contribution/utilisateur | Point mort socle (42 €) | Point mort réel (96 €) | +5 k€/mois | +10 k€/mois | +12 k€/mois |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 30 % | 7,2 | 13,37 € | 4 abonnés | **8 abonnés** | 378 | 752 | 902 |
| 60 % | 14,4 | 11,27 € | 4 abonnés | **9 abonnés** | 448 | 892 | **1 069** |
| 100 % | 24,0 | 8,47 € | 5 abonnés | **12 abonnés** | 596 | 1 187 | **1 423** |

**Ordre de grandeur :** pour payer **2 ingénieurs à 4 k€ brut** (~11,6 k€ chargés), il faut **~1 000 abonnés payants** à 60 % d'utilisation, **~1 380** à 100 %, ou **~870** à 30 %. Avec 100 abonnés, la marge brute (~1,1 k€/mois) ne couvre pas les salaires.

---

## 10. Verdict et recommandations

### 10.1 Verdict

Le plan actuel **tient économiquement à usage modéré** : 56–63 % de marge brute pour Starter/Pro à 100 % d'utilisation, ~71 % à 60 %, et un coût fixe faible (**42 €/mois de socle, ~96 €/mois en démarrage réel**). Mais il n'est **pas robuste** :

1. **Chat inclus = coût non borné.** Seuils de marge nulle : 22,7 retouches/projet (Starter), 18,5 (Pro), 13,8 (Business). À 20 retouches, Pro perd de l'argent ; Business dès 15.
2. **Les petits projets ne couvrent pas leurs coûts.** 3 crédits (720p, sans sous-titres) avec 5 retouches : −12 % Starter, −32 % Pro, −64 % Business.
3. **Business est la formule la plus fragile.** Revenu net/crédit le plus bas (0,0535 €), marge négative à 5 crédits/projet ou 15 retouches, et 34,9 % seulement en annuel à 100 %.
4. **L'annuel coûte 14–16 % de revenu net/crédit.** Il reste positif à usage modéré, mais ne pardonne pas les gros consommateurs.
5. **Le Free peut coûter 0,80–1,50 € par inscription** si le chat reste illimité ; à 1 000 inscriptions, 800–1 500 € de coût d'acquisition.
6. **TVA + Stripe prélèvent 20–22 % du prix affiché.** Raisonner en TTC est indispensable.

### 10.2 Recommandations

| Priorité | Mesure | Effet |
|---|---|---|
| **P0** | **D6b = 1 crédit par retouche commitée** (ou 3 gratuites/projet puis 1 crédit) | Marge 100 % : Starter 77,6 %, Pro 70,7 %, Business 63,6 % ; plafonne l'abus |
| **P0** | **1–2 crédits au commit du plan initial**, ou **minimum 5 crédits/projet**, ou plafond mensuel de projets | Couvre le plan Opus des petits projets ; supprime le cas 3 crédits loss-making |
| **P0** | **Plafonner le Free** : 1 projet, 3 retouches, 10 crédits ; pas de chat illimité | Coût Free ramené à ~0,30–0,50 €/inscription |
| **P1** | **Reporter ou repricer Business** : 69,99 €/700–900 crédits, ou le retirer (D5 = solo) | Évite la formule la moins rentable et la plus exposée au chat |
| **P1** | **Annuel = 11 × mensuel** si le chat reste inclus ; garder 10 × seulement avec D6b | Récupère 8–9 % de revenu net |
| **P1** | **Prix** : si chat inclus, Starter 12,99 € ou 80 crédits, Pro 29,99 €, Business 69,99 € | +17–31 % de revenu net/crédit ; à tester |
| **P2** | **Monitoring** : retouches/projet, crédits/projet, coût réel/projet, p95 rendu ; alerte si retouches/projet > 10 ou crédits/projet < 5 | Détecte la dérive avant qu'elle ne mange la marge |

**Recommandation principale :** ne pas augmenter les prix au lancement. **Facturer les retouches (D6b) et le commit du plan initial** est plus juste, aligne le coût sur l'usage et préserve l'attrait du prix d'entrée. Si le user refuse de facturer les retouches, alors il faut réduire les crédits (Starter 80, Pro 240, Business 600) ou augmenter les prix de 20–30 %.

### 10.3 Décisions à prendre

- **D6b** : 1 crédit/retouche commitée, ou allocation mensuelle puis 1 crédit.
- **D6d** : Business maintenu, repricé ou retiré.
- **D6e** : annuel 10× ou 11× ; taille des packs.
- **Free** : plafond de projets/retouches.
- **Prix TTC ou HT** : change toute la marge de ~20 %.
- **D12** : plafond d'aperçu 3 min (impacte le nombre de crédits/projet).
- **D8b** : Sonnet par défaut, Opus sur demande complexe (impacte la fourchette 0,24–0,50 €/projet).

---

## 11. Sources

Tarifs publics consultés le **2026-10-29**, hors TVA, susceptibles d'évoluer. Vérifier les lignes de facture avant de figer le modèle.

- Vercel — Pro plan : https://vercel.com/docs/plans/pro-plan
- Vercel — Fluid compute pricing : https://vercel.com/docs/functions/usage-and-pricing
- Vercel — Pricing : https://vercel.com/docs/pricing
- Supabase — Billing : https://supabase.com/docs/guides/platform/billing-on-supabase
- Cloudflare R2 — Pricing : https://developers.cloudflare.com/r2/pricing/
- Google Cloud Run — Pricing : https://cloud.google.com/run/pricing
- Google Cloud Scheduler — Pricing : https://cloud.google.com/scheduler/pricing
- Google Cloud Artifact Registry — Pricing : https://cloud.google.com/artifact-registry/pricing
- Google Cloud Secret Manager — Pricing : https://cloud.google.com/secret-manager/pricing
- Google Cloud — Network egress : https://cloud.google.com/network-tiers/pricing
- Anthropic — API pricing : https://platform.claude.com/docs/en/about-claude/pricing
- Deepgram — Pricing : https://deepgram.com/pricing
- Stripe France — Pricing : https://stripe.com/fr/pricing
- Stripe Billing — Pricing : https://stripe.com/billing/pricing
- Stripe Tax — Pricing : https://stripe.com/tax/pricing
- Resend — Pricing : https://resend.com/pricing
