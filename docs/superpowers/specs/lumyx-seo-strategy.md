# Prompt d'exécution — Stratégie SEO Lumyx (ex-Sightline)

> **Usage** : colle ce fichier entier dans une nouvelle conversation Claude quand tu es prêt à exécuter. Le prompt contient tout le contexte nécessaire pour ne rien avoir à réexpliquer.

---

## 0. Rôle

Tu es mon copilote SEO/contenu pour Lumyx. Avant de produire quoi que ce soit, fais le **gate check** de la section 1 — il conditionne tout le reste.

---

## 1. Gate check obligatoire (à faire en premier, avant toute production de contenu)

Pose-moi ces questions avant de commencer, et n'exécute la Phase 2 ou 3 que si les réponses le permettent :

1. **Le forwarding vidéo core est-il stable en production** (le bug de mapping mid/SSRC est-il fermé, un flux vidéo tient-il en charge réelle) ?
2. **Y a-t-il au moins 1-2 utilisateurs externes réels** qui font tourner le SFU en dehors de mon propre usage ?
3. **Le nom du projet est-il tranché** : Sightline ou Lumyx ? (domaine cible pressenti : `lumyx.dev`)

**Si (1) et (2) sont NON** → n'exécute que la **Phase 1** (fondations + contenu informationnel). Ne publie aucune page comparative frontale ("vs LiveKit"), aucune campagne SEA, aucun Show HN.

**Si (1) et (2) sont OUI** → tu peux passer en Phase 2.

Ne saute jamais cette vérification, même si je semble pressé — c'est une garde-fou volontaire posé en connaissance de cause (risque réputationnel identifié : un visiteur qui lit un comparatif vendant la fiabilité et tombe sur un bug connu, dans une petite communauté technique où ça se paie cher).

---

## 2. Contexte produit

- **Lumyx** (anciennement Sightline) est un SFU WebRTC open-source écrit en Rust, positionné comme alternative "drop-in" à LiveKit, avec observabilité native (jitter, packet loss, RTT, NACK ratio, bitrate) intégrée au media server — pas un SDK tiers à brancher.
- Stack : str0m v0.23.1, Tokio, Axum/rustls, DashMap. Monorepo `apps/sfu` (public), `apps/cloud` (privé), `apps/dashboard` (Next.js, prévu).
- Solo dev bootstrap, build-in-public sur X (@sightlinertc).
- Roadmap : (1) stabilité/distribution, (2) features SFU (TURN, simulcast, recording), (3) observabilité (Prometheus, dashboard), (4) couche de compatibilité LiveKit, (5) Lumyx Cloud SaaS.

## 3. Contexte concurrentiel (état constaté, à revérifier si la date d'exécution est lointaine)

- LiveKit a levé 100M$ en Series C (janvier 2026, Index Ventures + Salesforce Ventures) à 1Md$ de valorisation, et s'est officiellement repositionné comme "plateforme pour agents voix/vidéo/IA physique" — pas comme SFU vidéo généraliste.
- Signal de traction : repo `livekit/agents` (13k+ ⭐) dépasse presque le repo SFU core `livekit/livekit` (20k+ ⭐) — le centre de gravité produit/contenu est sur les agents IA.
- Pricing LiveKit Cloud : Build (gratuit) / Ship (50$) / Scale (500$) / Enterprise, facturé aux minutes d'agent-session.
- Douleurs self-host documentées (ex. guide Prodinit, juillet 2026) : Redis requis pour l'état de room multi-instance (sinon split-brain silencieux), plage UDP 50000-60000 à ouvrir (cause n°1 d'échecs ICE), TURN pour NAT symétrique, autoscaling naïf CPU-only. **Attention** : les "3 services distincts" (serveur + workers Python + Egress) ne s'appliquent qu'aux déploiements agents IA + recording — pour du vidéo pur, LiveKit self-hosted reste un seul service. Ne jamais généraliser ce point sans cette nuance.
- Concurrents adjacents sur l'observabilité (pas des SFU, des couches à brancher par-dessus) : **rtcStats** (Tsahi Levent-Levi / bloggeek.me, lancé 2026) et **Peermetrics** (WebRTC.ventures).
- Si l'exécution a lieu plus de 2-3 mois après la rédaction de ce prompt : **revérifie ces faits par recherche web avant de les citer** (pricing, funding, positionnement peuvent avoir changé).

## 4. Positionnement / message central

*"LiveKit a arrêté d'être une entreprise de SFU. Lumyx continue de l'être — avec l'observabilité que tu bricolais avant en Prometheus/Grafana ou via un SDK tiers, directement dans le media server."*

Trois piliers : (1) focus vidéo, pas agents IA — (2) observabilité native — (3) Rust, pas Go+CGO.

**Règle de contenu non négociable** : chaque page publiée avant que le gate check soit validé mentionne explicitement le statut "in active development" / roadmap publique. Jamais de survente. Jamais de comparatif qui implique une supériorité de fiabilité tant que ce n'est pas vrai.

---

## 5. Phase 1 — Fondations + autorité passive (exécuter dès maintenant, indépendamment du gate check)

### Technique (une fois)

- [ ] Google Search Console + Bing Webmaster Tools sur le domaine choisi
- [ ] Sitemap XML + robots.txt
- [ ] Schema `Organization` + `SoftwareApplication` sur la home
- [ ] Structure d'URL propre dès le départ : `/blog/`, `/docs/`, `/compare/`
- [ ] Analytics (Plausible ou GA4)

### Contenu à écrire (statut "early dev" assumé sur chaque page)

| Page | Mot-clé cible | Angle |
| --- | --- | --- |
| `/blog/livekit-pivoted-to-ai-agents` | livekit ai agents | Post d'analyse fondateur, factuel et sourcé |
| `/rust-webrtc-sfu` | rust webrtc sfu | Créneau quasi vide, dominable rapidement |
| `/webrtc-observability` | webrtc observability | Angle "natif au SFU" vs rtcStats/Peermetrics |
| `/blog/str0m-vs-pion` | str0m vs pion | Positionnement technique dans la conversation Rust WebRTC |
| `/blog/[bug-technique-résolu]` | longue traîne ultra-spécifique | Un post par bug non trivial résolu (ex. mapping mid/SSRC une fois fermé) |

### Netlinking passif

- [ ] Soumission awesome-webrtc / awesome-rust (GitHub)
- [ ] Page crates.io si publication d'un crate
- [ ] Cross-post dev.to / Hashnode avec canonical vers le blog
- [ ] Profil AlternativeTo.net
- [ ] Réponses techniques sourcées sur community.livekit.io / Stack Overflow (aide réelle, lien seulement si pertinent)

### KPIs 3 mois

Pages indexées 100% · Impressions GSC 500-2000/mois · 15-25 backlinks référents · Top 20 sur "rust webrtc sfu"

---

## 6. Phase 2 — Conquest + comparatifs (n'exécuter que si gate check section 1 validé)

- Publier `/livekit-alternative`, `/self-hosted-webrtc-sfu`, `/compare/lumyx-vs-mediasoup`, `/compare/lumyx-vs-janus`
- Mots-clés transactionnels : livekit alternative, livekit self hosting, webrtc sfu benchmark, datadog for webrtc, livekit vs mediasoup
- SEA : 200-400€/mois test sur mots-clés conquest, **jamais "LiveKit" en texte d'annonce visible** (vérifier politique marque Google Ads pour la juridiction avant de lancer — pas un avis juridique)
- Netlinking actif : guest post bloggeek.me/webrtc.ventures, Show HN + Product Hunt au lancement stable, threads X avec benchmarks chiffrés réels
- KPIs 9 mois : 3000-6000 visites organiques/mois · Top 15-20 sur "livekit alternative" · 30-50 signups Hobby/mois via SEO

## 7. Phase 3 — Dominance de niche (long terme, 9-18+ mois)

- Pages par cas d'usage : `/use-cases/telehealth-webrtc-sfu`, `/use-cases/edtech-live-classroom`, `/use-cases/live-commerce-streaming`, `/use-cases/gaming-voice-sfu`
- SEO du Cloud SaaS une fois lancé (pricing, doc publique indexable, changelog)
- Rafraîchissement trimestriel des pages piliers
- KPIs 18 mois : 15-25k visites organiques/mois · Top 5-10 sur "livekit alternative"

---

## 8. Première action à exécuter

Commence par la question du gate check (section 1), puis — quelle que soit la réponse — rédige `/blog/livekit-pivoted-to-ai-agents` en premier : c'est le seul contenu qui ne dépend d'aucune condition de stabilité produit.
