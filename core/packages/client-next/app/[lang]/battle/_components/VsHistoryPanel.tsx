/**
 * VsHistoryPanel — 1v1 对战历史面板
 * 展示双方成绩 + 共享打乱，按轮次倒序排列
 */

'use client';

import { useState, useCallback } from 'react';
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
import i18n from '@/i18n/i18n-client';

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

export default function VsHistoryPanel({ onClose }: { onClose: () => void }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const h0 = store.players[0].solveHistory;
  const h1 = store.players[1].solveHistory;
  const precision = store.timerPrecision;
  const roundCount = Math.max(h0.length, h1.length);

  // NOTE: 点击某轮弹出大字详情对话框,而不是 inline 展开
  const [detailRound, setDetailRound] = useState<number | null>(null);

  const ftp = useCallback((ms: number) => formatTimePlain(ms, precision), [precision]);

  const formatEntry = (entry: SolveEntry | undefined) => {
    if (!entry) return '—';
    const eff = getEffectiveTimeFromEntry(entry);
    if (eff === Infinity) return 'DNF';
    return ftp(eff);
  };

  const getWinner = (e0: SolveEntry | undefined, e1: SolveEntry | undefined): number => {
    if (!e0 || !e1) return -2;
    const t0 = getEffectiveTimeFromEntry(e0);
    const t1 = getEffectiveTimeFromEntry(e1);
    if (t0 === Infinity && t1 === Infinity) return -2;
    if (t0 < t1) return 0;
    if (t1 < t0) return 1;
    return -1; // tie
  };

  // NOTE: 导出 CSV — 双方 scramble 各占一列(同 puzzle 时两列值相同)
  const exportCSV = () => {
    if (roundCount === 0) return;
    const header = '#,Player1(ms),P1 Penalty,P1 Scramble,Player2(ms),P2 Penalty,P2 Scramble,Date';
    const rows = [];
    for (let i = 0; i < roundCount; i++) {
      const e0 = h0[i];
      const e1 = h1[i];
      const t0 = e0 ? (getEffectiveTimeFromEntry(e0) === Infinity ? 'DNF' : ftp(getEffectiveTimeFromEntry(e0))) : '';
      const t1 = e1 ? (getEffectiveTimeFromEntry(e1) === Infinity ? 'DNF' : ftp(getEffectiveTimeFromEntry(e1))) : '';
      const s0 = (e0?.scramble || '').replace(/,/g, ';');
      const s1 = (e1?.scramble || '').replace(/,/g, ';');
      const date = e0?.date || e1?.date || '';
      rows.push(`${i + 1},${t0},${e0?.penalty || ''},"${s0}",${t1},${e1?.penalty || ''},"${s1}",${date}`);
    }
    const csv = header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const puzTag = store.puzzleIds[0] === store.puzzleIds[1]
      ? store.puzzleIds[0]
      : `${store.puzzleIds[0]}-vs-${store.puzzleIds[1]}`;
    a.download = `1v1_${puzTag}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const puzzleName = (id: string) => {
    const p = PUZZLES.find(x => x.id === id);
    return p ? (p.name[(i18n.language.startsWith('zh') ? 'zh' : 'en')] || p.name.en) : id;
  };
  const puzzlesDiffer = store.puzzleIds[0] !== store.puzzleIds[1];

  return (
    <div className="history-overlay visible" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="history-panel vs-history-panel">
        <div className="history-header">
          <span className="history-title">
            <Swords size={16} />
            1v1 {tr({ zh: '历史', en: 'History',
                zhHant: "歷史"
            })}
            {puzzlesDiffer && (
              <span className="vs-puzzle-tag"> · P1: {puzzleName(store.puzzleIds[0])} · P2: {puzzleName(store.puzzleIds[1])}</span>
            )}
          </span>
          <span className="history-stats">{roundCount} {tr({ zh: '轮', en: 'rounds',
              zhHant: "輪"
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
            <div className="history-empty">{tr({ zh: '暂无双人记录', en: 'No rounds yet',
                zhHant: "暫無雙人記錄"
            })}</div>
          )}
          {Array.from({ length: roundCount }, (_, i) => roundCount - 1 - i).map(i => {
            const e0 = h0[i];
            const e1 = h1[i];
            const winner = getWinner(e0, e1);
            const dateStr = e0?.date ? formatDateOnly(e0.date) : (e1?.date ? formatDateOnly(e1.date) : '');

            // NOTE: 当前两人 puzzle id(展示行内 EventIcon 用,不依赖历史的 entry)
            const puz0 = store.puzzleIds[0];
            const puz1 = store.puzzleIds[1];

            return (
              <div
                key={i}
                className="history-item vs-round"
                onClick={() => setDetailRound(i)}
              >
                <span className="h-idx">{i + 1}.</span>
                <span className={`h-time vs-p1${winner === 0 ? ' h-best' : ''}`}>
                  {puzzlesDiffer && isWcaEvent(puz0) && <EventIcon event={puz0} className="vs-event-mini" />}
                  {formatEntry(e0)}
                  {winner === 0 && <Trophy size={12} className="vs-trophy" />}
                </span>
                <span className="vs-separator">vs</span>
                <span className={`h-time vs-p2${winner === 1 ? ' h-best' : ''}`}>
                  {puzzlesDiffer && isWcaEvent(puz1) && <EventIcon event={puz1} className="vs-event-mini" />}
                  {formatEntry(e1)}
                  {winner === 1 && <Trophy size={12} className="vs-trophy" />}
                </span>
                <span className="h-date">{dateStr}</span>
                <button
                  type="button"
                  className="h-delete"
                  title={tr({ zh: '删除此轮', en: 'Delete round',
                      zhHant: "刪除此輪"
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
          h0={h0}
          h1={h1}
          puz0={store.puzzleIds[0]}
          puz1={store.puzzleIds[1]}
          isZh={isZh}
          ftp={ftp}
          getWinner={getWinner}
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
  h0: SolveEntry[];
  h1: SolveEntry[];
  puz0: string;
  puz1: string;
  isZh: boolean;
  ftp: (ms: number) => string;
  getWinner: (e0: SolveEntry | undefined, e1: SolveEntry | undefined) => number;
  onClose: () => void;
  onDelete: () => void;
}

function RoundDetailModal({
  roundIndex, h0, h1, puz0, puz1, isZh, ftp, getWinner, onClose, onDelete,
}: RoundDetailModalProps) {
  const e0 = h0[roundIndex];
  const e1 = h1[roundIndex];
  const winner = getWinner(e0, e1);
  const s0 = e0?.scramble || '';
  const s1 = e1?.scramble || '';
  const sameScramble = s0 && s1 ? s0 === s1 : true;
  const dateStr = e0?.date ? formatDateTime(e0.date) : (e1?.date ? formatDateTime(e1.date) : '');

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
            {i18n.language === 'zh-Hant' ? (`第 ${roundIndex + 1} 輪`) : (isZh ? `第 ${roundIndex + 1} 轮` : `Round ${roundIndex + 1}`)}
            {dateStr && <span className="round-modal-date"> · {dateStr}</span>}
          </span>
          <button className="settings-x-btn" onClick={onClose}>✕</button>
        </div>

        <div className="round-modal-times">
          <div className={`round-modal-side${winner === 0 ? ' is-winner' : ''}`}>
            <div className="round-modal-pid">
              {isWcaEvent(puz0) && <EventIcon event={puz0} className="round-modal-event" />}
              <span>P1</span>
            </div>
            <div className="round-modal-time-row">
              <span className="round-modal-time">{renderTime(e0)}</span>
              {winner === 0 && <Trophy size={20} className="vs-trophy" />}
            </div>
            {e0?.penalty === '+2' && <div className="round-modal-penalty">+2</div>}
          </div>
          <div className="round-modal-vs">vs</div>
          <div className={`round-modal-side${winner === 1 ? ' is-winner' : ''}`}>
            <div className="round-modal-pid">
              {isWcaEvent(puz1) && <EventIcon event={puz1} className="round-modal-event" />}
              <span>P2</span>
            </div>
            <div className="round-modal-time-row">
              <span className="round-modal-time">{renderTime(e1)}</span>
              {winner === 1 && <Trophy size={20} className="vs-trophy" />}
            </div>
            {e1?.penalty === '+2' && <div className="round-modal-penalty">+2</div>}
          </div>
        </div>

        <div className="round-modal-scrambles">
          {sameScramble ? (
            s0 || s1 ? (
              <div className="round-modal-scramble-block">
                <div className="round-modal-scramble-label">{tr({ zh: '打乱', en: 'Scramble',
                    zhHant: "打亂"
                })}</div>
                <div className="round-modal-scramble-text">{s0 || s1}</div>
              </div>
            ) : null
          ) : (
            <>
              {s0 && (
                <div className="round-modal-scramble-block">
                  <div className="round-modal-scramble-label">P1{isWcaEvent(puz0) ? ' ' : ''}{tr({ zh: '打乱', en: 'Scramble',
                      zhHant: "打亂"
                })}</div>
                  <div className="round-modal-scramble-text">{s0}</div>
                </div>
              )}
              {s1 && (
                <div className="round-modal-scramble-block">
                  <div className="round-modal-scramble-label">P2{isWcaEvent(puz1) ? ' ' : ''}{tr({ zh: '打乱', en: 'Scramble',
                      zhHant: "打亂"
                })}</div>
                  <div className="round-modal-scramble-text">{s1}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="round-modal-actions">
          <button
            type="button"
            className="round-modal-delete"
            onClick={onDelete}
            title={tr({ zh: '删除此轮', en: 'Delete round',
                zhHant: "刪除此輪"
            })}
            aria-label={tr({ zh: '删除此轮', en: 'Delete round',
                zhHant: "刪除此輪"
            })}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
