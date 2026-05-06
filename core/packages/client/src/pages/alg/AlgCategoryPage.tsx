/**
 * /alg/:puzzle/:set         — list every case for one alg set.
 * /alg/:puzzle/:set/:sub    — for umbrella sets, list cases of one subgroup.
 *
 * For umbrella sets (ZBLL/1LLL/OLLCP/VLS) without :sub, render a subgroup picker
 * with OLL-style pattern previews (matches speedcubedb's ZBLL landing page).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Shuffle } from 'lucide-react';
import {
  loadAlg, getAlgSetMeta, ALG_PUZZLES,
  type AlgCase, type AlgFile, type AlgPuzzle, type AlgSticker,
  type AlgSubmission,
} from '@cuberoot/shared';
import { listSubmissions } from '../../utils/alg_api';
import CommunityAlgs from './CommunityAlgs';
import { VisualCube } from '../../components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '../../components/PuzzleSVG';
import LangToggle from '../../components/LangToggle';
import './alg.css';

const PUZZLE_SIZE: Record<AlgPuzzle, number> = { '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5, 'sq1': 3, 'megaminx': 3, 'pyraminx': 3, 'skewb': 3 };
const SR_PUZZLES: AlgPuzzle[] = ['sq1', 'megaminx', 'pyraminx', 'skewb'];
function srPuzzleKind(p: AlgPuzzle): PuzzleKind | null {
  if (p === 'sq1')      return 'sq1-net';        // SQ1 top-down split (matches speedcubedb)
  if (p === 'megaminx') return 'megaminx-top';   // Top pentagon view (LL-style)
  if (p === 'pyraminx') return 'pyraminx';       // 3D iso (Pyraminx has no canonical "top")
  if (p === 'skewb')    return 'skewb';          // 3D iso
  return null;
}

/** Map our AlgPuzzle slug to cubing.js's TwistyPlayer puzzle id. */
const TWISTY_PUZZLE: Record<AlgPuzzle, string> = {
  '2x2': '2x2x2',
  '3x3': '3x3x3',
  '4x4': '4x4x4',
  '5x5': '5x5x5',
  'sq1': 'square1',
  'megaminx': 'megaminx',
  'pyraminx': 'pyraminx',
  'skewb': 'skewb',
};

/** F2L `c.setup` is canonical (FR slot disturbed). For other oris, append a `y`-rotation
 *  so the disturbed slot ends up at the right visual position (cube also rotates with it,
 *  so non-FR thumbs aren't red-front — that's expected). */
const ORI_SUFFIX = ['', 'y', 'y2', "y'"];
function oriAdjustSetup(setup: string, oriIdx: number): string {
  if (!setup || oriIdx === 0) return setup;
  return `${setup} ${ORI_SUFFIX[oriIdx]}`;
}

/** speedcubedb labels F2L oris "Front Right / Front Left / Back Left / Back Right".
 *  Cubers universally use the short FR/FL/BL/BR — no translation, both langs. */
function shortOriName(name: string): string {
  const map: Record<string, string> = {
    'Front Right': 'FR', 'Front Left': 'FL', 'Back Left': 'BL', 'Back Right': 'BR',
  };
  return map[name] ?? name;
}

/** SQ1 alg `1,0/-1,0` → `(1,0)/(-1,0)`. cubing.js's parser requires parens
 * around each `m,n` move; speedcubedb's data omits them. */
function normalizeAlgForTwisty(puzzle: AlgPuzzle, alg: string): string {
  if (puzzle !== 'sq1') return alg;
  return alg.replace(/(-?\d+,-?\d+)/g, '($1)');
}

/** Map our (puzzle, set) to a cubing.js `experimentalStickering` value (LL/LS grayed out).
 *  Stickering is only well-supported on 3x3 and megaminx; returns undefined elsewhere
 *  (TwistyPlayer falls back to fully colored). */
function pickStickering(puzzle: AlgPuzzle, set: string): string | undefined {
  if (puzzle !== '3x3') return undefined;
  switch (set) {
    case 'f2l': case 'adv-f2l':                   return 'F2L';
    case 'oll': case 'ollcp':                     return 'OLL';
    case 'pll': case 'anti-pll':                  return 'PLL';
    case 'coll':                                  return 'COLL';
    case 'cmll':                                  return 'CMLL';
    case 'ell':                                   return 'ELL';
    case 'cls':                                   return 'CLS';
    case 'zbls':                                  return 'ZBLS';
    case 'vls':                                   return 'VLS';
    case 'wv':                                    return 'WVLS';
    case 'zbll':                                  return 'ZBLL';
    case '1lll':                                  return 'LL';
    case 'eo4a':                                  return 'EO';
    case 'sv': case 'sbls': case 'fruf':          return 'LS';
    default:                                      return undefined;
  }
}

/** Inline animated puzzle demo. Lazy-imports cubing/twisty. */
function AlgPlayer({ alg, puzzle, set, setup }: { alg: string; puzzle: AlgPuzzle; set: string; setup?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;
    const normalized = normalizeAlgForTwisty(puzzle, alg);
    const stickering = pickStickering(puzzle, set);
    // Prefer the canonical `setup` (rotation-free, matches static thumb) over inverting alg —
    // some algs start with `d`/`y` and the inverse leaves the cube body rotated.
    const setupForTwisty = setup && setup.trim()
      ? normalizeAlgForTwisty(puzzle, setup)
      : `(${normalized})'`;
    import('cubing/twisty').then((mod) => {
      if (cancelled || !host) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (mod as any).TwistyPlayer || (mod as any).default;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts: any = {
          puzzle: TWISTY_PUZZLE[puzzle],
          experimentalSetupAlg: setupForTwisty,
          alg: normalized,
          controlPanel: 'bottom-row',
          background: 'none',
          hintFacelets: 'none',
          backView: 'none',
        };
        if (stickering) opts.experimentalStickering = stickering;
        player = new Ctor(opts);
        player.style.colorScheme = 'light';
        player.style.width = '260px';
        player.style.height = '260px';
        host.appendChild(player);
      } catch (err) {
        console.warn(`[AlgPlayer] ${puzzle} alg failed: ${alg}`, err);
        host.innerHTML = `<div style="font-size:12px;color:#888;padding:8px">player unavailable</div>`;
      }
    }).catch(err => console.warn('Failed to load cubing library:', err));
    return () => {
      cancelled = true;
      if (player && host.contains(player)) host.removeChild(player);
    };
  }, [alg, puzzle]);
  return <div ref={hostRef} className="alg-twisty-host" />;
}

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

/** Pick the right preview thumb based on puzzle + sticker kind. */
function CaseThumb({ puzzle, set, sticker, alg, setup, size = 88 }: { puzzle: AlgPuzzle; set: string; sticker: AlgSticker; alg: string; setup?: string; size?: number }) {
  if (SR_PUZZLES.includes(puzzle)) {
    const kind = srPuzzleKind(puzzle)!;
    // Prefer setup (forward) when available — matches speedcubedb's preview state.
    // Fall back to inverting the canonical alg (case = solved.applyInverse(alg)).
    const driver = setup && setup.trim() ? { alg: setup } : { case: alg };
    return <PuzzleSVG kind={kind} {...driver} size={size} />;
  }
  // ZBLS preview uses VH mask (LL edges colored to show EO; LL corners grayed) —
  // matches the F2L+EO pattern shown in CubeRoot's ZBLS docx.
  const isZbls = puzzle === '3x3' && set === 'zbls';
  if (isZbls) {
    return <VisualCube algorithm={alg} setup={setup} view="iso" mask="vh" size={size} />;
  }
  // Prefer `setup` (rotation-free, canonical red-front) over inverting `alg` —
  // alg may start with `d`/`y` etc. and leave the cube rotated.
  return <VisualCube algorithm={alg} setup={setup} view={pickView(puzzle, set, sticker)} size={size} puzzleSize={PUZZLE_SIZE[puzzle]} />;
}

function pickView(puzzle: AlgPuzzle, set: string, sticker: AlgSticker): 'f2l' | 'oll' | 'pll' | 'pll-iso' {
  // 3x3 F2L isometric (LL grayed). Other puzzles' f2l-shaped stickers fall through to plan view.
  if (puzzle === '3x3' && sticker.kind === 'f2l') return 'f2l';
  // Yellow-vs-gray orientation preview for OLL-style sets across all sizes.
  if (set === 'oll' || set === 'oll-parity') return 'oll';
  // Default: planar top-down with full LL ring stickers — works for PLL / COLL / CMLL / ZBLL / 1LLL / OLLCP / VLS / 2x2 CLL / EG / 4x4 PLL Parity / 5x5 L2E / L2C.
  return 'pll';
}

function AlgRow({ alg, expanded, onToggle, animatable, puzzle, set, setup }: { alg: string; expanded: boolean; onToggle: () => void; animatable: boolean; puzzle: AlgPuzzle; set: string; setup?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`alg-alg-row${expanded ? ' is-expanded' : ''}`}
        onClick={animatable ? onToggle : undefined}
        onKeyDown={(e) => {
          if (animatable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggle();
          }
        }}
        title={animatable ? (expanded ? 'collapse' : 'play') : 'copy'}
      >
        <span className="alg-alg-text">{alg}</span>
        <button
          type="button"
          className="alg-alg-copy-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(alg).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
          title="copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
        </button>
      </div>
      {expanded && animatable && <AlgPlayer alg={alg} puzzle={puzzle} set={set} setup={setup} />}
    </>
  );
}

/** Subgroup-picker landing for umbrella sets — one card per *top-level* subgroup (OLL pattern). */
function SubgroupIndex({
  puzzle, set, cases, isZh,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  isZh: boolean;
}) {
  // Group by top-level subgroup label only — sub-subgroups (e.g. "U/U1" AUF variants) collapse
  // into the same OLL-pattern card. ZBLL → 7 cards (U/L/T/H/Pi/S/AS).
  const groups = useMemo(() => {
    const map = new Map<string, { sample: AlgCase; count: number }>();
    for (const c of cases) {
      const top = (c.subgroup || '').split('/', 1)[0];
      const existing = map.get(top);
      if (existing) existing.count++;
      else map.set(top, { sample: c, count: 1 });
    }
    return Array.from(map.entries());
  }, [cases]);

  // ZBLS thumbnails want F2L-style preview (LL EO visible) instead of OLL plan view.
  const useF2lThumb = puzzle === '3x3' && set === 'zbls';

  return (
    <div className={`alg-subgroup-grid${useF2lThumb ? ' is-f2l-thumb' : ''}`}>
      {groups.map(([topLabel, { sample, count }]) => {
        const firstAlg = sample.algs.flat()[0]?.alg ?? sample.standard ?? '';
        const slug = encodeURIComponent(topLabel.toLowerCase()) || '_';
        return (
          <Link
            key={topLabel || '_root_'}
            to={`/alg/${puzzle}/${set}/${slug}`}
            className="alg-subgroup-card"
          >
            <div className="alg-subgroup-thumb">
              {useF2lThumb
                ? <CaseThumb puzzle={puzzle} set={set} sticker={sample.sticker} alg={firstAlg} setup={sample.setup} size={110} />
                : <VisualCube algorithm={firstAlg} view="oll" size={120} />}
            </div>
            <div className="alg-subgroup-card-title">{useF2lThumb ? (topLabel || (isZh ? '其他' : 'Other')) : `${set.toUpperCase()} ${topLabel || (isZh ? '其他' : 'Other')}`}</div>
            <div className="alg-subgroup-card-count">{count} {isZh ? '个' : 'cases'}</div>
          </Link>
        );
      })}
    </div>
  );
}

export default function AlgCategoryPage() {
  const { puzzle: puzzleParam = '', set = '', subgroup: subgroupParam } = useParams<{ puzzle: string; set: string; subgroup?: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const validPuzzle = isPuzzle(puzzleParam);
  const meta = validPuzzle ? getAlgSetMeta(puzzleParam, set) : undefined;
  const [data, setData] = useState<AlgFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOri, setActiveOri] = useState(0);
  // Per-case override (lets user cycle one case's ori for side-by-side comparison while
  // the rest of the page stays on `activeOri`). Clicking the global tabs clears overrides.
  const [caseOri, setCaseOri] = useState<Record<string, number>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<AlgSubmission[]>([]);

  useEffect(() => {
    if (!validPuzzle || !meta) return;
    listSubmissions(puzzleParam, set)
      .then(setSubmissions)
      .catch(e => { console.warn('[alg] failed to load submissions', e); setSubmissions([]); });
  }, [puzzleParam, set, validPuzzle, meta]);

  const submissionsByCase = useMemo(() => {
    const map = new Map<string, AlgSubmission[]>();
    for (const s of submissions) {
      const arr = map.get(s.caseName) ?? [];
      arr.push(s);
      map.set(s.caseName, arr);
    }
    return map;
  }, [submissions]);

  useEffect(() => {
    if (!validPuzzle || !meta) { setError('unknown set'); setData(null); return; }
    setError(null);
    setData(null);
    loadAlg(puzzleParam, set).then(d => {
      setData(d);
      // For non-umbrella big sets (>100 cases), default-collapse subgroup sections.
      // Umbrella sets always navigate via the subgroup picker, no need to collapse.
      if (d.cases.length > 100 && !meta.umbrella) {
        const groups = new Set<string>();
        for (const c of d.cases) groups.add(c.subgroup || '');
        setCollapsedGroups(groups);
      } else {
        setCollapsedGroups(new Set());
      }
    }).catch(e => setError(String(e)));
  }, [puzzleParam, set, validPuzzle, meta]);

  // Cases visible after subgroup filtering (subgroupParam, when set, narrows the umbrella).
  const visibleCases = useMemo(() => {
    if (!data) return [];
    if (!subgroupParam) return data.cases;
    const wanted = decodeURIComponent(subgroupParam).toLowerCase();
    return data.cases.filter(c => {
      const top = (c.subgroup || '').split('/', 1)[0].toLowerCase();
      return top === wanted;
    });
  }, [data, subgroupParam]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleCases>();
    for (const c of visibleCases) {
      const key = c.subgroup || '';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visibleCases]);

  if (!validPuzzle || !meta) {
    return <div className="alg-root"><div className="alg-empty">Unknown set: {puzzleParam}/{set}</div></div>;
  }

  // cubing.js TwistyPlayer supports all 8 of our puzzles natively.
  const animatable = true;
  const showSubgroupPicker = !!meta.umbrella && !subgroupParam;
  const backTo = subgroupParam ? `/alg/${puzzleParam}/${set}` : `/alg/${puzzleParam}`;

  // Header subtitle for umbrella subgroup pages: "ZBLL · U", etc.
  const subgroupDisplay = subgroupParam
    ? decodeURIComponent(subgroupParam).toUpperCase()
    : '';

  const toggleGroup = (g: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link to={backTo} className="alg-back">
          <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
        </Link>
        <h1 className="alg-cat-title">
          <span className="alg-cat-puzzle">{puzzleParam}</span>
          {' '}
          {isZh ? meta.zh : meta.en}
          {subgroupDisplay && <span className="alg-cat-subgroup"> {subgroupDisplay}</span>}
        </h1>
        {data && !showSubgroupPicker && (
          <span className="alg-cat-count">{visibleCases.length} {isZh ? '个' : 'cases'}</span>
        )}
        <LangToggle variant="inline" className="alg-lang-toggle" />
      </div>

      {/* Page-level ori switcher — only for sets where every case has the same 4 oris (F2L family).
          One click here switches all case thumbs + alg lists at once. */}
      {data && !showSubgroupPicker && (() => {
        const oriNames = data.cases[0]?.oriNames;
        if (!oriNames || oriNames.length <= 1) return null;
        return (
          <div className="alg-ori-tabs alg-ori-tabs-global">
            {oriNames.map((name, i) => (
              <button
                key={i}
                type="button"
                className={`alg-ori-tab${activeOri === i ? ' is-active' : ''}`}
                onClick={() => { setActiveOri(i); setCaseOri({}); }}
              >
                {shortOriName(name)}
              </button>
            ))}
          </div>
        );
      })()}

      {error && <div className="alg-empty">{error}</div>}
      {!data && !error && <div className="alg-empty">{isZh ? '加载中…' : 'Loading…'}</div>}

      {data && showSubgroupPicker && (
        <SubgroupIndex puzzle={puzzleParam} set={set} cases={data.cases} isZh={isZh} />
      )}

      {data && !showSubgroupPicker && grouped.map(([subgroup, cases]) => {
        const collapsed = collapsedGroups.has(subgroup);
        // Subgroup headers visible when we have multiple groups, or when subgroup label is non-empty
        // and this isn't a single-subgroup umbrella view (which already has the label in the page header).
        const showHeader = !subgroupParam && (grouped.length > 1 || subgroup !== '');
        return (
          <section key={subgroup || '_root_'} className="alg-subgroup">
            {showHeader && (
              <h2
                className="alg-subgroup-title is-toggleable"
                onClick={() => toggleGroup(subgroup)}
                role="button"
                tabIndex={0}
              >
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {subgroup || (isZh ? '其他' : 'Other')}
                <span className="alg-subgroup-count">{cases.length}</span>
              </h2>
            )}
            {!collapsed && (
              <div className="alg-case-list">
                {cases.map(c => {
                  // Per-case override > global. Clamped to this case's actual ori count.
                  const rawOri = caseOri[c.name] ?? activeOri;
                  const oriIdx = rawOri < c.algs.length ? rawOri : 0;
                  const algsForOri = c.algs[oriIdx] ?? c.algs[0] ?? [];
                  const oriCount = c.algs.length;
                  const firstAlg = algsForOri[0]?.alg ?? c.standard ?? '';
                  return (
                    <article key={c.name} className="alg-case">
                      <div className="alg-case-head">
                        <div className="alg-case-cube">
                          <CaseThumb
                            puzzle={puzzleParam}
                            set={set}
                            sticker={c.sticker}
                            alg={firstAlg || c.setup || ''}
                            setup={oriAdjustSetup(c.setup, oriIdx)}
                          />
                        </div>
                        <div className="alg-case-info">
                          <div className="alg-case-name">
                            {c.name}
                            {oriCount > 1 && (
                              <button
                                type="button"
                                className="alg-case-y-btn"
                                onClick={() => setCaseOri(prev => ({ ...prev, [c.name]: (oriIdx + 1) % oriCount }))}
                                title={`${shortOriName(c.oriNames?.[oriIdx] ?? '')} → ${shortOriName(c.oriNames?.[(oriIdx + 1) % oriCount] ?? '')}`}
                              >
                                y
                                <span className="alg-case-y-current">{shortOriName(c.oriNames?.[oriIdx] ?? '')}</span>
                              </button>
                            )}
                          </div>
                          {c.setup && (
                            <div className="alg-case-standard">
                              <Shuffle size={13} className="alg-case-icon" aria-label={isZh ? '打乱' : 'Setup'} />
                              <code>{c.setup}</code>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="alg-case-algs">
                        {algsForOri.map((entry, i) => {
                          const key = `${c.name}::${oriIdx}::${i}`;
                          const expanded = expandedKey === key;
                          return (
                            <AlgRow
                              key={`${entry.altId ?? i}`}
                              alg={entry.alg}
                              expanded={expanded}
                              onToggle={() => setExpandedKey(expanded ? null : key)}
                              animatable={animatable}
                              puzzle={puzzleParam}
                              set={set}
                              setup={oriAdjustSetup(c.setup, oriIdx)}
                            />
                          );
                        })}
                      </div>
                      <CommunityAlgs
                        puzzle={puzzleParam}
                        setSlug={set}
                        caseName={c.name}
                        submissions={submissionsByCase.get(c.name) ?? []}
                        onPatch={(action) => {
                          setSubmissions(prev => {
                            if (action.type === 'add') return [...prev, action.submission];
                            if (action.type === 'update') return prev.map(s => s.id === action.submission.id ? action.submission : s);
                            return prev.filter(s => s.id !== action.id);
                          });
                        }}
                      />
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
