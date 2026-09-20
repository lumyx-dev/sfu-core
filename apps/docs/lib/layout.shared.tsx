import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Wordmark } from '@lumyx/ui';
// `REPO` vit dans lib/site-data.ts, qui est aussi la source des liens du MDX : une seconde
// declaration ici aurait pu diverger sans qu'aucun build ne le voie.
import { REPO } from './site-data';

// Ici `SITE_URL` veut bien dire lumyx.dev — c'est la seule des quatre constantes d'URL de cette app
// a le meriter ; app/layout.tsx, app/sitemap.ts et app/robots.ts lisent NEXT_PUBLIC_DOCS_URL et
// s'appellent donc `DOCS_URL`.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark />,
      url: SITE_URL,
    },
    // `external: true` sur les deux : la doc vit sur son propre domaine, ces URLs sortent donc de
    // l'app. Sans le drapeau, Fumadocs rend un <Link> de Next qui tenterait une navigation client
    // vers une origine qu'il ne sert pas.
    links: [
      { text: 'Home', url: SITE_URL, external: true },
      { text: 'GitHub', url: REPO, external: true },
    ],
    // Deja le defaut de Fumadocs v16 : ecrit quand meme parce que la bascule est une exigence ici
    // — localStorage etant cloisonne par origine, c'est le seul moyen de repasser en clair depuis
    // la doc — et non un defaut amont dont on herite.
    themeSwitch: { enabled: true },
  };
}
