/** @module Branded fallback for unmatched URLs and route-level notFound(). */
import type { Metadata } from 'next';
import AppLink from '@/components/AppLink';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'CubeRoot — 404',
};

const messages = {
  en: {
    description: 'This page could not be found. Your next solve is still here',
    home: 'Back to home',
    timer: 'Timer',
    algorithms: 'Algorithms',
  },
  zh: {
    description: '这个页面不存在，不过下一次复原还在这里',
    home: '回到首页',
    timer: '计时器',
    algorithms: '公式库',
  },
};

export default function NotFound() {
  return (
    <main className={styles.page}>
      {/* Root 404s have no locale params/provider. LANG_BOOTSTRAP selects the
          visible copy before paint without making the root layout dynamic. */}
      {(['en', 'zh'] as const).map((lang) => {
        const copy = messages[lang];
        const prefix = lang === 'zh' ? '/zh' : '';
        return (
          <section key={lang} lang={lang} className={styles[lang]}>
            <AppLink href={{ pathname: prefix || '/' }} prefetch={false} className={styles.brand}>
              <img src="/icons/CubeRoot.png" width={40} height={40} alt="" />
              <span>CubeRoot</span>
            </AppLink>
            <h1 className={styles.code}>404</h1>
            <p className={styles.description}>{copy.description}</p>
            <nav className={styles.links}>
              {/* Object hrefs preserve the locale even outside [lang]/layout. */}
              <AppLink href={{ pathname: prefix || '/' }} prefetch={false}>{copy.home}</AppLink>
              <AppLink href={{ pathname: `${prefix}/timer` }} prefetch={false}>{copy.timer}</AppLink>
              <AppLink href={{ pathname: `${prefix}/alg` }} prefetch={false}>{copy.algorithms}</AppLink>
            </nav>
          </section>
        );
      })}
    </main>
  );
}
