'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
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
import { getAlgSetMeta, loadAlg, type AlgCase, type AlgFile } from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import { useAuthUser } from '@/lib/auth-store';
import { sortByCp } from '@/lib/alg_cp_order';
import { displayZbllToken, primaryCaseName } from '@/lib/alg_case_display';
import { sortAlgItemsBySignedLabel } from '@/lib/alg_group_order';
import {
  caseMap,
  casesForChainScope,
  chainScopes,
  fetchCloudChainOrder,
  newerChainOrder,
  normalizeChainOrder,
  readLocalChainOrder,
  saveCloudChainOrder,
  writeLocalChainOrder,
  type ChainOrderSnapshot,
} from '@/lib/alg-chain-order';
import { caseKey } from '@/lib/trainer-case-key';
import { tr } from '@/i18n/tr';
import '../alg.css';
import './chain.css';

const CHAIN_SETS = ['oll', 'pll', 'coll', 'zbll'] as const;
type ChainSet = (typeof CHAIN_SETS)[number];
type SyncState = 'local' | 'loading' | 'saving' | 'saved' | 'error';

function scopeLabel(setSlug: ChainSet, scope: string): string {
  return scope.split('/').map((part) => (
    setSlug === 'zbll' ? displayZbllToken(part) : part.toUpperCase()
  )).join(' / ');
}

function SortableCase({ c, setSlug, index }: { c: AlgCase; setSlug: ChainSet; index: number }) {
  const key = caseKey(c);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: key });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const alg = c.algs[0]?.[0]?.alg || c.setup || '';
  return (
    <div ref={setNodeRef} style={style} className={`alg-chain-case${isDragging ? ' is-dragging' : ''}`}>
      <span className="alg-chain-index" aria-hidden="true">{index + 1}</span>
      <div className="alg-chain-thumb">
        <CaseThumb
          puzzle="3x3"
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
        className="alg-chain-handle"
        aria-label={tr({ zh: `移动第 ${index + 1} 张图`, en: `Move diagram ${index + 1}` })}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={17} />
      </button>
    </div>
  );
}

export default function AlgChainPage() {
  useTranslation();
  const user = useAuthUser();
  const [setSlug, setSetSlug] = useQueryState(
    'set',
    parseAsStringEnum<ChainSet>([...CHAIN_SETS]).withDefault('oll'),
  );
  const [scope, setScope] = useQueryState('scope', parseAsString.withDefault(''));
  const [data, setData] = useState<AlgFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('local');
  const saveSequence = useRef(0);
  const lastUpdated = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError(false);
    void loadAlg('3x3', setSlug).then((next) => {
      if (active) setData(next);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [setSlug]);

  const sortedCases = useMemo(() => {
    if (!data) return [];
    return sortAlgItemsBySignedLabel(
      sortByCp(setSlug, data.cases),
      (c) => primaryCaseName('3x3', setSlug, c),
    );
  }, [data, setSlug]);
  const scopes = useMemo(() => chainScopes(sortedCases), [sortedCases]);
  const scopedCases = useMemo(
    () => casesForChainScope(sortedCases, scope),
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
    const local = readLocalChainOrder('3x3', setSlug, scope);
    setOrder(normalizeChainOrder(canonicalKeys, local?.keys));
    setSyncState(user ? 'loading' : 'local');
    if (!user) return () => { active = false; };

    void fetchCloudChainOrder('3x3', setSlug, scope).then(async (cloud) => {
      if (!active) return;
      // 网络返回前用户可能已经排过一次，再读本机，确保刚发生的修改赢过旧云端。
      const currentLocal = readLocalChainOrder('3x3', setSlug, scope);
      const winner = newerChainOrder(currentLocal, cloud);
      const keys = normalizeChainOrder(canonicalKeys, winner?.keys);
      let snapshot: ChainOrderSnapshot | null = winner ? { ...winner, keys } : null;
      const repaired = !!winner && (winner.keys.length !== keys.length || winner.keys.some((key, i) => key !== keys[i]));
      if (repaired) snapshot = { keys, updatedAt: Math.max(Date.now(), winner.updatedAt + 1) };
      setOrder(keys);
      if (snapshot) {
        lastUpdated.current = Math.max(lastUpdated.current, snapshot.updatedAt);
        writeLocalChainOrder('3x3', setSlug, scope, snapshot);
      }
      if (snapshot && (repaired || !cloud || snapshot.updatedAt > cloud.updatedAt)) {
        await saveCloudChainOrder('3x3', setSlug, scope, snapshot);
      }
      if (active) setSyncState('saved');
    }).catch(() => {
      if (active) setSyncState('error');
    });
    return () => { active = false; };
  }, [canonicalKeys, scope, setSlug, user]);

  const persistOrder = useCallback((keys: string[]) => {
    const updatedAt = Math.max(Date.now(), lastUpdated.current + 1);
    lastUpdated.current = updatedAt;
    const snapshot = { keys, updatedAt };
    setOrder(keys);
    writeLocalChainOrder('3x3', setSlug, scope, snapshot);
    if (!user) {
      setSyncState('local');
      return;
    }
    const sequence = ++saveSequence.current;
    setSyncState('saving');
    void saveCloudChainOrder('3x3', setSlug, scope, snapshot).then(() => {
      if (sequence === saveSequence.current) setSyncState('saved');
    }).catch(() => {
      if (sequence === saveSequence.current) setSyncState('error');
    });
  }, [scope, setSlug, user]);

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

  const meta = getAlgSetMeta('3x3', setSlug);
  const topScopes = scopes.filter((item) => item.depth === 1);
  const nestedScopes = scopes.filter((item) => item.depth > 1);
  const syncText: Record<SyncState, string> = {
    local: tr({ zh: '已保存在本机', en: 'Saved on this device' }),
    loading: tr({ zh: '正在合并云端顺序', en: 'Merging cloud order' }),
    saving: tr({ zh: '正在保存', en: 'Saving' }),
    saved: tr({ zh: '已保存', en: 'Saved' }),
    error: tr({ zh: '本机已保存，云同步失败', en: 'Saved locally; cloud sync failed' }),
  };

  return (
    <main className="alg-root alg-chain-page">
      <header className="alg-chain-header">
        <div>
          <p className="alg-chain-kicker">{tr({ zh: '公式集', en: 'Algorithm sets' })}</p>
          <h1>{tr({ zh: '连拧', en: 'Chain drill' })}</h1>
          <p className="alg-chain-intro">
            {tr({ zh: '只看图，按当前顺序连续还原。拖动图旁的手柄即可重排。', en: 'Solve continuously from diagrams alone. Drag the handle beside any diagram to reorder it.' })}
          </p>
        </div>
        <span className={`alg-chain-sync is-${syncState}`}>{syncText[syncState]}</span>
      </header>

      <div className="alg-chain-controls">
        <label className="alg-chain-field">
          <span>{tr({ zh: '公式集', en: 'Set' })}</span>
          <select
            className="alg-chain-select"
            value={setSlug}
            onChange={(event) => {
              void setSetSlug(event.target.value as ChainSet);
              void setScope('');
            }}
          >
            {CHAIN_SETS.map((slug) => {
              const item = getAlgSetMeta('3x3', slug);
              return <option key={slug} value={slug}>{item?.short ?? slug.toUpperCase()}</option>;
            })}
          </select>
        </label>
        <label className="alg-chain-field">
          <span>{tr({ zh: '范围', en: 'Scope' })}</span>
          <select className="alg-chain-select" value={scope} onChange={(event) => void setScope(event.target.value)}>
            <option value="">{tr({ zh: '全部', en: 'All' })}</option>
            {topScopes.map((item) => <option key={item.value} value={item.value}>{scopeLabel(setSlug, item.value)}</option>)}
            {nestedScopes.length > 0 && (
              <optgroup label={setSlug === 'zbll' ? tr({ zh: 'COLL 子集', en: 'COLL subsets' }) : tr({ zh: '更细分组', en: 'Narrower groups' })}>
                {nestedScopes.map((item) => <option key={item.value} value={item.value}>{scopeLabel(setSlug, item.value)}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <button type="button" className="alg-chain-action" onClick={shuffle} disabled={order.length < 2}>
          <Shuffle size={15} />
          {tr({ zh: '打乱顺序', en: 'Shuffle' })}
        </button>
        <button type="button" className="alg-chain-action" onClick={() => persistOrder(canonicalKeys)} disabled={order.length === 0}>
          <RotateCcw size={15} />
          {tr({ zh: '恢复默认', en: 'Reset' })}
        </button>
      </div>

      <div className="alg-chain-summary">
        <strong>{meta?.short ?? setSlug.toUpperCase()}</strong>
        <span>{tr({ zh: `${orderedCases.length} 张图`, en: `${orderedCases.length} diagrams` })}</span>
        {!user && <span>{tr({ zh: '登录后可跨设备同步顺序', en: 'Sign in to sync this order across devices' })}</span>}
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
            <div className="alg-chain-grid">
              {orderedCases.map((c, index) => <SortableCase key={caseKey(c)} c={c} setSlug={setSlug} index={index} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </main>
  );
}
