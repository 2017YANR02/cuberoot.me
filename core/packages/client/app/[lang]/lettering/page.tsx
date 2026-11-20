'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from '@app-foundation/icons/lucide';
import BackHome from '@/components/BackHome';
import AlgPlayer from '@/components/AlgPlayer';
import { ClearButton } from '@/components/ClearButton';
import { createCharacterPlan, fitsCharacterInput, type CharacterPlan, type CharacterError } from './_lib/character-pattern';
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
  const [input, setInput] = useState('王');
  const [compositionDraft, setCompositionDraft] = useState<string | null>(null);
  const composing = useRef(false);
  const [inputLimit, setInputLimit] = useState(false);
  const [custom, setCustom] = useState<CharacterPlan | null>(null);
  const [error, setError] = useState<CharacterError | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glyphOptions = useMemo(() => availableLetteringGlyphs(order), [order]);
  const pattern = useMemo(
    () => custom?.pattern ?? (word ? getLetteringWordPattern(word, order) : getLetteringPattern(glyph, order)),
    [custom, glyph, order, word],
  );
  const segments = useMemo(
    () => custom?.segments ?? (word ? buildLetteringWordSegments(word, order) : buildLetteringSegments(glyph, order)),
    [custom, glyph, order, word],
  );
  const alg = useMemo(() => segments.join(' '), [segments]);
  const contentLabel = custom?.character ?? word ?? glyph;
  const patternSize = pattern.length;
  const moveCount = alg.split(/\s+/).filter(Boolean).length;
  const moveDurationMs = Math.max(48, Math.min(360, Math.round(28_000 / moveCount)));

  const generate = () => {
    if (composing.current) return;
    setInputLimit(false);
    setCopied(false);
    try {
      const next = createCharacterPlan(input, order);
      if ('code' in next) { setError(next); setPending(true); return; }
      setCustom(next);
      setWord(null);
      setError(null);
      setPending(false);
    } catch { setError({ code: 'font' }); setPending(true); }
  };

  const updateInput = (value: string) => {
    if (!fitsCharacterInput(value)) {
      setInputLimit(true);
      setError(null);
      return;
    }
    setInput(value);
    setInputLimit(false);
    setPending(true);
    setError(null);
  };

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
    setCustom(null);
    setPending(true);
    setError(null);
    const nextGlyphs = availableLetteringGlyphs(nextOrder);
    setOrder(nextOrder);
    if (word && nextOrder < LETTERING_WORD_MIN_ORDER) setWord(null);
    if (!nextGlyphs.includes(glyph)) setGlyph(nextGlyphs[0]);
  };

  const selectGlyph = (nextGlyph: LetteringGlyph) => {
    setInputLimit(false);
    setInput(nextGlyph);
    setCustom(null);
    setPending(false);
    setError(null);
    setWord(null);
    setGlyph(nextGlyph);
  };

  const selectWord = () => {
    setCustom(null);
    setPending(false);
    setError(null);
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
        <div className="lettering-workspace">
          <section className="lettering-controls" data-site-surface="panel" aria-label={tr({ zh: '拼字设置', en: 'Lettering settings' })}>
            <form id="lettering-generate-form" className="lettering-input-group" onSubmit={event => { event.preventDefault(); generate(); }}>
              <label htmlFor="lettering-character-input">{tr({ zh: '单个字符', en: 'Single character' })}</label>
              <div className="lettering-input-wrap">
                <input className="lettering-character-input" id="lettering-character-input" value={compositionDraft ?? input} autoComplete="off" spellCheck={false}
                  aria-invalid={error?.code === 'input'}
                  aria-describedby={inputLimit ? 'lettering-input-limit' : error ? 'lettering-input-feedback' : undefined}
                  onCompositionStart={event => { composing.current = true; setCompositionDraft(event.currentTarget.value); }}
                  onCompositionEnd={event => { composing.current = false; setCompositionDraft(null); updateInput(event.currentTarget.value); }}
                  onKeyDown={event => { if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
                  onChange={event => {
                    if (composing.current) setCompositionDraft(event.target.value);
                    else updateInput(event.target.value);
                  }} />
                {input && <ClearButton onClick={() => { composing.current = false; setCompositionDraft(null); updateInput(''); }} />}
              </div>
              {inputLimit && <p id="lettering-input-limit" className="lettering-feedback" role="status">{input
                ? tr({ zh: '只能输入一个字符。更换前请先删除当前字符。', en: 'Only one character is allowed. Delete the current character before entering another.' })
                : tr({ zh: '一次只能输入一个字符，请只输入一个汉字、字母或符号。', en: 'Enter just one Chinese character, letter or symbol at a time.' })}</p>}
            </form>
            {error && <p id="lettering-input-feedback" className={`lettering-feedback${error.code === 'input' ? ' lettering-error' : ''}`} role="alert">
              {error.code === 'input' ? tr({ zh: '请输入单个汉字、英文字母或符号（如 ♥、★），不支持多个字符、数字或组合表情。', en: 'Enter one Chinese character, English letter or symbol (such as ♥ or ★). Multiple characters, numbers and compound emoji are not supported.' })
                : error.code === 'order' ? tr({ zh: `当前阶数无法保留这个字形的细节，建议选择 ${error.minimum} 阶后生成。`, en: `This grid cannot preserve the glyph details. Try order ${error.minimum}.` })
                  : error.code === 'detail' ? tr({ zh: '当前字体在这个阶数下无法保留字形细节，请尝试其他阶数或字符。', en: 'This font cannot preserve the glyph details at this order. Try a different order or character.' })
                  : tr({ zh: '无法绘制这个字符，设备可能缺少对应字体。请尝试其他字符。', en: 'Unable to draw this character. A suitable font may be missing. Try another character.' })}
            </p>}
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
            <button type="submit" form="lettering-generate-form" className="lettering-generate">{tr({ zh: '生成拼法', en: 'Generate algorithm' })}</button>
            <p className="lettering-method">{tr({ zh: '按字形的笔画、间隙和封闭区域估计所需阶数；自动字形从 7 阶起尝试。生成后请检查点阵是否清晰。', en: 'Required size is estimated from strokes, gaps and enclosed spaces, starting at 7×7 for automatic glyphs. Check the resulting grid for legibility.' })}</p>
            <fieldset>
              <legend>{tr({ zh: '内置字形', en: 'Built-in glyphs' })}</legend>
              <div className="lettering-character-grid">
                {glyphOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    className="lettering-character"
                    aria-pressed={!pending && word === null && contentLabel === option}
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
            {!pending && <p className="lettering-method">
              {tr({
                  zh: `${word ? '词语' : '字形'}使用 ${patternSize}×${patternSize} 中心点阵，共 ${moveCount} 步。完成后六个面的最外圈均保持复原。`,
                  en: `The ${word ? 'phrase' : 'glyph'} uses a ${patternSize}×${patternSize} centre grid and ${moveCount} moves. The outer border of all six faces is solved at the end.`,
                })}
            </p>}
          </section>

          <section className="lettering-preview" data-site-surface="panel" aria-labelledby="lettering-preview-title">
            {pending ? <p className="lettering-empty" id="lettering-preview-title" role="status">{tr({ zh: '选择阶数后，点击“生成拼法”查看结果。', en: 'Choose a cube order and generate an algorithm to see the result.' })}</p> : <>
            <div className="lettering-preview-heading">
              <div>
                <p>{order}×{order}</p>
                <h2 id="lettering-preview-title">{contentLabel}</h2>
              </div>
            </div>

            <div className="lettering-pattern-summary">
              <div className="lettering-pixel-grid" role="img" aria-label={tr({ zh: `${contentLabel}的目标点阵`, en: `Target grid for ${contentLabel}` })}
                style={{ gridTemplateColumns: `repeat(${patternSize}, 1fr)` }}>
                {pattern.flatMap((row, y) => [...row].map((pixel, x) => <span key={`${y}-${x}`} data-ink={pixel === '1'} />))}
              </div>
              <p className="lettering-method">{tr({ zh: `${patternSize}×${patternSize} 目标点阵 · ${moveCount} 步`, en: `${patternSize}×${patternSize} target grid · ${moveCount} moves` })}<br />
                {custom?.source === 'font' ? tr({ zh: '字体自动采样；大小写保留，字形随设备字体略有差异。', en: 'Sampled from a local font. Case is preserved; appearance may vary by device.' }) : tr({ zh: '使用内置手工点阵。', en: 'Uses a hand-designed glyph.' })}
              </p>
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

            <p className="lettering-method lettering-result-note">{tr({ zh: '从复原状态开始，绿色面朝前、白色面朝上；其他面的中心颜色也会改变。', en: 'Start solved with green in front and white on top. Centres on other faces also change.' })}</p>
            <div className="lettering-alg-heading">
              <h3>{tr({ zh: '拼字公式', en: 'Lettering alg' })}</h3>
              <button type="button" className="lettering-copy-button" onClick={() => void copyAlg()}>
                {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制公式', en: 'Copy alg' })}
              </button>
            </div>
            <pre className="lettering-alg"><code>{segments.join('\n')}</code></pre>
            </>}
          </section>
        </div>
      </main>
    </div>
  );
}
