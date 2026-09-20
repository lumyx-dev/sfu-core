import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';

export default async function Page(props: PageProps<'/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      // `includeSeparator` remet le fil d'Ariane en service. `DocsPage` l'active par defaut, mais
      // l'arbre de la §6.1 est plat — les quatre sections sont des separateurs de `meta.json`, pas
      // des dossiers — et `getBreadcrumbItemsFromPath` ignore les separateurs sauf demande : le
      // composant recevait une liste vide et rendait `null`, donc `#nd-page` ouvrait directement
      // sur le <h1> alors que la §6.2 annonce le fil comme remplacant du `crumb` saisi a la main.
      // Avec le drapeau, il rend le nom de section ("Getting started"…), ce que `crumb` portait.
      // `id` est le crochet de la regle 6 de globals.css, qui lui pose le palier 12 : un litteral
      // d'objet type `ComponentProps<'div'>` n'accepte pas `data-sl-tier` (voir la regle).
      breadcrumb={{ includeSeparator: true, id: 'sl-crumb' }}
    >
      {/* Tout ce qui n'est pas la taille de police passe par `className` : les deux composants
          fusionnent ce qu'ils recoivent par-dessus leur defaut. La taille, elle, ne peut PAS
          passer par la — voir le bloc `[data-sl-tier]` de globals.css, qui la pose et explique
          pourquoi. Le data-attribut est le point d'accroche de cette regle. */}
      <DocsTitle
        data-sl-tier="title"
        className="tracking-[-0.02em] text-strong text-pretty"
      >
        {page.data.title}
      </DocsTitle>
      <DocsDescription
        data-sl-tier="description"
        className="mb-8 max-w-[680px] leading-relaxed text-muted text-pretty"
      >
        {page.data.description}
      </DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    // Les onze squelettes (`draft: true` en frontmatter) ne sont pas offerts a l'indexation :
    // leur corps est un `<Callout>` et des titres vides. Ils restent dans `meta.json` — la nav
    // doit rester complete — et sont deja absents du sitemap ; le `noindex` est le second volet,
    // celui qui compte pour une URL qu'un crawler atteindrait par un lien de la sidebar.
    // A retirer page par page, en meme temps que le drapeau, quand la prose arrive.
    ...(page.data.draft ? { robots: { index: false } } : {}),
  };
}
