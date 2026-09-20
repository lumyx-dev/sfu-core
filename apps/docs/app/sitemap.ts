import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

// Derive du loader plutot que d'une liste tenue a la main, pour qu'une page ajoutee dans
// content/docs n'exige pas de s'en souvenir. `getPages()` est l'accesseur public de la sortie de
// `loader()` (interface `LoaderOutput` de fumadocs-core) ; c'est aussi celui que la recherche de
// Fumadocs utilise en interne, donc les deux enumerations ne peuvent pas diverger.
//
// `page.url` inclut le `baseUrl: '/'` de lib/source.ts : l'accueil vaut '/' et les autres
// '/quickstart', '/api'… La concatenation donne donc une URL absolue sans double slash.
//
// Pas de `lastModified` : `new Date()` s'evaluerait dans le `.map()` et produirait seize
// horodatages de build legerement differents (mesure : .179Z pour /alerting, .180Z pour les
// autres), reaffirmes a chaque redeploiement et sans rapport avec la date de modification reelle
// de la page. Le champ est optionnel — mieux vaut ne rien declarer qu'un faux signal. Une vraie
// date viendrait de `fumadocs-mdx/plugins/last-modified`, qui la lit dans git.
export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    changeFrequency: 'weekly' as const,
    priority: page.url === '/' ? 1 : 0.7,
  }));
}
