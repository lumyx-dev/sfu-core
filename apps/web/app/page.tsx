import { SiteFooter } from '@/components/chrome/SiteFooter';
import { Hero } from './_sections/Hero';
import { LiveCard } from './_sections/LiveCard';

export default function Home() {
  return (
    <>
      <Hero />
      <LiveCard />
      <SiteFooter />
    </>
  );
}
