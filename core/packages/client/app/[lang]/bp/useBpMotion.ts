'use client';

import { useEffect, type RefObject } from 'react';

/** Page choreography only. Content is visible without JS; motion never gates reading. */
export function useBpMotion(page: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = page.current;
    if (!root || !window.IntersectionObserver) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dispose = () => {};
    const configure = () => {
      dispose();
      if (preference.matches) return;
      root.classList.add('bp-motion');
      const animations = new Set<Animation>();
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          // Anchor jumps may land beyond a target; never animate content above the reader.
          if (entry.boundingClientRect.bottom < 0) continue;
          const animation = entry.target.animate(
            [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 760, easing: 'cubic-bezier(.22, 1, .36, 1)' },
          );
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        }
      }, { threshold: 0.08 });
      root.querySelectorAll('.bp-market-heading, .bp-market-cards > article, .overview-summary > div, .overview-section > h2, .overview-section-head, .bp-executive-bento > div, .bp-visual > article, .bp-streams > article, .bp-moat-grid > article, .bp-atlas > article, .bp-founder-evidence, .bp-event-calculation').forEach(el => observer.observe(el));

      const story = root.querySelector<HTMLElement>('.bp-product-story');
      const chapters = [...root.querySelectorAll<HTMLElement>('.bp-product-chapter')];
      let frame = 0;
      let visible = false;
      const update = () => {
        frame = 0;
        if (!story || !visible || window.innerWidth < 960) return;
        const centre = window.innerHeight * 0.52;
        let closest = 0;
        let distance = Infinity;
        chapters.forEach((chapter, index) => {
          const box = chapter.getBoundingClientRect();
          const delta = Math.abs(box.top + box.height / 2 - centre);
          if (delta < distance) { closest = index; distance = delta; }
        });
        chapters.forEach((chapter, index) => { chapter.dataset.active = String(index === closest); });
        const top = story.getBoundingClientRect().top;
        const entrance = Math.max(0, Math.min(1, (window.innerHeight - top) / window.innerHeight));
        story.style.setProperty('--bp-product-scale', String(0.94 + entrance * 0.06));
      };
      const schedule = () => { if (visible && !frame) frame = window.requestAnimationFrame(update); };
      const storyObserver = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        schedule();
      });
      if (story) storyObserver.observe(story);
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      const finish = () => animations.forEach(animation => animation.cancel());
      window.addEventListener('beforeprint', finish);
      dispose = () => {
        observer.disconnect();
        storyObserver.disconnect();
        window.cancelAnimationFrame(frame);
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('beforeprint', finish);
        finish();
        root.classList.remove('bp-motion');
        story?.style.removeProperty('--bp-product-scale');
        chapters.forEach(chapter => { delete chapter.dataset.active; });
      };
    };
    configure();
    preference.addEventListener('change', configure);
    return () => { dispose(); preference.removeEventListener('change', configure); };
  }, [page]);
}
