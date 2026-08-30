import { SiteHeader } from '@/components/chrome/SiteHeader';
import { SiteFooter } from '@/components/chrome/SiteFooter';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-5 py-24 md:px-6 lg:px-10">
        <h1 style={{ fontSize: 'var(--fs-26)' }}>Sightline</h1>
      </main>
      <SiteFooter />
    </>
  );
}
