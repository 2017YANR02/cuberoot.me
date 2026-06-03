'use client';

// 3BLD 公式库 (commutator library) — browse + animate the corner/edge commutator
// dictionaries (formula_corner / formula_edge) extracted from the Android app,
// with optional Chinese association words (Dictionary.dic) as a memory hint.
//
// SELF-CONTAINED: every entry is loaded from the static JSON under ../_data/ via
// dynamic import() (code-split). No database / server access.
//
// Each commutator is a 3-cycle: applying it to a SOLVED cube cycles three pieces.
// • thumbnails use <CubingPreview> with the comm as the setup alg → a static 2D
//   picture of the resulting 3-cycle state (light, no animation).
// • the focused pair uses an interactive <TwistySection> on a solved cube with
//   the comm as `alg` so you can scrub / play the 3-cycle.
//
// cubing.js' Alg parser is strict: ~20 of the 818 algs (space-free glued runs +
// parenthesized groups with no inner spaces) throw on `new Alg(raw)`. We keep the
// JSON verbatim and normalize at RENDER time (verified: all 818 parse after this).

import {
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { Search, Loader2, Lightbulb, Boxes, Square } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ClearButton } from '@/components/ClearButton';
import CubingPreview from '@/components/CubingPreview';
import '../3bld.css';

// TwistySection pulls in cubing.js (heavy) — load only on the client, lazily.
const TwistySection = dynamic(() => import('@/components/TwistySection'), {
  ssr: false,
  loading: () => (
    <div className="bld-cube-loading">
      <Loader2 size={18} />
    </div>
  ),
});

type Kind = 'corner' | 'edge';
type CommMap = Record<string, string>;
type AssocMap = Record<string, string>;

/**
 * Normalize a dictionary alg into a cubing.js-parseable string (render-time only).
 * Strips parentheses, then inserts a space before every move-start token so that
 * glued runs ("UR'U'") and paren groups ("(URUR'U')R") parse. Verified to make
 * all 818 corner+edge algs parse in cubing/alg.
 */
function normalizeAlg(s: string): string {
  return s
    .replace(/[()]/g, ' ')
    .replace(/([RUFLBDxyzMESrludfb])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function CommLibraryPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('3BLD 公式库', '3BLD Commutator Library');

  const [kind, setKind] = useState<Kind>('corner');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // Lazily code-split the data: corner + edge maps + assoc words.
  const [corner, setCorner] = useState<CommMap | null>(null);
  const [edge, setEdge] = useState<CommMap | null>(null);
  const [assoc, setAssoc] = useState<AssocMap>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [c, e, a] = await Promise.all([
        import('../_data/comm-corner.json'),
        import('../_data/comm-edge.json'),
        import('../_data/assoc-words.json'),
      ]);
      if (!alive) return;
      setCorner((c.default ?? c) as CommMap);
      setEdge((e.default ?? e) as CommMap);
      setAssoc((a.default ?? a) as AssocMap);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const activeMap = kind === 'corner' ? corner : edge;

  // Filter: match the letter pair OR the alg text OR the assoc word (substring,
  // case-insensitive). The pair search uppercases so "ad" finds "AD".
  const pairs = useMemo(() => {
    if (!activeMap) return [];
    const all = Object.keys(activeMap); // already sorted in the JSON
    const q = query.trim();
    if (!q) return all;
    const qUpper = q.toUpperCase();
    const qLower = q.toLowerCase();
    return all.filter((p) => {
      if (p.includes(qUpper)) return true;
      const alg = activeMap[p];
      if (alg.toLowerCase().includes(qLower)) return true;
      const word = assoc[p];
      return word ? word.toLowerCase().includes(qLower) : false;
    });
  }, [activeMap, query, assoc]);

  // When switching kind / filtering, keep the selection only if it's still valid.
  useEffect(() => {
    if (selected && activeMap && !(selected in activeMap)) setSelected(null);
  }, [activeMap, selected]);

  const selAlg = selected && activeMap ? activeMap[selected] : null;
  const selAssoc = selected ? assoc[selected] : undefined;
  const selNormalized = selAlg ? normalizeAlg(selAlg) : '';

  const kindLabel = (k: Kind) =>
    k === 'corner' ? (isZh ? '角块' : 'Corner') : (isZh ? '棱块' : 'Edge');

  const loading = activeMap === null;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? '3BLD 公式库' : '3BLD Commutator Library'}</h1>
      </div>

      <p className="bld-input-summary">
        {isZh
          ? '角块 / 棱块换法公式库,每条公式在还原态魔方上即一组三循环。点选可交互播放,带中文联想词作记忆提示。'
          : 'Corner / edge commutator dictionary — each alg is a 3-cycle on a solved cube. Tap a pair to scrub it interactively; Chinese association words shown as a memory hint where available.'}
      </p>

      {/* ── toolbar: kind toggle + search ── */}
      <div className="bld-comm-toolbar">
        <div className="bld-seg" role="tablist" aria-label={isZh ? '块类型' : 'Piece type'}>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'corner'}
            className={`bld-seg-btn${kind === 'corner' ? ' is-on' : ''}`}
            onClick={() => setKind('corner')}
          >
            <Boxes size={15} />
            {kindLabel('corner')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'edge'}
            className={`bld-seg-btn${kind === 'edge' ? ' is-on' : ''}`}
            onClick={() => setKind('edge')}
          >
            <Square size={15} />
            {kindLabel('edge')}
          </button>
        </div>

        <div className="bld-comm-search-wrap">
          <span className="bld-comm-search-icon">
            <Search size={15} />
          </span>
          <input
            className="bld-comm-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isZh ? '搜索编码 / 公式 / 联想词' : 'Search pair / alg / word'}
            spellCheck={false}
            autoComplete="off"
            aria-label={isZh ? '搜索' : 'Search'}
          />
          {query && (
            <ClearButton isZh={isZh} onClick={() => setQuery('')} preserveFocus />
          )}
        </div>

        <span className="bld-comm-count">
          {loading
            ? (isZh ? '加载中…' : 'Loading…')
            : isZh
              ? `${pairs.length} 组`
              : `${pairs.length}`}
        </span>
      </div>

      {/* ── focused pair (interactive playback) ── */}
      {selected && selAlg && (
        <div className="bld-comm-focus">
          <div className="bld-comm-focus-cube">
            <div className="bld-cube-wrap">
              {/* solved cube + comm as alg → scrub the 3-cycle */}
              <TwistySection puzzle="3x3x3" scramble="" alg={selNormalized} />
            </div>
          </div>

          <div className="bld-comm-focus-info">
            <div className="bld-comm-focus-pair">
              <span className="bld-comm-focus-letters">{selected}</span>
              <span className="bld-comm-kind-tag">{kindLabel(kind)}</span>
            </div>

            <div>
              <div className="bld-comm-alg-label">{isZh ? '公式' : 'Algorithm'}</div>
              <div className="bld-comm-alg-text">{selAlg}</div>
            </div>

            {selAssoc && (
              <div className="bld-comm-assoc">
                <span className="bld-comm-assoc-icon">
                  <Lightbulb size={16} />
                </span>
                <span className="bld-comm-assoc-text">
                  {selAssoc}
                  {!isZh && (
                    <span className="bld-comm-alg-label"> (memory hint, zh)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── grid of all (filtered) pairs ── */}
      <div className="bld-comm-grid">
        {loading ? (
          <div className="bld-comm-empty">
            <Loader2 size={18} className="bld-inline-spin" />
          </div>
        ) : pairs.length === 0 ? (
          <div className="bld-comm-empty">
            {isZh ? '无匹配公式' : 'No matching algs'}
          </div>
        ) : (
          pairs.map((p) => {
            const alg = activeMap![p];
            const word = assoc[p];
            return (
              <button
                key={p}
                type="button"
                className={`bld-comm-card${selected === p ? ' is-active' : ''}`}
                onClick={() => setSelected(p)}
              >
                <span className="bld-comm-card-thumb">
                  <CubingPreview event="333" scramble={normalizeAlg(alg)} visualization="2D" size={8} />
                </span>
                <span className="bld-comm-card-head">
                  <span className="bld-comm-card-pair">{p}</span>
                </span>
                <span className="bld-comm-card-alg">{alg}</span>
                {word && <span className="bld-comm-card-assoc">{word}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
