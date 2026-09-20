import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Wordmark } from '@lumyx/ui';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev';
const REPO = 'https://github.com/FrekiManagarm/lumyx';

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
    // `enabled: true` est deja le defaut de Fumadocs v16 — mesure dans
    // node_modules/fumadocs-ui/dist/layouts/shared/client.js:62,
    // `themeSwitch: { enabled: themeSwitchEnabled = true, ... } = {}`. L'option est ecrite malgre
    // tout parce que la bascule n'est pas optionnelle ici : localStorage etant cloisonne par
    // origine, un visiteur passe en clair sur lumyx.dev arrive en sombre sur docs.lumyx.dev
    // (`defaultTheme: 'dark'` dans app/layout.tsx) et n'a que ce bouton pour repasser en clair.
    // La ligne rend donc l'exigence visible au lieu de la laisser dependre d'un defaut amont.
    themeSwitch: { enabled: true },
  };
}
