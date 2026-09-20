import type { MetadataRoute } from 'next';

// Calque sur apps/landing/app/robots.ts, a la variable d'environnement pres : la doc vit sur son
// propre domaine et porte donc son propre sitemap.
const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
