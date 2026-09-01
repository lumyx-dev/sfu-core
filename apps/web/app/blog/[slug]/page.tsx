import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertBanner } from '@lumyx/ui';
import { SiteFrame } from "@/components/site/frame";
import { SectionHead } from "@/components/site/chrome";
import { BLOG_POSTS } from "@/lib/blog-data";
import { BLOG_CONTENT } from "@/components/blog/registry";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: `${post.title} — Lumyx blog`, description: post.description };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const Content = BLOG_CONTENT[slug];
  if (!post || !Content) notFound();

  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
        <SectionHead index={post.date} label="Blog" />
        <article className="flex max-w-[680px] flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-44 font-semibold tracking-[-0.02em] text-strong text-pretty">{post.title}</h1>
            <p className="text-16 leading-relaxed text-muted text-pretty">{post.dek}</p>
          </div>
          <AlertBanner
            severity="info"
            title="Lumyx is in active development"
            body="Core video forwarding stability and third-party production usage aren't validated yet. Track progress on the changelog."
          />
          <Content />
        </article>
      </div>
    </SiteFrame>
  );
}
