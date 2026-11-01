import { useEffect } from 'react';

export default function HomepageMotionController() {
  useEffect(() => {
    const root = document.querySelector('.wn-approved-home');
    if (!root) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const sections = Array.from(root.querySelectorAll(':scope > section'));
    const heroVisual = root.querySelector('.wn-approved-hero__visual');

    sections.forEach((section) => section.classList.add('wn-motion-ready'));

    if (reduceMotion) {
      sections.forEach((section) => section.classList.add('is-visible'));
      return undefined;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    sections.forEach((section, index) => {
      if (index === 0) section.classList.add('is-visible');
      else revealObserver.observe(section);
    });

    let rafId = 0;
    const onScroll = () => {
      if (!heroVisual) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const shift = Math.min(window.scrollY * 0.035, 16);
        heroVisual.style.setProperty('--wn-parallax-y', `${shift}px`);
      });
    };

    let onPointerMove;
    let onPointerLeave;
    let onPointerEnter;
    let onResize;
    let pointerRafId = 0;
    let cachedRect = null;

    if (heroVisual && finePointer) {
      const updateRect = () => {
        if (heroVisual) cachedRect = heroVisual.getBoundingClientRect();
      };

      onPointerEnter = updateRect;
      onResize = updateRect;

      onPointerMove = (event) => {
        if (!cachedRect) updateRect();
        cancelAnimationFrame(pointerRafId);
        pointerRafId = requestAnimationFrame(() => {
          if (!cachedRect || cachedRect.width === 0 || cachedRect.height === 0) return;
          const x = (event.clientX - cachedRect.left) / cachedRect.width - 0.5;
          const y = (event.clientY - cachedRect.top) / cachedRect.height - 0.5;
          heroVisual.style.setProperty('--wn-tilt-x', `${(-y * 3.2).toFixed(2)}deg`);
          heroVisual.style.setProperty('--wn-tilt-y', `${(x * 4.2).toFixed(2)}deg`);
          heroVisual.style.setProperty('--wn-glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
          heroVisual.style.setProperty('--wn-glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
        });
      };

      onPointerLeave = () => {
        cancelAnimationFrame(pointerRafId);
        heroVisual.style.setProperty('--wn-tilt-x', '0deg');
        heroVisual.style.setProperty('--wn-tilt-y', '0deg');
        heroVisual.style.setProperty('--wn-glow-x', '50%');
        heroVisual.style.setProperty('--wn-glow-y', '38%');
        cachedRect = null;
      };

      heroVisual.addEventListener('pointerenter', onPointerEnter, { passive: true });
      heroVisual.addEventListener('pointermove', onPointerMove, { passive: true });
      heroVisual.addEventListener('pointerleave', onPointerLeave);
      window.addEventListener('resize', onResize, { passive: true });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      revealObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);

      if (heroVisual && onPointerMove && onPointerLeave) {
        cancelAnimationFrame(pointerRafId);
        heroVisual.removeEventListener('pointerenter', onPointerEnter);
        heroVisual.removeEventListener('pointermove', onPointerMove);
        heroVisual.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('resize', onResize);
      }
    };
  }, []);

  return null;
}
