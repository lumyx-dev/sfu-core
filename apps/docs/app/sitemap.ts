import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

// Derive du loader plutot que d'une liste tenue a la main, pour qu'une page ajoutee dans
// content/docs n'exige pas de s'en souvenir. `getPages()` est bien l'accesseur public de la sortie
// de `loader()` (LoaderOutput.getPages, node_modules/fumadocs-core/dist/index-BEGAd2ej.d.ts:239) ;
// c'est aussi celui que la recherche de Fumadocs utilise en interne.
//
// `page.url` inclut le `baseUrl: '/'` de lib/source.ts : l'accueil vaut '/' et les autres
// '/quickstart', '/api'… La concatenation donne donc une URL absolue sans double slash.
export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: page.url === '/' ? 1 : 0.7,
  }));
}
