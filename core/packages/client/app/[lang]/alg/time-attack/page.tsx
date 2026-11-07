'use client';

import PageHeading from '@/components/PageHeading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingPathname as usePathname, useTrainingQueryStates as useQueryStates, useTrainingHref } from '@/lib/training-host';
import { parseAsString, parseAsStringEnum } from 'nuqs';
import { RotateCcw, Shuffle } from '@app-foundation/icons/lucide';
import {
  ALG_CATALOG,
  ALG_PUZZLES,
  getAlgSetMeta,
  type AlgCase,
  type AlgFile,
  type AlgPuzzle,
} from '@cuberoot/shared';
import { loadTrainingAlg as loadAlg } from '@/lib/alg_case_alignment';
import { AlgCaseOrderGrid } from '@/components/AlgCaseOrderGrid';
import AppLink from '@/components/AppLink';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { eventDisplayName } from '@/lib/wca-events';
import { PUZZLE_EVENT } from '@/app/[lang]/alg/_trainer/events';
import {
  caseMap,
  canonicalTimeAttackCases,
  casesForTimeAttackScope,
  timeAttackScopes,
} from '@/lib/alg-time-attack-order';
import { displayZbllToken } from '@/lib/alg_case_display';
import { caseKey } from '@/lib/trainer-case-key';
import { tr } from '@/i18n/tr';
import '../alg.css';
import './time-attack.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

import { useTimeAttackOrder, type TimeAttackSyncState } from '@/hooks/useTimeAttackOrder';

function scopeLabel(setSlug: string, scope: string): string {
  return scope.split('/').map((part) => (
    setSlug === 'zbll' ? displayZbllToken(part) : part.toUpperCase()
  )).join(' / ');
}

export default function AlgTimeAttackPage() {
  const { i18n } = useTranslation();
  const pathname = usePathname();
  const trainingHref = useTrainingHref();
  const user = useAuthUser();
  const [{ puzzle, set: requestedSetSlug, scope }, setQuery] = useQueryStates({
    puzzle: parseAsStringEnum<AlgPuzzle>([...ALG_PUZZLES]).withDefault('3x3'),
    set: parseAsString.withDefault('oll'),
    scope: parseAsString.withDefault(''),
  });
  const availableSets = ALG_CATALOG[puzzle];
  const setSlug = getAlgSetMeta(puzzle, requestedSetSlug)
    ? requestedSetSlug
    : availableSets[0].slug;
  const [data, setData] = useState<AlgFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const isZh = i18n.language.startsWith('zh');
  const puzzlePickerGroups = useMemo<readonly PuzzlePickerGroup[]>(() => [{
    id: 'algorithm-puzzles',
    label: tr({ zh: '公式库项目', en: 'Algorithm puzzles' }),
    items: ALG_PUZZLES.map((item) => ({
      id: item,
      label: eventDisplayName(item, isZh),
      iconClass: item === 'fto' ? 'unofficial-fto' : `event-${PUZZLE_EVENT[item]}`,
    })),
  }], [isZh]);

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError(false);
    void loadAlg(puzzle, setSlug).then((next) => {
      if (active) setData(next);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [puzzle, setSlug]);

  useEffect(() => {
    if (requestedSetSlug === setSlug) return;
    void setQuery({ set: setSlug, scope: '' });
  }, [requestedSetSlug, setQuery, setSlug]);

  const sortedCases = useMemo(() => {
    if (!data) return [];
    return canonicalTimeAttackCases(puzzle, setSlug, data.cases);
  }, [data, puzzle, setSlug]);
  const scopes = useMemo(() => timeAttackScopes(sortedCases), [sortedCases]);
  const scopedCases = useMemo(
    () => casesForTimeAttackScope(sortedCases, scope),
    [sortedCases, scope],
  );
  const canonicalKeys = useMemo(() => scopedCases.map(caseKey), [scopedCases]);
  const { order, syncState, persistOrder } = useTimeAttackOrder(puzzle, setSlug, scope, canonicalKeys);
  const casesByKey = useMemo(() => caseMap(scopedCases), [scopedCases]);
  const orderedCases = useMemo(
    () => order.map((key) => casesByKey.get(key)).filter((c): c is AlgCase => !!c),
    [order, casesByKey],
  );

  const shuffle = useCallback(() => {
    if (order.length < 2) return;
    const next = [...order];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.every((key, i) => key === order[i])) next.push(next.shift()!);
    persistOrder(next);
  }, [order, persistOrder]);

  const meta = getAlgSetMeta(puzzle, setSlug);
  const topScopes = scopes.filter((item) => item.depth === 1);
  const nestedScopes = scopes.filter((item) => item.depth > 1);
  const syncText: Record<TimeAttackSyncState, string> = {
    local: tr({ zh: '已保存在本机', en: 'Saved on this device' }),
    loading: tr({ zh: '正在合并云端顺序', en: 'Merging cloud order' }),
    saving: tr({ zh: '正在保存', en: 'Saving' }),
    saved: tr({ zh: '已保存', en: 'Saved' }),
    error: tr({ zh: '本机已保存，云同步失败', en: 'Saved locally; cloud sync failed' }),
  };
  const returnPath = trainingHref(`${pathname}?puzzle=${encodeURIComponent(puzzle)}&set=${encodeURIComponent(setSlug)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`);

  return (
    <main className="alg-root alg-time-attack-page">
      <header className="alg-time-attack-header">
        <div>

          <PageHeading backHref="/alg">{tr({ zh: '连拧', en: 'Time Attack' })}</PageHeading>
          <p className="alg-time-attack-intro">
            {tr({ zh: '只看图，按当前顺序连续还原。拖动图旁的手柄即可重排。', en: 'Solve continuously from diagrams alone. Drag the handle beside any diagram to reorder it.' })}
          </p>
        </div>
        <span className={`alg-time-attack-sync is-${syncState}`}>{syncText[syncState]}</span>
      </header>

      <div className="alg-time-attack-controls">
        <div className="alg-time-attack-field">
          <span>{tr({ zh: '项目', en: 'Puzzle' })}</span>
          <PuzzlePicker
            isZh={isZh}
            selectedEvent={puzzle}
            groups={puzzlePickerGroups}
            onSelect={(id) => {
              if (!(ALG_PUZZLES as readonly string[]).includes(id)) return;
              const nextPuzzle = id as AlgPuzzle;
              void setQuery({ puzzle: nextPuzzle, set: ALG_CATALOG[nextPuzzle][0].slug, scope: '' });
            }}
          />
        </div>
        <label className="alg-time-attack-field">
          <span>{tr({ zh: '公式集', en: 'Set' })}</span>
          <select
            className="alg-time-attack-select"
            value={setSlug}
            onChange={(event) => {
              void setQuery({ set: event.target.value, scope: '' });
            }}
          >
            {availableSets.map((item) => (
              <option key={item.slug} value={item.slug}>{item.short ?? tr({ en: item.en, zh: item.zh })}</option>
            ))}
          </select>
        </label>
        <label className="alg-time-attack-field">
          <span>{tr({ zh: '范围', en: 'Scope' })}</span>
          <select className="alg-time-attack-select" value={scope} onChange={(event) => void setQuery({ scope: event.target.value })}>
            <option value="">{tr({ zh: '全部', en: 'All' })}</option>
            {topScopes.map((item) => <option key={item.value} value={item.value}>{scopeLabel(setSlug, item.value)}</option>)}
            {nestedScopes.length > 0 && (
              <optgroup label={setSlug === 'zbll' ? tr({ zh: 'COLL 子集', en: 'COLL subsets' }) : tr({ zh: '更细分组', en: 'Narrower groups' })}>
                {nestedScopes.map((item) => <option key={item.value} value={item.value}>{scopeLabel(setSlug, item.value)}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <button type="button" className="alg-time-attack-action" onClick={shuffle} disabled={order.length < 2}>
          <Shuffle size={15} />
          {tr({ zh: '打乱顺序', en: 'Shuffle' })}
        </button>
        <button type="button" className="alg-time-attack-action" onClick={() => persistOrder(canonicalKeys)} disabled={order.length === 0}>
          <RotateCcw size={15} />
          {tr({ zh: '恢复默认', en: 'Reset' })}
        </button>
      </div>

      <div className="alg-time-attack-summary">
        <strong>{meta?.short ?? setSlug.toUpperCase()}</strong>
        {!user && (
          <AppLink href={`/account${nextQuery(returnPath)}`} prefetch={false} className="alg-time-attack-login">
            {tr({ zh: '登录，保存并同步当前顺序', en: 'Sign in to save and sync this order' })}
          </AppLink>
        )}
      </div>

      {loadError ? (
        <div className="alg-empty">{tr({ zh: '公式集加载失败', en: 'Failed to load the algorithm set.' })}</div>
      ) : !data ? (
        <div className="alg-empty"><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator></div>
      ) : orderedCases.length === 0 ? (
        <div className="alg-empty">{tr({ zh: '这个范围没有可练习的图', en: 'There are no diagrams in this scope.' })}</div>
      ) : (
        <AlgCaseOrderGrid cases={orderedCases} order={order} puzzle={puzzle} setSlug={setSlug} onChange={persistOrder} />
      )}
    </main>
  );
}
