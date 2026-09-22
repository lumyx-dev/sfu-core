# Design — self-hosting : SFU + Dashboard + Postgres en une commande

Date : 2026-09-22
Statut : validé, prêt pour l'implémentation
Ticket : [LUM-598](https://linear.app/dunlo/issue/LUM-598) (parent : LUM-539)

---

## 1. Contexte

Le critère de succès du Dashboard OSS est un critère d'installation : auto-hébergeable
rapidement, sans compte Cloud, sans configuration lourde. Un `docker compose up` qui échoue à la
première tentative annule le bénéfice de l'open source — la personne ferme l'onglet.

Le dépôt ne contient aucun fichier Docker aujourd'hui. Trois services doivent cohabiter :

| Service | État actuel |
| --- | --- |
| `apps/sfu` | Rust/axum, HTTPS obligatoire, certificats mkcert non versionnés. Télémétrie Postgres déjà câblée (`SFU_DATABASE_URL`), migrations sqlx embarquées et appliquées au démarrage (`telemetry/pg.rs`) |
| `apps/dashboard` | Next.js 16, App Router, **données entièrement mockées** (`lib/dashboard-data.ts`). Ne parle ni au SFU ni à Postgres |
| Postgres | Aucun. Le SFU tombe sur un `NoopSink` quand `SFU_DATABASE_URL` est absente |

### Périmètre

| Dans le périmètre | Hors périmètre |
| --- | --- |
| `compose.yaml` réunissant les trois services | Profil « démo » et générateur de trafic |
| Images SFU et Dashboard | Câblage du dashboard sur le SFU ou sur Postgres |
| Plage de ports UDP configurable dans le SFU | Port UDP unique mutualisé (démultiplexage par ufrag) |
| Certificat TLS obtenu sans étape préalable | Référence complète des variables d'environnement (LUM-599) |
| Deux réparations du dépôt qui bloquent le build (§3) | Génération automatique des secrets |

LUM-598 reste donc ouvert après ce travail : le profil démo et le critère « le dashboard affiche
des données vivantes » ne sont pas atteignables tant que le dashboard sert des données mockées.

---

## 2. Décisions validées

### 2.1 Bun installe, Node construit et sert

Mesuré, pas supposé. Deux images construites à l'identique sauf la base du dernier étage, les
huit routes produit tapées sur chacune :

| | `oven/bun:1.3.11-alpine` | `node:22-alpine` |
| --- | --- | --- |
| Les 8 routes | 8 × HTTP 500 | 8 × 200, HTML complet (31–75 ko) |
| Démarrage | 11 erreurs, 2 uniques | `✓ Ready in 0ms` |
| Taille | 238 Mo | 319 Mo |

Erreur, émise par Bun lui-même, identique au build et au runtime :

```
Failed to load external module next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:
TypeError: Expected CommonJS module to have a function wrapper.
If you weren't messing around with Bun's internals, this is a bug in Bun
```

Bun ne charge pas le runtime serveur précompilé de Next 16 (Turbopack). Les 81 Mo d'écart
achètent une image qui ne sert aucune page.

**Retenu** : `bun install` pour les dépendances (449 paquets en 7,2 s, et c'est le gestionnaire
du dépôt), `node` pour `next build` et pour servir. Bun ne devient pas le runtime.

### 2.2 Plage de ports UDP fixe

`transport/peer_connection.rs` bind aujourd'hui un socket UDP **éphémère par peer**
(`0.0.0.0:0`). En réseau bridge Docker ces ports ne peuvent pas être publiés : le média ne passe
pas. `network_mode: host` est écarté — sur macOS le conteneur partage le réseau de la VM Docker,
pas celui de l'hôte, et le navigateur ne joint rien.

**Retenu** : `SFU_UDP_PORT_MIN` / `SFU_UDP_PORT_MAX`, publiés en 1:1 par le compose.

### 2.3 TLS : monté sinon généré

Les certificats mkcert ne sont pas versionnés (`.gitignore` : `*.pem`). Les exiger contredirait
« sans étape préalable ».

**Retenu** : l'entrypoint utilise `/mkcert/localhost+1.pem` s'il est présent (le compose monte
`./apps/sfu` en lecture seule — un répertoire, jamais un fichier fantôme), sinon il génère un
certificat auto-signé persisté dans un volume.

### 2.4 Postgres 18

`postgres:18-alpine` (18.6). La 19 n'existe qu'en `19beta3` au 2026-09-22.

### 2.5 Cache de compilation Rust : montages BuildKit, pas cargo-chef

`cargo-chef` demanderait un `cargo install` dans un étage supplémentaire. Deux montages de cache
BuildKit (`~/.cargo/registry` et `target/`) obtiennent le même effet sur les reconstructions sans
outil tiers ni étage de planification. Ni l'un ni l'autre n'accélère le premier build sur machine
vierge, qui est le cas mesuré par le ticket.

---

## 3. Prérequis — deux réparations du dépôt

Découvertes en construisant l'image. Aucune n'est causée par Docker ; les deux bloquent le
livrable. Chacune fait un commit indépendant : elles réparent le dépôt même si la suite change.

### 3.1 `bun install --frozen-lockfile` échoue sur un clone frais

`bun.lock` est versionné avec des entrées pour `apps/cloud` et `apps/landing`, deux workspaces
que `.gitignore` exclut. Sur un dépôt cloné depuis GitHub ils n'existent pas, bun réécrit
376 lignes et `--frozen-lockfile` refuse.

**La correction propre — sortir les apps privées du workspace — ne tient pas dans ce ticket.**
Essayée et mesurée : `apps/cloud` perd le protocole `catalog:` (trivial, une version à épingler)
et surtout `@lumyx/ui`. En `file:`, bun copie le paquet et duplique `@types/react` —
`check-types` échoue sur « Two different types with this name exist ». En `link:`, bun exige un
`bun link` manuel préalable. Restent une liaison manuelle par machine, un registre privé, ou la
sortie des apps privées du dépôt : trois chantiers qui dépassent LUM-598, et dont aucun ne peut
être testé ici puisque `apps/landing` n'existe pas sur cette machine.

**Ce que ça coûte vraiment de s'en passer** : sur un clone frais, les 376 lignes qui bougent sont
189 résolutions **retirées**, toutes appartenant aux seules apps privées (`better-auth`,
`drizzle`, `pg`…). Les versions des paquets que le dashboard utilise ne bougent pas — `bun.lock`
continue de les épingler. On perd le détecteur de dérive, pas les versions.

**Retenu** : l'étage `deps` fait `bun install` sans `--frozen-lockfile`, avec un commentaire qui
dit pourquoi. Un ticket dédié traite la sortie des apps privées du workspace — c'est aussi,
concrètement, la frontière OSS / privé que LUM-600 demande d'écrire.

### 3.2 `apps/dashboard` ne compile pas sur `main`

```
Module not found: Can't resolve './sections/core'   (+ data, feedback, layout-section,
                                                     navigation, webrtc)
```

`app/%5Fds/page.tsx` importe six fichiers frères absents du dépôt. Le commit `b79d039`
(« replace apps/dashboard with the sightline-react dashboard ») a amené la page sans ses
sections. Les versions qui existent — `origin/feat/design-system`, `feat/marketing-site`,
`feat/telemetry-persistence` — sont toutes antérieures au renommage `@sightline/ui` →
`@lumyx/ui` et importent un `../mock` disparu : les restaurer est un portage, pas un
copier-coller.

**Correction** : la page est supprimée. C'est une vitrine de design system, pas une page produit,
orpheline depuis le portage. Elle reviendra avec la branche design system, portée sur
`@lumyx/ui`. Aucune source ne la référence — seuls des artefacts `.next` périmés le font.

Une fois la page écartée, le build passe : 12 routes, toutes statiques, TypeScript en 1,9 s.

---

## 4. Changement SFU — allocation des ports UDP

### 4.1 Configuration

Deux champs dans `TransportConfig`, lus par `Config::from_env` selon la règle déjà appliquée
partout dans `config.rs` (valeur absente ou illisible ⇒ défaut) :

| Variable | Défaut | Sens |
| --- | --- | --- |
| `SFU_UDP_PORT_MIN` | `0` | Premier port de la plage |
| `SFU_UDP_PORT_MAX` | `0` | Dernier port inclus |

`0/0` reproduit le comportement actuel — port éphémère choisi par le noyau. **Hors Docker, rien
ne change.** Une plage inversée (`min > max`) ou partielle (une seule des deux variables) est
traitée comme absente, comme le fait déjà `parse_secs` pour une durée illisible.

### 4.2 Allocation

Un curseur atomique partagé, porté par `AppState`, balaie la plage à partir de sa position
courante et rend le premier port libre. Repartir de `min` à chaque peer ferait rescanner les
ports déjà pris, au carré du nombre de participants.

`PeerConnection::new` renvoie aujourd'hui son socket via `.expect("bind UDP éphémère")`. Il
devient un `Result` : plage épuisée ⇒ `SfuError::Transport`, refus propre du peer entrant au lieu
d'un panic qui emporte le serveur.

### 4.3 Tests

Dans `config.rs`, au même endroit que les tests existants :

- une plage absente laisse `0/0`, le défaut historique ;
- une plage inversée ou partielle retombe sur le défaut.

Dans le module d'allocation :

- sans plage, le port rendu est éphémère et non nul ;
- avec une plage, tous les ports rendus y appartiennent ;
- une plage de N ports sert N peers, et le (N+1)ᵉ reçoit `SfuError::Transport` — pas un panic ;
- un port rendu est réutilisable après libération.

---

## 5. Images

### 5.1 SFU — `apps/sfu/Dockerfile`

Base Debian, pas Alpine : `aws-lc-sys` (backend rustls) réclame `cmake`, `clang` et `perl`, et se
construit mal sur musl.

| Étage | Base | Rôle |
| --- | --- | --- |
| `build` | `rust:1.98-slim-bookworm` | `cargo build --release`, deux montages de cache BuildKit. Aucune macro `sqlx::query!` dans la crate : pas de base de données nécessaire à la compilation |
| runtime | `debian:bookworm-slim` | Le binaire, `migrations/`, `assets/`, plus `openssl` (génération du certificat) et `curl` (healthcheck) |

`docker-entrypoint.sh` : si `/mkcert/localhost+1.pem` et sa clé existent, ils sont utilisés tels
quels. Sinon, génération d'un auto-signé `CN=localhost`, SAN `DNS:localhost,IP:127.0.0.1`, dans
le volume `lumyx-certs` — une seule fois, les démarrages suivants le retrouvent. Puis `exec` sur
le binaire, pour que le SFU reçoive les signaux directement.

### 5.2 Dashboard — `apps/dashboard/Dockerfile`

Contexte de build : la racine du dépôt, le workspace bun en a besoin.

| Étage | Base | Rôle |
| --- | --- | --- |
| `deps` | `oven/bun:1.3.11-alpine` | Les seuls `package.json` + `bun.lock`, puis `bun install` (cf. §3.1 pour l'absence de `--frozen-lockfile`). Copier les manifestes avant les sources garde la couche valide tant que les dépendances ne bougent pas |
| `build` | `node:22-alpine` | `next build` sur les `node_modules` de l'étage précédent |
| runtime | `node:22-alpine` | `.next/standalone`, `.next/static`, `public/`. Utilisateur non root |

`next.config.ts` gagne `output: 'standalone'` et `outputFileTracingRoot` pointant la racine du
monorepo — sans cette racine le traçage s'arrête à `apps/dashboard` et `@lumyx/ui` manque.

### 5.3 `.dockerignore`

Les motifs d'un `.dockerignore` sont ancrés à la racine du contexte : `.next/` n'exclut **pas**
`apps/dashboard/.next/`. Sans le préfixe `**/`, un `.next` local périmé part dans l'image et la
casse avec un `validator.ts` qui référence des routes disparues — constaté pendant le spike. Tous
les motifs d'artefacts sont donc préfixés `**/`.

Le fichier exclut aussi `apps/cloud/` et `apps/landing/` : rien de privé ne doit entrer dans une
image publique.

---

## 6. `compose.yaml`

| Service | Image | Publie | Dépend de |
| --- | --- | --- | --- |
| `postgres` | `postgres:18-alpine` | rien | — |
| `sfu` | construite | `3000/tcp`, `40000-40063/udp` | `postgres` sain |
| `dashboard` | construite | `3001/tcp` | `sfu` sain |

Postgres n'est pas publié sur l'hôte : seul le SFU en a besoin, et un port 5432 ouvert par défaut
est une mauvaise valeur par défaut pour un outil qu'on auto-héberge.

Les ports UDP sont publiés **en 1:1**. Le SFU annonce dans ses candidats ICE le port qu'il voit
localement (`ice_host:port`) ; une remise en correspondance rendrait ces candidats faux.

Volumes nommés : `lumyx-pgdata` (données) et `lumyx-certs` (certificat généré).

`depends_on` avec `condition: service_healthy` en chaîne. Nécessaire, pas décoratif : le SFU
applique ses migrations sqlx au démarrage et ne doit pas partir avant que Postgres accepte les
connexions. Healthchecks : `pg_isready` pour Postgres, `curl -k https://localhost:3000/health`
pour le SFU, une requête HTTP sur `/` pour le dashboard.

### Variables et défauts

| Variable | Défaut dans le compose | Remarque |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `lumyx` | Surchargeable. La génération automatique de secrets est hors périmètre (LUM-598, itération suivante) |
| `SFU_DATABASE_URL` | `postgres://lumyx:…@postgres:5432/lumyx` | Active la persistance de la télémétrie |
| `SFU_ICE_HOST` | `127.0.0.1` | L'adresse que le navigateur joint. À changer pour un déploiement distant |
| `SFU_UDP_PORT_MIN` / `MAX` | `40000` / `40063` | 64 peers simultanés. Publier 64 ports UDP reste rapide ; 10 000 ne le serait pas |
| `SFU_SERVE_TEST_CLIENT` | `true` | Le client de test est la seule façon de voir du média tant que le dashboard est mocké |

---

## 7. Vérification

1. `cargo test` et `cargo clippy --all-targets` verts, tests d'allocation de ports inclus.
2. `bun install` réussit sur une arborescence simulant un clone frais, et les versions des
   paquets du dashboard y sont celles de `bun.lock`.
3. `docker builder prune -af`, puis `docker compose up` — le test « machine vierge » du ticket.
4. `/health` du SFU à 200 ; les tables de télémétrie créées dans Postgres.
5. Les 8 routes du dashboard à 200 avec du HTML, pas seulement un code de retour : Next sert
   200 sur ses propres pages d'erreur.
6. Le client de test du SFU ouvert dans deux onglets sur `https://localhost:3000`, média dans les
   deux sens. **C'est la seule preuve que la plage UDP fonctionne** — un `/health` vert ne dit
   rien du média.

---

## 8. Suites

| Sujet | Ticket |
| --- | --- |
| Profil démo + générateur de trafic (réutiliser `apps/sfu/scripts/browser-check.ts`) | LUM-598, itération suivante |
| Documentation self-hosting et référence des variables | LUM-599 |
| Frontière Dashboard OSS / Cloud dans le README | LUM-600 |
| Port UDP unique mutualisé, démultiplexage par ufrag | à créer |
| Sortir `apps/cloud` et `apps/landing` du workspace bun | à créer |
| Génération automatique des secrets | à créer |
| Portage de la galerie `/_ds` sur `@lumyx/ui` | à créer |
