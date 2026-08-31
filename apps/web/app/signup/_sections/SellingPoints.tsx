import { POINTS } from '@/content/signup';

// Source: Sign up.dc.html:46-55 — `sc-for list="{{ sellingPoints }}"`, backed by the `POINTS`
// array copied verbatim into content/signup.ts. Static list, no state, so this stays a Server
// Component like every section on this page except SignupWizard.
export function SellingPoints() {
  return (
    <div className="flex flex-col gap-4 max-w-[460px]">
      {POINTS.map((point) => (
        <div
          key={point.title}
          className="flex items-start gap-3 pl-4 border-l-2 border-accent"
        >
          <span className="flex flex-col gap-1">
            <span className="text-[13.5px] font-semibold text-strong">{point.title}</span>
            <span className="text-[12.5px] leading-body text-muted [text-wrap:pretty]">
              {point.body}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
