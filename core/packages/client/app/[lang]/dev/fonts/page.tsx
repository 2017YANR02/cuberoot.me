'use client';

// /dev/fonts — single reference for every self-hosted font on the site.
// Each font shows a live specimen rendered in its actual family, plus role,
// weights, coverage, where it's used, the token to prefer, files and license.
// Data lives in _fonts.ts (mirrors app/fonts.css + page-local @font-face blocks).
import { useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';
import './fonts.css';
import { FONT_GROUPS, type FontSpec } from './_fonts';

function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(`var(${token})`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1100);
    }).catch(() => {});
  };
  return (
    <button type="button" className="fn-token" onClick={copy} title={`var(${token})`}>
      <code>var({token})</code>
      <span className="fn-token-copy">{copied ? tr({ zh: '已复制', en: 'copied'
    }) : tr({ zh: '复制', en: 'copy'
    })}</span>
    </button>
  );
}

function FontCard({ f, lang }: { f: FontSpec; lang: 'zh' | 'en' }) {
  const totalKb = f.files.reduce((s, x) => s + x.kb, 0);
  return (
    <div className="fn-card">
      <div
        className={`fn-specimen${f.numeric ? ' fn-specimen--num' : ''}`}
        style={{ fontFamily: f.cssVar ? `var(${f.cssVar})` : `'${f.family}', ${f.fallback}` }}
      >
        {f.specimen}
      </div>
      <div className="fn-card-body">
        <div className="fn-card-head">
          <span className="fn-family" style={{ fontFamily: f.cssVar ? `var(${f.cssVar})` : `'${f.family}', ${f.fallback}` }}>{f.family}</span>
          <span className="fn-role">{lang === 'zh' ? f.roleZh : f.roleEn}</span>
        </div>
        <p className="fn-usage">{lang === 'zh' ? f.usageZh : f.usageEn}</p>
        <dl className="fn-meta">
          <div className="fn-meta-row">
            <dt>{tr({ zh: '取用', en: 'Use' })}</dt>
            <dd>
              {f.cssVar
                ? <CopyToken token={f.cssVar} />
                : <code className="fn-family-code">font-family: &apos;{f.family}&apos;</code>}
            </dd>
          </div>
          <div className="fn-meta-row">
            <dt>{tr({ zh: '字重', en: 'Weights' })}</dt>
            <dd>{f.weights}</dd>
          </div>
          <div className="fn-meta-row">
            <dt>{tr({ zh: '覆盖', en: 'Coverage'
            })}</dt>
            <dd>{lang === 'zh' ? f.coverage.zh : f.coverage.en}</dd>
          </div>
          <div className="fn-meta-row">
            <dt>{tr({ zh: '文件', en: 'Files'
            })}</dt>
            <dd>
              {f.files.length === 0 && tr({ zh: '系统内置，无需下载（0 KB）', en: 'Built into the system; no download (0 KB)' })}
              <span className="fn-files">
                {f.files.map((file) => (
                  <span className="fn-file" key={file.name} title={file.name}>
                    <code>{file.name}</code>
                    <span className="fn-file-kb">{file.kb} KB</span>
                  </span>
                ))}
              </span>
              {f.files.length > 1 && <span className="fn-files-total">{tr({ zh: '合计', en: 'total'
            })} {totalKb} KB</span>}
            </dd>
          </div>
          <div className="fn-meta-row">
            <dt>{tr({ zh: '来源', en: 'Source'
            })}</dt>
            <dd>{f.source} · <span className="fn-license">{f.license}</span></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default function CodeFontsPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  return (
    <div className="fn">
      <header className="fn-head">
        <div className="fn-topbar">
          <Link href="/dev" className="fn-back">← /dev</Link>
        </div>
        <h1 className="fn-title">
          <span className="fn-prefix">/</span>fonts
          <span className="fn-cursor">_</span>
        </h1>
        <p className="fn-sub">
          {tr({
            zh: '正文统一使用自托管 SF Pro Text 与苹方 Web 字体，其余展示、等宽和 PDF 字体按场景加载。下面列出字体样张、字重、用途与加载方式。',
            en: 'Body text uses self-hosted SF Pro Text and PingFang Web fonts across devices. Display, monospace and PDF fonts load for their respective uses. Browse specimens, weights, usage and loading details below.'
        })}
        </p>
      </header>

      {FONT_GROUPS.map((g) => (
        <section className="fn-cat" key={g.id}>
          <div className="fn-cat-head">
            <span className="fn-cat-tag">// {g.id}</span>
            <h2 className="fn-cat-title">{lang === 'zh' ? g.zh : g.en}</h2>
          </div>
          <p className="fn-cat-note">{lang === 'zh' ? g.noteZh : g.noteEn}</p>
          <div className="fn-grid">
            {g.fonts.map((f) => <FontCard key={f.family} f={f} lang={lang} />)}
          </div>
        </section>
      ))}

      <section className="fn-cat fn-cat--cjk">
        <div className="fn-cat-head">
          <span className="fn-cat-tag">// cjk</span>
          <h2 className="fn-cat-title">{tr({ zh: '中文 Web 字体', en: 'Chinese Web fonts'
        })}</h2>
        </div>
        <p className="fn-cat-note">
          {tr({
            zh: '中文正文使用自托管 SF Pro SC（苹方），按实际使用的字重加载。缺失字形或加载失败时回退系统字体；衬线标题仍使用霞鹜文楷，PDF 使用文泉驿微米黑。',
            en: 'Chinese body text uses self-hosted SF Pro SC (PingFang), loading only the weights in use. Missing glyphs or failed downloads fall back to system fonts. Serif headings retain LXGW WenKai; PDFs use WenQuanYi Micro Hei.'
        })}
        </p>
        <div className="fn-cjk-stack">
          <code>SF Pro SC (Web)</code><span>›</span>
          <code>system-ui</code><span>›</span>
          <code>Microsoft YaHei</code><span>›</span>
          <code>Hiragino Sans GB</code><span>›</span>
          <code>sans-serif</code>
        </div>
      </section>

      <footer className="fn-foot">
        <div className="fn-foot-line">
          <Link href="/dev/tokens">/tokens</Link>
          <span>·</span>
          <Link href="/dev">/dev</Link>
          <span>·</span>
          <Link href="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
