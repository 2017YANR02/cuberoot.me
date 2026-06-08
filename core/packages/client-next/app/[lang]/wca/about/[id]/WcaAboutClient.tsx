'use client';

/**
 * /wca/about/:id — WCA 统计算法解释页(通用渲染器)
 *
 * 进入入口:
 *  - WcaStatsIndex 卡片右上的 (?) 圆圈
 *  - WcaStatsPage 标题旁的 (?) 圆圈
 *
 * 内容来自 entries/<id>.ts 里的 AboutEntry,通过 ABOUT_REGISTRY 索引。
 */
import { useMemo } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ABOUT_REGISTRY } from './_lib/registry';
import type { AboutEntry, AboutStep, AboutStat, AboutFormula, AboutCode, AboutRelated, AboutSection } from './_lib/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './wca_about.css';
import { tr } from '@/i18n/tr';

function pickLang<T extends string | string[] | undefined>(zh: T, en: T, isZh: boolean): T {
  return (isZh ? zh : en) as T;
}

function Paragraphs({ value }: { value: string | string[] | undefined }) {
  if (!value) return null;
  const arr = Array.isArray(value) ? value : [value];
  return (
    <>
      {arr.map((p, i) => (
        <p key={i} className="wcaa-prose" dangerouslySetInnerHTML={{ __html: inlineFormat(p) }} />
      ))}
    </>
  );
}

/**
 * 受控行内格式化:`code`  → <code>; **bold** → <strong>; \n → <br>.
 * 注意:dangerouslySetInnerHTML — 调用方只传项目静态文案,不接 user input。
 */
function inlineFormat(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function StatCallout({ stat, isZh }: { stat: AboutStat; isZh: boolean }) {
  return (
    <div className="wcaa-stat">
      <div className="wcaa-stat-value">{stat.value}</div>
      <div className="wcaa-stat-label">{isZh ? stat.labelZh : stat.labelEn}</div>
      {(isZh ? stat.hintZh : stat.hintEn) && (
        <div className="wcaa-stat-hint">{isZh ? stat.hintZh : stat.hintEn}</div>
      )}
    </div>
  );
}

function StepCard({ step, index, isZh }: { step: AboutStep; index: number; isZh: boolean }) {
  return (
    <div className={`wcaa-step${step.highlight ? ' is-highlight' : ''}`}>
      <span className="wcaa-step-num">{index + 1}</span>
      <div>
        <div className="wcaa-step-title">{isZh ? step.titleZh : step.titleEn}</div>
        <div
          className="wcaa-step-body"
          dangerouslySetInnerHTML={{ __html: inlineFormat(isZh ? step.bodyZh : step.bodyEn) }}
        />
      </div>
    </div>
  );
}

function FormulaCard({ formula, isZh }: { formula: AboutFormula; isZh: boolean }) {
  return (
    <div className="wcaa-formula">
      <div className="wcaa-formula-label">{isZh ? formula.labelZh : formula.labelEn}</div>
      <div className="wcaa-formula-expr">{formula.expr}</div>
      {(isZh ? formula.bodyZh : formula.bodyEn) && (
        <div
          className="wcaa-formula-body"
          dangerouslySetInnerHTML={{
            __html: inlineFormat(isZh ? formula.bodyZh ?? '' : formula.bodyEn ?? ''),
          }}
        />
      )}
    </div>
  );
}

function CodeBlock({ code, isZh }: { code: AboutCode; isZh: boolean }) {
  const caption = isZh ? code.captionZh : code.captionEn;
  return (
    <>
      {caption && <div className="wcaa-code-caption">{caption}</div>}
      <div className="wcaa-code">
        <div className="wcaa-code-head">
          <span>{code.lang}</span>
        </div>
        <pre>{code.body}</pre>
      </div>
    </>
  );
}

function RelatedCard({ rel, isZh }: { rel: AboutRelated; isZh: boolean }) {
  const name = isZh ? rel.titleZh : rel.titleEn;
  const hint = isZh ? rel.hintZh : rel.hintEn;
  const inner = (
    <>
      <div className="wcaa-related-name">
        {name}
        {rel.href && <ExternalLink size={12} style={{ marginLeft: 6, opacity: 0.55 }} />}
      </div>
      {hint && <div className="wcaa-related-hint">{hint}</div>}
    </>
  );
  if (rel.href) {
    return (
      <a className="wcaa-related-card" href={rel.href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  const to = rel.toStat ? `/wca/${rel.id}` : `/wca/about/${rel.id}`;
  return <Link className="wcaa-related-card" href={to}>{inner}</Link>;
}

function ExtraSection({ section, isZh }: { section: AboutSection; isZh: boolean }) {
  return (
    <>
      <h2 className="wcaa-section-title">{isZh ? section.titleZh : section.titleEn}</h2>
      <Paragraphs value={pickLang(section.bodyZh, section.bodyEn, isZh)} />
    </>
  );
}

export default function WcaAboutClient() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? '');
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const entry = useMemo<AboutEntry | null>(() => {
    if (!id) return null;
    return ABOUT_REGISTRY[id] ?? null;
  }, [id]);

  const aboutTitle = entry ? (isZh ? entry.titleZh : entry.titleEn) : (tr({ zh: '统计说明', en: 'About Stat',
      zhHant: "統計說明"
}));
  useDocumentTitle(aboutTitle, aboutTitle);

  if (!entry) {
    return (
      <div className="wcaa-page">
        <div className="wcaa-header">
          <Link href="/wca" className="wcaa-back">
            <ArrowLeft size={16} />
            <span>{tr({ zh: '返回 WCA 统计', en: 'Back to WCA Statistics',
                zhHant: "返回 WCA 統計"
            })}</span>
          </Link>
        </div>
        <main className="wcaa-main">
          <div className="wcaa-missing">
            {isZh
              ? `暂未给统计项 "${id}" 撰写算法说明页。可在 /wca 列表里点开它本身看数据。`
              : `No algorithm explanation yet for "${id}". You can still browse it from /wca.`}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="wcaa-page">
      <div className="wcaa-header">
        <Link href="/wca" className="wcaa-back">
          <ArrowLeft size={16} />
          <span>{tr({ zh: '返回 WCA 统计', en: 'Back to WCA Statistics',
              zhHant: "返回 WCA 統計"
        })}</span>
        </Link>
      </div>

      <main className="wcaa-main">
        <div className="wcaa-title-row">
          <h1 className="wcaa-title">{isZh ? entry.titleZh : entry.titleEn}</h1>
          {(isZh ? entry.badgeZh : entry.badgeEn) && (
            <span className="wcaa-badge">{isZh ? entry.badgeZh : entry.badgeEn}</span>
          )}
        </div>

        <Paragraphs value={pickLang(entry.introZh, entry.introEn, isZh)} />

        {entry.stats && entry.stats.length > 0 && (
          <>
            <h2 className="wcaa-section-title">{tr({ zh: '数字一览', en: 'By the numbers',
                zhHant: "數字一覽"
            })}</h2>
            <div className="wcaa-stats-grid">
              {entry.stats.map((s, i) => <StatCallout key={i} stat={s} isZh={isZh} />)}
            </div>
          </>
        )}

        <h2 className="wcaa-section-title">{tr({ zh: '数据源', en: 'Data source',
            zhHant: "資料來源"
        })}</h2>
        <Paragraphs value={pickLang(entry.sourceZh, entry.sourceEn, isZh)} />
        {entry.sourceCode && <CodeBlock code={entry.sourceCode} isZh={isZh} />}

        <h2 className="wcaa-section-title">{tr({ zh: '算法 / 流程', en: 'Algorithm / pipeline',
            zhHant: "演算法 / 流程"
        })}</h2>
        <div className="wcaa-flow">
          {entry.steps.map((s, i) => <StepCard key={i} step={s} index={i} isZh={isZh} />)}
        </div>

        {entry.formulae && entry.formulae.length > 0 && (
          <>
            <h2 className="wcaa-section-title">{tr({ zh: '关键公式', en: 'Key formulae',
                zhHant: "關鍵公式"
            })}</h2>
            {entry.formulae.map((f, i) => <FormulaCard key={i} formula={f} isZh={isZh} />)}
          </>
        )}

        {((isZh ? entry.edgesZh : entry.edgesEn) ?? []).length > 0 && (
          <>
            <h2 className="wcaa-section-title">{tr({ zh: '口径与边界', en: 'Caveats & edges',
                zhHant: "口徑與邊界"
            })}</h2>
            <ul className="wcaa-edges">
              {(isZh ? entry.edgesZh! : entry.edgesEn!).map((e, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(e) }} />
              ))}
            </ul>
          </>
        )}

        {entry.extraSections?.map((sec, i) => <ExtraSection key={i} section={sec} isZh={isZh} />)}

        {entry.related && entry.related.length > 0 && (
          <>
            <h2 className="wcaa-section-title">{tr({ zh: '相关统计 / 链接', en: 'Related stats & links',
                zhHant: "相關統計 / 連結"
            })}</h2>
            <div className="wcaa-related">
              {entry.related.map((r, i) => <RelatedCard key={i} rel={r} isZh={isZh} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
