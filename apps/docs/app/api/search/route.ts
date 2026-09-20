import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Recherche servie par cette route, sans service heberge : a seize pages, Algolia ou Orama Cloud
// ajouteraient une cle a gerer et un index a synchroniser pour un gain nul.
//
// Ce n'est pas un index ecrit au build, malgre le nom de la tache : `createFromSource` enumere
// `source.getPages()` — le meme accesseur que app/sitemap.ts — construit l'index Orama a la
// PREMIERE requete et le garde dans un WeakMap cle par instance de loader. Le contenu est fige au
// build (les MDX sont compiles), l'index vit en memoire du serveur, et la route sort en
// `ƒ (Dynamic)`, ce qui est attendu. La variante reellement statique (`staticGET`, index exporte
// en JSON et recherche cote client) exigerait `search: { type: 'static' }` sur le RootProvider et
// cesserait de repondre a `?query=`.
//
// `language` epingle le tokenizer Orama si son defaut (`multilingual`) bouge en amont. Mesure : ne
// change aucun resultat sur ce corpus — aucun stemmer n'est enregistre dans un mode ni dans
// l'autre. Chiffres dans le rapport de la tache 7.
export const { GET } = createFromSource(source, {
  language: 'english',
});
