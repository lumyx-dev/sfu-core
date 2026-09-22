# Gate Phase 0 — Matrice de scénarios et seuils de passage

*Document de référence — écrit le 22 septembre 2026, **avant** la première exécution de la campagne.*

---

## Pourquoi ce document existe

Le cahier des charges fixe comme critère Phase 0 « stabilité démontrée en conditions réseau
dégradées ». Cette phrase n'est pas mesurable telle quelle : elle ne dit ni quelles
conditions, ni quelle stabilité, ni comment on constate l'échec.

Ce document la transforme en une liste de scénarios et de seuils chiffrés. Il est écrit
avant la campagne, et c'est tout son intérêt : **un seuil défini après coup s'ajuste
inconsciemment au résultat obtenu.** Une fois la campagne lancée, les seuils ci-dessous ne
bougent plus ; s'ils se révèlent mal choisis, on le note dans le rapport et on les corrige
pour la campagne suivante, sans réécrire le verdict de celle en cours.

**Portée.** Ce document couvre la première moitié du gate Phase 0 — le comportement en
conditions réseau dégradées ([LUM-529](https://linear.app/dunlo/issue/LUM-529)). La seconde
moitié — le déploiement réel sur Hetzner — a ses propres critères et n'est pas traitée ici.

---

## Comment lire ce document

Phase 0 (moitié réseau) est **franchie** si et seulement si :

> Les douze scénarios de gate du §4 ont été exécutés, et chacun respecte **tous** les seuils
> marqués bloquants au §5.

Un seul scénario en échec sur un seul seuil bloquant suffit à ne pas franchir le gate. Les
mesures marquées *notées* sont publiées au rapport mais n'entrent pas dans le verdict.

Rien d'autre n'entre en compte : ni l'impression de l'opérateur, ni le fait qu'un scénario
ait « presque » passé.

---

## 1. Décisions de méthode

Quatre décisions prises en amont, non rouvertes par l'exécution.

**1.1 — La vérité terrain est mesurée côté client, dans le harness uniquement.**
Le gel vidéo et la continuité audio ne sont pas observables depuis le chemin média : le SFU
voit passer des paquets, pas ce qu'un décodeur en fait. Le client de test headless les
rapporte donc via `getStats()`.

Ce n'est **pas** une entorse à la décision 4.10 de
`docs/superpowers/specs/2026-08-30-db-self-hosted-design.md` (« aucune métrique rapportée par
le navigateur »). Cette décision porte sur ce que le *produit* expose : l'argument de Lumyx
est de mesurer depuis le chemin média plutôt que de dépendre d'un SDK client. Un banc
d'essai qui établit la vérité terrain est un outil interne, et il est nécessaire : sans
référence côté client, rien ne prouve que le `jitter_ms` et le `loss` relevés côté SFU
veulent dire quelque chose.

**1.2 — Deux niveaux d'exécution.** Un *smoke* de quatre scénarios (~20 min) rejouable après
chaque changement du SFU, et une *campagne de gate* de douze scénarios (~2 h) qui seule fait
foi. Le smoke attrape les régressions en continu ; la campagne tranche Phase 0.

**1.3 — L'audio bloque, la vidéo est notée.** Une conversation dont l'audio se coupe est un
appel raté ; une vidéo qui perd en netteté reste un appel réussi. Surtout, le SFU n'a
aujourd'hui **ni simulcast ni SVC** : sous contrainte de débit, l'effondrement de la vidéo est
le comportement attendu d'une architecture connue, pas un défaut de stabilité. Faire échouer
le gate là-dessus reviendrait à mesurer une fonctionnalité absente plutôt qu'une instabilité.

**1.4 — La matrice est creuse et dirigée par le risque.** Le produit cartésien des axes
(6 profils × 3 tailles × 2 asymétries = 36 scénarios, ~6 h) produirait une campagne qu'on
n'exécute qu'une fois, donc mal. L'axe balayé en priorité est le profil réseau à quatre
participants ; les autres axes ne reçoivent que des points ciblés, listés au §4.

---

## 2. Profils réseau

Six profils déclaratifs, appliqués au trafic **média UDP** et pas seulement au signaling.
Leur implémentation relève de [LUM-551](https://linear.app/dunlo/issue/LUM-551).

| Profil | Perte | Jitter | RTT | Débit | Pourquoi ce profil existe |
|---|---|---|---|---|---|
| `perfect` | 0 % | 0 ms | 0 ms | — | Témoin. Sans lui, impossible de distinguer un défaut du SFU d'un artefact du harness |
| `lossy-2pct` | 2 % uniforme | 10 ms | 40 ms | — | Seuil où la réparation NACK devient visible sans être dominante |
| `lossy-5pct` | 5 % uniforme | 20 ms | 80 ms | — | Perte franche mais survivable — le cas central du gate |
| `bursty-10pct` | rafales 10 %, 200 ms | 30 ms | 80 ms | — | La perte réelle arrive en rafale. Un SFU qui tient 5 % uniforme peut s'effondrer sur une rafale de charge équivalente |
| `wifi-congested` | 1–3 % variable | 60 ms | 50 ms | 2 Mbps | Jitter élevé et débit plafonné : le cas le plus courant chez un vrai utilisateur |
| `3g-poor` | 3 % | 100 ms | 300 ms | 500 kbps | Mobile dégradé. Teste le plafond de débit plus que la perte |

**Reproductibilité.** Rejouer deux fois le même profil doit produire des conditions
comparables. Le harness fixe donc la graine de tout générateur aléatoire et la consigne dans
le rapport ; une campagne dont les graines ne sont pas notées n'est pas rejouable et ne
compte pas.

---

## 3. Ce qui est mesuré

### Côté client (vérité terrain, via `getStats()`)

| Mesure | Source | Unité |
|---|---|---|
| Taux de dissimulation audio | `concealedSamples / totalSamplesReceived` | fraction |
| Plus longue coupure audio | trous successifs dissimulés | ms |
| Nombre et durée des gels vidéo | `freezeCount`, `totalFreezesDuration` | count, ms |
| Débit et résolution vidéo reçus | `bytesReceived`, `frameWidth/Height` | bps, px |

### Côté SFU (ce que la télémétrie relève déjà)

| Mesure | Source | Unité |
|---|---|---|
| Jitter, perte, RTT par leg | `telemetry.track_samples` | ms, fraction, ms |
| Compteurs NACK / PLI / FIR | `telemetry.track_samples` | deltas/s |
| Débit par peer et transport | `telemetry.peer_samples` | octets/s |
| États ICE et événements | `telemetry.events` | — |

### Côté processus

RSS, CPU, et sortie du processus (panic, code de sortie).

> **Prérequis.** Ces mesures côté SFU supposent
> [LUM-553](https://linear.app/dunlo/issue/LUM-553) mergé **et vérifié bout en bout** : les
> tests prouvent l'arithmétique et le câblage, pas que str0m émet ce qu'on croit. La première
> exécution du scénario S5 sert aussi de vérification — si l'on injecte 5 % de perte et que
> `track_samples.loss` ne monte pas aux alentours de 0,05, c'est l'instrumentation qui est
> fausse, pas le SFU qui est bon.

---

## 4. Matrice de scénarios

### Campagne de gate — 12 scénarios, sessions de 10 minutes, ~2 h

| # | Profil | Participants | Dégradés | Ce que le scénario cherche |
|---|---|---|---|---|
| S1 | `perfect` | 2 | — | Référence minimale |
| S2 | `perfect` | 4 | — | Référence nominale |
| S3 | `perfect` | 8 | — | Charge sans dégradation : isole le coût du fanout |
| S4 | `lossy-2pct` | 4 | 1 | Entrée en réparation |
| S5 | `lossy-5pct` | 4 | 1 | **Scénario central du gate** |
| S6 | `lossy-5pct` | 4 | tous | Perte partagée plutôt qu'isolée |
| S7 | `bursty-10pct` | 4 | 1 | Rafale sur un seul participant |
| S8 | `bursty-10pct` | 4 | tous | Rafale généralisée — pire cas réaliste |
| S9 | `wifi-congested` | 4 | 1 | Jitter dominant, perte secondaire |
| S10 | `3g-poor` | 4 | 1 | Débit contraint |
| S11 | `lossy-5pct` | 8 | 1 | La perte passe-t-elle à l'échelle de la room |
| S12 | `lossy-5pct` | 2 | tous | Cas minimal, sans fanout à blâmer |

**La colonne « Dégradés » est la plus importante du tableau.** « Un seul dégradé » pose la
question proprement SFU : un participant en mauvais réseau doit-il dégrader l'expérience des
autres ? Un mesh dirait oui ; un SFU doit dire non. Si S5 montre les trois participants sains
affectés, c'est un défaut de forwarding, pas un effet du réseau — et c'est précisément ce que
le gate existe pour attraper. D'où le seuil d'isolation du §5.

### Smoke — 4 scénarios, sessions de 5 minutes, ~20 min

S2 (témoin), S5 (perte franche), S7 (rafale), S3 (charge).

Rejouable après chaque correctif du SFU. Le smoke ne franchit aucun gate : il signale une
régression, il ne prononce pas de verdict.

---

## 5. Seuils de passage

Chaque seuil porte sa justification. Un seuil qu'on ne sait pas justifier en une phrase est
un seuil qu'on ajustera au résultat.

### Bloquants

| # | Seuil | Justification |
|---|---|---|
| **B1** | Taux de dissimulation audio **< 3 %** chez tout participant, sur tout scénario | Le PLC d'Opus masque les pertes isolées de façon inaudible ; au-delà d'environ 3 % d'échantillons dissimulés, l'auditeur perçoit un son haché |
| **B2** | Aucune coupure audio **> 200 ms** | En deçà, l'auditeur perçoit un artefact ; au-delà, il perçoit une coupure et demande « tu es toujours là ? » |
| **B3** | **Isolation** — sur les scénarios à un seul dégradé (S4, S5, S7, S9, S10, S11), le taux de dissimulation des participants sains ne dépasse pas celui du témoin `perfect` de plus de **1 point** | C'est la promesse même d'un SFU. Un dépassement est un défaut de forwarding, pas un effet du réseau |
| **B4** | **Récupération** — sur les scénarios à rafale (S7, S8), le média reprend en **< 2 s** après la fin de chaque rafale | Un aller-retour de PLI plus une keyframe tiennent largement dans 2 s ; au-delà, l'utilisateur recharge la page |
| **B5** | **ICE** — aucun état `Disconnected` non résolu en **< 10 s** | `Disconnected` est intermittent par conception dans str0m ; passé 10 s sans retour, la session est perdue du point de vue de l'utilisateur |
| **B6** | **Aucun crash** : pas de panic, pas de sortie inattendue du processus | Sans commentaire |
| **B7** | **Mémoire** — croissance du RSS **< 5 %** entre la minute 1 et la fin de session | La première minute contient l'allocation initiale ; une croissance soutenue au-delà est une fuite, et à 8 participants elle se voit dans les dix minutes |

### Notées, non bloquantes

| Mesure | Pourquoi elle ne bloque pas |
|---|---|
| Nombre et durée des gels vidéo | Sans simulcast ni SVC, la dégradation vidéo sous contrainte est le comportement attendu (décision 1.3) |
| Chute du débit et de la résolution vidéo | Idem. Attendu sur `3g-poor` et `wifi-congested` |
| Distribution du jitter et du RTT par leg | Donnée de diagnostic : sert à expliquer un échec, pas à en prononcer un |
| Taux de NACK et de PLI | Un taux élevé signale une réparation active, ce qui est le comportement souhaité, pas un défaut |
| CPU par participant | Relève du test de charge ([LUM-557](https://linear.app/dunlo/issue/LUM-557)), pas de la stabilité réseau |

### Une limite connue, assumée d'avance

Sur `3g-poor` (S10), quatre participants impliquent trois flux vidéo entrants. À ~1 Mbps
chacun contre un plafond de 500 kbps, **la vidéo va s'effondrer** — c'est arithmétique, pas
accidentel. Le scénario reste dans la matrice parce que l'audio, lui, doit survivre :
Opus tient dans ~32 kbps, et B1/B2 s'appliquent pleinement. Cet effondrement vidéo est noté
au rapport et ne fait pas échouer le gate.

---

## 6. Protocole d'exécution

1. Consigner la version du SFU (SHA de commit), la date, et les graines aléatoires du harness.
2. Exécuter le scénario témoin `perfect` correspondant **avant** chaque scénario dégradé de
   même taille — un témoin qui dérive invalide les mesures qui le suivent.
3. Laisser la session tourner la durée pleine, même si un seuil est franchi tôt : le rapport
   doit montrer le comportement complet, pas s'arrêter au premier échec.
4. Exporter les séries de `telemetry.track_samples` et `peer_samples` pour la fenêtre de la
   session, ainsi que les statistiques client.
5. Publier le rapport : un tableau scénario × seuil, valeur mesurée et verdict par cellule.

**Le rapport est public** — c'est la différence entre « ça marche chez moi » et une
démonstration. La définition de terminé de LUM-529 l'exige explicitement.

---

## 7. Ce que ce document ne couvre pas

- **Le déploiement Hetzner**, seconde moitié du gate Phase 0, avec ses propres critères.
- **La validation NAT symétrique et le repli TURN** ([LUM-555](https://linear.app/dunlo/issue/LUM-555)) : conditions de connectivité, pas de dégradation de lien, et une matrice distincte.
- **Le test de charge** ([LUM-557](https://linear.app/dunlo/issue/LUM-557)) : S3 et S11 touchent la charge, mais chercher le point de rupture est un autre exercice.
- **La résilience aux coupures** ([LUM-556](https://linear.app/dunlo/issue/LUM-556)) : reconnexion, ICE restart et fermeture brutale relèvent d'un scénario d'interruption, pas de dégradation continue.
- **Les seuils de Phase 0bis** (deux utilisateurs externes actifs sans assistance), qui ne sont pas de nature technique.
