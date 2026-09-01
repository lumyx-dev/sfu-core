import { SiteFrame } from "@/components/site/frame";
import { Badge, AlertBanner } from '@lumyx/ui';
import { RELEASES } from "@/lib/docs-data";

export default function ChangelogPage() {
  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-16 lg:grid-cols-[180px_1fr]">
        <nav className="flex flex-col gap-1 lg:sticky lg:top-8">
          <span className="sl-label pb-2">Releases</span>
          {RELEASES.map((r, i) => (
            <a
              key={r.version}
              href={`#${r.version}`}
              className={`sl-num flex items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-13 no-underline hover:bg-hover hover:no-underline ${i === 0 ? "text-strong" : "text-muted"}`}
            >
              {r.version}
              <span className="text-11 text-faint">{r.date.replace(/ \d{4}$/, "")}</span>
            </a>
          ))}
        </nav>

        <main className="flex min-w-0 flex-col gap-14">
          <div className="flex flex-col gap-3">
            <h1 className="text-44 font-semibold tracking-[-0.02em] text-strong">Changelog</h1>
            <p className="max-w-[620px] text-16 leading-relaxed text-muted text-pretty">
              Every release of the SFU, in public. Breaking changes are called breaking, and say what to update.
            </p>
          </div>

          {RELEASES.map((r) => (
            <section key={r.version} id={r.version} className="flex flex-col gap-5 border-t border-hairline pt-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="sl-num text-26 font-semibold tracking-[-0.02em] text-strong">{r.version}</h2>
                <span className="sl-num text-12 text-muted">{r.date}</span>
                <Badge className="sl-num">{r.commit}</Badge>
                {r.latest ? <Badge tone="accent">Latest</Badge> : null}
              </div>
              <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">{r.summary}</p>

              {"breaking" in r && r.breaking ? (
                <AlertBanner severity="critical" title="Breaking change" body={r.breaking} />
              ) : null}

              {r.groups.map((g) => (
                <div key={g.kind} className="flex flex-col gap-2.5">
                  <Badge tone={g.tone}>{g.kind}</Badge>
                  <ul className="flex flex-col gap-2 pl-0">
                    {g.items.map((it) => (
                      <li key={it} className="flex gap-2.5 text-13 leading-relaxed text-body text-pretty">
                        <span className="mt-[7px] size-1 shrink-0 rounded-pill bg-[var(--n-300)]" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </main>
      </div>
    </SiteFrame>
  );
}
