/**
 * VsHistoryPanel — 对战历史面板(2~4 人)
 * 展示各方成绩 + 共享打乱，按轮次倒序排列;胜者(可并列)高亮 + 奖杯
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Waypoints } from 'lucide-react';
import { TimerBattleHistory } from '@cuberoot/timer-ui';
import {
  useBattleStore,
  timerToBattleEvent,
  filterUnpairedLegacyBattleRecords,
  loadLegacyBattleRecords,
} from './engine/battle_store';
import { battleReconIndex, battleReconKey } from '@/app/[lang]/timer/_lib/storage/db';
import ReconstructModal from '@/app/[lang]/timer/_components/ReconstructModal';
import { eventInfo, type Solve } from '@/app/[lang]/timer/_lib/types';
import { formatTimePlain } from '@/app/[lang]/timer/_shared/format';
import { getEffectiveTimeFromEntry } from '@/app/[lang]/timer/_shared/stats-core';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import { buildLocalBattleCsv, type LocalBattleRound } from '@cuberoot/shared/timer';

// NOTE: yyyy-mm-dd —— 列表用
function formatDateOnly(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export { buildLocalBattleCsv } from '@cuberoot/shared/timer';

export function useBattleHistoryProps({ onClose }: { onClose: () => void }): React.ComponentProps<typeof TimerBattleHistory> {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const rounds = store.battleRounds;
  const legacyHistory = useMemo(() => {
    const loaded = loadLegacyBattleRecords(store.sessionId);
    return { records: filterUnpairedLegacyBattleRecords(loaded.records, rounds), skippedKeys: loaded.skippedKeys };
  }, [rounds, store.sessionId]);
  const exportCSV = () => {
    const csv = buildLocalBattleCsv(rounds, legacyHistory.records, store.playerCount);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `local-battle_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const warning = store.battleHistoryWarning && <p role="alert">{store.battleHistoryWarning === 'corrupt'
    ? tr({ zh: '部分旧对战历史已损坏；原始恢复副本已保留，下方只显示验证通过的轮次。请先导出 CSV。', en: 'Some older battle history is damaged. A raw recovery copy was kept; only verified rounds are shown below. Export CSV before continuing.' })
    : store.battleHistoryWarning === 'legacy-mirror-stale'
      ? tr({ zh: '对战轮次已经保存，但个人统计镜像未能同步；轮次不会丢失，个人统计可能暂时过期。', en: 'Battle rounds were saved, but the individual statistics mirror could not be synchronized. Rounds are safe; personal stats may be temporarily stale.' })
      : tr({ zh: '对战历史未能保存到本机。请保持页面打开并立即导出 CSV；刷新后本次改动可能丢失。', en: 'Battle history could not be saved on this device. Keep this page open and export CSV now; this change may be lost after refresh.' })}</p>;
  return {
    rounds,
    playerCount: store.playerCount,
    language: isZh ? 'zh' : 'en',
    precision: store.timerPrecision as 0 | 1 | 2 | 3,
    onClose: onClose,
    onClear: () => store.resetAll(),
    onExport: exportCSV,
    warning: warning,
    onDelete: (id) => { const index = rounds.findIndex((round) => round.id === id); if (index >= 0) store.deleteVsRound(index); return !useBattleStore.getState().battleRounds.some(round => round.id === id); },
    roundActions: (round) => <RoundReplay round={round} isZh={isZh} />,
    legacy: <>
      {legacyHistory.records.length > 0 && <>
        <p role="status">{tr({ zh: '旧版个人记录保留为独立记录，不与轮次合并。', en: 'Legacy individual records are preserved separately from verified rounds.' })}</p>
        {legacyHistory.records.toReversed().map((record, index) => {
          const effective = getEffectiveTimeFromEntry(record.entry);
          return <div className="history-item vs-round" key={`${record.event}:${record.playerId}:${record.entry.date}:${index}`}>
            <span>P{record.playerId + 1} · {isWcaEvent(timerToBattleEvent(record.event)) && <EventIcon event={timerToBattleEvent(record.event)} />}
              {isZh ? eventInfo(record.event).nameZh : eventInfo(record.event).nameEn} · {effective === Infinity ? 'DNF' : formatTimePlain(effective, store.timerPrecision)}</span>
            <time>{formatDateOnly(record.entry.date)}</time><p>{record.entry.scramble}</p>
          </div>;
        })}
      </>}
      {legacyHistory.skippedKeys > 0 && <p role="alert">{tr({ zh: `${legacyHistory.skippedKeys} 组旧版记录已损坏，未参与展示或配对。`, en: `${legacyHistory.skippedKeys} legacy history groups are damaged and were not displayed or paired.` })}</p>}
    </>,
  };
}

/** Reconstruction remains a Web storage capability, injected into shared round details. */
function RoundReplay({ round, isZh }: { round: LocalBattleRound; isZh: boolean }) {
  const [solve, setSolve] = useState<Solve | null>(null);
  const attempt = round.attempts.find((entry) => entry.playerId === 0)?.solve;
  const recon = useMemo(() => {
    if (!attempt?.scramble) return null;
    const { index, solves } = battleReconIndex(attempt.event);
    const hit = index.get(battleReconKey(attempt.scramble, attempt.timeMs));
    return hit ? { hit, solves } : null;
  }, [attempt]);
  if (!recon) return null;
  return <>
    <button type="button" onClick={() => setSolve(recon.hit)}><Waypoints size={14} />{tr({ zh: 'P1 复盘', en: 'P1 reconstruction' })}</button>
    {solve && <ReconstructModal solve={solve} isZh={isZh} history={recon.solves} onClose={() => setSolve(null)} />}
  </>;
}

export default function VsHistoryPanel(props: { onClose: () => void }) {
  return <TimerBattleHistory {...useBattleHistoryProps(props)} />;
}
