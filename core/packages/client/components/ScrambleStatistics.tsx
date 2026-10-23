'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';
import { SubsetColorPicker, useSubsetSelection } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { COMP_STEP_STAGES, minimumCompSteps, type CompStepsVariant } from '@/lib/comp-steps';
import { fetchScrambleStatistics, type ScrambleStatisticsData } from '@/lib/scramble-statistics';
import { stageLabel, variantLabel, VARIANT_ORDER } from '@/lib/scramble-variants';
import { toWcaEventId } from '@/lib/wca-events';
import { countMovesExpanded } from '@/lib/recon-alg-utils';
import './scramble-statistics.css';

const CROSS_VARIANTS = VARIANT_ORDER.filter((variant): variant is CompStepsVariant =>
  ['std', 'pseudo', 'pair', 'pseudo_pair', 'eo', 'f2leo', 'pseudo_f2leo'].includes(variant));
const OTHER_GROUPS: { label: string | null; variants: CompStepsVariant[] }[] = [
  { label: 'lbl', variants: ['daisy', 'first_layer'] },
  { label: 'block', variants: ['123', '222', '223', '123x2'] },
  { label: null, variants: ['eoline', 'dr'] },
];
const FAMILY = new Set(['333', '333oh', '333bf', '333fm', '333ft']);
export const supportsScrambleStatistics = (event: string) => FAMILY.has(toWcaEventId(event));

interface Props {
  compId?: string | null;
  event: string;
  scramble: string;
  optimalScramble?: string;
  resolveOriginal?: boolean;
}

export default function ScrambleStatistics(props: Props) {
  if (!props.compId || !props.scramble.trim() || !supportsScrambleStatistics(props.event)) return null;
  // Remount on a different scramble so loading never shows a previous solve's numbers.
  return <StatisticsBody key={`${props.compId}:${props.scramble}`} {...props} compId={props.compId} />;
}

function StatisticsBody({ compId, scramble, optimalScramble, resolveOriginal = false }: Props & { compId: string }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const subset = useSubsetSelection('cn');
  const [data, setData] = useState<ScrambleStatisticsData | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchScrambleStatistics(compId, scramble, resolveOriginal).then(result => {
      if (!cancelled) setData(result);
    }).catch(() => {
      if (!cancelled) setData({ steps: {}, failed: true });
    });
    return () => { cancelled = true; };
  }, [compId, scramble, resolveOriginal, attempt]);

  const optimal = optimalScramble || data?.optimalScramble;
  const wholeSteps = optimal ? countMovesExpanded(optimal) : null;
  const hasStages = data && Object.values(data.steps).some(values => values.some(value => value >= 0));
  const valueFor = (variant: CompStepsVariant, index: number) =>
    minimumCompSteps(data?.steps[variant], index, subset.selectedColors);
  const missing = hasStages && (Object.keys(COMP_STEP_STAGES) as CompStepsVariant[])
    .some(variant => COMP_STEP_STAGES[variant].some((_, index) => valueFor(variant, index) === null));
  const renderValue = (value: number | null) => value === null
    ? <span className="scramble-statistics-missing" aria-label={tr({ zh: '尚未统计', en: 'Not yet computed' })}>—</span>
    : <b>{value}</b>;

  const header = (
      <div className="scramble-statistics-header">
        <span>{tr({ zh: '最少步数', en: 'Minimum moves' })} <small>HTM</small></span>
        {wholeSteps !== null && <span className="scramble-statistics-whole">{variantLabel('333', isZh)} <b>{wholeSteps}</b></span>}
      </div>
  );

  return (
    <section className="scramble-statistics" aria-label={tr({ zh: '打乱统计', en: 'Scramble statistics' })} aria-busy={!data}>
      {!hasStages && header}
      {!data && <p className="scramble-statistics-status" role="status">{tr({ zh: '统计加载中…', en: 'Loading statistics…' })}</p>}
      {hasStages && <>
        <table className="scramble-statistics-matrix">
          <thead><tr>
            <th scope="col" aria-label={tr({ zh: '类型', en: 'Type' })}>
              <SubsetColorPicker sel={subset} isZh={isZh} />
            </th>
            {COMP_STEP_STAGES.std.map((stage, index) => <th scope="col" key={stage} aria-label={stageLabel(stage, isZh)}>
              {index === 0 ? stageLabel(stage, isZh) : 'X'.repeat(index)}
            </th>)}
          </tr></thead>
          <tbody>{CROSS_VARIANTS.map(variant => <tr key={variant}>
            <th scope="row">{variantLabel(variant, isZh)}</th>
            {COMP_STEP_STAGES.std.map((_, index) => <td key={index}>
              {index < COMP_STEP_STAGES[variant].length
                ? renderValue(valueFor(variant, index))
                : <span aria-label={tr({ zh: '不适用', en: 'Not applicable' })}>·</span>}
            </td>)}
          </tr>)}</tbody>
        </table>
        {header}
        <dl className="scramble-statistics-other">
          {OTHER_GROUPS.map(group => <div className={`scramble-statistics-group${group.label ? '' : ' is-ungrouped'}`} key={group.label ?? 'other'}>
            <dt className={group.label ? undefined : 'sr-only'}>{group.label
              ? variantLabel(group.label, isZh)
              : tr({ zh: '其他类型', en: 'Other types' })}</dt>
            <dd><dl className="scramble-statistics-metrics">
              {group.variants.flatMap(variant => COMP_STEP_STAGES[variant].map((stage, index) => <div key={`${variant}:${stage}`}>
                <dt>{stageLabel(stage, isZh)}</dt><dd>{renderValue(valueFor(variant, index))}</dd>
              </div>))}
            </dl></dd>
          </div>)}
        </dl>
      </>}
      {data && !hasStages && <p className="scramble-statistics-status">
        {tr({ zh: '此打乱暂无阶段统计', en: 'Stage statistics are not yet available for this scramble' })}
      </p>}
      {missing && !data?.failed && <p className="scramble-statistics-status">{tr({ zh: '— 尚未统计', en: '— Not yet computed' })}</p>}
      {data?.failed && <p className="scramble-statistics-status" role="status">
        {tr({ zh: '部分统计加载失败', en: 'Some statistics could not be loaded' })}
        {' '}<button type="button" className="scramble-statistics-retry" onClick={() => setAttempt(value => value + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button>
      </p>}
    </section>
  );
}
