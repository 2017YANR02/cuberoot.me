'use client';

// /code/fonts — single reference for every self-hosted font on the site.
// Each font shows a live specimen rendered in its actual family, plus role,
// weights, coverage, where it's used, the token to prefer, files and license.
// Data lives in _fonts.ts (mirrors app/fonts.css + page-local @font-face blocks).
import { useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
        style={{ fontFamily: `'${f.family}', ${f.fallback}` }}
      >
        {f.specimen}
      </div>
      <div className="fn-card-body">
        <div className="fn-card-head">
          <span className="fn-family" style={{ fontFamily: `'${f.family}', ${f.fallback}` }}>{f.family}</span>
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

  useDocumentTitle('字体', 'Fonts');

  return (
    <div className="fn">
      <header className="fn-head">
        <div className="fn-topbar">
          <Link href="/code" className="fn-back">← /code</Link>
        </div>
        <h1 className="fn-title">
          <span className="fn-prefix">/</span>fonts
          <span className="fn-cursor">_</span>
        </h1>
        <p className="fn-sub">
          {tr({
            zh: '全站用到的每一款字体都自托管(放在 public/fonts/,无 Google Fonts 那条 render-blocking link),这里一处列全。三款核心字体由设计令牌暴露,其余按场景局部注册。下面每张卡都用该字体真渲染一行样张。',
            en: 'Every font on the site is self-hosted (in public/fonts/, no render-blocking Google Fonts link). This page lists them all. Three core fonts are exposed via design tokens; the rest are registered page-locally per context. Each card below renders a live specimen in the actual font.'
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
          <h2 className="fn-cat-title">{tr({ zh: '中文走系统字体', en: 'CJK uses system fonts'
        })}</h2>
        </div>
        <p className="fn-cat-note">
          {tr({
            zh: '正文没有自托管中文字体 —— 整套思源/黑体动辄几 MB,首屏代价太大。中文正文落到系统字体栈:PingFang SC(苹果)、Microsoft YaHei(Windows)、Hiragino Sans GB,最后 generic sans-serif 兜底。例外两处:① 标题中文用自托管 LXGW WenKai 楷体(静态子集 120KB,见核心排版),配 Fraunces;② /scramble/gen 的 PDF 还原用文泉驿微米黑。两者都按需加载,不进正文首屏。',
            en: 'There is no self-hosted CJK body font — a full Source Han / Hei family is several MB, too costly for first paint. CJK body text falls to the system stack: PingFang SC (Apple), Microsoft YaHei (Windows), Hiragino Sans GB, then generic sans-serif. Two exceptions: (1) CJK headings use self-hosted LXGW WenKai 楷体 (a 120KB static subset, see Core typography) paired with Fraunces; (2) /scramble/gen PDF parity uses WenQuanYi Micro Hei. Both load on demand and never touch the body first paint.'
        })}
        </p>
        <div className="fn-cjk-stack">
          <code>PingFang SC</code><span>›</span>
          <code>Microsoft YaHei</code><span>›</span>
          <code>Hiragino Sans GB</code><span>›</span>
          <code>sans-serif</code>
        </div>
      </section>

      <footer className="fn-foot">
        <div className="fn-foot-line">
          <Link href="/code/tokens">/tokens</Link>
          <span>·</span>
          <Link href="/code">/code</Link>
          <span>·</span>
          <Link href="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
