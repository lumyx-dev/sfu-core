import { SiteHeader, SiteFooter } from "./chrome";

/** Marketing chrome for every page but the home hero, which owns its own header. */
export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-body">
      <SiteHeader />
      {children}
      <div className="border-t border-hairline">
        <SiteFooter />
      </div>
    </div>
  );
}
