import { defineConfig } from 'fumadocs-mdx/config';
// Sous-chemin dedie plutot que la racine `@lumyx/ui` : fumadocs-mdx compile ce fichier avec
// esbuild en `packages: "external"`, puis l'importe nativement depuis Node — sans passer par le
// bundler webpack/turbopack de Next qui tolere les imports relatifs sans extension. Le barrel
// `@lumyx/ui` (`src/index.ts`) fait `export * from './lib/utils'` (sans extension), ce que le
// resolveur ESM natif de Node refuse (`ERR_MODULE_NOT_FOUND`). `code-theme.ts` n'a aucun import
// interne, donc ce sous-chemin se resout nativement sans toucher au reste du barrel. Ce sous-chemin
// est execute par le Node natif de la machine, d'ou le `engines: { node: '>=22.18' }` declare a la
// fois par packages/ui/package.json — le paquet qui EXPOSE le `.ts` brut — et par
// apps/docs/package.json : c'est la version a partir de laquelle le type-stripping n'est plus
// derriere un drapeau.
import { lumyxCodeTheme } from '@lumyx/ui/code-theme';

// Fumadocs fusionne nos options par-dessus ses defauts avec un spread superficiel
// (`{...rehypeCodeDefaultOptions, ...nosOptions}`) : un spread ne peut jamais retirer une cle.
// `rehypeCodeDefaultOptions` porte en dur `themes: {light:'github-light', dark:'github-dark'}`
// et `defaultColor: false`. Consequence pour chaque option a un seul theme :
//
// - `theme: lumyxCodeTheme` seul : `themes` du defaut survit a la fusion, `codeToTokens` de Shiki
//   teste `"themes" in options` AVANT `"theme" in options` — `themes` gagne des qu'il existe,
//   meme si sa valeur ne convient pas. Le highlighter n'a prechauffe que `lumyxCodeTheme` (seul
//   `getRequiredThemes` prefere correctement `theme`), donc la page plante :
//   `ShikiError: Theme \`github-light\` not found`.
// - `theme: lumyxCodeTheme, themes: undefined` : `"x" in obj` ne regarde que la presence de la
//   cle, pas sa valeur — `themes` reste "in options" meme a `undefined`. Shiki tente alors
//   `Object.entries(undefined)` et plante avec `Cannot convert undefined or null to object`.
//   Verifie empiriquement (dev server, puis isole avec `shiki.codeToHtml` seul).
// - `themes: {light: lumyxCodeTheme, dark: lumyxCodeTheme}` seul : le `defaultColor: false` du
//   defaut survit a la meme fusion superficielle. Avec `defaultColor: false`, Shiki n'ecrit
//   AUCUNE couleur inline et se repose entierement sur des variables `--shiki-light`/
//   `--shiki-dark` consommees par une regle externe — pire que necessaire, et ca fait echouer
//   l'exigence `--shiki-light` == 0.
//
// La combinaison qui fonctionne evite le probleme a la racine : `themes` (au pluriel) EXISTE
// deja sur le defaut, donc le fournir nous-memes ne fait que remplacer sa valeur (pas de cle
// fantome a retirer), et on neutralise explicitement `defaultColor` et `colorsRendering` plutot
// que de compter sur leurs valeurs par defaut. `colorsRendering: 'none'` est une option publique
// documentee de Shiki (`@shikijs/types`, `CodeOptionsMultipleThemes.colorsRendering`) : avec deux
// entrees identiques et `defaultColor: 'light'`, `flatTokenVariants` n'ecrit la couleur QUE sur
// le slot par defaut (`color: var(--code-*)` inline, comme en mode theme unique) et n'emet aucune
// variable `--shiki-*`. Verifie avec Shiki 4.4.3 reel depuis apps/docs : sortie identique
// token-pour-token au mode `theme` seul, `--shiki-light` absent. Deux effets de bord mesures,
// sans consequence ici : la classe `<pre>` gagne `shiki-themes` (rien dans
// fumadocs-ui/css/lib/shiki.css ne cible ce nom, cosmetique), et `getRequiredThemes` precharge le
// theme deux fois (idempotent). `keepBackground` (non utilise ici, off par defaut) cesserait de
// fonctionner sous ce mode puisque `--shiki-light-bg` n'est plus emis — a garder en tete si
// quelqu'un l'active un jour.
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: lumyxCodeTheme,
        dark: lumyxCodeTheme,
      },
      defaultColor: 'light',
      colorsRendering: 'none',

      // Par defaut Fumadocs pose sur le <pre> un attribut `icon` contenant une chaine HTML de
      // logo de langage, destinee a dangerouslySetInnerHTML. Le systeme Lumyx ne met pas de
      // logo dans un bloc de code.
      icon: false,
    },
  },
});
