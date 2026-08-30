'use client';

import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setRatio(max > 0 ? window.scrollY / max : 0);
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 2,
        width: `${ratio * 100}%`,
        background: 'var(--accent)',
        zIndex: 50,
        transition: 'width 80ms linear',
      }}
    />
  );
}
