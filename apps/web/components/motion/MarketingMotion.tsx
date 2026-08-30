'use client';

import { useEffect } from 'react';

const DURATION = 560;
const EASE = 'cubic-bezier(0.16,0.84,0.32,1)';
const FAILSAFE_MS = 6000;

export function MarketingMotion() {
  useEffect(() => {
    // Le seul test de prefers-reduced-motion du site. On sort avant d'avoir masqué
    // quoi que ce soit : tout reste visible et lisible, rien ne joue.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const play = (el: HTMLElement) => {
      if (el.dataset.animPlayed) return;
      el.dataset.animPlayed = '1';
      const kind = el.getAttribute('data-anim') || 'rise';
      const delay = Number(el.getAttribute('data-anim-delay') || 0);
      el.style.animation = `sl-${kind} ${DURATION}ms ${EASE} ${delay}ms both`;
    };

    // Titres révélés mot par mot : on découpe avant que l'observer ne voie les éléments.
    document.querySelectorAll<HTMLElement>('[data-words]').forEach((el) => {
      if (el.dataset.wordsSplit) return;
      el.dataset.wordsSplit = '1';
      const base = Number(el.getAttribute('data-words-delay') || 0);
      const words = (el.textContent || '').split(/\s+/).filter(Boolean);
      el.textContent = '';
      words.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.display = 'inline-block';
        span.style.animation = `sl-word ${DURATION}ms ${EASE} ${base + i * 45}ms both`;
        el.appendChild(span);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-anim]'));
    const deferred: HTMLElement[] = [];
    els.forEach((el) => {
      if (el.hasAttribute('data-anim-now')) play(el);
      else {
        el.style.opacity = '0';
        deferred.push(el);
      }
    });

    let io: IntersectionObserver | undefined;
    if (deferred.length && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              play(e.target as HTMLElement);
              io?.unobserve(e.target);
            }
          }),
        { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
      );
      deferred.forEach((el) => io?.observe(el));
    } else {
      deferred.forEach(play);
    }

    // Filet de sécurité : un observer qui ne se déclenche jamais ne doit pas pouvoir
    // laisser du contenu invisible.
    const failsafe = window.setTimeout(() => deferred.forEach(play), FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      io?.disconnect();
    };
  }, []);

  return null;
}
