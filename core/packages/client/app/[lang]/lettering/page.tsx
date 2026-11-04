'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from '@app-foundation/icons/lucide';
import BackHome from '@/components/BackHome';
import AlgPlayer from '@/components/AlgPlayer';
import { tr, useLang } from '@/i18n/tr';
import {
  availableLetteringGlyphs,
  buildLetteringSegments,
  buildLetteringWordSegments,
  getLetteringPattern,
  getLetteringWordPattern,
  LETTERING_ORDERS,
  LETTERING_WORD_MIN_ORDER,
  type LetteringGlyph,
  type LetteringOrder,
  type LetteringWord,
} from './_lib/lettering-alg';
import './lettering.css';

const LETTERING_WORD: LetteringWord = '一生一世';

export default function LetteringPage() {
  useLang();
  const [order, setOrder] = useState<LetteringOrder>(7);
  const [glyph, setGlyph] = useState<LetteringGlyph>('王');
  const [word, setWord] = useState<LetteringWord | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glyphOptions = useMemo(() => availableLetteringGlyphs(order), [order]);
  const pattern = useMemo(
    () => word ? getLetteringWordPattern(word, order) : getLetteringPattern(glyph, order),
    [glyph, order, word],
  );
  const segments = useMemo(
    () => word ? buildLetteringWordSegments(word, order) : buildLetteringSegments(glyph, order),
    [glyph, order, word],
  );
  const alg = useMemo(() => segments.join(' '), [segments]);
  const contentLabel = word ?? glyph;
  const patternSize = pattern.length;
  const moveCount = alg.split(/\s+/).filter(Boolean).length;
  const moveDurationMs = Math.max(48, Math.min(360, Math.round(28_000 / moveCount)));
  const usesOuterPieces = word === null && (glyph === '生' || glyph === '世') && order === 7;

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const copyAlg = async () => {
    await navigator.clipboard.writeText(alg);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const selectOrder = (nextOrder: LetteringOrder) => {
    const nextGlyphs = availableLetteringGlyphs(nextOrder);
    setOrder(nextOrder);
    if (word && nextOrder < LETTERING_WORD_MIN_ORDER) setWord(null);
    if (!nextGlyphs.includes(glyph)) setGlyph(nextGlyphs[0]);
  };

  const selectGlyph = (nextGlyph: LetteringGlyph) => {
    setWord(null);
    setGlyph(nextGlyph);
  };

  const selectWord = () => {
    setWord(LETTERING_WORD);
    if (order < LETTERING_WORD_MIN_ORDER) setOrder(LETTERING_WORD_MIN_ORDER);
  };

  return (
    <div className="lettering-page">
      <header className="lettering-header lettering-shell">
        <div className="lettering-heading">
          <BackHome />
          <div>
            <p className="lettering-eyebrow">{tr({ zh: '创作工具', en: 'Creative tool' })}</p>
            <h1>{tr({ zh: '魔方拼字', en: 'Cube Lettering' })}</h1>
          </div>
        </div>
      </header>

      <main className="lettering-shell lettering-main">
        <p className="lettering-intro">
          {tr({
            zh: '选择阶数、汉字或“一生一世”，模拟器会从复原状态执行中心块换位子。',
            en: 'Choose a cube order, character, or the four-character phrase. The simulator executes centre commutators from the solved state.',
          })}
        </p>

        <div className="lettering-workspace">
          <section className="lettering-controls" data-site-surface="panel" aria-label={tr({ zh: '拼字设置', en: 'Lettering settings' })}>
            <fieldset>
              <legend>{tr({ zh: '魔方阶数', en: 'Cube order' })}</legend>
              <div className="lettering-order-grid">
                {LETTERING_ORDERS.map(option => (
                  <button
                    key={option}
                    type="button"
                    className="lettering-order"
                    aria-pressed={order === option}
                    onClick={() => selectOrder(option)}
                  >
                    {tr({ zh: `${option}阶`, en: `${option}×${option}` })}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>{tr({ zh: '汉字', en: 'Character' })}</legend>
              <div className="lettering-character-grid">
                {glyphOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    className="lettering-character"
                    aria-pressed={word === null && glyph === option}
                    onClick={() => selectGlyph(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>{tr({ zh: '多字词语', en: 'Multi-character phrase' })}</legend>
              <button
                type="button"
                className="lettering-word"
                aria-pressed={word === LETTERING_WORD}
                onClick={selectWord}
              >
                {LETTERING_WORD}
              </button>
            </fieldset>
            <p className="lettering-method">
              {usesOuterPieces
                ? tr({
                  zh: `字形使用完整 7×7 正面点阵，外圈棱块也参与转动，共 ${moveCount} 步。`,
                  en: `The glyph uses the full 7×7 front-face grid, including outer edge pieces, for ${moveCount} moves.`,
                })
                : tr({
                  zh: `${word ? '词语' : '字形'}使用 ${patternSize}×${patternSize} 中心点阵；相邻层合并成块转动，再补不能合并的部分，共 ${moveCount} 步。棱角保持复原。`,
                  en: `The ${word ? 'phrase' : 'glyph'} uses a ${patternSize}×${patternSize} centre grid. Adjacent layers turn as blocks before the remaining parts are filled, for ${moveCount} moves; edges and corners stay solved.`,
                })}
            </p>
          </section>

          <section className="lettering-preview" data-site-surface="panel" aria-labelledby="lettering-preview-title">
            <div className="lettering-preview-heading">
              <div>
                <p>{order}×{order}</p>
                <h2 id="lettering-preview-title">{contentLabel}</h2>
              </div>
            </div>

            <div className="lettering-cube-card">
              <AlgPlayer
                alg={alg}
                puzzle="5x5"
                puzzleOrder={order}
                set=""
                startSolved
                autoPlay
                interactionMode="view"
                moveDurationMs={moveDurationMs}
                fillPane
              />
            </div>

            <div className="lettering-alg-heading">
              <h3>{tr({ zh: '拼字公式', en: 'Lettering alg' })}</h3>
              <button type="button" className="lettering-copy-button" onClick={() => void copyAlg()}>
                {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制公式', en: 'Copy alg' })}
              </button>
            </div>
            <pre className="lettering-alg"><code>{segments.join('\n')}</code></pre>
          </section>
        </div>
      </main>
    </div>
  );
}
