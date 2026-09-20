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
} from '@lumyx/ui';
import { MetricsReference, MetricsThresholds } from '@/components/metrics-reference';
import { DocCard, DocCards } from '@/components/doc-cards';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,

    // `DocSection` rendait un h2 precede d'une hairline : c'etait le rythme visuel de l'ancienne
    // doc. Porte ici, il s'obtient avec un simple `## Titre` en MDX.
    h2: (props: React.ComponentProps<'h2'>) => (
      <h2
        {...props}
        className="mt-8 border-t border-hairline pt-8 text-26 font-semibold tracking-[-0.02em] text-strong"
      />
    ),
    h3: (props: React.ComponentProps<'h3'>) => (
      <h3 {...props} className="mt-6 text-20 font-semibold tracking-[-0.02em] text-strong" />
    ),
    p: (props: React.ComponentProps<'p'>) => (
      <p {...props} className="max-w-[680px] text-14 leading-relaxed text-body text-pretty" />
    ),

    Callout,
    Tabs,
    Tab,
    Steps,
    Step,
    Card,
    CardContent,
    MetricsReference,
    MetricsThresholds,
    DocCards,
    DocCard,

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
