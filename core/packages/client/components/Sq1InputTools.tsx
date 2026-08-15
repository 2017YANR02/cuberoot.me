'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import Link from '@/components/AppLink';
import { Sq1StateSvg } from '@/components/Sq1StateSvg';
import { tr } from '@/i18n/tr';
import { sq1StateShapes } from '@/lib/sq1-shapes';
import {
  inferSq1CubeshapeStart,
  isSq1Sliceable,
  nextSq1SliceableLayerRotation,
  sq1ParityBreakdown,
  type Sq1Layer,
  type Sq1ParityFactorKey,
  type Sq1RotationDirection,
  traceSq1Algorithm,
} from '@/lib/sq1-tools';
import { canonicalSq1Alg } from '@cuberoot/shared/sq1-notation';
import styles from './Sq1Tools.module.css';

function UrlTextarea({
  value,
  onCommit,
  placeholder,
  invalid = false,
  describedBy,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [composing, setComposing] = useState(false);
  useEffect(() => { if (!composing) setDraft(value); }, [composing, value]);
  return (
    <textarea
      className={styles.textarea}
      value={draft}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onCompositionStart={() => setComposing(true)}
      onCompositionEnd={(event) => {
        setComposing(false);
        setDraft(event.currentTarget.value);
        onCommit(event.currentTarget.value);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!composing) onCommit(next);
      }}
    />
  );
}

function resultError(result: ReturnType<typeof traceSq1Algorithm>): string | null {
  if (result.ok) return null;
  if (result.reason === 'invalid-notation') {
    return tr({ zh: '记号无法识别。请使用 (上层, 下层) 和 /。', en: 'The notation is invalid. Use (top, bottom) turns and /.' });
  }
  return tr({ zh: `第 ${result.step ?? '?'} 步不能切。`, en: `Slice ${result.step ?? '?'} is not possible in that position.` });
}

function parityFactorLabel(key: Sq1ParityFactorKey): string {
  const labels: Record<Sq1ParityFactorKey, { zh: string; en: string }> = {
    'top-corner-order': { zh: '上层角块顺序', en: 'Top corner order' },
    'top-edge-order': { zh: '上层棱块顺序', en: 'Top edge order' },
    'bottom-corner-order': { zh: '下层角块顺序', en: 'Bottom corner order' },
    'bottom-edge-order': { zh: '下层棱块顺序', en: 'Bottom edge order' },
    'top-edges-in-odd-edge-positions': { zh: '奇数棱位中的上层棱块', en: 'Top edges in odd edge positions' },
    'top-corners-in-odd-corner-positions': { zh: '奇数角位中的上层角块', en: 'Top corners in odd corner positions' },
  };
  return tr(labels[key]);
}

export function Sq1Inspector() {
  const [algorithm, setAlgorithm] = useQueryState('alg', parseAsString.withDefault(''));
  const result = useMemo(() => traceSq1Algorithm(algorithm), [algorithm]);
  const hasInput = algorithm.trim().length > 0;
  const final = result.ok && hasInput ? result.steps.at(-1)!.state : null;
  const shapes = final ? sq1StateShapes(final) : null;
  const sliceable = final ? isSq1Sliceable(final) : false;
  const parity = final ? sq1ParityBreakdown(final) : null;

  const alignLayer = (layer: Sq1Layer, direction: Sq1RotationDirection) => {
    if (!final) return;
    const amount = nextSq1SliceableLayerRotation(final, layer, direction);
    if (amount == null) return;
    const top = layer === 'top' ? amount : 0;
    const bottom = layer === 'bottom' ? amount : 0;
    void setAlgorithm(canonicalSq1Alg(`${algorithm} (${top}, ${bottom})`));
  };

  const alignmentAmount = (layer: Sq1Layer, direction: Sq1RotationDirection) => final
    ? nextSq1SliceableLayerRotation(final, layer, direction)
    : null;

  const alignmentLabel = (layer: Sq1Layer, direction: Sq1RotationDirection, amount: number | null) => {
    const layerName = layer === 'top'
      ? tr({ zh: '上层', en: 'Top layer' })
      : tr({ zh: '下层', en: 'Bottom layer' });
    const directionName = direction === 'positive'
      ? tr({ zh: '正方向', en: 'positive direction' })
      : tr({ zh: '负方向', en: 'negative direction' });
    return amount == null
      ? tr({ zh: `${layerName}没有可用的${directionName}对齐位置`, en: `${layerName} has no ${directionName} sliceable position` })
      : tr({ zh: `${layerName}转 ${amount} 到下一个可切位置`, en: `Turn ${layerName} by ${amount} to the next sliceable position` });
  };

  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>{tr({ zh: '打乱或公式', en: 'Scramble or algorithm' })}</span>
        <UrlTextarea
          value={algorithm}
          onCommit={(value) => void setAlgorithm(value)}
          placeholder="(1, 0) / (-3, -3) /"
          invalid={hasInput && !result.ok}
          describedBy={hasInput && !result.ok ? 'sq1-inspector-error' : undefined}
        />
      </label>
      {!result.ok && hasInput && <p id="sq1-inspector-error" className={styles.error} role="alert">{resultError(result)}</p>}
      {final && (
        <div id="sq1-inspector-result" className={styles.result}>
          <Sq1StateSvg state={final} label={tr({ zh: '最终 SQ1 状态', en: 'Final Square-1 state' })} className={styles.preview} />
          <div className={styles.inspectorDetails}>
            <dl className={styles.facts}>
              <dt>{tr({ zh: '合法步骤', en: 'Valid moves' })}</dt><dd>{result.ok ? result.tokens.length : 0}</dd>
              <dt>{tr({ zh: '上层', en: 'Top' })}</dt><dd>{shapes?.top?.name ?? tr({ zh: '未知', en: 'Unknown' })}</dd>
              <dt>{tr({ zh: '下层', en: 'Bottom' })}</dt><dd>{shapes?.bottom?.name ?? tr({ zh: '未知', en: 'Unknown' })}</dd>
              <dt>{tr({ zh: '中层', en: 'Middle layer' })}</dt><dd>{final.sliceSolved ? tr({ zh: '正', en: 'Solved' }) : tr({ zh: '反', en: 'Flipped' })}</dd>
            </dl>

            <div className={styles.alignmentSection}>
              <p className={styles.alignmentHeading}>{tr({ zh: '转到下一个可切位置', en: 'Rotate to the next sliceable position' })}</p>
              <div className={styles.alignmentControls}>
                {(['top', 'bottom'] as const).map((layer) => {
                  const negative = alignmentAmount(layer, 'negative');
                  const positive = alignmentAmount(layer, 'positive');
                  const labelId = `sq1-${layer}-alignment-label`;
                  return (
                    <div key={layer} className={styles.alignmentControl} role="group" aria-labelledby={labelId}>
                      <span id={labelId} className={styles.alignmentLayer}>{layer === 'top'
                        ? tr({ zh: '上层', en: 'Top' })
                        : tr({ zh: '下层', en: 'Bottom' })}</span>
                      <button
                        type="button"
                        className={styles.alignmentButton}
                        disabled={negative == null}
                        aria-label={alignmentLabel(layer, 'negative', negative)}
                        aria-controls="sq1-inspector-result"
                        onClick={() => alignLayer(layer, 'negative')}
                      >−</button>
                      <button
                        type="button"
                        className={styles.alignmentButton}
                        disabled={positive == null}
                        aria-label={alignmentLabel(layer, 'positive', positive)}
                        aria-controls="sq1-inspector-result"
                        onClick={() => alignLayer(layer, 'positive')}
                      >+</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {!sliceable || !parity ? (
              <p className={styles.alignmentWarning} role="status" aria-live="polite">
                {tr({ zh: '奇偶分析暂不可用。请先用上方的 + / − 把上下层都转到可切位置。', en: 'Parity analysis is unavailable. Use + / − above to rotate both layers to sliceable positions first.' })}
              </p>
            ) : (
              <div id="sq1-inspector-parity" className={styles.parityAnalysis} aria-live="polite">
                <p className={styles.paritySummary}>{parity.odd
                  ? tr({ zh: `总计 ${parity.total}：奇数计数`, en: `Total ${parity.total}: odd parity count` })
                  : tr({ zh: `总计 ${parity.total}：偶数计数`, en: `Total ${parity.total}: even parity count` })}</p>
                <div className={styles.parityTableWrap}>
                  <table className={styles.parityTable}>
                    <caption>{tr({ zh: '六项奇偶计数', en: 'Six-factor parity breakdown' })}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{tr({ zh: '项目', en: 'Factor' })}</th>
                        <th scope="col">{tr({ zh: '计数', en: 'Count' })}</th>
                        <th scope="col">{tr({ zh: '奇偶', en: 'Parity' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parity.factors.map((factor) => (
                        <tr key={factor.key}>
                          <th scope="row">
                            {parityFactorLabel(factor.key)}
                            {factor.sides && <span className={styles.paritySequence}>{factor.sides.join(' ')}</span>}
                          </th>
                          <td>{factor.count}</td>
                          <td>{factor.count % 2 === 1
                            ? tr({ zh: '奇', en: 'Odd' })
                            : tr({ zh: '偶', en: 'Even' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function Sq1Visualizer() {
  const [setup, setSetup] = useQueryState('setup', parseAsString.withDefault(''));
  const [algorithm, setAlgorithm] = useQueryState('alg', parseAsString.withDefault(''));
  const result = useMemo(() => traceSq1Algorithm(algorithm, setup), [algorithm, setup]);
  const hasInput = setup.trim().length > 0 || algorithm.trim().length > 0;

  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>{tr({ zh: '起始状态（可留空）', en: 'Setup (optional)' })}</span>
        <UrlTextarea value={setup} onCommit={(value) => void setSetup(value)} invalid={hasInput && !result.ok} describedBy={hasInput && !result.ok ? 'sq1-visualizer-error' : undefined} />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{tr({ zh: '公式', en: 'Algorithm' })}</span>
        <UrlTextarea value={algorithm} onCommit={(value) => void setAlgorithm(value)} invalid={hasInput && !result.ok} describedBy={hasInput && !result.ok ? 'sq1-visualizer-error' : undefined} />
      </label>
      {!result.ok && hasInput && <p id="sq1-visualizer-error" className={styles.error} role="alert">{resultError(result)}</p>}
      {result.ok && hasInput && (
        <div className={styles.steps}>
          {result.steps.map((step) => {
            const names = sq1StateShapes(step.state);
            return (
              <div key={step.index} className={styles.step}>
                <Sq1StateSvg state={step.state} label={tr({ zh: `第 ${step.index} 步`, en: `Step ${step.index}` })} className={styles.stepSvg} />
                <p className={styles.stepMove}>{step.index === 0 ? tr({ zh: '起始', en: 'Start' }) : step.move}</p>
                <div className={styles.stepName}>{names.top?.name ?? '?'} / {names.bottom?.name ?? '?'}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function Sq1Importer() {
  const [algorithm, setAlgorithm] = useQueryState('alg', parseAsString.withDefault(''));
  const inference = useMemo(() => inferSq1CubeshapeStart(algorithm), [algorithm]);
  const start = inference.ok ? inference.start : null;
  const shapes = start ? sq1StateShapes(start) : null;
  const hasInput = algorithm.trim().length > 0;
  const visualizerHref = inference.ok
    ? `/alg/sq1/visualize?setup=${encodeURIComponent(inference.setup)}&alg=${encodeURIComponent(algorithm)}`
    : '/alg/sq1/visualize';

  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>{tr({ zh: '复形公式', en: 'Cubeshape algorithm' })}</span>
        <UrlTextarea
          value={algorithm}
          onCommit={(value) => void setAlgorithm(value)}
          placeholder="/ (-3, 0) / (3, 3) /"
          invalid={hasInput && !inference.ok}
          describedBy={hasInput && !inference.ok ? 'sq1-importer-error' : undefined}
        />
      </label>
      {!inference.ok && hasInput && <p id="sq1-importer-error" className={styles.error} role="alert">{resultError(inference.error)}</p>}
      {start && inference.ok && hasInput && (
        <div className={styles.result}>
          <Sq1StateSvg state={start} label={tr({ zh: '反推的起始状态', en: 'Inferred starting state' })} className={styles.preview} />
          <div>
            <dl className={styles.facts}>
              <dt>{tr({ zh: '上层', en: 'Top' })}</dt><dd>{shapes?.top?.name ?? '?'}</dd>
              <dt>{tr({ zh: '下层', en: 'Bottom' })}</dt><dd>{shapes?.bottom?.name ?? '?'}</dd>
              <dt>{tr({ zh: '起始设置', en: 'Setup' })}</dt><dd>{inference.setup}</dd>
            </dl>
            <p><Link className={styles.compactLink} href={visualizerHref} prefetch={false}>{tr({ zh: '在过程查看器中打开', en: 'Open in shape visualizer' })}</Link></p>
          </div>
        </div>
      )}
    </>
  );
}
