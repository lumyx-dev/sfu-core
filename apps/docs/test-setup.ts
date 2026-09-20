import { plugin } from 'bun';
import { createMdxPlugin } from 'fumadocs-mdx/bun';

// `lib/source.ts` appelle `defineDocs` de `fumadocs-mdx/macro`, une macro que seul le plugin de
// bundler de fumadocs-mdx sait compiler. Sous `bun test` il n'y a pas de bundler : la fonction
// lancee telle quelle jette
// « [MDX] this macro was not compiled by the bundler plugin of `fumadocs-mdx` », et tout test qui
// importe `source` — directement ou via app/sitemap.ts — echoue a l'import.
//
// Ce module enregistre le plugin Bun officiel du paquet dans le runtime de test, charge par
// `[test].preload` de bunfig.toml.
//
// Le `await` n'est pas decoratif : `setup()` du plugin est asynchrone (il lit et evalue
// source.config.ts avant d'installer son `onLoad`). Mesure, sans le `await`, le test echoue avec
// exactement la meme erreur de macro qu'avec aucun preload — les modules sont resolus avant que le
// `onLoad` ne soit en place. Avec, les quatre tests du sitemap passent.
await plugin(createMdxPlugin());
