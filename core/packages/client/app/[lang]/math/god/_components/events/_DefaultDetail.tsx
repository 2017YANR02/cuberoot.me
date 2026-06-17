'use client';

/**
 * Default event-detail body, built from god_data + god_deep_data.
 * Used for any event without a bespoke events/<Name>.tsx article.
 * Rich enough to stand alone: headline numbers, state-space, the multi-paragraph
 * "deep" blurb, same-group note, an optional reused interactive, and references.
 */
import { Suspense, lazy, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { PUZZLES, type DiameterValue } from '../god_data';
import { DEEP } from '../god_deep_data';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  MathText, TeX, tr, type HighlightCard,
} from './_shared';

const DistanceDistribution = lazy(() => import('../DistanceDistribution'));
const GrowthChart = lazy(() => import('../GrowthChart'));
const Bfs2x2Demo = lazy(() => import('../Bfs2x2Demo'));

/** Which reused interactive (if any) to show for a default event. */
const INTERACTIVE: Record<string, 'dist' | 'growth' | 'bfs'> = {
  '222': 'bfs',
  '333bf': 'dist',
  '333oh': 'dist',
  '444bf': 'growth',
  '555bf': 'growth',
};

const byId = new Map(PUZZLES.map((p) => [p.id, p]));

function statusLabel(d: DiameterValue): { zh: string; en: string } {
  if (d.status === 'exact') return { zh: '已证精确值', en: 'Proven exact' };
  if (d.status === 'parametric') return { zh: '平凡 / 参数化', en: 'Trivial / parametric' };
  return { zh: '当前上下界', en: 'Current bounds' };
}

function diameterNum(d: DiameterValue): ReactNode {
  if (d.status === 'parametric') return <TeX src={String.raw`20\,k`} />;
  if (d.status === 'exact') return String(d.upper);
  if (d.lower != null && d.upper != null) return `${d.lower}–${d.upper}`;
  if (d.lower != null) return <TeX src={`\\ge ${d.lower}`} />;
  return <TeX src={`\\le ${d.upper}`} />;
}

export default function DefaultDetail({ isZh, eventId }: { isZh: boolean; eventId: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const p = byId.get(eventId);
  if (!p) return null;

  const deep = DEEP[eventId];
  const canonical = p.sameGroupAs ? byId.get(p.sameGroupAs) : null;

  const cards: HighlightCard[] = p.diameters.map((d) => ({
    num: diameterNum(d),
    cap: t(`${d.metric} ${statusLabel(d).zh}`, `${d.metric} ${statusLabel(d).en}`),
    sub: d.by ? d.by : d.note ? tr(d.note) : undefined,
    tone: d.status === 'exact' ? 'accent' : d.status === 'parametric' ? 'wca' : 'warn',
  }));

  const interactive = INTERACTIVE[eventId];

  return (
    <>
      <EvHighlights cards={cards} />

      {canonical && (
        <EvCallout tone="info" heading={t('与另一项目同群', 'Shares another event\'s group')}>
          {t(
            `本项目与「${tr(canonical.name)}」是同一个魔方群,上帝之数完全相同。难度差异来自规则与执行方式,不来自群结构。`,
            `This event has exactly the same puzzle group as ${tr(canonical.name)}, so the God's number is identical. Any difficulty difference comes from the rules and execution, not the group structure.`,
          )}{' '}
          <Link href={`/math/god?event=${canonical.id}`}>
            {t(`查看「${tr(canonical.name)}」详解 →`, `See the ${tr(canonical.name)} write-up →`)}
          </Link>
        </EvCallout>
      )}

      <EvSection
        title={t('态空间', 'State space')}
        lead={p.states.pretty ? tr(p.states.pretty) : undefined}
      >
        <EvStatStrip items={[
          { label: t('合法状态数', 'Reachable states'), value: <MathText>{`|G| = ${p.states.sci}`}</MathText> },
          ...(p.states.exact ? [{ label: t('精确计数', 'Exact count'), value: <span className="god-mono" style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>{p.states.exact}</span> }] : []),
        ]} />
      </EvSection>

      {deep && (
        <EvSection title={deep.heading ? tr(deep.heading) : t('详解', 'In depth')}>
          {deep.paragraphs.map((para, i) => (
            <p key={i}><MathText>{tr(para)}</MathText></p>
          ))}
        </EvSection>
      )}

      {!deep && (
        <EvSection title={t('概述', 'Overview')}>
          <p><MathText>{tr(p.blurb)}</MathText></p>
        </EvSection>
      )}

      {interactive && (
        <EvSection
          title={interactive === 'bfs'
            ? t('2×2 现场 BFS', '2×2 live BFS')
            : interactive === 'dist'
            ? t('三阶最少步分布', '3×3 minimum-solution distribution')
            : t('NxN 增长', 'N×N growth')}
        >
          <Suspense fallback={<div className="god-loading">…</div>}>
            {interactive === 'bfs' && <Bfs2x2Demo isZh={isZh} />}
            {interactive === 'dist' && <DistanceDistribution isZh={isZh} />}
            {interactive === 'growth' && <GrowthChart isZh={isZh} />}
          </Suspense>
        </EvSection>
      )}

      <EvRefs refs={p.refs.map((r) => ({ url: r.url, zh: r.label, en: r.label }))} />
    </>
  );
}
