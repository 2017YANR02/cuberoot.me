/**
 * VsHistoryPanel — 对战历史面板(2~4 人)
 * 展示各方成绩 + 共享打乱，按轮次倒序排列;胜者(可并列)高亮 + 奖杯
 */

'use client';

import { Fragment, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Swords, Trophy, Download, Trash2 } from 'lucide-react';
import { useBattleStore } from './engine/battle_store';
import { formatTimePlain } from '@/app/[lang]/timer/_shared/format';
import { getEffectiveTimeFromEntry } from '@/app/[lang]/timer/_shared/stats-core';
import { PUZZLES } from './engine/constants';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent } from '@/lib/wca-events';
import type { SolveEntry } from './engine/types';
import { tr } from '@/i18n/tr';

// NOTE: yyyy-mm-dd —— 列表用
function formatDateOnly(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// NOTE: yyyy-mm-dd HH:MM —— 详情 modal 用
function formatDateTime(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const dateStr = formatDateOnly(isoDate);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${dateStr} ${hh}:${mm}`;
}

// NOTE: 某一轮的胜者列表(最小有效成绩,可并列;全 DNF/缺成绩 → 空)
function getRoundWinners(entries: (SolveEntry | undefined)[]): number[] {
  const ts = entries.map(e => (e ? getEffectiveTimeFromEntry(e) : Infinity));
  const min = Math.min(...ts);
  if (min === Infinity) return [];
  return ts.flatMap((t, i) => (t === min ? [i] : []));
}

export default function VsHistoryPanel({ onClose }: { onClose: () => void }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const n = store.playerCount;
  const histories = store.players.slice(0, n).map(p => p.solveHistory);
  const puzzles = store.puzzleIds.slice(0, n);
  const precision = store.timerPrecision;
  const roundCount = Math.max(...histories.map(h => h.length));

  // NOTE: 点击某轮弹出大字详情对话框,而不是 inline 展开
  const [detailRound, setDetailRound] = useState<number | null>(null);

  const ftp = useCallback((ms: number) => formatTimePlain(ms, precision), [precision]);

  const formatEntry = (entry: SolveEntry | undefined) => {
    if (!entry) return '—';
    const eff = getEffectiveTimeFromEntry(entry);
    if (eff === Infinity) return 'DNF';
    return ftp(eff);
  };

  // NOTE: 导出 CSV — 各方 time/penalty/scramble 各占一组列(同 puzzle 时 scramble 相同)
  const exportCSV = () => {
    if (roundCount === 0) return;
    const header = ['#',
      ...Array.from({ length: n }, (_, i) => [`Player${i + 1}(ms)`, `P${i + 1} Penalty`, `P${i + 1} Scramble`]).flat(),
      'Date'].join(',');
    const rows = [];
    for (let i = 0; i < roundCount; i++) {
      const entries = histories.map(h => h[i]);
      const cols = entries.flatMap(e => {
        const t = e ? (getEffectiveTimeFromEntry(e) === Infinity ? 'DNF' : ftp(getEffectiveTimeFromEntry(e))) : '';
        const sc = (e?.scramble || '').replace(/,/g, ';');
        return [t, e?.penalty || '', `"${sc}"`];
      });
      const date = entries.find(e => e?.date)?.date || '';
      rows.push([i + 1, ...cols, date].join(','));
    }
    const csv = header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const puzTag = puzzles.every(p => p === puzzles[0]) ? puzzles[0] : puzzles.join('-vs-');
    a.download = `${n === 2 ? '1v1' : `${n}p`}_${puzTag}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const puzzleName = (id: string) => {
    const p = PUZZLES.find(x => x.id === id);
    return p ? (p.name[(i18n.language.startsWith('zh') ? 'zh' : 'en')] || p.name.en) : id;
  };
  const puzzlesDiffer = puzzles.some(p => p !== puzzles[0]);

  return (
    <div className="history-overlay visible" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="history-panel vs-history-panel">
        <div className="history-header">
          <span className="history-title">
            <Swords size={16} />
            {n === 2 ? '1v1' : `${n}P`} {tr({ zh: '历史', en: 'History'
            })}
            {puzzlesDiffer && (
              <span className="vs-puzzle-tag">
                {puzzles.map((p, i) => ` · P${i + 1}: ${puzzleName(p)}`).join('')}
              </span>
            )}
          </span>
          <span className="history-stats">{roundCount} {tr({ zh: '轮', en: 'rounds'
        })}</span>
          <button className="settings-x-btn" onClick={onClose}>✕</button>
        </div>

        {/* 工具按钮 */}
        <div className="history-tools">
          <button className="history-tool-btn" onClick={exportCSV}>
            <Download size={14} /> CSV
          </button>
        </div>

        {/* 轮次列表 */}
        <div className="history-list">
          {roundCount === 0 && (
            <div className="history-empty">{tr({ zh: '暂无对战记录', en: 'No rounds yet'
            })}</div>
          )}
          {Array.from({ length: roundCount }, (_, i) => roundCount - 1 - i).map(i => {
            const entries = histories.map(h => h[i]);
            const winners = getRoundWinners(entries);
            const dateStr = formatDateOnly(entries.find(e => e?.date)?.date || '');

            return (
              <div
                key={i}
                className="history-item vs-round"
                onClick={() => setDetailRound(i)}
              >
                <span className="h-idx">{i + 1}.</span>
                <span className="vs-times">
                  {entries.map((e, pi) => (
                    <Fragment key={pi}>
                      {pi > 0 && <span className="vs-separator">vs</span>}
                      <span className={`h-time vs-time${winners.includes(pi) ? ' h-best' : ''}`}>
                        {puzzlesDiffer && isWcaEvent(puzzles[pi]) && <EventIcon event={puzzles[pi]} className="vs-event-mini" />}
                        {formatEntry(e)}
                        {winners.includes(pi) && <Trophy size={12} className="vs-trophy" />}
                      </span>
                    </Fragment>
                  ))}
                </span>
                <span className="h-date">{dateStr}</span>
                <button
                  type="button"
                  className="h-delete"
                  title={tr({ zh: '删除此轮', en: 'Delete round'
                })}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.deleteVsRound(i);
                  }}
                ><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 单轮详情弹窗 — 大字方便看 */}
      {detailRound !== null && (
        <RoundDetailModal
          roundIndex={detailRound}
          entries={histories.map(h => h[detailRound])}
          puzzles={puzzles}
          isZh={isZh}
          ftp={ftp}
          onClose={() => setDetailRound(null)}
          onDelete={() => {
            store.deleteVsRound(detailRound);
            setDetailRound(null);
          }}
        />
      )}
    </div>
  );
}

// ===== RoundDetailModal — 单轮大字详情 =====

interface RoundDetailModalProps {
  roundIndex: number;
  entries: (SolveEntry | undefined)[];
  puzzles: string[];
  isZh: boolean;
  ftp: (ms: number) => string;
  onClose: () => void;
  onDelete: () => void;
}

function RoundDetailModal({
  roundIndex, entries, puzzles, isZh, ftp, onClose, onDelete,
}: RoundDetailModalProps) {
  const winners = getRoundWinners(entries);
  const dateStr = formatDateTime(entries.find(e => e?.date)?.date || '');

  // NOTE: 相同打乱合并展示(同 puzzle 共享打乱时只显示一条)
  const scrambleGroups: Array<[string, number[]]> = [];
  entries.forEach((e, pi) => {
    const sc = e?.scramble;
    if (!sc) return;
    const g = scrambleGroups.find(([s]) => s === sc);
    if (g) g[1].push(pi);
    else scrambleGroups.push([sc, [pi]]);
  });

  const renderTime = (e: SolveEntry | undefined) => {
    if (!e) return '—';
    const eff = getEffectiveTimeFromEntry(e);
    if (eff === Infinity) return 'DNF';
    return ftp(eff);
  };

  return (
    <div className="round-modal-overlay" onClick={(ev) => {
      if (ev.target === ev.currentTarget) onClose();
    }}>
      <div className="round-modal">
        <div className="round-modal-header">
          <span className="round-modal-title">
            {(isZh ? `第 ${roundIndex + 1} 轮` : `Round ${roundIndex + 1}`)}
            {dateStr && <span className="round-modal-date"> · {dateStr}</span>}
          </span>
          <button className="settings-x-btn" onClick={onClose}>✕</button>
        </div>

        <div className="round-modal-times">
          {entries.map((e, pi) => (
            <div key={pi} className={`round-modal-side${winners.includes(pi) ? ' is-winner' : ''}`}>
              <div className="round-modal-pid">
                {isWcaEvent(puzzles[pi]) && <EventIcon event={puzzles[pi]} className="round-modal-event" />}
                <span>P{pi + 1}</span>
              </div>
              <div className="round-modal-time-row">
                <span className="round-modal-time">{renderTime(e)}</span>
                {winners.includes(pi) && <Trophy size={20} className="vs-trophy" />}
              </div>
              {e?.penalty === '+2' && <div className="round-modal-penalty">+2</div>}
            </div>
          ))}
        </div>

        <div className="round-modal-scrambles">
          {scrambleGroups.map(([sc, idxs]) => (
            <div className="round-modal-scramble-block" key={sc}>
              <div className="round-modal-scramble-label">
                {scrambleGroups.length > 1 ? `${idxs.map(i => `P${i + 1}`).join(' / ')} ` : ''}
                {tr({ zh: '打乱', en: 'Scramble'
                })}
              </div>
              <div className="round-modal-scramble-text">{sc}</div>
            </div>
          ))}
        </div>

        <div className="round-modal-actions">
          <button
            type="button"
            className="round-modal-delete"
            onClick={onDelete}
            title={tr({ zh: '删除此轮', en: 'Delete round'
            })}
            aria-label={tr({ zh: '删除此轮', en: 'Delete round'
            })}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
