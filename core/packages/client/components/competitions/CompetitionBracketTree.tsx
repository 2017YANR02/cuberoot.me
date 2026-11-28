import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CornerDownRight, LocateFixed, Search } from '@app-foundation/icons/lucide';
import { Flag } from '@/components/Flag';
import { useIsMobile } from '@/hooks/useIsMobile';
import { competitionMatchCode } from './competition-results';
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

  const finals = matches.filter(match => match.side === 'grand_final').sort((a, b) => a.round - b.round);
  for (const [index, match] of finals.entries()) {
    const incoming = (feeders.get(match.id) ?? []).flatMap(id => {
      const node = nodes.get(id);
      return node ? [node.y] : [];
    });
    const y = incoming.length ? (Math.min(...incoming) + Math.max(...incoming)) / 2 : top;
    nodes.set(match.id, { match, x: (mainColumns + index) * (cardWidth + columnGap), y });
    start = Math.max(start, y + cardHeight + 12);
  }

  const width = (mainColumns + finals.length) * (cardWidth + columnGap) - columnGap;
  return { nodes, lanes, finals, width, height: start };
}

export function CompetitionBracketTree({ matches, labels, ownMatch, registrationIds, activeOnly = false }: {
  matches: CompetitionBracketMatch[];
  labels: Record<Side, string>;
  activeOnly?: boolean;
  ownMatch?: CompetitionBracketMatch;
  registrationIds?: ReadonlySet<string>;
}) {
  const t = useT();
  const lang = useLang();
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [located, setLocated] = useState<string | null>(null);
  const [section, setSection] = useState<Side | 'all'>('winners');
  const [round, setRound] = useState(1);
  const [search, setSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile(700);
  const own = (id: string | null) => !!id && !!registrationIds?.has(id);
  const inspected = own(located) ? located : hovered ?? focused;
  const active = registrationIds?.size && !own(inspected) ? null : inspected;
  const displayed = useMemo(() => section === 'all' ? matches : matches.filter(match => match.side === section), [matches, section]);
  const { nodes, lanes, finals, width, height } = useMemo(() => layoutBracket(displayed), [displayed]);
  const activeMatches = matches.filter(match => match.status === 'in_progress');
  const rounds = [...new Set(displayed.map(match => match.round))].sort((a, b) => a - b);
  const navLabel = { winners: t('胜者组', 'Winners'), losers: t('败者组', 'Losers'), grand_final: t('总决赛', 'Grand final'), all: t('完整树', 'Full tree') };
  const query = search.trim().toLowerCase();
  const compact = section === 'grand_final' || !!query || activeOnly || (mobile && section !== 'all');
  const visible = activeOnly ? activeMatches : query ? matches.filter(match =>
    [competitionMatchCode(match), match.nameA, match.nameB, String(match.seedA ?? ''), String(match.seedB ?? '')]
      .some(value => value?.toLowerCase().includes(query)))
    : section === 'grand_final' ? displayed : displayed.filter(match => match.round === round);

  useEffect(() => {
    if (!locating || !ownMatch) return;
    scroll.current?.querySelector<HTMLElement>(`[data-bracket-match="${CSS.escape(ownMatch.id)}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'instant' });
    setLocating(false);
  }, [locating, ownMatch, section, round, compact]);

  function renderMatch(match: CompetitionBracketMatch, node?: Node) {
    const drop = match.nextLoss ? matches.find(item => item.id === match.nextLoss) : undefined;
    const isOwn = own(match.playerA) || own(match.playerB);
    const hasScore = match.status === 'in_progress' || match.status === 'completed';
    const label = match.status === 'in_progress'
      ? match.gameNumber ? t(`进行中 · 第 ${match.gameNumber} 局`, `Live · Game ${match.gameNumber}`) : t('进行中', 'Live')
      : match.status === 'completed' ? t('已结束', 'Complete') : match.status === 'bye' ? t('轮空', 'Bye')
        : match.status === 'pending' ? t('等待落位', 'Awaiting seats') : t('待开赛', 'Scheduled');
    return <article key={match.id} className="competition-match-card"
      data-bracket-match={match.id} data-own={isOwn || undefined} data-match-status={match.status}
      data-path={!!active && (match.playerA === active || match.playerB === active) || undefined}
      style={node ? { left: node.x, top: node.y, width: cardWidth, height: cardHeight } : undefined}>
      <header>
        <strong className="competition-code">{competitionMatchCode(match)}</strong>
        <span className={match.status === 'in_progress' ? 'competition-match-live' : undefined}>{label}</span>
      </header>
      {([{ id: match.playerA, name: match.nameA, score: match.scoreA, seed: match.seedA, country: match.countryA },
        { id: match.playerB, name: match.nameB, score: match.scoreB, seed: match.seedB, country: match.countryB }]).map(({ id, name, score, seed, country }, index) =>
        <div key={index} className="competition-match-player" data-winner={!!id && id === match.winner}
          data-own={own(id) || undefined} data-path={!!id && id === active || undefined}
          tabIndex={id && !compact ? 0 : undefined} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}
          onFocus={() => setFocused(id)} onBlur={() => setFocused(null)}>
          <span className="competition-seed">{seed ?? '—'}</span>
          {country ? <Flag iso2={country} spanClassName="country-flag" imgClassName="country-flag-ct" />
            : <span className="competition-empty-flag" aria-hidden />}
          <span className="competition-match-name">{name ? displayCuberName(name, lang === 'zh') : '—'}</span>
          {own(id) && <small>{t('我', 'You')}</small>}
          <strong>{id && hasScore ? score : '—'}</strong>
        </div>)}
      {drop && match.side === 'winners' && <small className="competition-match-drop"><CornerDownRight size={12} aria-hidden />
        {t('负者去向', 'Loser to')} <span className="competition-code">{competitionMatchCode(drop)}</span></small>}
    </article>;
  }

  return <>
    {!activeOnly && <nav className="competition-bracket-nav" aria-label={t('签表跳转', 'Jump through bracket')}>
      <div className="competition-section-tabs">
        {(['winners', 'losers', 'grand_final', 'all'] as const).filter(side => side === 'all' || matches.some(match => match.side === side)).map(side =>
          <button key={side} type="button" aria-pressed={section === side} onClick={() => {
            setSection(side); setRound(1); setLocated(null); setSearch('');
            if (scroll.current) { scroll.current.scrollTop = 0; scroll.current.scrollLeft = 0; }
          }}>{navLabel[side]}</button>)}
      </div>
      <label className="competition-bracket-search"><Search size={16} aria-hidden />
        <input className="platform-field-control" type="search" value={search} onChange={event => setSearch(event.target.value)}
          aria-label={t('搜索选手或桌号', 'Search player or table')} placeholder={t('选手或桌号', 'Player or table')} />
      </label>
      {ownMatch && <button className="competition-secondary" type="button" onClick={() => {
        setLocated(ownMatch.playerA && registrationIds?.has(ownMatch.playerA) ? ownMatch.playerA : ownMatch.playerB);
        setSection(ownMatch.side); setRound(ownMatch.round); setSearch(''); setLocating(true);
      }}><LocateFixed size={15} aria-hidden />{t('定位我的对局', 'Locate my match')}</button>}
      {mobile && section !== 'all' && section !== 'grand_final' && rounds.length > 1 && !query &&
        <span className="competition-field-select">
          <select className="platform-field-control" value={round} aria-label={t('跳转到轮次', 'Jump to round')} onChange={event => setRound(Number(event.target.value))}>
            {rounds.map(value => <option key={value} value={value}>{section === 'losers' ? `L${value}` : `R${value}`}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden />
        </span>}
    </nav>}
    {compact ? <div ref={scroll} className="competition-bracket-cards" data-finals={section === 'grand_final' && !query && !activeOnly || undefined}>
      {section === 'grand_final' && !query && !activeOnly && <div className="competition-final-feeders">
        {matches.filter(match => match.side !== 'grand_final' && visible.some(final => final.id === match.nextWin))
          .sort((a, b) => Number(a.side === 'losers') - Number(b.side === 'losers')).map(match => <section key={match.id}>
          <h3>{match.side === 'winners' ? t('胜者组决赛', 'Winners final') : t('败者组决赛', 'Losers final')}</h3>
          {renderMatch(match)}
        </section>)}
      </div>}
      {visible.map(match => renderMatch(match))}
      {!visible.length && <p className="competition-muted">{activeOnly ? t('暂无进行中的桌台。', 'No live tables.') : t('没有找到对局。', 'No matching tables.')}</p>}
    </div> : <div className="competition-bracket-viewport">
    <div ref={scroll} className="competition-bracket-scroll" tabIndex={0} role="region" aria-label={t('双败淘汰签表，可滚动查看', 'Scrollable double-elimination bracket')}>
    <div className="competition-bracket-tree" style={{ width, height }}>
      <svg aria-hidden="true" className="competition-bracket-lines" width={width} height={height}>
        {[...nodes.values()].map(({ match, x, y }) => {
          const next = match.nextWin && nodes.get(match.nextWin);
          if (!next) return null;
          const x1 = x + cardWidth;
          const y1 = y + cardHeight / 2;
          const y2 = next.y + cardHeight / 2;
          const mid = next.x - columnGap / 2;
          const reset = next.match.side === 'grand_final' && next.match.round === 2;
          const onPath = [next.match.playerA, next.match.playerB].some(id => id !== null && (id === active || own(id))
            && (match.winner === id || (reset && [match.playerA, match.playerB].includes(id))));
          return <path key={match.id} data-path={onPath || undefined} d={`M ${x1} ${y1} H ${mid} V ${y2} H ${next.x}`} />;
        })}
      </svg>
      {lanes.map(lane => <section key={lane.side} aria-label={labels[lane.side]}>
        <h3 className="competition-bracket-lane" style={{ top: lane.start }}>{labels[lane.side]}</h3>
        {lane.columns.map((round, index) => <h4 className="competition-bracket-round" key={round}
          style={{ left: index * (cardWidth + columnGap), top: lane.start + 37 }}>{t(`第 ${round} 轮`, `Round ${round}`)}</h4>)}
        {[...nodes.values()].filter(node => node.match.side === lane.side).map(node => renderMatch(node.match, node))}
      </section>)}
      {finals.map(match => {
        const node = nodes.get(match.id)!;
        return <section key={match.id}>
          <h3 className="competition-bracket-lane" style={{ left: node.x, top: node.y - 38 }}>
            {match.round === 2 ? t('总决赛加赛 · BO5', 'Grand final reset · BO5') : labels.grand_final}
          </h3>
          {renderMatch(match, node)}
        </section>;
      })}
    </div>
    </div>
    </div>}
  </>;
}
