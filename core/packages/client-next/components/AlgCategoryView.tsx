'use client';

/**
 * AlgCategoryView — read-only port of packages/client/src/pages/alg/AlgCategoryPage.tsx.
 *
 * Drops from the Vite version (deferred to later phases):
 *   - Admin features (AdminCaseEditor / ValidationReportModal / dnd-kit reorder)
 *   - CommunityAlgs sub-rendering
 *   - AlgPlayer (cubing.js TwistyPlayer) — alg rows still copy on click,
 *     but no inline 3D animation playback
 *
 * Keeps: subgroup picker (umbrella sets), second-level picker, ori switcher,
 * per-case ori cycle, subgroup collapse, sticker/setup/HTML alg rendering.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Shuffle } from 'lucide-react';
import {
  loadAlg, getAlgSetMeta, ALG_PUZZLES,
  type AlgCase, type AlgFile, type AlgPuzzle,
} from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { CaseThumb } from '@/components/CaseThumb';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const ORI_SUFFIX = ['', 'y', 'y2', "y'"];
function oriAdjustSetup(setup: string, oriIdx: number): string {
  if (!setup || oriIdx === 0) return setup;
  return `${setup} ${ORI_SUFFIX[oriIdx]}`;
}

function shortOriName(name: string): string {
  const map: Record<string, string> = {
    'Front Right': 'FR', 'Front Left': 'FL', 'Back Left': 'BL', 'Back Right': 'BR',
  };
  return map[name] ?? name;
}

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

const ALG_HTML_TAG_WHITELIST = new Set(['u', 's', 'em', 'strong', 'sub', 'sup']);
function sanitizeAlgHtml(html: string): string {
  return html.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (_full, slash, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALG_HTML_TAG_WHITELIST.has(t)) return '';
    if (slash) return `</${t}>`;
    if (t === 'u' && /\bclass\s*=\s*["']?wavy["']?/i.test(attrs)) return '<u class="wavy">';
    return `<${t}>`;
  });
}

function AlgRow({ alg, algHtml, puzzle }: { alg: string; algHtml?: string; puzzle: AlgPuzzle }) {
  const [copied, setCopied] = useState(false);
  const algShown = formatScrambleForEvent(puzzle, alg);
  return (
    <div
      role="button"
      tabIndex={0}
      className="alg-alg-row"
      onClick={() => {
        navigator.clipboard.writeText(algShown).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigator.clipboard.writeText(algShown).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }
      }}
      title="copy"
    >
      {algHtml && puzzle !== 'sq1'
        ? <span className="alg-alg-text" dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(algHtml) }} />
        : <span className="alg-alg-text">{algShown}</span>}
      <button
        type="button"
        className="alg-alg-copy-btn"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(algShown).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        title="copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
      </button>
    </div>
  );
}

function SubgroupIndex({
  puzzle, set, cases, isZh,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  isZh: boolean;
}) {
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

  const useF2lThumb = puzzle === '3x3' && set === 'zbls';

  return (
    <div className={`alg-subgroup-grid${useF2lThumb ? ' is-f2l-thumb' : ''}`}>
      {groups.map(([topLabel, { sample, count }]) => {
        const firstAlg = sample.algs.flat()[0]?.alg ?? sample.standard ?? '';
        const slug = encodeURIComponent(topLabel.toLowerCase()) || '_';
        return (
          <Link
            key={topLabel || '_root_'}
            href={`/alg/${puzzle}/${set}/${slug}`}
            className="alg-subgroup-card"
          >
            <div className="alg-subgroup-thumb">
              {useF2lThumb
                ? <CaseThumb puzzle={puzzle} set={set} sticker={sample.sticker} alg={firstAlg} setup={sample.setup} size={110} />
                : <VisualCube algorithm={firstAlg} view="oll" size={120} />}
            </div>
            <div className="alg-subgroup-card-title">{useF2lThumb ? (topLabel || (tr({ zh: '其他', en: 'Other' }))) : `${set.toUpperCase()} ${topLabel || (tr({ zh: '其他', en: 'Other' }))}`}</div>
            <div className="alg-subgroup-card-count">{count} {tr({ zh: '个', en: 'cases',
                zhHant: "個"
            })}</div>
          </Link>
        );
      })}
    </div>
  );
}

export interface AlgCategoryViewProps {
  puzzleParam: string;
  set: string;
  subgroupParam?: string;
}

export default function AlgCategoryView({ puzzleParam, set, subgroupParam }: AlgCategoryViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const validPuzzle = isPuzzle(puzzleParam);
  const meta = validPuzzle ? getAlgSetMeta(puzzleParam, set) : undefined;
  const algSetTitle = (() => {
    const fallback = tr({ zh: '公式库', en: 'Algorithms',
        zhHant: "公式庫"
    });
    if (!puzzleParam || !set) return fallback;
    const setName = meta ? ((i18n.language === 'zh-Hant' ? ((meta as { zhHant?: string }).zhHant ?? meta.zh) : (i18n.language.startsWith('zh') ? meta.zh : meta.en))) : set;
    return `${puzzleParam} · ${setName}`;
  })();
  useDocumentTitle(algSetTitle, algSetTitle);
  const [data, setData] = useState<AlgFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOri, setActiveOri] = useState(0);
  const [caseOri, setCaseOri] = useState<Record<string, number>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!validPuzzle || !meta) { setError('unknown set'); setData(null); return; }
    setError(null);
    setData(null);
    loadAlg(puzzleParam, set).then(d => {
      setData(d);
      if (d.cases.length > 100 && !meta.umbrella) {
        const groups = new Set<string>();
        for (const c of d.cases) groups.add(c.subgroup || '');
        setCollapsedGroups(groups);
      } else {
        setCollapsedGroups(new Set());
      }
    }).catch(e => setError(String(e)));
  }, [puzzleParam, set, validPuzzle, meta]);

  const subgroupSlug = subgroupParam ? decodeURIComponent(subgroupParam).toLowerCase() : null;
  const slugLevel: 'top' | 'sub' | null = useMemo(() => {
    if (!subgroupSlug || !data) return null;
    for (const c of data.cases) {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (parts[0] === subgroupSlug) return 'top';
      if (parts[1] === subgroupSlug) return 'sub';
    }
    return null;
  }, [data, subgroupSlug]);

  const subParentSlug = useMemo(() => {
    if (!data || slugLevel !== 'sub' || !subgroupSlug) return null;
    for (const c of data.cases) {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (parts[1] === subgroupSlug) return parts[0];
    }
    return null;
  }, [data, slugLevel, subgroupSlug]);

  const visibleCases = useMemo(() => {
    if (!data) return [];
    if (!subgroupSlug) return data.cases;
    return data.cases.filter(c => {
      const parts = (c.subgroup || '').toLowerCase().split('/');
      if (slugLevel === 'top') return parts[0] === subgroupSlug;
      if (slugLevel === 'sub') return parts[1] === subgroupSlug;
      return false;
    });
  }, [data, subgroupSlug, slugLevel]);

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

  const showSubgroupPicker = !!meta.umbrella && !subgroupParam;

  const subSubgroups = useMemo(() => {
    if (!meta.umbrella || slugLevel !== 'top') return [];
    const map = new Map<string, { sample: AlgCase; count: number }>();
    for (const c of visibleCases) {
      const parts = (c.subgroup || '').split('/');
      if (parts.length < 2) continue;
      const sub = parts[1];
      const e = map.get(sub);
      if (e) e.count++;
      else map.set(sub, { sample: c, count: 1 });
    }
    return Array.from(map.entries());
  }, [visibleCases, slugLevel, meta.umbrella]);
  const showSubSubgroupPicker = subSubgroups.length > 1;

  const backTo = slugLevel === 'sub' && subParentSlug
    ? `/alg/${puzzleParam}/${set}/${subParentSlug}`
    : subgroupParam
      ? `/alg/${puzzleParam}/${set}`
      : `/alg/${puzzleParam}`;

  const subgroupDisplay = (
    slugLevel === 'sub' && subParentSlug && subgroupSlug
      ? `${subParentSlug.toUpperCase()} · ${subgroupSlug.toUpperCase()}`
      : subgroupSlug
        ? subgroupSlug.toUpperCase()
        : ''
  );

  const toggleGroup = (g: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href={backTo} className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <h1 className="alg-cat-title">
          <span className="alg-cat-puzzle">{puzzleParam}</span>
          {' '}
          {(i18n.language === 'zh-Hant' ? ((meta as { zhHant?: string }).zhHant ?? meta.zh) : (i18n.language.startsWith('zh') ? meta.zh : meta.en))}
          {subgroupDisplay && <span className="alg-cat-subgroup"> {subgroupDisplay}</span>}
        </h1>
        {data && !showSubgroupPicker && (
          <span className="alg-cat-count">{visibleCases.length} {tr({ zh: '个', en: 'cases',
              zhHant: "個"
        })}</span>
        )}
      </div>

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
      {!data && !error && <div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…',
          zhHant: "載入中…"
    })}</div>}

      {data && showSubgroupPicker && (
        <SubgroupIndex puzzle={puzzleParam as AlgPuzzle} set={set} cases={data.cases} isZh={isZh} />
      )}

      {data && showSubSubgroupPicker && (() => {
        const LEVEL2_PICKER_MASK: Record<string, string> = {
          zbll: 'coll', '1lll': 'coll', ollcp: 'coll',
        };
        const pickerMask = LEVEL2_PICKER_MASK[set];
        return (
          <div className="alg-subgroup-grid">
            {subSubgroups.map(([subLabel, { sample, count }]) => {
              const firstAlg = sample.algs.flat()[0]?.alg ?? sample.standard ?? '';
              const sub2Slug = encodeURIComponent(subLabel.toLowerCase());
              return (
                <Link
                  key={subLabel}
                  href={`/alg/${puzzleParam}/${set}/${sub2Slug}`}
                  className="alg-subgroup-card"
                >
                  <div className="alg-subgroup-thumb">
                    <CaseThumb
                      puzzle={puzzleParam as AlgPuzzle}
                      set={set}
                      sticker={sample.sticker}
                      alg={firstAlg}
                      setup={sample.setup}
                      size={120}
                      mask={pickerMask}
                    />
                  </div>
                  <div className="alg-subgroup-card-title">{subLabel}</div>
                  <div className="alg-subgroup-card-count">{count} {tr({ zh: '个', en: 'cases',
                      zhHant: "個"
                })}</div>
                </Link>
              );
            })}
          </div>
        );
      })()}

      {data && !showSubgroupPicker && !showSubSubgroupPicker && grouped.map(([subgroup, cases]) => {
        const collapsed = collapsedGroups.has(subgroup);
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
                {subgroup || (tr({ zh: '其他', en: 'Other' }))}
                <span className="alg-subgroup-count">{cases.length}</span>
              </h2>
            )}
            {!collapsed && (
              <div className="alg-case-list">
                {cases.map(c => {
                  const rawOri = caseOri[c.name] ?? activeOri;
                  const oriIdx = rawOri < c.algs.length ? rawOri : 0;
                  const algsForOri = c.algs[oriIdx] ?? c.algs[0] ?? [];
                  const oriCount = c.algs.length;
                  const firstAlg = algsForOri[0]?.alg ?? c.standard ?? '';
                  return (
                    <article key={c.id ?? c.name} className="alg-case">
                      <div className="alg-case-head">
                        <div className="alg-case-cube">
                          <CaseThumb
                            puzzle={puzzleParam as AlgPuzzle}
                            set={set}
                            sticker={c.sticker}
                            alg={firstAlg || c.setup || ''}
                            setup={oriAdjustSetup(c.setup, oriIdx)}
                          />
                        </div>
                        <div className="alg-case-info">
                          <div className="alg-case-name">
                            <span className="alg-case-letter">{c.name}</span>
                            {c.number != null && <span className="alg-case-index">#{c.number}</span>}
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
                              <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup',
                                  zhHant: "打亂"
                            })} />
                              <code>{formatScrambleForEvent(puzzleParam, c.setup)}</code>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="alg-case-algs">
                        {algsForOri.map((entry, i) => (
                          <AlgRow
                            key={`${entry.altId ?? i}`}
                            alg={entry.alg}
                            algHtml={entry.algHtml}
                            puzzle={puzzleParam as AlgPuzzle}
                          />
                        ))}
                      </div>
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
