import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Recherche servie par cette route, sans service heberge : a seize pages, Algolia ou Orama Cloud
// ajouteraient une cle a gerer et un index a synchroniser pour un gain nul.
//
// Ce que fait reellement `createFromSource(source).GET`, lu dans
// node_modules/fumadocs-core/dist/search/server.js:185-215 : il appelle `source.getPages()` — le
// meme accesseur que app/sitemap.ts — construit l'index Orama a la PREMIERE requete et le garde
// dans un WeakMap cle par instance de loader. Le contenu est donc fige au build (les MDX sont
// compiles par fumadocs-mdx), mais l'index lui-meme vit en memoire du serveur : la route sort en
// `ƒ (Dynamic)` au build, ce qui est attendu. La variante reellement statique existe
// (`staticGET`, index exporte en JSON et recherche cote client) et n'est pas prise ici : elle
// exigerait `search: { type: 'static' }` sur le RootProvider et la route ne repondrait plus a
// `?query=`, alors qu'elle repond en HTTP aujourd'hui.
//
// `language: 'english'` epingle le tokenizer sur un corpus 100% anglais, au lieu de dependre du
// defaut v16 `multilingual` (SharedOptions.language dans server-D1FyGpz2.d.ts:53-59). Mesure, et
// contre l'intuition : l'option ne change RIEN sur ce contenu. Nombre de resultats, avec puis sans,
// sur `metric` 21/21, `metrics` 19/19, `room` 18/18, `rooms` 4/4, `observability` 2/2,
// `forwarded` 0/0. Aucune racinisation dans un mode comme dans l'autre — `forwarded` ne trouve pas
// `forwarding`, `rooms` ne trouve pas les pages de `room`. L'option est gardee pour figer le
// tokenizer si le defaut amont bouge, pas pour un gain de rappel : il n'y en a aucun.
export const { GET } = createFromSource(source, {
  language: 'english',
});
