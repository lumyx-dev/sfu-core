import type { MetadataRoute } from 'next';

// Calque sur apps/landing/app/robots.ts, a la variable d'environnement pres : la doc vit sur son
// propre domaine et porte donc son propre sitemap.
//
// Nomme d'apres la variable qu'il lit : `SITE_URL` designe lumyx.dev ailleurs dans le repo
// (lib/layout.shared.tsx).
//
// `allow: '/'` reste general : ce sont les onze squelettes qui portent leur propre exclusion, par
// un `robots: { index: false }` emis depuis `generateMetadata` (app/(docs)/[[...slug]]/page.tsx) et
// par leur absence du sitemap. Une regle `disallow` ici les empecherait d'etre crawlees, donc
// aussi d'etre vues comme `noindex` — et il faudrait la tenir a jour a la main a chaque page qui
// sort de brouillon.
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${DOCS_URL}/sitemap.xml`,
  };
}
