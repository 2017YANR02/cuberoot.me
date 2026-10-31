'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { Check, Copy, Search, CircleHelp } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import { CompPicker, CompPickerSummary } from '@/components/CompPicker';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { SearchInput } from '@/components/SearchInput';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { competitionFetch } from '@/lib/competition-access';
import { commonCompetitors, competitionRoster, type CompetitionRosterData, type CompetitorPresence } from '@/lib/comp-common-competitors';
import { localizeCompName } from '@/lib/comp-localize';
import { displayCuberName } from '@/lib/cuber-name-display';
import { loadComps, type Comp } from '@/lib/comp-search';
import './common-competitors.css';

function presenceLabel(presence: CompetitorPresence) {
  switch (presence) {
    case 'competed': return tr({ zh: '有参赛成绩', en: 'Has competed' });
    case 'registered': return tr({ zh: '已报名', en: 'Registered' });
    case 'dns': return tr({ zh: '仅 DNS', en: 'DNS only' });
    case 'listed': return tr({ zh: '名单中', en: 'Listed' });
  }
}

export default function CommonCompetitors({ data, isZh, onRefresh }: {
  data: CompetitionRosterData;
  isZh: boolean;
  onRefresh: () => void;
}) {
  const [compareId, setCompareId] = useQueryState('compare', parseAsString.withDefault('').withOptions({ history: 'push', scroll: false }));
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Comp | null>(null);
  const [response, setResponse] = useState<{ id: string; data?: CompetitionRosterData; error?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const copy = useCopy();
  const pickerId = useId();
  const sameCompetition = compareId.replaceAll('-', '').toLowerCase() === data.slug.replaceAll('-', '').toLowerCase();
  const validId = /^[A-Za-z0-9_-]{1,128}$/.test(compareId);
  const selectedComp = picked?.id === compareId ? picked : null;

  useEffect(() => {
    if (!validId || selectedComp) return;
    let cancelled = false;
    void loadComps().then(comps => {
      if (!cancelled) setPicked(comps.find(comp => comp.id === compareId) ?? null);
    }).catch(() => { /* The loaded roster still supplies a name if the catalog is unavailable. */ });
    return () => { cancelled = true; };
  }, [compareId, validId, selectedComp]);

  useEffect(() => {
    if (!validId || sameCompetition) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]);
    setResponse(null);
    void competitionFetch(`/api/comp/${encodeURIComponent(compareId)}?v=4`, { signal })
      .then(async result => {
        if (!result.ok) throw new Error(`HTTP ${result.status}`);
        const next: CompetitionRosterData = await result.json();
        if (next.partial || !next.users || !next.resultsByRound || !next.slug
          || next.slug.replaceAll('-', '').toLowerCase() !== compareId.replaceAll('-', '').toLowerCase()) {
          throw new Error('Incomplete competition roster');
        }
        if (!controller.signal.aborted) setResponse({ id: compareId, data: next });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResponse({ id: compareId, error: true });
      });
    return () => controller.abort();
  }, [compareId, validId, sameCompetition, retry]);

  const other = response?.id === compareId ? response.data : undefined;
  const failed = response?.id === compareId && response.error;
  const currentRoster = useMemo(() => data.partial ? null : competitionRoster(data), [data]);
  const otherRoster = useMemo(() => other ? competitionRoster(other) : null, [other]);
  const matches = useMemo(() => currentRoster && otherRoster
    ? commonCompetitors(currentRoster, otherRoster).sort((a, b) =>
      displayCuberName(a.name, isZh).localeCompare(displayCuberName(b.name, isZh), isZh ? 'zh-CN' : 'en'))
    : [], [currentRoster, otherRoster, isZh]);
  const needle = search.trim().toLocaleLowerCase();
  const shown = matches.filter(p => !needle || `${p.name} ${p.wcaId}`.toLocaleLowerCase().includes(needle));
  const currentName = localizeCompName(data.slug, data.name, isZh);
  const otherName = other ? localizeCompName(other.slug, other.name, isZh) : compareId;
  const unidentified = (currentRoster?.unidentified ?? 0) + (otherRoster?.unidentified ?? 0);

  function pick(comp: Comp) {
    setPicked(comp);
    setQuery('');
    setSearch('');
    void setCompareId(comp.id);
  }

  return (
    <section className="comp-common">
      <div className="comp-common-picker">
        <label className="sr-only" htmlFor={pickerId}>{tr({ zh: '对比另一场比赛', en: 'Compare with another competition' })}</label>
        <div className="comp-common-search">
          <Search size={18} aria-hidden="true" />
          <CompPicker
            inputId={pickerId}
            inputClassName="search-control"
            value={query}
            onChange={setQuery}
            onPick={pick}
            placeholder={tr({ zh: '搜索比赛名称 / 城市', en: 'Search competition / city' })}
            isZh={isZh}
            hideCancelled
          />
        </div>
      </div>
      {compareId && (
        <div className="comp-common-selection">
          <Link
            className="comp-picker-item comp-common-selected"
            href={`/wca/comp/${encodeURIComponent(compareId)}`}
            prefetch={false}
          >
            {selectedComp ? <CompPickerSummary comp={selectedComp} isZh={isZh} /> : otherName}
          </Link>
          <button type="button" className="comp-view-tab" onClick={() => copy.copy(window.location.href, 'link')}>
            {copy.copiedKey === 'link' ? <Check size={14} /> : <Copy size={14} />}
            {tr({ zh: '复制对比链接', en: 'Copy comparison link' })}
          </button>
        </div>
      )}
      <div aria-live="polite">
        {compareId && (!validId || sameCompetition) ? (
          <p>{tr({ zh: '请选择另一场有效的比赛。', en: 'Choose a different, valid competition.' })}</p>
        ) : data.partial ? (
          <p>{tr({ zh: '当前比赛的完整名单尚未加载。', en: 'The full roster for this competition has not loaded.' })}
            <button type="button" className="comp-view-tab" onClick={onRefresh}>{tr({ zh: '重试', en: 'Retry' })}</button>
          </p>
        ) : failed ? (
          <p>{tr({ zh: '另一场比赛的名单加载失败。', en: 'Could not load the other competition’s roster.' })}
            <button type="button" className="comp-view-tab" onClick={() => setRetry(value => value + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button>
          </p>
        ) : compareId && !other ? (
          <LoadingIndicator>{tr({ zh: '加载选手名单…', en: 'Loading competitors…' })}</LoadingIndicator>
        ) : other && currentRoster && otherRoster ? (
          currentRoster.total === 0 || otherRoster.total === 0 ? (
            <p>{tr({ zh: '有一场比赛尚无可用的公开选手名单，暂时无法判断交集。', en: 'A public competitor roster is unavailable for one competition, so the overlap cannot yet be determined.' })}</p>
          ) : (
            <>
              <div className="comp-common-toolbar">
                <span className="comp-common-count">
                  <strong>{tr({ zh: `共同选手 ${matches.length} 人`, en: `${matches.length} common competitors` })}</strong>
                  <InfoTooltip
                    icon={CircleHelp}
                    iconSize={16}
                    ariaLabel={tr({ zh: '匹配说明', en: 'About matching' })}
                    content={[
                      tr({ zh: '按 WCA ID 匹配；报名不代表实际到场，DNF 计为参赛，DNS 不计。', en: 'Matched by WCA ID. Registration does not confirm attendance; DNF counts as participation, DNS does not.' }),
                      unidentified > 0 ? tr({ zh: `两场名单分别有 ${currentRoster.unidentified} / ${otherRoster.unidentified} 人无 WCA ID，未纳入匹配。`, en: `${currentRoster.unidentified} / ${otherRoster.unidentified} entrants respectively have no WCA ID and are excluded.` }) : '',
                    ].filter(Boolean).join('\n')}
                  />
                </span>
                <SearchInput value={search} onChange={setSearch} placeholder={tr({ zh: '搜索选手 / WCA ID', en: 'Search person / WCA ID' })} />
              </div>
              {shown.length > 0 ? (
                <div className="comp-table-wrap">
                  <table className="comp-table sticky-thead comp-common-table">
                    <thead><tr>
                      <th scope="col">{tr({ zh: '选手', en: 'Competitor' })}</th>
                      <th scope="col">{currentName}</th>
                      <th scope="col">{otherName}</th>
                    </tr></thead>
                    <tbody>{shown.map(person => (
                      <tr key={person.wcaId}>
                        <td><Link href={`/wca/persons/${person.wcaId}`} prefetch={false}>{displayCuberName(person.name, isZh)}</Link><small>{person.wcaId}</small></td>
                        <td>{presenceLabel(person.presence)}</td>
                        <td>{presenceLabel(person.otherPresence)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p>{search.trim()
                ? tr({ zh: '没有匹配的选手。', en: 'No competitors match your search.' })
                : tr({ zh: '当前公开数据中未找到符合条件的共同选手。', en: 'No common competitors meeting these criteria were found in the available public data.' })}</p>}
            </>
          )
        ) : null}
      </div>
    </section>
  );
}
