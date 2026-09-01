# Base de données de la console Cloud (auth + organisation/projets) — Design

**Date :** 2026-09-01
**Statut :** implémenté (branche `feat/console-db` du dépôt `apps/cloud`) — voir §11 pour
trois écarts découverts à l'implémentation, contre les versions installées de Better Auth
**Sous-projet :** socle de données de la console Cloud (`apps/cloud`)

## 1. Contexte

`apps/cloud` (la console Cloud, distincte du dashboard self-hosted) affiche aujourd'hui
des données entièrement mockées dans `apps/cloud/lib/cloud-data.ts` : projets, quotas
d'usage, clés API, webhooks, factures, équipe, plans. `packages/db` et `packages/auth`
existent comme scaffolds vides, réservés mais non consommés.

La PR ouverte `feat/telemetry-persistence` (#4) a posé le socle de données du **self-hosted**
(`apps/dashboard` + SFU) : schémas Postgres `telemetry` et `app`, Drizzle + `drizzle-kit
migrate` pour ce dernier. Son spec (`docs/superpowers/specs/2026-08-30-db-self-hosted-design.md`,
§1) est explicite : la console Cloud "a un modèle sans rapport — organisation, projets,
environnements, quotas, minutes-participant, factures, audit log — et garde une base
séparée. Les mélanger imposerait au self-hosted des colonnes `org_id` qui n'y veulent rien
dire." Ce document couvre cette base séparée, avec le même outillage (Drizzle) mais aucune
donnée ni schéma partagé avec le self-hosted.

## 2. Objectif

Donner à la console Cloud une vraie authentification multi-organisation (Better Auth) et
un modèle de données pour organisation → projets → environnements → clés API, pour
remplacer les mocks par des données réelles sur ce périmètre précis.

**Critères de succès.** Un utilisateur peut créer un compte (email/mot de passe ou Google),
créer une organisation, y inviter des membres avec un rôle, créer un projet, y créer des
environnements nommés librement, et générer une clé API scopée à un projet + environnement
donnés. Chacune de ces actions produit une ligne d'audit log lisible.

## 3. Périmètre

**Dans le périmètre :** Better Auth (email/mot de passe, Google OAuth, plugin
`organization`, plugin `apiKey`) ; les tables applicatives `project`, `environment`,
`audit_log` ; les migrations Drizzle ; le client Drizzle et sa configuration dans
`apps/cloud`.

**Hors périmètre :** facturation et usage (confié à Autumn, sous-projet séparé) ; webhooks
sortants ; tout ce qui touche au self-hosted, à la télémétrie ou à `apps/dashboard` ; un
package partagé (`packages/db`/`packages/auth` restent des scaffolds vides pour un futur
second consommateur — YAGNI).

## 4. Décisions arrêtées

**4.1 — Base et code entièrement dans `apps/cloud`, pas de package partagé.** Le self-hosted
et le Cloud n'ont quasiment aucun besoin commun (auth multi-tenant complète vs réserve de
place, modèle organisation/facturation vs télémétrie temps réel). Mutualiser via
`packages/db`/`packages/auth` maintenant ajouterait une abstraction sans second
consommateur réel. Les deux packages restent des scaffolds vides.

**4.2 — Better Auth avec le plugin `organization`.** Un utilisateur peut appartenir à
plusieurs organisations avec un rôle (`owner`/`admin`/`member`) et switcher entre elles —
le modèle standard d'une console Cloud multi-clients, et ce que l'onglet Team du mock
attend déjà.

**4.3 — Clés API scopées projet + environnement.** Le plugin `apiKey` de Better Auth est
étendu via `additionalFields` avec `projectId` et `environmentId`, tous deux requis. Une
clé n'a de sens que rattachée à un couple précis, comme le suggère déjà le mock
(`envs: "prod + staging"`).

**4.4 — Environnements librement nommables.** Pas d'ensemble fixe `prod`/`staging` : une
table `environment` à part, un `name` texte libre par projet, sur le modèle Vercel.

**4.5 — Audit log dans le périmètre, webhooks hors périmètre.** L'audit log (qui a fait
quoi dans la console) est un besoin transversal simple à modéliser maintenant, sans
dépendance externe. Les webhooks sortants dépendent d'events SFU/Autumn qui n'existent pas
encore côté Cloud — sous-projet séparé plus tard, même logique que la télémétrie qui a
scindé écriture SFU et écrans dashboard.

**4.6 — Facturation et usage confiés à Autumn.** Pas de tables `quotas`/`invoices`/`usage`
dans ce schéma : Autumn les porte. Seul un lien organisation ↔ customer Autumn sera
nécessaire, à définir dans le sous-projet Autumn.

**4.7 — Fichier de schéma généré séparé du fichier écrit à la main.** `auth-schema.ts` est
régénéré par `@better-auth/cli generate` à chaque changement de plugin et n'est jamais édité
à la main. `schema.ts` porte les tables applicatives (`project`, `environment`,
`audit_log`), écrites et maintenues à la main, qui référencent les tables Better Auth par
clé étrangère (`organization.id`, `user.id`). Les deux sont fusionnés dans le client
Drizzle et dans `drizzle.config.ts`. Ce découpage évite qu'une régénération n'écrase des
tables qu'elle ne connaît pas.

## 5. Architecture

```
apps/cloud/lib/auth/auth.ts        — config serveur Better Auth
apps/cloud/lib/auth/client.ts      — client Better Auth (React)
apps/cloud/lib/db/auth-schema.ts   — généré par `@better-auth/cli generate`
apps/cloud/lib/db/schema.ts        — project, environment, audit_log (écrit à la main)
apps/cloud/lib/db/index.ts         — client Drizzle (pg.Pool + schéma fusionné)
apps/cloud/drizzle.config.ts       — pour drizzle-kit generate/migrate
```

Une base Postgres dédiée (`CLOUD_DATABASE_URL`), provisionnée indépendamment de celle du
self-hosted. Schéma Postgres par défaut (`public`) : la base est déjà dédiée à la console
Cloud, aucun autre process n'y écrit, un schéma nommé n'apporterait pas de garantie
supplémentaire ici (contrairement au self-hosted où deux écrivains partagent une même
base).

## 6. Auth — configuration Better Auth

```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  plugins: [
    organization({
      // rôles owner/admin/member, invitations par email — comportement par défaut
    }),
    apiKey({
      additionalFields: {
        projectId: { type: "string", required: true },
        environmentId: { type: "string", required: true },
      },
    }),
  ],
});
```

Tables générées par Better Auth : `user`, `session`, `account`, `verification`,
`organization`, `member`, `invitation`, `apikey`. Aucune n'est éditée à la main.

## 7. Tables applicatives

```ts
export const project = pgTable("project", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const environment = pgTable("environment", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => project.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id),
  actorUserId: text("actor_user_id").references(() => user.id),
  action: text("action").notNull(),        // ex. 'project.created', 'api_key.revoked'
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

`apikey.projectId` référence `project.id`, `apikey.environmentId` référence
`environment.id` — ajoutées à la main dans `schema.ts` après génération, puisque
`additionalFields` ne pose pas de contrainte de clé étrangère automatiquement.

`slug` unique par organisation (`project`) et par projet (`environment`) — contrainte
`unique` composite, vérifiée en base plutôt qu'en application uniquement.

## 8. Audit log — mécanisme

Deux sources, pas de service central :

- **Actions Better Auth** : `databaseHooks.organization.create.after`,
  `member.create.after`, `invitation.create.after` (et équivalents `delete`/`update`
  pertinents) appellent `logAudit()`.
- **Actions applicatives** (projet, environnement, clé API — hors modèles Better Auth) :
  chaque server action appelle `logAudit()` explicitement après la mutation.

`logAudit()` est une fonction unique dans `apps/cloud/lib/db/audit.ts`, insère une ligne et
ne lève jamais côté appelant (best-effort : un audit log qui échoue ne doit pas faire
échouer l'action réelle).

## 9. Migrations

`drizzle-kit generate` puis `drizzle-kit migrate` (prod) / `drizzle-kit push` (dev), comme
pour le schéma `app` du self-hosted. Après tout changement de plugin Better Auth :
`@better-auth/cli generate` régénère `auth-schema.ts`, puis `drizzle-kit generate` produit
la migration SQL correspondante.

## 10. Vérification

- Migrations appliquées contre un Postgres de test au démarrage de la CI (pas de lock
  `information_schema` comme côté SFU : ici Drizzle est le seul propriétaire du schéma,
  aucun risque de dérive cross-langage).
- Flows testés au niveau API : inscription, création d'organisation, invitation acceptée,
  création d'une clé API scopée projet + environnement, révocation, et présence de la ligne
  d'audit log correspondante pour chacun.

## 11. Amendements post-implémentation

Trois décisions de ce document se sont révélées irréalisables telles quelles contre les
versions installées de `better-auth`/`@better-auth/api-key` (1.7.2). Chacune a été
vérifiée directement contre le code source de la librairie (pas supposée), documentée dans
le code au point exact où elle s'applique, et re-vérifiée indépendamment en revue. Ce
paragraphe existe pour que ce document reste une autorité fiable — les sections ci-dessus
ne sont pas corrigées en place pour garder trace de l'intention originale.

**§4.3 / §6 — `additionalFields` n'existe pas.** Le plugin `apiKey` a été extrait de
`better-auth` vers un package séparé, `@better-auth/api-key`, dont les options n'offrent
aucun moyen d'ajouter des colonnes personnalisées (seulement un renommage des colonnes
existantes). `projectId`/`environmentId` sont ajoutées via le mécanisme générique
`schema.<model>.fields` d'un plugin local (`apiKeyScopeFields` dans
`apps/cloud/lib/auth/auth.ts`) — un chemin différent, mais qui produit les mêmes colonnes
réelles, confirmé par une génération CLI effective, pas seulement par lecture de types.

**Conséquence plus sévère, non anticipée par ce document :** l'endpoint
`auth.api.createApiKey` de `@better-auth/api-key` construit son `INSERT` à partir d'une
liste de champs figée qui ne lit ni ne transmet `projectId`/`environmentId` sous aucune
forme — confirmé empiriquement (violation Postgres `23502` avec les colonnes `NOT NULL`
d'origine). La garantie « `tous deux requis` » de §4.3 est donc **irréalisable au niveau
base de données** via cette API. Les colonnes ont été rendues nullables (FK toujours
appliquée dès qu'une valeur est posée), et l'invariant « une clé est toujours scopée »
vit désormais au niveau applicatif : `apps/cloud/lib/auth/api-keys.ts` expose
`createScopedApiKey()`, seul point du code qui doit être utilisé pour créer une clé
(appelle `createApiKey` puis un `UPDATE` immédiat sur les deux colonnes). Tout futur code
de création de clé doit passer par cette fonction, jamais par `auth.api.createApiKey`
directement.

**§8 — `databaseHooks` ne couvre pas `organization`/`member`/`invitation`.** Cette clé de
configuration de Better Auth ne couvre que `user`/`session`/`account`/`verification` dans
la version installée. Le mécanisme réel pour les hooks de cycle de vie de l'organisation
est l'option `organizationHooks` du plugin `organization` lui-même
(`afterCreateOrganization`/`afterAddMember`/`afterCreateInvitation`) — confirmé jusque dans
les gestionnaires de route réels (pas seulement les déclarations de type), qui appellent
bien ces callbacks au bon moment. `logAudit()` (§8, mécanisme inchangé) est appelée depuis
là plutôt que depuis `databaseHooks`.

**Cause commune identifiée, hors périmètre de cette implémentation :** `@better-auth/cli`
publié reste figé sur `better-auth@1.4.21`/`@better-auth/core@1.4.21`, trois versions
mineures derrière celle installée dans ce projet (`1.7.2`) — sans version stable
intermédiaire disponible sur le registre npm au moment de l'implémentation. Une
régénération naïve via `@better-auth/cli generate` produit donc un schéma incomplet
(colonnes manquantes sur `account`/`session`/`verification`, qui cassaient
`auth.api.signUpEmail` pour tout appelant). Un générateur alternatif, version-cohérent,
existe (`@better-auth/drizzle-adapter`'s `createSchema`, sur son point d'entrée
`relations-v2`) mais n'a pas été adopté dans cette implémentation — recommandé pour qui
reprendra le flux de régénération de schéma décrit en §9.
