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
    <DocsPage toc={page.data.toc} full={page.data.full}>
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
  };
}
