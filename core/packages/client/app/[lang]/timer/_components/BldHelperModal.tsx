'use client';

// 盲拧助手 / BLD helper — cstimer-style inline modal for the timer.
//
// Given the CURRENT 3x3 scramble, shows the Speffz memo letter sequence for
// edges and corners (the lettering you'd memorize), flipped edges / twisted
// corners, and parity — by reusing the existing 3BLD trainer read-engine.
//
// Buffers / borrow order / hue-skip are user-configurable and SHARED with the
// /alg/3bld config (single useBldConfigStore), so a cuber's BLD identity is
// one setting site-wide. Memo letters are cycle-coloured: blue = cycle start,
// green = cycle end (upstream reader.js color:blue / color:green).
//
// REUSES the framework-agnostic pure libs directly (no trainer page UI):
//   codereader(scramble, cfg) -> { edges: LetterCell[], corners, flips, twists }

import { useEffect, useId, useMemo, useState, type JSX } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import BoolToggle from '@/components/BoolToggle';
import { codereader } from '@/app/[lang]/alg/3bld/_lib/read-engine';
import { useBldConfigStore, useBldConfigHydrated } from '@/app/[lang]/alg/3bld/_store/bld-config-store';
import type { LetterCell, CodeReadResult } from '@/app/[lang]/alg/3bld/_lib/types';
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import './bld_helper.css';
import { tr } from '@/i18n/tr';

interface Props {
  scramble: string;
  event: EventId;
  isZh: boolean;
  onClose: () => void;
}

// Upstream chichu buffer letter sets (8 corner / 12 edge buffers).
const CORNER_BUFFERS = ['J', 'A', 'G', 'D', 'W', 'O', 'R', 'X'];
const EDGE_BUFFERS = ['A', 'G', 'E', 'C', 'I', 'K', 'M', 'O', 'Q', 'S', 'W', 'Y'];

const EMPTY_READ: CodeReadResult = { edges: [], corners: [], flips: '', twists: '' };

// 3x3-shaped events use standard WCA 3x3 notation -> the read-engine handles them.
function is3x3Event(event: EventId): boolean {
  return event.startsWith('333');
}

/**
 * 多盲的打乱是多条:生成器输出 `Solve 1 of 3: R U F ...` 每行一条。整串喂给 codereader
 * 只会算出垃圾(或抛异常被吞成空),所以按行拆开,让用户选看第几个魔方。
 * 其余项目(含 WCA 真题源,一次只给一条)只有一行,原样返回单条。
 */
function splitSolves(raw: string): string[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [raw.trim()];
  return lines.map((l) => l.replace(/^Solve\s+\d+\s+of\s+\d+\s*[:：]\s*/i, ''));
}

function cellClass(role: LetterCell['role']): string {
  if (role === 'start') return 'bld-helper-cell-start';
  if (role === 'end') return 'bld-helper-cell-end';
  return '';
}

// Render LetterCell[] grouped in pairs (e.g. "UF DR | KP"), colour-coding the
// cycle start/end stickers. Falls back to a muted "无 / none" when empty.
function Letters({ cells }: { cells: LetterCell[]; isZh: boolean }): JSX.Element {
  if (cells.length === 0) {
    return <span className="bld-helper-empty">{tr({ zh: '无', en: 'none'
    })}</span>;
  }
  const pairs: LetterCell[][] = [];
  for (let i = 0; i < cells.length; i += 2) pairs.push(cells.slice(i, i + 2));
  return (
    <span className="bld-helper-letters">
      {pairs.map((pair, pi) => (
        <span key={pi} className="bld-helper-pair">
          {pair.map((c, ci) => (
            <span key={ci} className={cellClass(c.role)}>{c.letter}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

export default function BldHelperModal({ scramble, event, isZh, onClose }: Props): JSX.Element {
  const titleId = useId();
  const [advOpen, setAdvOpen] = useState(false);

  useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);
  const setConfig = useBldConfigStore((s) => s.setConfig);
  const upper = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const solves = useMemo(() => splitSolves(scramble), [scramble]);
  const [solveIdx, setSolveIdx] = useState(0);
  // 换了打乱(下一题 / 切项目)回到第 1 个,否则会停在上一串里越界的序号上。
  useEffect(() => { setSolveIdx(0); }, [scramble]);

  const trimmed = (solves[Math.min(solveIdx, solves.length - 1)] ?? '').trim();
  const usable = trimmed.length > 0 && is3x3Event(event);

  const read = useMemo<CodeReadResult>(() => {
    if (!usable) return EMPTY_READ;
    try {
      return codereader(trimmed, config);
    } catch {
      return EMPTY_READ;
    }
  }, [trimmed, usable, config]);

  // Parity = odd number of edge targets (the BLD edge/corner swap case).
  const parity = read.edges.length % 2 === 1;

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal bld-helper-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{tr({ zh: '盲拧助手', en: 'BLD helper'
        })}</h2>

        {!usable ? (
          <p className="bld-helper-hint">
            {tr({ zh: '仅 3x3 打乱可用', en: '3x3 scrambles only'
            })}
          </p>
        ) : (
          <>
            <div className="bld-helper-config">
              {/* 多盲:一串打乱含多个魔方,选看第几个。单条项目不渲染这一项。 */}
              {solves.length > 1 && (
                <div className="bld-helper-cfg-field">
                  <label htmlFor="bldh-solve">{tr({ zh: '第几个', en: 'Cube'
                  })}</label>
                  <select
                    className="bld-helper-cfg-select"
                    id="bldh-solve"
                    value={solveIdx}
                    onChange={(e) => setSolveIdx(Number(e.target.value))}
                  >
                    {solves.map((_, i) => (
                      <option key={i} value={i}>{i + 1} / {solves.length}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="bld-helper-cfg-field">
                <label htmlFor="bldh-cbuf">{tr({ zh: '角缓冲', en: 'Corner buffer'
                })}</label>
                <select
                  className="bld-helper-cfg-select"
                  id="bldh-cbuf"
                  value={config.cBuf}
                  onChange={(e) => setConfig({ cBuf: e.target.value })}
                >
                  {CORNER_BUFFERS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="bld-helper-cfg-field">
                <label htmlFor="bldh-ebuf">{tr({ zh: '棱缓冲', en: 'Edge buffer'
                })}</label>
                <select
                  className="bld-helper-cfg-select"
                  id="bldh-ebuf"
                  value={config.eBuf}
                  onChange={(e) => setConfig({ eBuf: e.target.value })}
                >
                  {EDGE_BUFFERS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <button
                type="button"
                className="bld-helper-adv-toggle"
                onClick={() => setAdvOpen((o) => !o)}
                aria-expanded={advOpen}
              >
                {tr({ zh: '高级', en: 'Advanced'
                })}
                {advOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {advOpen && (
              <div className="bld-helper-adv">
                <div className="bld-helper-cfg-field wide">
                  <label htmlFor="bldh-corder">{tr({ zh: '角借位顺序', en: 'Corner order'
                })}</label>
                  <div className="bld-helper-input-wrap">
                    <input
                      className="bld-helper-input"
                      id="bldh-corder"
                      value={config.cOrder}
                      onChange={(e) => setConfig({ cOrder: upper(e.target.value) })}
                      spellCheck={false}
                      autoCapitalize="characters"
                    />
                    {config.cOrder && <ClearButton isZh={isZh} onClick={() => setConfig({ cOrder: '' })} preserveFocus />}
                  </div>
                </div>
                <div className="bld-helper-cfg-field wide">
                  <label htmlFor="bldh-eorder">{tr({ zh: '棱借位顺序', en: 'Edge order'
                })}</label>
                  <div className="bld-helper-input-wrap">
                    <input
                      className="bld-helper-input"
                      id="bldh-eorder"
                      value={config.eOrder}
                      onChange={(e) => setConfig({ eOrder: upper(e.target.value) })}
                      spellCheck={false}
                      autoCapitalize="characters"
                    />
                    {config.eOrder && <ClearButton isZh={isZh} onClick={() => setConfig({ eOrder: '' })} preserveFocus />}
                  </div>
                </div>
                <BoolToggle
                  className="bld-helper-check"
                  value={config.keepHueC}
                  onChange={(v) => setConfig({ keepHueC: v })}
                  label={tr({ zh: '角保持色相', en: 'Corner keep hue' })}
                />
                <BoolToggle
                  className="bld-helper-check"
                  value={config.keepHueE}
                  onChange={(v) => setConfig({ keepHueE: v })}
                  label={tr({ zh: '棱保持色相', en: 'Edge keep hue' })}
                />
                <BoolToggle
                  className="bld-helper-check"
                  value={config.skipC === 1}
                  onChange={(v) => setConfig({ skipC: v ? 1 : 0 })}
                  label={tr({ zh: '角跳编法', en: 'Corner fixed-buffer' })}
                />
                <BoolToggle
                  className="bld-helper-check"
                  value={config.skipE === 1}
                  onChange={(v) => setConfig({ skipE: v ? 1 : 0 })}
                  label={tr({ zh: '棱跳编法', en: 'Edge fixed-buffer' })}
                />
              </div>
            )}

            <div className="bld-helper-sections">
              <div className="bld-helper-section">
                <span className="bld-helper-section-label">{tr({ zh: '棱块', en: 'Edges'
                })}</span>
                <Letters cells={read.edges} isZh={isZh} />
              </div>

              <div className="bld-helper-section">
                <span className="bld-helper-section-label">{tr({ zh: '角块', en: 'Corners'
                })}</span>
                <Letters cells={read.corners} isZh={isZh} />
              </div>
            </div>

            <div className="bld-helper-legend">
              <span className="bld-helper-legend-item">
                <span className="bld-helper-cell-start">A</span>
                {tr({ zh: '循环起点', en: 'cycle start'
                })}
              </span>
              <span className="bld-helper-legend-item">
                <span className="bld-helper-cell-end">A</span>
                {tr({ zh: '循环终点', en: 'cycle end'
                })}
              </span>
            </div>

            <div className="bld-helper-meta">
              <span className="bld-helper-meta-item">
                <span className="bld-helper-meta-key">{tr({ zh: '奇偶', en: 'Parity' })}</span>
                <span className={`bld-helper-meta-val ${parity ? 'is-on' : 'is-off'}`}>
                  {parity ? tr({ zh: '有', en: 'yes' }) : tr({ zh: '无', en: 'no'
                                                      })}
                </span>
              </span>

              <span className="bld-helper-meta-item">
                <span className="bld-helper-meta-key">{tr({ zh: '翻棱', en: 'Edge flips'
                })}</span>
                <span className={`bld-helper-meta-val ${read.flips ? 'is-on' : 'is-off'}`}>
                  {read.flips || tr({ zh: '无', en: 'none'
                                                      })}
                </span>
              </span>

              <span className="bld-helper-meta-item">
                <span className="bld-helper-meta-key">{tr({ zh: '翻角', en: 'Corner twists' })}</span>
                <span className={`bld-helper-meta-val ${read.twists ? 'is-on' : 'is-off'}`}>
                  {read.twists || tr({ zh: '无', en: 'none'
                                                      })}
                </span>
              </span>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="primary modal-action-btn" onClick={onClose}>{tr({ zh: '关闭', en: 'Close'
        })}</button>
        </div>
      </div>
    </div>
  );
}
