import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@lumyx/ui';
import { MetricDetail, MetricsThresholds } from '@/components/metrics-reference';
import { DocCard, DocCards } from '@/components/doc-cards';

// Les titres de Fumadocs ne sont pas de simples <h2>/<h3> : `Heading`
// (fumadocs-ui/dist/components/heading.js) pose `scroll-m-28` — indispensable sous `md`, ou
// `#nd-subnav` est une barre collante de --fd-header-height qui masquerait sinon le titre vise
// par un lien d'ancre — et enveloppe le texte dans un <a href="#id"> avec son bouton de copie.
// Les remplacer perdait les trois. On compose donc PAR-DESSUS le composant de Fumadocs au lieu
// de lui substituer un element a nous : lui garde son comportement, nous n'ajoutons que le
// palier typographique Lumyx et la hairline.
type HeadingProps = React.ComponentProps<'h2'>;
const FdH2 = defaultMdxComponents.h2 as React.ComponentType<HeadingProps>;
const FdH3 = defaultMdxComponents.h3 as React.ComponentType<HeadingProps>;

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,

    // `DocSection` rendait un h2 precede d'une hairline : c'etait le rythme visuel de l'ancienne
    // doc. Porte ici, il s'obtient avec un simple `## Titre` en MDX.
    // `cn(props.className, …)` et non un `className=` pose apres le spread : ce dernier ecrasait
    // en silence une classe passee par l'auteur du MDX.
    //
    // La TAILLE ne passe pas par `className`, pour la meme raison que `DocsTitle` et
    // `DocsDescription` (voir le bloc `[data-sl-tier]` de app/globals.css) : `Heading` fusionne
    // la classe recue avec le `cn` de Fumadocs, un tailwind-merge SANS l'extension d'echelle
    // Lumyx. Ce tailwind-merge classe `text-26` en COULEUR de texte, et le `text-strong` qui
    // suit dans la meme chaine l'evince. Mesure : le DOM rendu ne porte aucun `text-26` (il ne
    // survit que dans le payload flight de RSC, ce qui fait qu'un grep du HTML renvoie un faux
    // positif par titre), `.text-26{font-size:26px}` est bien emis mais aucune regle ne matche
    // l'element, et `getComputedStyle` lisait 21px sur les quatre <h2> de /quickstart —
    // `.prose :where(h2){font-size:1.5em}`. Le data-attribut est le point d'accroche de la
    // regle CSS qui pose le palier.
    h2: (props: HeadingProps) => (
      <FdH2
        {...props}
        data-sl-tier="h2"
        className={cn(
          props.className,
          'mt-8 border-t border-hairline pt-8 font-semibold tracking-[-0.02em] text-strong'
        )}
      />
    ),
    h3: (props: HeadingProps) => (
      <FdH3
        {...props}
        data-sl-tier="h3"
        className={cn(props.className, 'mt-6 font-semibold tracking-[-0.02em] text-strong')}
      />
    ),
    p: (props: React.ComponentProps<'p'>) => (
      <p
        {...props}
        className={cn(props.className, 'max-w-[680px] text-14 leading-relaxed text-body text-pretty')}
      />
    ),

    Callout,
    Tabs,
    Tab,
    Steps,
    Step,
    Card,
    CardContent,
    MetricsThresholds,
    MetricDetail,
    DocCards,
    DocCard,

    // `Cards` de Fumadocs survivait au spread alors que `Card` est desormais celui de Lumyx :
    // `<Cards><Card/></Cards>` aurait rendu des cartes Lumyx dans une grille Fumadocs, sans
    // erreur. On l'aligne sur la paire locale.
    Cards: DocCards,

    // Ajouts hors brief : les pages self-hosting et cloud portaient chacune un `Table` Lumyx dans
    // une `Card`, et self-hosting une liste de `Badge`. Le brief ne listait que Card/CardContent,
    // ce qui aurait fait tomber le tableau des prerequis, celui des plans et les quatre pastilles
    // de la checklist de production.
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,

    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
