interface IntroEffectOptions {
  revealSelector: string;
  activeColor: string;
  stagger: () => void;
  threshold?: number;
  rootMargin?: string;
}

/** Install only after the page's content is mounted; return the effect cleanup. */
export function installIntroEffects(root: HTMLElement, {
  revealSelector,
  activeColor,
  stagger,
  threshold = 0.15,
  rootMargin = '0px 0px -60px 0px',
}: IntroEffectOptions): () => void {
  let disposed = false;
  const io = new IntersectionObserver((entries) => {
    if (disposed) return;
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (!entry.target.classList.contains('visible')) entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold, rootMargin });
  root.querySelectorAll<HTMLElement>(revealSelector).forEach((el) => {
    if (!el.classList.contains('fade-up')) el.classList.add('fade-up');
    io.observe(el);
  });
  stagger();

  const floats = root.querySelectorAll<HTMLElement>('.float');
  let mx = 0, my = 0, tx = 0, ty = 0;
  const onMouse = (event: MouseEvent) => {
    mx = (event.clientX / window.innerWidth - 0.5) * 2;
    my = (event.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('mousemove', onMouse);
  let raf = 0;
  const loop = () => {
    if (disposed) return;
    tx += (mx - tx) * 0.06;
    ty += (my - ty) * 0.06;
    floats.forEach((el, i) => {
      const depth = (i % 3 + 1) * 6;
      const translate = `${tx * depth}px ${ty * depth}px`;
      if (el.style.translate !== translate) el.style.translate = translate;
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const navLinks = root.querySelectorAll<HTMLAnchorElement>('.nav-links a');
  const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
  const setActive = () => {
    const y = window.scrollY + 120;
    let current = sections[0]?.id;
    for (const section of sections) if (section.offsetTop <= y) current = section.id;
    navLinks.forEach((anchor) => {
      const color = anchor.getAttribute('href') === '#' + current ? activeColor : '';
      if (anchor.style.color !== color) anchor.style.color = color;
    });
  };
  window.addEventListener('scroll', setActive, { passive: true });
  setActive();

  const onAnchorClick = (event: Event) => {
    const anchor = event.currentTarget as HTMLAnchorElement;
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const id = href.slice(1);
    const target = id === 'top' ? root : root.querySelector('#' + id);
    if (target) {
      event.preventDefault();
      const top = (target as HTMLElement).getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
  anchors.forEach((anchor) => anchor.addEventListener('click', onAnchorClick));

  return () => {
    disposed = true;
    io.disconnect();
    window.removeEventListener('mousemove', onMouse);
    window.removeEventListener('scroll', setActive);
    cancelAnimationFrame(raf);
    anchors.forEach((anchor) => anchor.removeEventListener('click', onAnchorClick));
  };
}
