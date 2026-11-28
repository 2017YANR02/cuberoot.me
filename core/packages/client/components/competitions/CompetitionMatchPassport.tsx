import type { ReactNode } from 'react';
import { ArrowRight } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import type { CompetitionBracketMatch } from '@/lib/online-competition-api';
import { competitionMatchCode } from './competition-results';

export function CompetitionMatchPassport({ title, code, status, tone, children, action }: {
  title: string; code?: string; status: string; tone: 'waiting' | 'ready' | 'done' | 'lost';
  children?: ReactNode; action?: ReactNode;
}) {
  return <section className="competition-passport" data-tone={tone}>
    <header><h2>{title}</h2>{code && <span className="competition-code">{code}</span>}</header>
    <div className="competition-passport-body"><div><strong role="status">{status}</strong>{children}</div>{action}</div>
  </section>;
}

export function CompetitionMatchEnter({ onEnter }: { onEnter: () => void }) {
  const t = useT();
  return <button type="button" className="competition-primary competition-focus-action" onClick={onEnter}>
    {t('进入对战席', 'Enter match')} <ArrowRight size={16} aria-hidden />
  </button>;
}

export function CompetitionMatchFeeder({ feeder }: { feeder: { match: CompetitionBracketMatch; winner: boolean } }) {
  const t = useT();
  const code = competitionMatchCode(feeder.match);
  const progress = feeder.match.status === 'in_progress'
    ? ` · ${feeder.match.scoreA}:${feeder.match.scoreB}${feeder.match.gameNumber ? ` · G${feeder.match.gameNumber}` : ''}` : '';
  return <p className="competition-muted">
    {feeder.winner ? t(`等待 ${code} 胜者`, `Waiting for the winner of ${code}`) : t(`等待 ${code} 负者`, `Waiting for the loser of ${code}`)}{progress}
  </p>;
}
