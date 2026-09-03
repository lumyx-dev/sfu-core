# Design — layout dashboard partagé : sidebar + header (self-hosted et cloud)

Date : 2026-09-01
Statut : validé, prêt pour le plan d'implémentation

---

## 1. Contexte

`apps/dashboard` (self-hosted, port 3001) et `apps/cloud` (console SaaS, port 3002) partagent
aujourd'hui une seule primitive de structure : `AppShell`, dans
`packages/ui/src/components/lumyx/app-shell.tsx`. Elle rend une sidebar de 248px et une colonne
de contenu en `grid-rows-[auto_1fr_auto]`.

Trois manques constatés à l'exploration :

1. **Aucun header.** `Toolbar` et `PageBody` sont exportés par `packages/ui` mais consommés par
   zéro fichier dans les deux apps. Chaque page rend son titre à sa manière, dans un
   `CardHeader`/`CardTitle`.
2. **Aucun responsive.** `grid-cols-[248px_1fr]` est figé. Sous ~900px les deux apps sont
   inutilisables : la sidebar ne se replie ni ne s'escamote.
3. **Un design system à moitié câblé.** `packages/ui/src/styles.css` définit les huit tokens
   `--sidebar-*` du contrat shadcn (`--sidebar`, `--sidebar-accent`, `--sidebar-border`…) et
   `--sidebar-w: 248px`. Aucun composant ne les consomme — `packages/ui/src/components/ui/`
   ne contient pas de `sidebar.tsx`.

Ce document définit la structure partagée : ce que `packages/ui` expose, ce que chaque app
assemble, et comment une page alimente son header.

### Périmètre

| Dans le périmètre | Hors périmètre |
| --- | --- |
| Primitives de layout dans `packages/ui` | Refonte du contenu des pages |
| Réécriture des deux chromes d'app | Palette de commandes ⌘K |
| Ajout d'un `AppHeader` sur les 21 écrans | Bascule de thème clair/sombre |
| Drawer mobile de la sidebar | Mode rail repliable en desktop |
| | Authentification, `ProjectSwitcher` fonctionnel |

Le mode rail n'est pas construit, mais la structure retenue le rend accessible plus tard sans
refonte (cf. §4).

---

## 2. Décisions validées

| Décision | Choix retenu |
| --- | --- |
| Niveau de partage | **Primitives partagées, assemblage local.** `packages/ui` fournit les briques ; chaque app compose sa propre structure. |
| Base de la sidebar | **Composant `sidebar` de shadcn/ui**, installé dans `packages/ui` puis customisé aux tokens Lumyx. |
| Contenu du header | Breadcrumb conditionnel + titre + méta à gauche, slot d'actions à droite. |
| Menu compte | Dans le `SidebarFooter` du cloud, sous le compteur de quota. Pas dans le header. |
| Switchers org / projet / environnement | Dans le `SidebarHeader` du cloud, sous le wordmark. Pas dans le header. |
| `StatusStrip` | Conservé dans les deux apps, contenu inchangé ; seul son comportement sous 1024px évolue (§4). |
| Alimentation du header | **Chaque `page.tsx` rend son `<AppHeader/>`.** Pas de contexte, pas de portal, pas de table de routes. |
| Sidebar responsive | Figée à 248px en desktop, drawer `Sheet` sous 1024px. Pas de repli desktop. |
| `AppShell` | **Supprimé.** |

### Pourquoi shadcn plutôt qu'une sidebar maison

Le drawer mobile, le raccourci ⌘B, la persistance de l'état en cookie et l'accessibilité
arrivent testés au lieu d'être écrits à la main. Le composant est copié dans le repo, donc
customisable sans limite. Les tokens `--sidebar-*` déjà présents dans `styles.css` indiquent
que c'était le chemin prévu par le design system.

Prérequis vérifiés dans `packages/ui` : `components.json` existe (style `new-york`, `rsc: true`,
`cssVariables: true`) ; `separator`, `tooltip`, `skeleton`, `input`, `button` et
`@radix-ui/react-dialog` sont présents. Seuls `sheet.tsx` et le hook `use-mobile` manquent —
`shadcn add sidebar` les tire automatiquement.

Contrainte à respecter : `packages/ui/scripts/verify-ds.mjs` interdit dans `src/` toute couleur
littérale (hex, `rgba()`), toute font monospace, tout `dangerouslySetInnerHTML` et tout
`*.module.css`. La sidebar shadcn n'utilise que des tokens — elle passe.

### Pourquoi la page rend son header

Les alternatives écartées :

- **Table de routes dans le chrome** — zéro édition de page, mais les métas dynamiques (nom de
  room, compteurs live) et les actions par écran demandent un échappatoire qui annule le
  bénéfice.
- **Contexte + portal** — impose `'use client'` sur toute page qui déclare un header, et
  introduit un flash au premier rendu.
- **Layouts Next imbriqués** — idiomatique, mais ajoute ~21 fichiers `layout.tsx` et laisse les
  métas dépendantes des données de la page tout aussi malcommodes.

Rendre le header depuis la page garde le titre au même endroit que les données qui le
remplissent, reste compatible Server Components, et n'introduit aucun mécanisme implicite. Le
coût assumé est qu'une page peut oublier son header ; la grille est conçue pour que ça ne casse
rien (cf. §4).

### Pourquoi les switchers et le menu compte ne sont pas dans le header

Le header change à chaque navigation ; le contexte org/projet et l'identité de l'utilisateur
non. Les mélanger fait clignoter des éléments qui devraient être stables. Le menu compte dans
le `SidebarFooter` évite en plus toute collision de z-index ou de place avec le slot `actions`
d'une page qui porte trois boutons.

---

## 3. Ce que `packages/ui` expose

| Primitive | Origine | Rôle |
| --- | --- | --- |
| `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup*`, `SidebarMenu*` | shadcn, installé puis customisé | Coquille de navigation, drawer mobile, état |
| `SidebarNav` | **nouveau**, spécifique Lumyx | Rend `NavSection[]` en `SidebarGroup` / `SidebarMenuButton`, gère l'état actif via `usePathname` |
| `Wordmark` | déplacé depuis `app-shell.tsx` | `LumyxMark` + « Lumyx » |
| `AppHeader` | **remplace `Toolbar`** | Breadcrumb, titre, méta, actions, `SidebarTrigger` mobile |
| `PageBody` | inchangé | `max-w-[1360px]`, padding, seule zone qui scrolle |
| `StatusStrip` | inchangé | Barre système en bas |

`sidebar.tsx` reste le plus proche possible de l'upstream shadcn, pour pouvoir être remis à jour.
Toute la customisation visuelle Lumyx se concentre dans `SidebarNav` : barre d'accent inset de
2px sur l'item actif (`shadow-[inset_2px_0_0_var(--accent)]`), `bg-accent-tint`,
`text-accent-text`, labels de groupe en `sl-label`, hairline `border-hairline`, largeur pilotée
par `--sidebar-w` (248px, déjà défini dans `styles.css`).

Le type `NavSection` est conservé tel quel :

```ts
export type NavSection = {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
};
```

### API d'`AppHeader`

```tsx
<AppHeader
  breadcrumb={[{ href: '/rooms', label: 'Rooms' }, { label: 'webinar-us' }]}  // optionnel
  title="webinar-us"
  meta="ap-south-1 · 12 peers · 00:42:18"                                     // optionnel
  actions={<Button size="sm">Exporter</Button>}                               // optionnel
/>
```

Règles d'affichage :

- Sans `breadcrumb` : titre, puis `meta` en ligne fine dessous.
- Avec `breadcrumb` : breadcrumb en ligne fine au-dessus du titre, `meta` reste sous le titre.
- Le dernier segment du breadcrumb n'a pas de `href` et n'est pas cliquable.
- `AppHeader` rend lui-même le `SidebarTrigger`, en `lg:hidden`, à gauche du bloc titre.
- `AppHeader` porte `row-start-1` en dur.

---

## 4. Grille et responsive

`SidebarInset` devient `grid h-svh grid-rows-[auto_1fr_auto] overflow-hidden`.

| Ligne | Contenu | Comportement |
| --- | --- | --- |
| 1 (`auto`) | `AppHeader`, rendu par la page | Hauteur naturelle, ne scrolle pas |
| 2 (`1fr`) | `PageBody`, rendu par la page | **Seule zone qui scrolle** (`overflow-y-auto`) |
| 3 (`auto`) | `StatusStrip`, rendu par le chrome | Hauteur naturelle, ne scrolle pas |

Cette grille remplace les trois `position: sticky` de l'implémentation actuelle
(`sticky top-0 z-20` sur la toolbar, `sticky bottom-0 z-20` sur le strip, `sticky top-0` sur
l'aside). Plus de z-index à coordonner, et le contenu ne peut plus passer sous le header.

`AppHeader` porte `row-start-1`, `PageBody` porte `row-start-2`. Une page qui oublie son header,
ou qui inverse l'ordre de ses deux enfants, ne décale pas la grille : le contenu reste à sa
place, il manque seulement le titre.

### Seuil responsive

Le hook `use-mobile` de shadcn a un seuil par défaut à 768px. Il est porté à **1024px** : à
900px on aurait 248px de sidebar pour 650px de contenu, trop étroit pour les tables de peers et
les graphes de métriques.

| Sous 1024px | Au-dessus |
| --- | --- |
| Sidebar en drawer `Sheet`, fermée par défaut | Sidebar figée à 248px |
| `SidebarTrigger` visible dans `AppHeader` | `SidebarTrigger` masqué (`lg:hidden`) |
| `PageBody` en `px-4` | `PageBody` en `px-8` |
| `StatusStrip` scrolle horizontalement | `StatusStrip` sur une ligne |

### Configuration de la `Sidebar`

`collapsible="offcanvas"`, et non `collapsible="none"` : dans le source shadcn, `"none"`
court-circuite la branche mobile avant le rendu du `Sheet`. Avec `"offcanvas"` et un
`SidebarTrigger` masqué en desktop, on obtient exactement « figée en desktop, drawer en
mobile ». C'est aussi ce qui laisse le mode rail accessible plus tard : il suffira d'afficher le
trigger en desktop et de passer à `collapsible="icon"`.

### Thème sombre

Rien à faire. `--sidebar: var(--surface-card)` et le bloc sombre de `styles.css` redéfinit
`--surface-card` ; l'indirection CSS suffit. Aucune des deux apps n'a de bascule de thème
aujourd'hui (`next-themes` n'est installé que dans `apps/web`) — hors périmètre.

---

## 5. Assemblage par app

### `apps/dashboard/components/dashboard-chrome.tsx`

```
<SidebarProvider>
  <Sidebar collapsible="offcanvas">
    <SidebarHeader>  <Wordmark/>                        </SidebarHeader>
    <SidebarContent> <SidebarNav sections={SECTIONS}/>  </SidebarContent>
    <SidebarFooter>  v0.4.1 · MIT licensed · sfu-eu-3   </SidebarFooter>
  </Sidebar>
  <SidebarInset>
    {children}                    ← la page rend <AppHeader/> puis <PageBody/>
    <StatusStrip items={…}/>
  </SidebarInset>
</SidebarProvider>
```

`SECTIONS` est inchangé : Live (Overview, Rooms, Peers, Alerts), History (Metrics, Session
replay, Signaling), Instance (Server, Settings).

### `apps/cloud/components/cloud-chrome.tsx`

Structure identique, avec deux ajouts locaux à cloud :

- `SidebarHeader` : `<Wordmark/>` **plus** `<ProjectSwitcher/>` — un composant local, présentationnel
  à ce stade (pas de logique de changement de projet, hors périmètre).
- `SidebarFooter` : le compteur de quota deux-tons actuel, **plus** `<AccountMenu/>` en dessous.

`SECTIONS` est inchangé : Project (Overview, Rooms, Alerts, Metrics, API keys), Organisation
(Projects, Usage, Team, Billing, Audit log).

`apps/cloud/app/onboarding/page.tsx` reste hors du groupe `(console)` et n'a donc pas de chrome.

---

## 6. Migration des pages

21 écrans reçoivent un `AppHeader`.

**`apps/dashboard` (11)** : `/` (Overview), `/rooms`, `/rooms/room`, `/peers`, `/alerts`,
`/metrics`, `/replay`, `/signaling`, `/server`, `/settings`, `/_ds`.

**`apps/cloud/(console)` (10)** : `/` (Projects), `/overview`, `/rooms`, `/alerts`, `/metrics`,
`/keys`, `/usage`, `/team`, `/billing`, `/audit`.

Pour la majorité la transformation est mécanique : le titre existe déjà dans un
`CardHeader`/`CardTitle`, on le remonte dans `AppHeader` et on le retire de la carte, puis on
enveloppe le reste dans `<PageBody>`.

Deux cas demandent une décision :

- **`/rooms/room`** — le seul écran imbriqué, et donc le seul à recevoir un `breadcrumb`
  (`Rooms / <nom de la room>`).
- **`/_ds`** — page vitrine du design system : elle doit désormais présenter aussi les nouvelles
  primitives de layout.

---

## 7. Vérification

- `bun run verify:ds` sur `packages/ui`, `apps/dashboard`, `apps/cloud` — la règle
  « aucune couleur littérale » est la plus exposée par ce chantier.
- `bun run check-types` sur les trois.
- `bun run build` sur les deux apps.
- Passe visuelle sur les deux apps en desktop (≥ 1024px) et en mobile (< 1024px, drawer ouvert
  et fermé).

Le repo n'a pas de test de rendu (`apps/dashboard` n'a même pas de script `test`) ; ce chantier
n'introduit pas de harnais de test de composants — ce serait un sous-projet à part entière.
