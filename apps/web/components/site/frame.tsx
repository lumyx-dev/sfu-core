import { SiteHeader, SiteFooter, DarkBand } from "./chrome";

/** Marketing chrome for every page but the home hero, which owns its own dark header. */
export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-body">
      <DarkBand><SiteHeader /></DarkBand>
      {children}
      <DarkBand className="border-t border-hairline"><SiteFooter /></DarkBand>
    </div>
  );
}
