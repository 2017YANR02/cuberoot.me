'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, Shuffle } from 'lucide-react';
import {
  ALG_CATALOG,
  ALG_PUZZLES,
  getAlgSetMeta,
  loadAlg,
  type AlgCase,
  type AlgFile,
  type AlgPuzzle,
} from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import AppLink from '@/components/AppLink';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { sortByCp } from '@/lib/alg_cp_order';
import { displayZbllToken, primaryCaseName } from '@/lib/alg_case_display';
import { sortAlgItemsBySignedLabel } from '@/lib/alg_group_order';
import { eventDisplayName } from '@/lib/wca-events';
import { PUZZLE_EVENT } from '@/app/[lang]/alg/_trainer/events';
import {
  caseMap,
  casesForTimeAttackScope,
  fetchCloudTimeAttackOrder,
  newerTimeAttackOrder,
  normalizeTimeAttackOrder,
  readLocalTimeAttackOrder,
  saveCloudTimeAttackOrder,
  timeAttackScopes,
  writeLocalTimeAttackOrder,
  type TimeAttackOrderSnapshot,
} from '@/lib/alg-time-attack-order';
import { caseKey } from '@/lib/trainer-case-key';
import { tr } from '@/i18n/tr';
import '../alg.css';
import './time-attack.css';

type SyncState = 'local' | 'loading' | 'saving' | 'saved' | 'error';

function scopeLabel(setSlug: string, scope: string): string {
  return scope.split('/').map((part) => (
    setSlug === 'zbll' ? displayZbllToken(part) : part.toUpperCase()
  )).join(' / ');
}

function SortableCase({
  c,
  puzzle,
  setSlug,
  index,
}: {
  c: AlgCase;
  puzzle: AlgPuzzle;
  setSlug: string;
  index: number;
}) {
  const key = caseKey(c);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: key });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const alg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  return (
    <div ref={setNodeRef} style={style} className={`alg-time-attack-case${isDragging ? ' is-dragging' : ''}`}>
      <div className="alg-time-attack-thumb">
        <CaseThumb
          puzzle={puzzle}
          set={setSlug}
          sticker={c.sticker}
          alg={alg}
          setup={c.setup}
          size={116}
          loading={index < 9 ? 'eager' : 'lazy'}
        />
      </div>
      <button
        type="button"
        className="alg-time-attack-handle"
        aria-label={tr({ zh: `移动第 ${index + 1} 张图`, en: `Move diagram ${index + 1}` })}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={17} />
      </button>
    </div>
  );
}

export default function AlgTimeAttackPage() {
  const { i18n } = useTranslation();
  const pathname = usePathname();
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
  const [order, setOrder] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('local');
  const saveSequence = useRef(0);
  const lastUpdated = useRef(0);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
    return sortAlgItemsBySignedLabel(
      sortByCp(setSlug, data.cases),
      (c) => primaryCaseName(puzzle, setSlug, c),
    );
  }, [data, puzzle, setSlug]);
  const scopes = useMemo(() => timeAttackScopes(sortedCases), [sortedCases]);
  const scopedCases = useMemo(
    () => casesForTimeAttackScope(sortedCases, scope),
    [sortedCases, scope],
  );
  const canonicalKeys = useMemo(() => scopedCases.map(caseKey), [scopedCases]);
  const casesByKey = useMemo(() => caseMap(scopedCases), [scopedCases]);
  const orderedCases = useMemo(
    () => order.map((key) => casesByKey.get(key)).filter((c): c is AlgCase => !!c),
    [order, casesByKey],
  );

  useEffect(() => {
    if (canonicalKeys.length === 0) {
      setOrder([]);
      return;
    }
    let active = true;
    const local = readLocalTimeAttackOrder(puzzle, setSlug, scope);
    setOrder(normalizeTimeAttackOrder(canonicalKeys, local?.keys));
    setSyncState(user ? 'loading' : 'local');
    if (!user) return () => { active = false; };

    void fetchCloudTimeAttackOrder(puzzle, setSlug, scope).then(async (cloud) => {
      if (!active) return;
      // 网络返回前用户可能已经排过一次，再读本机，确保刚发生的修改赢过旧云端。
      const currentLocal = readLocalTimeAttackOrder(puzzle, setSlug, scope);
      const winner = newerTimeAttackOrder(currentLocal, cloud);
      const keys = normalizeTimeAttackOrder(canonicalKeys, winner?.keys);
      let snapshot: TimeAttackOrderSnapshot | null = winner ? { ...winner, keys } : null;
      const repaired = !!winner && (winner.keys.length !== keys.length || winner.keys.some((key, i) => key !== keys[i]));
      if (repaired) snapshot = { keys, updatedAt: Math.max(Date.now(), winner.updatedAt + 1) };
      setOrder(keys);
      if (snapshot) {
        lastUpdated.current = Math.max(lastUpdated.current, snapshot.updatedAt);
        writeLocalTimeAttackOrder(puzzle, setSlug, scope, snapshot);
      }
      if (snapshot && (repaired || !cloud || snapshot.updatedAt > cloud.updatedAt)) {
        await saveCloudTimeAttackOrder(puzzle, setSlug, scope, snapshot);
      }
      if (active) setSyncState('saved');
    }).catch(() => {
      if (active) setSyncState('error');
    });
    return () => { active = false; };
  }, [canonicalKeys, puzzle, scope, setSlug, user]);

  const persistOrder = useCallback((keys: string[]) => {
    const updatedAt = Math.max(Date.now(), lastUpdated.current + 1);
    lastUpdated.current = updatedAt;
    const snapshot = { keys, updatedAt };
    setOrder(keys);
    writeLocalTimeAttackOrder(puzzle, setSlug, scope, snapshot);
    if (!user) {
      setSyncState('local');
      return;
    }
    const sequence = ++saveSequence.current;
    setSyncState('saving');
    void saveCloudTimeAttackOrder(puzzle, setSlug, scope, snapshot).then(() => {
      if (sequence === saveSequence.current) setSyncState('saved');
    }).catch(() => {
      if (sequence === saveSequence.current) setSyncState('error');
    });
  }, [puzzle, scope, setSlug, user]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = order.indexOf(String(event.active.id));
    const to = order.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    persistOrder(arrayMove(order, from, to));
  }, [order, persistOrder]);

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
  const syncText: Record<SyncState, string> = {
    local: tr({ zh: '已保存在本机', en: 'Saved on this device' }),
    loading: tr({ zh: '正在合并云端顺序', en: 'Merging cloud order' }),
    saving: tr({ zh: '正在保存', en: 'Saving' }),
    saved: tr({ zh: '已保存', en: 'Saved' }),
    error: tr({ zh: '本机已保存，云同步失败', en: 'Saved locally; cloud sync failed' }),
  };
  const returnPath = `${pathname}?puzzle=${encodeURIComponent(puzzle)}&set=${encodeURIComponent(setSlug)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`;

  return (
    <main className="alg-root alg-time-attack-page">
      <header className="alg-time-attack-header">
        <div>
          <p className="alg-time-attack-kicker">{tr({ zh: '公式集', en: 'Algorithm sets' })}</p>
          <h1>{tr({ zh: '连拧', en: 'Time Attack' })}</h1>
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
        <div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div>
      ) : orderedCases.length === 0 ? (
        <div className="alg-empty">{tr({ zh: '这个范围没有可练习的图', en: 'There are no diagrams in this scope.' })}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="alg-time-attack-grid">
              {orderedCases.map((c, index) => (
                <SortableCase key={caseKey(c)} c={c} puzzle={puzzle} setSlug={setSlug} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </main>
  );
}
