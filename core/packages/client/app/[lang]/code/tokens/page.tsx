'use client';

// /code/tokens — single-source color-token reference for the whole site.
// Light + dark value of every token shown side by side; derivation via color-mix.
import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import './tokens.css';
import { GROUPS, type Kind, type Swatch, type Token } from './_tokens';

const RECIPES: { code: string; zh: string; en: string }[] = [
  { code: 'color-mix(in srgb, var(--foreground) 8%, transparent)', zh: '半透明叠加(hover 底 / 细分隔线)', en: 'Translucent overlay (hover base, hairline)' },
  { code: 'color-mix(in srgb, var(--accent) 12%, transparent)', zh: 'accent 弱化(tag / 选中底)', en: 'Soft accent (tag / selected bg)' },
  { code: 'color-mix(in srgb, var(--accent) 88%, black)', zh: 'hover 压一档', en: 'Darken one step on hover' },
  { code: 'color-mix(in srgb, var(--foreground) 20%, transparent)', zh: '比默认略强的边框', en: 'A border one notch stronger than default' },
];

const STRATEGY: { mode: string; zh: string; en: string; pages: string }[] = [
  { mode: '双主题', zh: '走 :root token,跟随用户 light / dark 自动翻', en: 'Follows :root tokens, flips with the user’s light / dark choice', pages: '/alg · /battle · /recon · /mosaic' },
  { mode: 'dark-locked', zh: 'WCA 统计家族,永远暗色,不参与主题切换', en: 'WCA-stats family — always dark, opts out of the toggle', pages: '/wca/* · /records · /nemesizer' },
  { mode: 'light-locked', zh: '锁 light,page-scope color-scheme: light', en: 'Locked light via page-scoped color-scheme', pages: '/calc' },
];

function Chip({ theme, sw, kind }: { theme: 'light' | 'dark'; sw: Swatch; kind: Kind }) {
  const frameBg = theme === 'light' ? '#fafafa' : '#171717';
  const frameBorder = theme === 'light' ? '#e5e5e5' : '#333333';
  const txtColor = theme === 'light' ? '#737373' : '#a3a3a3';
  let inner: ReactNode;
  if (kind === 'text') inner = <span className="tk-chip-aa" style={{ color: sw.css }}>Aa</span>;
  else if (kind === 'border') inner = <span className="tk-chip-ring" style={{ borderColor: sw.css }} />;
  else inner = <span className="tk-chip-fill" style={{ background: sw.css }} />;
  return (
    <div className="tk-chip" style={{ background: frameBg, borderColor: frameBorder }}>
      {inner}
      <span className="tk-chip-txt" style={{ color: txtColor }}>{sw.txt}</span>
    </div>
  );
}

function TokenCard({ t, lang }: { t: Token; lang: 'zh' | 'en' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(`var(${t.name})`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1100);
    }).catch(() => {});
  };
  return (
    <button type="button" className="tk-card" onClick={copy} title={`var(${t.name})`}>
      <div className="tk-chips">
        <Chip theme="light" sw={t.light} kind={t.kind} />
        <Chip theme="dark" sw={t.dark} kind={t.kind} />
      </div>
      <div className="tk-card-name">
        <span>{t.name}</span>
        <span className="tk-copy">{copied ? tr({ zh: '已复制', en: 'copied'
        }) : tr({ zh: '复制 var()', en: 'copy var()'
        })}</span>
      </div>
      <div className="tk-card-desc">{lang === 'zh' ? t.zh : t.en}</div>
    </button>
  );
}

export default function CodeTokensPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  useDocumentTitle('设计令牌', 'Design Tokens');

  return (
    <div className="tk">
      <header className="tk-head">
        <div className="tk-topbar">
          <Link href="/code" className="tk-back">← /code</Link>
        </div>
        <h1 className="tk-title">
          <span className="tk-prefix">/</span>tokens
          <span className="tk-cursor">_</span>
        </h1>
        <p className="tk-sub">
          {tr({
            zh: '全站配色的单一来源。背景 / 文字 / 品牌 / 状态 / 边框五组令牌,每个都把亮、暗两套真值并排给你看;需要中间色一律 color-mix 从令牌推,绝不硬码灰阶。写 CSS 取色照这页来。',
            en: 'The single source for every color on the site. Five groups — surface, text, brand, signal, border — each showing its real light and dark value side by side. Need an in-between shade? Derive it from a token with color-mix; never hardcode greys. Pick from here when writing CSS.'
        })}
        </p>
      </header>

      {GROUPS.map((g) => (
        <section className="tk-cat" key={g.id}>
          <div className="tk-cat-head">
            <span className="tk-cat-tag">// {g.id}</span>
            <h2 className="tk-cat-title">{lang === 'zh' ? g.zh : g.en}</h2>
          </div>
          <div className="tk-grid">
            {g.tokens.map((t) => <TokenCard key={t.name} t={t} lang={lang} />)}
          </div>
        </section>
      ))}

      <p className="tk-pair">
        {tr({
          zh: '另有配对前景色随上面成套使用:',
          en: 'Paired foreground tokens travel with the set above: '
        })}
        <code>--card-foreground</code> · <code>--popover-foreground</code> · <code>--primary</code> / <code>--primary-foreground</code> · <code>--secondary</code> / <code>--secondary-foreground</code> · <code>--accent-foreground</code> · <code>--destructive-foreground</code>
      </p>

      <section className="tk-cat" style={{ marginTop: 52 }}>
        <div className="tk-cat-head">
          <span className="tk-cat-tag">// color-mix</span>
          <h2 className="tk-cat-title">{tr({ zh: '衍生色:一律 color-mix', en: 'Derived colors: always color-mix' })}</h2>
        </div>
        <p className="tk-cat-note">
          {tr({
            zh: '需要半透明 / hover / 弱化色时,别手算 rgba,从令牌用 color-mix 推。下面的预览块会跟着你当前主题实时算出来。',
            en: 'Need a translucent, hover, or softened shade? Don’t hand-roll rgba — derive it from a token with color-mix. The preview blocks below resolve live against your current theme.'
        })}
        </p>
        <div className="tk-recipes">
          {RECIPES.map((r) => (
            <div className="tk-recipe" key={r.code}>
              <span className="tk-recipe-swatch" style={{ background: r.code }} />
              <div className="tk-recipe-body">
                <code className="tk-recipe-code">{r.code}</code>
                <span className="tk-recipe-desc">{lang === 'zh' ? r.zh : r.en}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="tk-cat">
        <div className="tk-cat-head">
          <span className="tk-cat-tag">// strategy</span>
          <h2 className="tk-cat-title">{tr({ zh: '主题策略', en: 'Theme strategy'
        })}</h2>
        </div>
        <p className="tk-cat-note">
          {tr({
            zh: '写 CSS 前先确认页面属于哪一类:大多数页双主题跟随令牌,WCA 统计家族永远暗,/calc 永远亮。',
            en: 'Before writing CSS, know which bucket a page is in: most are dual-theme via tokens, the WCA-stats family is always dark, /calc is always light.'
        })}
        </p>
        <div className="tk-strat">
          {STRATEGY.map((s) => (
            <div className="tk-strat-row" key={s.mode}>
              <span className="tk-strat-mode">{s.mode}</span>
              <span className="tk-strat-desc">{lang === 'zh' ? s.zh : s.en}</span>
              <span className="tk-strat-pages">{s.pages}</span>
            </div>
          ))}
        </div>
        <p className="tk-cat-note" style={{ marginTop: 16 }}>
          {tr({
            zh: '另有「配色主题」叠加层:用户在右上「外观」菜单可选 6 套整套皮肤(克劳德 + 5 套中国传统色),经 data-palette 覆盖上面全部令牌——基础令牌不动,只被皮肤盖住。整套并排见 ',
            en: 'There’s also a palette overlay: from the top-right Appearance menu users pick one of 6 full skins (Claude + 5 Chinese-traditional palettes) that override every token above via data-palette — the base tokens stay put, a skin just sits on top. Compare them side by side at '
        })}
          <Link href="/appearance">/appearance</Link>
        </p>
      </section>

      <footer className="tk-foot">
        <div className="tk-foot-line">
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
