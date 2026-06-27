'use client';

// Twizzle-style "Puzzle Cuts" editor. Picks a base platonic solid and a set of
// face / vertex / edge cuts, builds a cubing.js PuzzleGeometry description string
// (e.g. "c f 0.255"), and reports it via onChange. SimPage feeds that string to
// TwistySection.puzzleDescription → TwistyPlayer.experimentalPuzzleDescription, so
// cubing.js renders + drags the resulting twisty puzzle for free.
//
// Same description grammar as alpha.twizzle.net/explore: <shape> (<cutType> <dist>)*
// shape ∈ c/t/o/d/i, cutType ∈ f/v/e. Cut order is geometry-irrelevant (all cut
// planes are collected then applied), so we group them by type for the UI.

import { useMemo, useCallback } from 'react';
import { X, Plus, Copy } from 'lucide-react';
import { useT } from '@/hooks/useT';
import './CutEditor.css';

export type CutType = 'f' | 'v' | 'e';

const SHAPES: { id: string; zh: string; en: string }[] = [
  { id: 'c', zh: '立方体', en: 'Cube' },
  { id: 't', zh: '四面体', en: 'Tetrahedron' },
  { id: 'o', zh: '八面体', en: 'Octahedron' },
  { id: 'd', zh: '十二面体', en: 'Dodecahedron' },
  { id: 'i', zh: '二十面体', en: 'Icosahedron' },
];

const GROUPS: { type: CutType; zh: string; en: string; def: number }[] = [
  { type: 'f', zh: '面切割', en: 'Face cuts', def: 0.5 },
  { type: 'v', zh: '顶点切割', en: 'Vertex cuts', def: 0.3 },
  { type: 'e', zh: '棱切割', en: 'Edge cuts', def: 0.3 },
];

interface ParsedDesc { shape: string; cuts: { type: CutType; d: number }[]; }

function parseDesc(desc: string): ParsedDesc {
  const parts = (desc || '').trim().split(/\s+/).filter(Boolean);
  const shape = parts[0] && SHAPES.some((s) => s.id === parts[0]) ? parts[0] : 'c';
  const cuts: { type: CutType; d: number }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const type = parts[i] as CutType;
    const d = parseFloat(parts[i + 1]);
    if ((type === 'f' || type === 'v' || type === 'e') && Number.isFinite(d)) {
      cuts.push({ type, d });
    }
  }
  return { shape, cuts };
}

// Trim float noise (0.30000000004 → "0.3") without forcing trailing zeros.
function fmt(d: number): string {
  return String(parseFloat(d.toFixed(4)));
}

function buildDesc(shape: string, cuts: { type: CutType; d: number }[]): string {
  return [shape, ...cuts.map((c) => `${c.type} ${fmt(c.d)}`)].join(' ');
}

export default function CutEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (desc: string) => void;
}) {
  const t = useT();
  const { shape, cuts } = useMemo(() => parseDesc(value), [value]);

  const emit = useCallback(
    (nextShape: string, nextCuts: { type: CutType; d: number }[]) => {
      onChange(buildDesc(nextShape, nextCuts));
    },
    [onChange],
  );

  const setCutValue = (idx: number, d: number) =>
    emit(shape, cuts.map((c, i) => (i === idx ? { ...c, d } : c)));
  const removeCut = (idx: number) => emit(shape, cuts.filter((_, i) => i !== idx));
  const addCut = (type: CutType, def: number) => emit(shape, [...cuts, { type, d: def }]);

  const copyDesc = () => { try { void navigator.clipboard?.writeText(value); } catch { /* */ } };

  return (
    <div className="cut-editor">
      <div className="cut-editor-head">
        <span className="cut-editor-title">{t('自定义切割', 'Puzzle Cuts')}</span>
        <select
          className="cut-shape"
          value={shape}
          onChange={(e) => emit(e.target.value, cuts)}
          aria-label={t('基础多面体', 'Base solid')}
        >
          {SHAPES.map((s) => (
            <option key={s.id} value={s.id}>{t(s.zh, s.en)}</option>
          ))}
        </select>
      </div>

      {GROUPS.map((g) => (
        <div key={g.type} className="cut-group">
          <div className="cut-group-title">{t(g.zh, g.en)}</div>
          {cuts.map((c, i) =>
            c.type === g.type ? (
              <div key={i} className="cut-row">
                <input
                  type="range"
                  className="cut-range"
                  min={0}
                  max={1}
                  step={0.005}
                  value={Math.max(0, Math.min(1, c.d))}
                  onChange={(e) => setCutValue(i, parseFloat(e.target.value))}
                  aria-label={t(g.zh, g.en)}
                />
                <input
                  type="number"
                  className="cut-num"
                  step={0.01}
                  value={c.d}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) setCutValue(i, v);
                  }}
                />
                <button
                  type="button"
                  className="cut-del"
                  onClick={() => removeCut(i)}
                  aria-label={t('删除', 'Remove')}
                  title={t('删除', 'Remove')}
                >
                  <X size={14} />
                </button>
              </div>
            ) : null,
          )}
          <button type="button" className="cut-add" onClick={() => addCut(g.type, g.def)}>
            <Plus size={14} />
            <span>{t('添加', 'Add')}</span>
          </button>
        </div>
      ))}

      <div className="cut-desc-row">
        <input
          type="text"
          className="cut-desc"
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          aria-label={t('切割描述', 'Cut description')}
        />
        <button
          type="button"
          className="cut-del"
          onClick={copyDesc}
          aria-label={t('复制', 'Copy')}
          title={t('复制', 'Copy')}
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}
