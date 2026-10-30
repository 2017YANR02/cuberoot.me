/** @module Branded fallback for unmatched URLs and route-level notFound(). */
import type { Metadata } from 'next';
import AppLink from '@/components/AppLink';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'CubeRoot — 404',
};

const messages = {
  en: {
    title: 'Looks like we took a wrong turn.',
    aside: 'A little lost, together.',
    description: 'This page could not be found. Your next solve is still here.',
    home: 'Back to home',
    timer: 'Timer',
    algorithms: 'Algorithms',
    navigation: 'Find your way back',
  },
  zh: {
    title: '好像，拐错了一个弯。',
    aside: '迷路也没关系',
    description: '这个页面不存在，不过下一次复原还在这里。',
    home: '回到首页',
    timer: '计时器',
    algorithms: '公式库',
    navigation: '找回方向',
  },
};

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.scene}>
          <picture>
            <source media="(max-width: 600px)" srcSet="/illustrations/not-found/lost-together-960-v1.webp" />
            <img
              className={styles.landscape}
              src="/illustrations/not-found/lost-together-1585-v1.webp"
              width={1585}
              height={992}
              alt=""
              fetchPriority="high"
            />
          </picture>
        </div>
      </div>
      {/* Root 404s have no locale params/provider. LANG_BOOTSTRAP selects the
          visible copy before paint without making the root layout dynamic. */}
      {(['en', 'zh'] as const).map((lang) => {
        const copy = messages[lang];
        const prefix = lang === 'zh' ? '/zh' : '';
        return (
          <section key={lang} lang={lang} className={styles[lang]}>
            <header className={styles.header}>
              <AppLink href={{ pathname: prefix || '/' }} prefetch={false} className={styles.brand}>
                <img src="/icons/CubeRoot-dark.png" width={32} height={32} alt="" />
                <span>CubeRoot</span>
              </AppLink>
              <p className={styles.aside}>{copy.aside}</p>
            </header>
            <div className={styles.content}>
              <h1 className={styles.code}>404</h1>
              <h2 className={styles.title}>{copy.title}</h2>
              <p className={styles.description}>{copy.description}</p>
              <nav className={styles.links} aria-label={copy.navigation}>
                {/* Object hrefs preserve the locale even outside [lang]/layout. */}
                <AppLink href={{ pathname: prefix || '/' }} prefetch={false} className={styles.home}>
                  {copy.home}<span aria-hidden="true">→</span>
                </AppLink>
                <AppLink href={{ pathname: `${prefix}/timer` }} prefetch={false}>{copy.timer}</AppLink>
                <AppLink href={{ pathname: `${prefix}/alg` }} prefetch={false}>{copy.algorithms}</AppLink>
              </nav>
            </div>
          </section>
        );
      })}
    </main>
  );
}

