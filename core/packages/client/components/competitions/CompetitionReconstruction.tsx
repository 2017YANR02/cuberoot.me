'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Play } from 'lucide-react';
import type { Solve } from '@cuberoot/shared/timer';
import { useLang } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { onIdle } from '@/lib/on-idle';
import { useWebReconstructHost } from '@/lib/use-web-reconstruct-host';
import { getCompetitionAttemptReplay, type CompetitionReplay } from '@/lib/online-competition-api';

const loadRecap = () => import('@cuberoot/timer-ui/solve-recap');
const loadModal = () => import('@cuberoot/timer-ui/reconstruct-modal');
const SolveRecap = dynamic(loadRecap, { ssr: false });
const ReconstructModal = dynamic(loadModal, { ssr: false });

export function preloadCompetitionReconstruction() {
  return onIdle(() => {
    void Promise.all([loadRecap(), loadModal(), import('@cuberoot/timer-ui/reconstruct-report')]).catch(() => {});
  });
}

export function replaySolve(id: string, replay: CompetitionReplay | null): Solve | null {
  if (!replay?.moves.length || replay.disconnected || replay.penalty === 'DNF' || replay.penalty === 'DNS') return null;
  return {
    id, event: '333', scramble: replay.scramble, timeMs: replay.durationMs, penalty: replay.penalty === '+2' ? '+2' : 'ok',
    ts: replay.timestamp ? Date.parse(replay.timestamp) : 0,
    moves: replay.moves.map(({ move, elapsedMs }) => ({ m: move, ts: elapsedMs })),
    ...(replay.gyro ? { gyro: replay.gyro } : {}),
  };
}

export function CompetitionRecap({ solve, onDismiss, onFull }: { solve: Solve; onDismiss(): void; onFull(): void }) {
  const host = useWebReconstructHost();
  const lang = useLang();
  return <div className="competition-arena-recap" data-site-surface="panel">
    <SolveRecap host={host} isZh={lang === 'zh'} solve={solve} history={[]} onDismiss={onDismiss} onFull={onFull} previewOnly />
  </div>;
}

export function CompetitionReplayDialog({ own, opponent, onClose }: { own: Solve | null; opponent?: Solve | null; onClose(): void }) {
  const t = useT();
  const host = useWebReconstructHost();
  const lang = useLang();
  const [perspective, setPerspective] = useState(own ? 'own' : 'opponent');
  const solve = perspective === 'own' ? own : opponent;
  if (!solve) return null;
  const controls = own && opponent && <div className="competition-replay-perspectives" role="group" aria-label={t('复盘视角', 'Replay perspective')}>
    <button className="competition-secondary" type="button" aria-pressed={perspective === 'own'} onClick={() => setPerspective('own')}>{t('我方', 'My solve')}</button>
    <button className="competition-secondary" type="button" aria-pressed={perspective === 'opponent'} onClick={() => setPerspective('opponent')}>{t('对手', 'Opponent')}</button>
  </div>;
  return <ReconstructModal solve={solve} host={host} isZh={lang === 'zh'} onClose={onClose} headerControls={controls} />;
}

export function CompetitionReplayButton({ registrationId, number, publicReplay, children }: {
  registrationId: string; number: number; publicReplay?: boolean; children: ReactNode;
}) {
  const t = useT();
  const [solve, setSolve] = useState<Solve | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function open() {
    setBusy(true);
    setError(false);
    try {
      const { report } = await getCompetitionAttemptReplay(registrationId, number, publicReplay);
      const next = replaySolve(`${registrationId}:${number}`, report);
      if (next) setSolve(next);
      else setError(true);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <>
    <button className="competition-secondary competition-replay-button" type="button" disabled={busy} onClick={() => void open()}>
      {children} <Play size={11} aria-hidden />
      <span className="sr-only">{t(`查看第 ${number} 把复盘`, `Replay attempt ${number}`)}</span>
    </button>
    {error && <small role="alert">{t('复盘加载失败', 'Replay unavailable')}</small>}
    {solve && <CompetitionReplayDialog own={solve} onClose={() => setSolve(null)} />}
  </>;
}
