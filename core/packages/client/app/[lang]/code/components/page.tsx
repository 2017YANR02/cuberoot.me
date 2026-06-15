'use client';

// /code/components — browsable catalog of cuberoot.me's own reusable components.
// Data + live demos live in ./_catalog.tsx (the single place to register new ones).
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './components_gallery.css';
import { tr } from '@/i18n/tr';
import { CATALOG, CATEGORIES, type ComponentEntry } from './_catalog';

function Card({ e, lang }: { e: ComponentEntry; lang: 'zh' | 'en' }) {
  const Demo = e.Demo;
  return (
    <div className="cg-card">
      <div className="cg-card-head">
        <span className="cg-card-name">{e.name}</span>
      </div>
      <p className="cg-card-desc">{lang === 'zh' ? e.zh : e.en}</p>
      {Demo && (
        <div className="cg-stage">
          <Demo />
        </div>
      )}
      <pre className="cg-code"><code>{e.import}</code></pre>
      {e.usage && <pre className="cg-code cg-code-usage"><code>{e.usage}</code></pre>}
      {e.note && <div className="cg-card-note">{lang === 'zh' ? e.note.zh : e.note.en}</div>}
    </div>
  );
}

export default function CodeComponentsPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  useDocumentTitle('组件库', 'Components');

  return (
    <div className="cg">
      <header className="cg-head">
        <div className="cg-topbar">
          <Link href="/code" className="cg-back">← /code</Link>
        </div>
        <h1 className="cg-title">
          <span className="cg-prefix">/</span>components
          <span className="cg-cursor">_</span>
        </h1>
        <p className="cg-sub">
          {tr({
            zh: 'cuberoot.me 自己沉淀的可复用 UI 组件,一处集中查阅:每个组件一句话说清用途,能独立演示的直接给实时预览加照抄即用的 import。写新页面前先来这翻一遍,别重复造轮子。',
            en: 'The reusable UI components cuberoot.me has accumulated, in one browsable place: a one-line purpose for each, a live preview for the self-contained ones, plus a copy-paste import. Skim here before building a new page — don’t reinvent the wheel.'
        })}
        </p>
      </header>

      <div className="cg-note">
        <span className="cg-note-mark">★</span>
        <span>
          {tr({
            zh: '约定:新建一个可复用组件后,在 ',
            en: 'Convention: after building a new reusable component, register an entry in '
        })}
          <code>app/[lang]/code/components/_catalog.tsx</code>
          {tr({
            zh: ' 里登记一条(顺手写个实时 Demo),下一个人 / 下一个 AI 打开本页就能查到它。',
            en: ' (and add a live demo while you’re at it). The next person — or the next AI — then finds it right here.'
        })}
        </span>
      </div>

      {CATEGORIES.map((cat) => {
        const items = CATALOG.filter((e) => e.category === cat.id);
        if (!items.length) return null;
        return (
          <section className="cg-cat" key={cat.id}>
            <div className="cg-cat-head">
              <span className="cg-cat-tag">// {cat.id}</span>
              <h2 className="cg-cat-title">{lang === 'zh' ? cat.zh : cat.en}</h2>
            </div>
            <div className="cg-grid">
              {items.map((e) => (
                <Card key={e.name} e={e} lang={lang} />
              ))}
            </div>
          </section>
        );
      })}

      <footer className="cg-foot">
        <div className="cg-foot-line">
          <Link href="/code">/code</Link>
          <span>·</span>
          <Link href="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
