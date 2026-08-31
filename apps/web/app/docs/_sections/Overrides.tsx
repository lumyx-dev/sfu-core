import { OVERRIDE_SAMPLE } from '@/content/metrics';

// Source: Docs.dc.html:120-128.
export function Overrides() {
  return (
    <section id="overrides" className="flex flex-col gap-3.5 pt-3 border-t border-border">
      <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-strong">
        Overriding a threshold
      </h2>
      <p className="m-0 text-[14px] leading-body text-body [text-wrap:pretty]">
        Thresholds are per project and per environment. A staging environment that runs on a bad
        office link should not page anyone.
      </p>
      <div className="flex flex-col gap-[5px] py-3.5 px-4 border border-border rounded-tile bg-sunken">
        {OVERRIDE_SAMPLE.map((line, i) => (
          <span key={i} className="whitespace-pre-wrap text-[12.5px] leading-body text-body">
            {line}
          </span>
        ))}
      </div>
    </section>
  );
}
