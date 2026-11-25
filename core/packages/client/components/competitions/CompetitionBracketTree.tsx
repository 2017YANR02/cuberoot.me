import { useMemo, useState } from 'react';
import { ArrowRight, CornerDownRight } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import type { CompetitionBracketMatch } from '@/lib/online-competition-api';

type Side = CompetitionBracketMatch['side'];
type Node = { match: CompetitionBracketMatch; x: number; y: number };
const cardWidth = 218;
const cardHeight = 118;
const columnGap = 44;
const rowGap = 24;
const top = 71;
const pitch = cardHeight + rowGap;

function layoutBracket(matches: CompetitionBracketMatch[]) {
  const nodes = new Map<string, Node>();
  const feeders = new Map<string, string[]>();
  for (const match of matches) {
    if (!match.nextWin) continue;
    const list = feeders.get(match.nextWin) ?? [];
    list.push(match.id);
    feeders.set(match.nextWin, list);
  }

  let start = 0;
  let mainColumns = 1;
  const lanes = (['winners', 'losers'] as const).flatMap(side => {
    const rounds = new Map<number, CompetitionBracketMatch[]>();
    for (const match of matches) {
      if (match.side !== side) continue;
      const round = rounds.get(match.round) ?? [];
      round.push(match);
      rounds.set(match.round, round);
    }
    if (!rounds.size) return [];
    const columns = [...rounds.keys()].sort((a, b) => a - b);
    mainColumns = Math.max(mainColumns, columns.length);
    let bottom = start + top;
    columns.forEach((round, column) => {
      rounds.get(round)!.sort((a, b) => a.number - b.number).forEach((match, index) => {
        const upstream = (feeders.get(match.id) ?? []).flatMap(id => {
          const node = nodes.get(id);
          return node ? [node.y] : [];
        });
        const y = upstream.length ? upstream.reduce((total, value) => total + value, 0) / upstream.length : start + top + index * pitch;
        nodes.set(match.id, { match, x: column * (cardWidth + columnGap), y });
        bottom = Math.max(bottom, y + cardHeight);
      });
    });
    const lane = { side, start, columns };
    start = bottom + 32;
    return [lane];
  });

  const finals = matches.filter(match => match.side === 'grand_final');
  for (const match of finals) {
    const incoming = (feeders.get(match.id) ?? []).flatMap(id => {
      const node = nodes.get(id);
      return node ? [node.y] : [];
    });
    const y = incoming.length ? (Math.min(...incoming) + Math.max(...incoming)) / 2 : top;
    nodes.set(match.id, { match, x: mainColumns * (cardWidth + columnGap), y });
    start = Math.max(start, y + cardHeight + 12);
  }

  const width = (mainColumns + Number(finals.length > 0)) * (cardWidth + columnGap) - columnGap;
  return { nodes, lanes, finals, width, height: start };
}

export function CompetitionBracketTree({ matches, labels, canEnter, onEnter }: {
  matches: CompetitionBracketMatch[];
  labels: Record<Side, string>;
  canEnter: (match: CompetitionBracketMatch) => boolean;
  onEnter: (id: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const active = hovered ?? focused;
  const { nodes, lanes, finals, width, height } = useMemo(() => layoutBracket(matches), [matches]);

  function renderMatch({ match, x, y }: Node) {
    const enter = canEnter(match);
    const drop = match.nextLoss && nodes.get(match.nextLoss)?.match;
    return <article key={match.id} className="competition-match-card" data-site-surface="panel"
      data-own={enter || undefined} data-match-status={match.status}
      data-path={!!active && (match.playerA === active || match.playerB === active) || undefined}
      style={{ left: x, top: y, width: cardWidth, height: cardHeight }}>
      {enter && <button className="competition-match-open" type="button" onClick={() => onEnter(match.id)}
        aria-label={t(`进入对战席 · 第 ${match.round} 轮第 ${match.number} 场`, `Enter match · round ${match.round}, match ${match.number}`)} />}
      <header>
        <span>{t(`第 ${match.number} 场`, `Match ${match.number}`)}</span>
        {match.status === 'in_progress' ? <span className="competition-match-live"><span className="competition-live-dot" aria-hidden />
          {match.gameNumber ? t(`第 ${match.gameNumber} 局`, `Game ${match.gameNumber}`) : t('进行中', 'Live')}</span>
          : match.status === 'bye' ? <span>{t('轮空', 'Bye')}</span> : enter && <ArrowRight size={14} aria-hidden />}
      </header>
      {([{ id: match.playerA, name: match.nameA, score: match.scoreA }, { id: match.playerB, name: match.nameB, score: match.scoreB }]).map(({ id, name, score }, index) => {
        const props = {
          className: 'competition-match-player',
          'data-winner': !!id && id === match.winner,
          'data-path': !!id && id === active || undefined,
          onMouseEnter: () => setHovered(id),
          onMouseLeave: () => setHovered(null),
          onFocus: () => setFocused(id),
          onBlur: () => setFocused(null),
        };
        const content = <><span>{name ? displayCuberName(name, lang === 'zh') : '—'}</span><strong>{score ?? '—'}</strong></>;
        return enter ? <button {...props} type="button" key={index} onClick={() => onEnter(match.id)}>{content}</button>
          : <div {...props} key={index} tabIndex={id ? 0 : undefined}>{content}</div>;
      })}
      {drop && match.side === 'winners' && <small className="competition-match-drop"><CornerDownRight size={12} aria-hidden />
        {drop.side === 'grand_final' ? t('负者进总决赛', 'Loser to grand final')
          : t(`负者进败者组 ${drop.round}–${drop.number}`, `Loser to lower ${drop.round}–${drop.number}`)}</small>}
    </article>;
  }

  return <div className="competition-bracket-scroll" tabIndex={0} role="region" aria-label={t('双败淘汰签表，可横向滑动', 'Double-elimination bracket, scroll horizontally')}>
    <div className="competition-bracket-tree" style={{ width, height }}>
      <svg aria-hidden="true" className="competition-bracket-lines" width={width} height={height}>
        {[...nodes.values()].map(({ match, x, y }) => {
          const next = match.nextWin && nodes.get(match.nextWin);
          if (!next) return null;
          const x1 = x + cardWidth;
          const y1 = y + cardHeight / 2;
          const y2 = next.y + cardHeight / 2;
          const mid = next.x - columnGap / 2;
          const onPath = active && match.winner === active && [next.match.playerA, next.match.playerB].includes(active);
          return <path key={match.id} data-path={onPath || undefined} d={`M ${x1} ${y1} H ${mid} V ${y2} H ${next.x}`} />;
        })}
        {active && [...nodes.values()].map(({ match, x, y }) => {
          const next = match.nextLoss && nodes.get(match.nextLoss);
          if (!next || !match.winner || match.winner === active || ![match.playerA, match.playerB].includes(active)
            || ![next.match.playerA, next.match.playerB].includes(active)) return null;
          const x1 = x + cardWidth;
          const y1 = y + cardHeight / 2;
          const y2 = next.y + cardHeight / 2;
          if (next.match.side === 'grand_final') {
            const mid = next.x - columnGap / 2;
            return <path key={`drop-${match.id}`} data-path data-drop d={`M ${x1} ${y1} H ${mid} V ${y2} H ${next.x}`} />;
          }
          const gapY = (lanes.find(lane => lane.side === 'losers')?.start ?? next.y) - 12;
          const right = next.x + cardWidth;
          return <path key={`drop-${match.id}`} data-path data-drop
            d={`M ${x1} ${y1} H ${x1 + 12} V ${gapY} H ${right + 12} V ${y2} H ${right}`} />;
        })}
      </svg>
      {lanes.map(lane => <section key={lane.side} aria-label={labels[lane.side]}>
        <h3 className="competition-bracket-lane" style={{ top: lane.start }}>{labels[lane.side]}</h3>
        {lane.columns.map((round, index) => <h4 className="competition-bracket-round" key={round}
          style={{ left: index * (cardWidth + columnGap), top: lane.start + 37 }}>{t(`第 ${round} 轮`, `Round ${round}`)}</h4>)}
        {[...nodes.values()].filter(node => node.match.side === lane.side).map(renderMatch)}
      </section>)}
      {finals.map(match => {
        const node = nodes.get(match.id)!;
        return <section key={match.id}>
          <h3 className="competition-bracket-lane" style={{ left: node.x, top: node.y - 38 }}>{labels.grand_final}</h3>
          {renderMatch(node)}
        </section>;
      })}
    </div>
  </div>;
}
