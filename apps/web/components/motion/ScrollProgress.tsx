'use client';

import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setRatio(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-progress
      className="fixed left-0 top-0 z-[60] h-0.5 bg-accent"
      style={{ width: `${ratio * 100}%` }}
    />
  );
}
