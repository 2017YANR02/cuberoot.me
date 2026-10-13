'use client';
import { useEffect, useMemo, useState } from 'react';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useTranslation } from 'react-i18next';
import AppLink from '@/components/AppLink';
import { ListSelect } from '@/components/ListSelect';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import ScrambleImageDownload from '@/components/ScrambleImageDownload';
import { useT } from '@/hooks/useT';
import { getRecon } from '@/lib/recon-api';
import { attemptsPerRound, localizeRound, formatReconSingle } from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { localizeCompName } from '@/lib/comp-localize';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { fetchAttempts, fetchCubingAttempts, fetchScrambles } from '@/lib/wca-results-api';
import { formatWcaResult } from '@/lib/wca-format-result';
import { reconPathSeg } from '@/lib/recon-seo';

type ReconSolve = Awaited<ReturnType<typeof getRecon>>;
const roundKey = (s: ReconSolve) => JSON.stringify([s.personId || s.person, s.compWcaId || s.comp, s.event, s.round]);

export default function ReconRoundOverview({ filtered, all }: { filtered: ReconSolve[]; all: ReconSolve[] }) {
  const t = useT();
  const { t: translate, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [selected, setSelected] = useQueryState('roundId', parseAsInteger.withOptions({ history: 'push' }));
  const rounds = useMemo(() => [...new Map(filtered.filter(s => s.comp && s.round && s.person && s.solveNum).map(s => [roundKey(s), s])).values()], [filtered]);
  const selectedSolve = all.find(s => s.id === selected);
  const seed = rounds.find(s => selectedSolve && roundKey(selectedSolve) === roundKey(s)) ?? rounds[0];
  const titleOf = (s: ReconSolve) => [displayCuberName(s.person || '', isZh), localizeCompName(s.compWcaId || '', s.comp || '', isZh), eventDisplayName(toWcaEventId(s.event), isZh), localizeRound(s.round, translate)].join(' · ');
  return <section className="recon-round-overview">
    <h2>{t('整轮打乱与复盘', 'Round scrambles and reconstructions')}</h2>
    <ListSelect items={rounds.map(s => ({ value: String(s.id), label: titleOf(s) }))} value={seed ? String(seed.id) : ''} onChange={value => void setSelected(Number(value))} clearable={false} allLabel={t('选择选手、比赛和轮次', 'Choose a competitor, competition and round')} />
    {!seed ? <p>{t('当前筛选下没有带轮次信息的复盘。', 'No reconstructions with round information match these filters.')}</p> : <RoundSheet key={roundKey(seed)} seed={seed} title={titleOf(seed)} all={all} />}
  </section>;
}

function RoundSheet({ seed, title, all }: { seed: ReconSolve; title: string; all: ReconSolve[] }) {
  const t = useT();
  const [details, setDetails] = useState<ReconSolve[]>([]);
  const [official, setOfficial] = useState<(string | null)[]>([]);
  const [results, setResults] = useState<(number | null)[]>([]);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const ids = all.filter(s => roundKey(s) === roundKey(seed)).map(s => s.id).sort((a, b) => a - b).join(',');
  useEffect(() => {
    let cancelled = false;
    setBusy(true); setFailed(false); setOfficial([]); setResults([]);
    (async () => {
      const loaded: ReconSolve[] = [];
      let incomplete = false;
      for (const id of ids.split(',').filter(Boolean).map(Number)) {
        if (cancelled) return;
        try { loaded.push(await getRecon(id)); } catch { incomplete = true; }
      }
      if (cancelled) return;
      setDetails(loaded);
      if (seed.compWcaId && seed.round && seed.personId) {
        try {
          const values = await fetchAttempts(seed.compWcaId, seed.event, seed.round, seed.personId);
          const fallback = values?.some(v => v !== null) ? values : await fetchCubingAttempts(seed.compWcaId, seed.event, seed.round, seed.personId);
          if (!cancelled) setResults(fallback ?? []);
          const groups = [...new Set(loaded.map(s => s.groupId).filter(Boolean))];
          // Never infer a competitor's group from the first scramble set.
          if (groups.length === 1) {
            const scrambles = await fetchScrambles(seed.compWcaId, seed.event, seed.round, groups[0]);
            if (!cancelled) setOfficial(scrambles ?? []);
          }
        } catch { incomplete = true; }
      }
      if (!cancelled) { setFailed(incomplete); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [ids, retry, seed.compWcaId, seed.event, seed.round, seed.personId]);
  const event = toWcaEventId(seed.event);
  const rows = Array.from({ length: attemptsPerRound(seed.event) }, (_, index) => {
    const solves = details.filter(s => s.solveNum === index + 1);
    const solve = solves.find(s => s.recordType !== 'timing') ?? solves[0];
    const scramble = solve?.wcaScramble || solve?.scramble || official[index] || solve?.optimalScramble || null;
    const result = results[index] != null ? formatWcaResult(results[index]!, event, 'single') : solve ? formatReconSingle(solve.event, solve.value, solve.rawTime) : '';
    const equivalent = !solve?.wcaScramble && !solve?.scramble && !official[index] && !!solve?.optimalScramble;
    const caption = [result, equivalent ? t('等价打乱', 'Equivalent scramble') : ''].filter(Boolean).join(' · ');
    return { label: String(index + 1), scramble, caption, solves };
  });
  return <div aria-busy={busy}>
    <h3>{title}</h3><ScrambleImageDownload sheets={[{ title, event, rows }]} disabled={busy} />
    {failed && <p role="alert">{t('部分数据未能加载。', 'Some data could not be loaded.')} <button type="button" onClick={() => setRetry(n => n + 1)}>{t('重试', 'Retry')}</button></p>}
    <div className="recon-round-rows">{rows.map(row => <article key={row.label} className="recon-round-row" data-site-surface="panel">
      <strong>#{row.label} {row.caption}</strong>
      <div className="recon-round-diagram">{row.scramble && <ScramblePreview2D event={event} scramble={row.scramble} size={70} />}</div>
      <p className="recon-round-scramble">{busy ? t('加载中…', 'Loading…') : row.scramble || t('暂无该把打乱；未推断选手的打乱组。', 'Scramble unavailable; the competitor’s scramble group has not been inferred.')}</p>
      <div>{row.solves.filter(s => s.recordType !== 'timing').map(s => <AppLink key={s.id} href={`/recon/${reconPathSeg(s)}`} prefetch={false}>{t('查看复盘', 'View reconstruction')}</AppLink>)}{!busy && !row.solves.some(s => s.recordType !== 'timing') && <span>{t('尚未收录复盘', 'No reconstruction yet')}</span>}</div>
    </article>)}</div>
  </div>;
}
