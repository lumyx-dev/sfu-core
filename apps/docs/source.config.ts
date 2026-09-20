import { defineConfig } from 'fumadocs-mdx/config';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
// Sous-chemin dedie plutot que la racine `@lumyx/ui` : fumadocs-mdx compile ce fichier avec
// esbuild en `packages: "external"`, puis l'importe nativement depuis Node — sans passer par le
// bundler webpack/turbopack de Next qui tolere les imports relatifs sans extension. Le barrel
// `@lumyx/ui` (`src/index.ts`) fait `export * from './lib/utils'` (sans extension), ce que le
// resolveur ESM natif de Node refuse (`ERR_MODULE_NOT_FOUND`). `code-theme.ts` n'a aucun import
// interne, donc ce sous-chemin se resout nativement sans toucher au reste du barrel.
import { lumyxCodeTheme } from '@lumyx/ui/code-theme';

// `rehypeCodeDefaultOptions` (objet exporte, muable) porte en dur `themes: { light: 'github-light',
// dark: 'github-dark' }`. Fumadocs fusionne nos options par-dessus lui avec un spread superficiel
// (`{ ...rehypeCodeDefaultOptions, ...nosOptions }`) : comme un spread ne peut jamais retirer une
// cle, ajouter `theme` sans retirer `themes` laisse les deux presentes sur l'objet final. Or
// `codeToTokens` de Shiki teste `"themes" in options` avant `"theme" in options` — la cle `themes`
// gagne des qu'elle existe, meme a `undefined` (`"x" in obj` ne regarde que la presence de la cle,
// pas sa valeur : passer `themes: undefined` a cote de `theme` a ete essaye et fait planter Shiki
// avec `Cannot convert undefined or null to object`, verifie empiriquement en lancant le serveur
// de dev — Shiki tente alors `Object.entries(undefined)`). Constate aussi sans ce retrait : la
// page plante avec `ShikiError: Theme \`github-light\` not found`, le highlighter n'ayant charge
// que notre theme. Retirer la cle `themes` de l'objet par defaut avant la fusion est donc la seule
// facon de laisser le theme unique s'appliquer proprement ; comme cet objet est un singleton
// partage par reference a l'interieur de fumadocs-core, le modifier ici avant `defineConfig`
// s'applique a toutes les compilations ulterieures de ce process.
delete (rehypeCodeDefaultOptions as { themes?: unknown }).themes;

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      // Un seul theme, et non la paire clair/sombre par defaut de Fumadocs : les couleurs sont
      // des variables CSS qui basculent deja d'elles-memes sous .dark.
      theme: lumyxCodeTheme,

      // Par defaut Fumadocs pose sur le <pre> un attribut `icon` contenant une chaine HTML de
      // logo de langage, destinee a dangerouslySetInnerHTML. Le systeme Lumyx ne met pas de
      // logo dans un bloc de code.
      icon: false,
    },
  },
});
