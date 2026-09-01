import Link from "next/link";
import type { Metadata } from "next";
import { AlertBanner } from "@lumyx/ui";
import { SiteFrame } from "@/components/site/frame";
import { SectionHead } from "@/components/site/chrome";
import { BLOG_POSTS } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Blog — Lumyx",
  description: "Build notes on an open-source Rust WebRTC SFU, and analysis of the market around it.",
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
        <SectionHead index="01" label="Blog" blurb="Build notes, market analysis, and the bugs we closed." />
        <div className="flex flex-col gap-10">
          <AlertBanner
            severity="info"
            title="Lumyx is in active development"
            body="Core video forwarding stability and third-party production usage aren't validated yet."
          />
          <div className="flex flex-col">
            {posts.map((p, i) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className={`flex flex-col gap-2 border-t border-subtle py-6 no-underline hover:no-underline ${
                  i === posts.length - 1 ? "border-b" : ""
                }`}
              >
                <span className="sl-num text-12 text-faint">{p.date}</span>
                <span className="text-[19px] font-semibold tracking-[-0.02em] text-strong">{p.title}</span>
                <span className="text-13 leading-relaxed text-muted text-pretty">{p.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SiteFrame>
  );
}
