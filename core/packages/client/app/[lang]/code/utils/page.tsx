'use client';

// /code/utils — quick-reference for cuberoot.me's own hooks & canonical utils.
// Entries live in ./_catalog.tsx (the single place to register new ones).
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './utils_ref.css';
import { tr } from '@/i18n/tr';
import { CATALOG, UCATS, type UtilEntry } from './_catalog';

function Card({ e, lang }: { e: UtilEntry; lang: 'zh' | 'en' }) {
  return (
    <div className="ur-card">
      <span className="ur-card-name">{e.name}</span>
      <p className="ur-card-desc">{lang === 'zh' ? e.zh : e.en}</p>
      <pre className="ur-code ur-code-sig"><code>{e.sig}</code></pre>
      <pre className="ur-code ur-code-sub"><code>{e.imp}</code></pre>
      {e.usage && <pre className="ur-code ur-code-sub"><code>{e.usage}</code></pre>}
    </div>
  );
}

export default function CodeUtilsPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  useDocumentTitle('速查', 'Hooks & Utils');

  return (
    <div className="ur">
      <header className="ur-head">
        <div className="ur-topbar">
          <Link href="/code" className="ur-back">← /code</Link>
        </div>
        <h1 className="ur-title">
          <span className="ur-prefix">/</span>utils
          <span className="ur-cursor">_</span>
        </h1>
        <p className="ur-sub">
          {tr({
            zh: 'cuberoot.me 自己的 6 个 React Hook,与一批 canonical 工具函数,集中速查:i18n 文案、API 地址、WCA 成绩格式化、项目归一、配色常量。写新代码前先翻一遍,别重复造轮子。',
            en: 'A quick-reference for cuberoot.me’s own 6 React hooks and the canonical utility functions: i18n text, API URLs, WCA result formatting, event normalization, color constants. Skim before writing new code — don’t reinvent the wheel.'
        })}
        </p>
      </header>

      <div className="ur-note">
        <span className="ur-note-mark">★</span>
        <span>
          {tr({
            zh: '约定:新增一个可复用 hook / 工具函数后,在 ',
            en: 'Convention: after adding a reusable hook / util, register an entry in '
        })}
          <code>app/[lang]/code/utils/_catalog.tsx</code>
          {tr({
            zh: ' 里登记一条,下一个人 / 下一个 AI 打开本页就能查到它。',
            en: ' — the next person, or the next AI, then finds it right here.'
        })}
        </span>
      </div>

      {UCATS.map((cat) => {
        const items = CATALOG.filter((e) => e.category === cat.id);
        if (!items.length) return null;
        return (
          <section className="ur-cat" key={cat.id}>
            <div className="ur-cat-head">
              <span className="ur-cat-tag">// {cat.id}</span>
              <h2 className="ur-cat-title">{lang === 'zh' ? cat.zh : cat.en}</h2>
            </div>
            <div className="ur-grid">
              {items.map((e) => <Card key={e.name} e={e} lang={lang} />)}
            </div>
          </section>
        );
      })}

      <footer className="ur-foot">
        <div className="ur-foot-line">
          <Link href="/code/components">/components</Link>
          <span>·</span>
          <Link href="/code">/code</Link>
          <span>·</span>
          <Link href="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
