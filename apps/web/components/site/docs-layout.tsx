import Link from "next/link";
import { SiteFrame } from "./frame";
import { DOC_NAV } from "@/lib/docs-data";

export type TocItem = { id: string; label: string };

/** Shared shell for every /docs/* page: left section nav, main column, right on-page rail. */
export function DocsLayout({
  crumb,
  title,
  description,
  activeId,
  toc,
  children,
}: {
  crumb: string;
  title: string;
  description: string;
  activeId: string;
  toc: TocItem[];
  children: React.ReactNode;
}) {
  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-10 px-10 py-10 lg:grid-cols-[220px_1fr_200px]">
        <nav className="flex flex-col gap-5 lg:sticky lg:top-8">
          {DOC_NAV.map((sec) => (
            <div key={sec.title} className="flex flex-col gap-1">
              <span className="sl-label pb-1">{sec.title}</span>
              {sec.items.map((it) =>
                it.href ? (
                  <Link
                    key={it.id}
                    href={it.href}
                    className={`rounded-sm px-2 py-1.5 text-13 no-underline hover:bg-hover hover:no-underline ${
                      it.id === activeId ? "bg-active font-medium text-strong" : "text-muted"
                    }`}
                  >
                    {it.label}
                  </Link>
                ) : (
                  <span key={it.id} className="cursor-default px-2 py-1.5 text-13 text-faint">
                    {it.label}
                  </span>
                )
              )}
            </div>
          ))}
        </nav>

        <main className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-3">
            <span className="sl-num text-12 text-faint">{crumb}</span>
            <h1 className="text-44 font-semibold tracking-[-0.02em] text-strong text-pretty">{title}</h1>
            <p className="max-w-[680px] text-16 leading-relaxed text-muted text-pretty">{description}</p>
          </div>

          {children}
        </main>

        <aside className="hidden flex-col gap-2 lg:sticky lg:top-8 lg:flex">
          <span className="sl-label pb-1">On this page</span>
          {toc.map((t, i) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`border-l-2 px-2.5 py-1 text-12 no-underline hover:text-strong hover:no-underline ${
                i === 0 ? "border-accent font-medium text-strong" : "border-hairline text-muted"
              }`}
            >
              {t.label}
            </a>
          ))}
        </aside>
      </div>
    </SiteFrame>
  );
}

export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3 border-t border-hairline pt-8">
      <h2 className="text-26 font-semibold tracking-[-0.02em] text-strong">{title}</h2>
      {children}
    </section>
  );
}

export function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-subtle bg-sunken px-4 py-3.5">
      {lines.map((l, i) => (
        <span key={i} className="sl-num whitespace-pre text-[12.5px] text-body">
          {l}
        </span>
      ))}
    </div>
  );
}
