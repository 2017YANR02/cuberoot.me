/**
 * VsHistoryPanel — 对战历史面板(2~4 人)
 * 展示各方成绩 + 共享打乱，按轮次倒序排列;胜者(可并列)高亮 + 奖杯
 */

'use client';

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Download, Trash2, Waypoints } from 'lucide-react';
import {
  useBattleStore,
  battleToTimerEvent,
  timerToBattleEvent,
  filterUnpairedLegacyBattleRecords,
  loadLegacyBattleRecords,
  type LegacyBattleRecord,
} from './engine/battle_store';
import { battleReconIndex, battleReconKey } from '@/app/[lang]/timer/_lib/storage/db';
import { csvEscape } from '@/app/[lang]/timer/_lib/storage/import_export';
import ReconstructModal from '@/app/[lang]/timer/_components/ReconstructModal';
import { eventInfo, type EventId, type Solve } from '@/app/[lang]/timer/_lib/types';
import { formatTimePlain } from '@/app/[lang]/timer/_shared/format';
import { getEffectiveTimeFromEntry } from '@/app/[lang]/timer/_shared/stats-core';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import { effectiveMs, type LocalBattleRound } from '@cuberoot/shared/timer';

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

// NOTE: 相同打乱只展示一遍;不同项目 / 不同打乱保留对应玩家编号。
function groupRoundScrambles(entries: (Solve | undefined)[]): Array<{
  event: EventId;
  scramble: string;
  playerIndexes: number[];
}> {
  const groups: Array<{ event: EventId; scramble: string; playerIndexes: number[] }> = [];
  entries.forEach((entry, playerIndex) => {
    const scramble = entry?.scramble;
    if (!entry || !scramble) return;
    const group = groups.find((candidate) => (
      candidate.event === entry.event && candidate.scramble === scramble
    ));
    if (group) group.playerIndexes.push(playerIndex);
    else groups.push({ event: entry.event, scramble, playerIndexes: [playerIndex] });
  });
  return groups;
}

function roundPlayers(round: LocalBattleRound, width: number): {
  entries: Array<Solve | undefined>;
  puzzles: string[];
} {
  const attempts = new Map(round.attempts.map((attempt) => [attempt.playerId, attempt.solve]));
  const entries = Array.from({ length: width }, (_, playerId) => attempts.get(playerId));
  return {
    entries,
    puzzles: entries.map((solve) => (solve ? timerToBattleEvent(solve.event) : '')),
  };
}

export function buildLocalBattleCsv(
  rounds: readonly LocalBattleRound[],
  legacyRecords: readonly LegacyBattleRecord[],
  minimumPlayers: number,
): string {
  const width = Math.max(
    minimumPlayers,
    ...rounds.map((round) => Math.max(...round.attempts.map((attempt) => attempt.playerId)) + 1),
    ...legacyRecords.map((record) => record.playerId + 1),
  );
  const header = ['#', 'Round ID',
    ...Array.from({ length: width }, (_, i) => [`P${i + 1} Event`, `Player${i + 1}(ms)`, `P${i + 1} Penalty`, `P${i + 1} Scramble`]).flat(),
    'Date'];
  const rows: string[][] = [];
  for (let i = 0; i < rounds.length; i++) {
    const { entries } = roundPlayers(rounds[i], width);
    const cols = entries.flatMap((entry) => [
      entry?.event || '',
      entry ? String(entry.timeMs) : '',
      entry?.penalty || '',
      entry?.scramble || '',
    ]);
    const firstEntry = entries.find((entry): entry is Solve => entry !== undefined);
    rows.push([
      String(i + 1),
      rounds[i].id,
      ...cols,
      firstEntry ? new Date(firstEntry.ts).toISOString() : '',
    ]);
  }
  for (const record of legacyRecords) {
    const cols = Array.from({ length: width }, (_, playerId) => (
      playerId === record.playerId
        ? [record.event, String(record.entry.time), record.entry.penalty, record.entry.scramble]
        : ['', '', '', '']
    )).flat();
    rows.push(['legacy', '', ...cols, record.entry.date]);
  }
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map((field) => csvEscape(field)).join(','))
    .join('\r\n')}\r\n`;
}

export default function VsHistoryPanel({ onClose }: { onClose: () => void }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const n = store.playerCount;
  const rounds = store.battleRounds;
  const legacyHistory = useMemo(() => {
    const loaded = loadLegacyBattleRecords(store.sessionId);
    const records = filterUnpairedLegacyBattleRecords(loaded.records, rounds);
    return { records, skippedKeys: loaded.skippedKeys };
  }, [rounds, store.sessionId]);
  const unpairedLegacyRecords = legacyHistory.records;
  const maxPlayers = Math.max(n, ...rounds.map((round) => (
    Math.max(-1, ...round.attempts.map((attempt) => attempt.playerId)) + 1
  )), ...unpairedLegacyRecords.map((record) => (
    record.playerId + 1
  )));
  const allPuzzles = Array.from(new Set(rounds.flatMap((round) => (
    round.attempts.map((attempt) => timerToBattleEvent(attempt.solve.event))
  )).concat(unpairedLegacyRecords.map((record) => timerToBattleEvent(record.event)))));
  const precision = store.timerPrecision;
  const roundCount = rounds.length;

  // NOTE: 点击某轮弹出大字详情对话框,而不是 inline 展开
  const [detailRound, setDetailRound] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    panelRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const ftp = useCallback((ms: number) => formatTimePlain(ms, precision), [precision]);

  const formatEntry = (entry: Solve | undefined) => {
    if (!entry) return '—';
    const eff = effectiveMs(entry);
    if (eff === Infinity) return 'DNF';
    return ftp(eff);
  };

  // NOTE: 导出 CSV — 各方 time/penalty/scramble 各占一组列(同 puzzle 时 scramble 相同)
  const exportCSV = () => {
    if (roundCount === 0 && unpairedLegacyRecords.length === 0) return;
    const csv = buildLocalBattleCsv(rounds, unpairedLegacyRecords, maxPlayers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const puzTag = allPuzzles.length === 1 ? allPuzzles[0] : (allPuzzles.join('-vs-') || 'battle');
    a.download = `local-battle_${puzTag}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detail = detailRound !== null && rounds[detailRound]
    ? { round: rounds[detailRound], ...roundPlayers(
        rounds[detailRound],
        Math.max(...rounds[detailRound].attempts.map((attempt) => attempt.playerId)) + 1,
      ) }
    : null;
  return (
    <div className="history-overlay visible" data-no-timer onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }} onKeyDown={(event) => {
      if (event.key === 'Escape' && detailRound === null) {
        event.stopPropagation();
        onClose();
      }
    }}>
      <div
        ref={panelRef}
        className="history-panel vs-history-panel"
        role="dialog"
        aria-modal="true"
        aria-label={tr({ zh: '本地对战历史', en: 'Local battle history' })}
        tabIndex={-1}
      >
        <div className="history-header">
          <span className="history-title">
            {tr({ zh: '本地对战历史', en: 'Local battle history' })}
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

        {store.battleHistoryWarning && (
          <div className="history-empty" role="alert">
            {store.battleHistoryWarning === 'corrupt'
              ? tr({
                  zh: '部分旧对战历史已损坏；原始恢复副本已保留，下方只显示验证通过的轮次。请先导出 CSV。',
                  en: 'Some older battle history is damaged. A raw recovery copy was kept; only verified rounds are shown below. Export CSV before continuing.',
                })
              : store.battleHistoryWarning === 'legacy-mirror-stale'
                ? tr({
                    zh: '对战轮次已经保存，但个人统计镜像未能同步；轮次不会丢失，个人 ao5 等统计可能暂时过期。',
                    en: 'Battle rounds were saved, but the individual statistics mirror could not be synchronized. Rounds are safe; personal ao5-style stats may be temporarily stale.',
                  })
                : tr({
                  zh: '对战历史未能保存到本机。请保持页面打开并立即导出 CSV；刷新后本次改动可能丢失。',
                  en: 'Battle history could not be saved on this device. Keep this page open and export CSV now; this change may be lost after refresh.',
                  })}
          </div>
        )}

        {/* 轮次列表 */}
        <div className="history-list">
          {roundCount === 0 && (
            <div className="history-empty">{tr({ zh: '暂无对战记录', en: 'No rounds yet'
            })}</div>
          )}
          {Array.from({ length: roundCount }, (_, i) => roundCount - 1 - i).map(i => {
            const round = rounds[i];
            const width = Math.max(...round.attempts.map((attempt) => attempt.playerId)) + 1;
            const { entries, puzzles } = roundPlayers(round, width);
            const winners = round.winners;
            const dateStr = formatDateOnly(new Date(round.ts).toISOString());
            const scrambleGroups = groupRoundScrambles(entries);
            const puzzlesDiffer = puzzles.some((puzzle) => puzzle !== puzzles[0]);

            return (
              <div
                key={round.id}
                className="history-item vs-round"
              >
                <button
                  type="button"
                  className="vs-round-open"
                  onClick={() => setDetailRound(i)}
                  aria-label={tr({
                    zh: `第 ${i + 1} 轮：查看历史打乱和详情`,
                    en: `Round ${i + 1}: view scramble history and details`,
                  })}
                >
                  <span className="vs-round-summary">
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
                  </span>
                  {scrambleGroups.length > 0 && (
                    <span className="vs-round-scrambles">
                      {scrambleGroups.map(({ event, scramble, playerIndexes }) => (
                        <span className="h-scramble" key={`${event}:${scramble}`}>
                          {scrambleGroups.length > 1 ? `${playerIndexes.map(pi => `P${pi + 1}`).join(' / ')} · ${isZh ? eventInfo(event).nameZh : eventInfo(event).nameEn} ` : ''}
                          {tr({ zh: '打乱：', en: 'Scramble: ' })}{scramble}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="h-delete"
                  title={tr({ zh: '删除此轮', en: 'Delete round'
                })}
                  onClick={() => store.deleteVsRound(i)}
                ><Trash2 size={14} /></button>
              </div>
            );
          })}
          {unpairedLegacyRecords.length > 0 && (
            <>
              <div className="history-empty" role="status">
                {tr({
                  zh: `另有 ${unpairedLegacyRecords.length} 条旧版个人记录。无法可靠证明它们属于同一轮，因此保留为单条记录，不会按数组下标强行拼成对战。`,
                  en: `${unpairedLegacyRecords.length} legacy individual records are also preserved. Their round membership cannot be proven, so they remain separate instead of being paired by array index.`,
                })}
              </div>
              {[...unpairedLegacyRecords].reverse().map((record, index) => {
                const event = eventInfo(record.event);
                const effective = getEffectiveTimeFromEntry(record.entry);
                return (
                  <div
                    className="history-item vs-round"
                    key={`${record.event}:${record.playerId}:${record.entry.date}:${index}`}
                  >
                    <span className="vs-round-summary">
                      <span className="h-idx">P{record.playerId + 1}</span>
                      <span className="h-time">
                        {isWcaEvent(timerToBattleEvent(record.event)) && (
                          <EventIcon
                            event={timerToBattleEvent(record.event)}
                            className="vs-event-mini"
                          />
                        )}
                        {isZh ? event.nameZh : event.nameEn} · {' '}
                        {effective === Infinity ? 'DNF' : ftp(effective)}
                      </span>
                      <span className="h-date">{formatDateOnly(record.entry.date)}</span>
                    </span>
                    {record.entry.scramble && (
                      <span className="h-scramble">
                        {tr({ zh: '打乱：', en: 'Scramble: ' })}{record.entry.scramble}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {legacyHistory.skippedKeys > 0 && (
            <div className="history-empty" role="alert">
              {tr({
                zh: `${legacyHistory.skippedKeys} 组旧版记录已损坏，未参与展示或配对。`,
                en: `${legacyHistory.skippedKeys} legacy history groups are damaged and were not displayed or paired.`,
              })}
            </div>
          )}
        </div>
      </div>

      {/* 单轮详情弹窗 — 大字方便看 */}
      {detailRound !== null && detail && (
        <RoundDetailModal
          roundIndex={detailRound}
          entries={detail.entries}
          puzzles={detail.puzzles}
          winners={detail.round.winners}
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
  entries: (Solve | undefined)[];
  puzzles: string[];
  winners: number[];
  isZh: boolean;
  ftp: (ms: number) => string;
  onClose: () => void;
  onDelete: () => void;
}

function RoundDetailModal({
  roundIndex, entries, puzzles, winners, isZh, ftp, onClose, onDelete,
}: RoundDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    modalRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const firstEntry = entries.find((entry): entry is Solve => entry !== undefined);
  const dateStr = formatDateTime(firstEntry ? new Date(firstEntry.ts).toISOString() : '');

  /**
   * 复盘入口。对战记分板只存数字,整把(转动流 / 分段)在**本机计时记录**里 ——
   * 用智能魔方拧的那些把会同时留一份(见 `useBattleCubes`)。两边没有共用的 id,
   * 按「打乱 + 没取整的用时」认回来(见 `battleReconIndex`)。
   *
   * 只有 P1 认得回来:本机记录是这台设备主人的练习历史,队友的把根本不往里写。
   * 认不回来的行不长按钮 —— 没连魔方的人一个多余图标都看不见。
   */
  const [reconSolve, setReconSolve] = useState<Solve | null>(null);
  const recon = useMemo(() => {
    const e = entries[0];
    if (!e?.scramble || !puzzles[0]) return null;
    const { index, solves } = battleReconIndex(battleToTimerEvent(puzzles[0]) as EventId);
    const hit = index.get(battleReconKey(e.scramble, e.timeMs));
    return hit ? { hit, solves } : null;
  }, [entries, puzzles]);

  const scrambleGroups = groupRoundScrambles(entries);

  const renderTime = (e: Solve | undefined) => {
    if (!e) return '—';
    const eff = effectiveMs(e);
    if (eff === Infinity) return 'DNF';
    return ftp(eff);
  };

  return (
    <div className="round-modal-overlay" data-no-timer onClick={(ev) => {
      if (ev.target === ev.currentTarget) onClose();
    }} onKeyDown={(event) => {
      if (event.key === 'Escape' && !reconSolve) {
        event.stopPropagation();
        onClose();
      }
    }}>
      <div
        ref={modalRef}
        className="round-modal"
        role="dialog"
        aria-modal="true"
        aria-label={tr({
          zh: `第 ${roundIndex + 1} 轮`,
          en: `Round ${roundIndex + 1}`,
        })}
        tabIndex={-1}
      >
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
          {scrambleGroups.map(({ event, scramble, playerIndexes }) => (
            <div className="round-modal-scramble-block" key={`${event}:${scramble}`}>
              <div className="round-modal-scramble-label">
                {scrambleGroups.length > 1 ? `${playerIndexes.map(i => `P${i + 1}`).join(' / ')} · ${isZh ? eventInfo(event).nameZh : eventInfo(event).nameEn} ` : ''}
                {tr({ zh: '打乱', en: 'Scramble'
                })}
              </div>
              <div className="round-modal-scramble-text">{scramble}</div>
            </div>
          ))}
        </div>

        <div className="round-modal-actions">
          {recon && (
            <button
              type="button"
              className="round-modal-recon"
              onClick={() => setReconSolve(recon.hit)}
              title={tr({ zh: 'P1 复盘', en: 'P1 reconstruction' })}
            >
              <Waypoints size={14} />
              {tr({ zh: '复盘', en: 'Reconstruction' })}
            </button>
          )}
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
      {reconSolve && recon && (
        <ReconstructModal
          solve={reconSolve}
          isZh={isZh}
          history={recon.solves}
          onClose={() => setReconSolve(null)}
        />
      )}
    </div>
  );
}
