/**
 * VsHistoryPanel — 1v1 对战历史面板
 * 展示双方成绩 + 共享打乱，按轮次倒序排列
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Swords, Trophy, Download } from 'lucide-react';
import { useBattleStore } from './engine/battle_store';
import { formatTimePlain } from './engine/format_time';
import { getEffectiveTimeFromEntry } from './engine/stats';
import { PUZZLES } from './engine/constants';
import type { SolveEntry } from './engine/types';

function formatRelativeDate(isoDate: string, isZh: boolean): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  if (diff === 0) return timeStr;
  if (diff === 1) return (isZh ? '昨天 ' : 'Yesterday ') + timeStr;
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + timeStr;
}

export default function VsHistoryPanel({ onClose }: { onClose: () => void }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const h0 = store.players[0].solveHistory;
  const h1 = store.players[1].solveHistory;
  const precision = store.timerPrecision;
  const roundCount = Math.max(h0.length, h1.length);

  // NOTE: 展开打乱的轮次索引
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  const ftp = useCallback((ms: number) => formatTimePlain(ms, precision), [precision]);

  const toggleExpand = (idx: number) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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

  // NOTE: 导出 CSV
  const exportCSV = () => {
    if (roundCount === 0) return;
    const header = '#,Player1(ms),P1 Penalty,Player2(ms),P2 Penalty,Scramble,Date';
    const rows = [];
    for (let i = 0; i < roundCount; i++) {
      const e0 = h0[i];
      const e1 = h1[i];
      const t0 = e0 ? (getEffectiveTimeFromEntry(e0) === Infinity ? 'DNF' : ftp(getEffectiveTimeFromEntry(e0))) : '';
      const t1 = e1 ? (getEffectiveTimeFromEntry(e1) === Infinity ? 'DNF' : ftp(getEffectiveTimeFromEntry(e1))) : '';
      const scramble = (e0?.scramble || e1?.scramble || '').replace(/,/g, ';');
      const date = e0?.date || e1?.date || '';
      rows.push(`${i + 1},${t0},${e0?.penalty || ''},${t1},${e1?.penalty || ''},"${scramble}",${date}`);
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
    return p ? (p.name[isZh ? 'zh' : 'en'] || p.name.en) : id;
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
            1v1 {isZh ? '历史' : 'History'}
            {puzzlesDiffer && (
              <span className="vs-puzzle-tag"> · P1: {puzzleName(store.puzzleIds[0])} · P2: {puzzleName(store.puzzleIds[1])}</span>
            )}
          </span>
          <span className="history-stats">{roundCount} {isZh ? '轮' : 'rounds'}</span>
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
            <div className="history-empty">{isZh ? '暂无对战记录' : 'No rounds yet'}</div>
          )}
          {Array.from({ length: roundCount }, (_, i) => roundCount - 1 - i).map(i => {
            const e0 = h0[i];
            const e1 = h1[i];
            const winner = getWinner(e0, e1);
            const scramble = e0?.scramble || e1?.scramble || '';
            const dateStr = e0?.date ? formatRelativeDate(e0.date, isZh) : '';
            const isExpanded = expandedSet.has(i);

            return (
              <div
                key={i}
                className={`history-item vs-round${isExpanded ? ' expanded' : ''}`}
                onClick={() => toggleExpand(i)}
              >
                <span className="h-idx">{i + 1}.</span>
                <span className={`h-time vs-p1${winner === 0 ? ' h-best' : ''}`}>
                  {formatEntry(e0)}
                  {winner === 0 && <Trophy size={12} className="vs-trophy" />}
                </span>
                <span className="vs-separator">vs</span>
                <span className={`h-time vs-p2${winner === 1 ? ' h-best' : ''}`}>
                  {formatEntry(e1)}
                  {winner === 1 && <Trophy size={12} className="vs-trophy" />}
                </span>
                <span className="h-date">{dateStr}</span>
                <span className="h-scramble">{scramble}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
