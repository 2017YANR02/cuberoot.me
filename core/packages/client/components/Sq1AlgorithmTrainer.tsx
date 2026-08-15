'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { ListSelect } from '@/components/ListSelect';
import { Sq1StateSvg } from '@/components/Sq1StateSvg';
import { tr } from '@/i18n/tr';
import {
  SQ1_ALG_TRAINER_CASES,
  SQ1_ALG_TRAINER_GROUPS,
  chooseSq1AlgTrainerCase,
  createSq1AlgTrainerRound,
  type Sq1AlgTrainerCase,
  type Sq1AlgTrainerGroupId,
  type Sq1AlgTrainerRound,
  type Sq1MiddleStrategy,
} from '@/lib/sq1-alg-trainer';
import { persistItem } from '@/lib/safe-storage';
import styles from './Sq1AlgorithmTrainer.module.css';

const STORAGE_KEY = 'sq1:algorithm-trainer:v1';
const ALL_IDS = new Set(SQ1_ALG_TRAINER_CASES.map((item) => item.id));

const GROUP_LABELS: Record<Sq1AlgTrainerGroupId, { zh: string; en: string }> = {
  cubeshape: { zh: '复形', en: 'Cubeshape' },
  'edge-permutation': { zh: '棱块排列 EP', en: 'Edge permutation (EP)' },
  'permute-last-layer': { zh: '末层排列 PLL', en: 'Permute last layer (PLL)' },
  'lin-corner-permutation': { zh: 'Lin 角块排列', en: 'Lin corner permutation' },
  'lin-pll-plus-1': { zh: 'Lin PLL+1', en: 'Lin PLL+1' },
};

const MIDDLE_ITEMS = [
  { value: 'random', label: tr({ zh: '随机', en: 'Random' }) },
  { value: 'never', label: tr({ zh: '从不翻转', en: 'Never flipped' }) },
  { value: 'always', label: tr({ zh: '总是翻转', en: 'Always flipped' }) },
];

function validStrategy(value: unknown): value is Sq1MiddleStrategy {
  return value === 'random' || value === 'never' || value === 'always';
}

function readPreferences(): { selected: Set<string>; middle: Sq1MiddleStrategy } {
  if (typeof window === 'undefined') return { selected: new Set(ALL_IDS), middle: 'random' };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      selectedIds?: unknown;
      middle?: unknown;
    };
    const selected = Array.isArray(stored.selectedIds)
      ? new Set(stored.selectedIds.filter((id): id is string => typeof id === 'string' && ALL_IDS.has(id)))
      : new Set(ALL_IDS);
    return { selected, middle: validStrategy(stored.middle) ? stored.middle : 'random' };
  } catch {
    return { selected: new Set(ALL_IDS), middle: 'random' };
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select, button, [contenteditable="true"]');
}

export default function Sq1AlgorithmTrainer() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ALL_IDS));
  const [middle, setMiddle] = useState<Sq1MiddleStrategy>('random');
  const [round, setRound] = useState<Sq1AlgTrainerRound | null>(null);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const generate = useCallback((specificCase?: Sq1AlgTrainerCase) => {
    const item = specificCase ?? chooseSq1AlgTrainerCase(selected);
    if (!item) {
      setRound(null);
      setError(tr({ zh: '请先选择至少一个情况。', en: 'Select at least one case first.' }));
      return;
    }
    try {
      setRound(createSq1AlgTrainerRound(item, middle));
      setAnswerVisible(false);
      setError('');
    } catch {
      setError(tr({ zh: '这次未能生成合法打乱，请再试一次。', en: 'A legal scramble could not be generated. Please try again.' }));
    }
  }, [middle, selected]);

  useEffect(() => {
    const preferences = readPreferences();
    setSelected(preferences.selected);
    setMiddle(preferences.middle);
    const initial = chooseSq1AlgTrainerCase(preferences.selected);
    if (initial) {
      try {
        setRound(createSq1AlgTrainerRound(initial, preferences.middle));
      } catch {
        setError(tr({ zh: '这次未能生成合法打乱，请再试一次。', en: 'A legal scramble could not be generated. Please try again.' }));
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistItem(STORAGE_KEY, JSON.stringify({ selectedIds: [...selected], middle }));
  }, [hydrated, middle, selected]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return;
      event.preventDefault();
      generate();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generate]);

  const selectedCount = selected.size;
  const inspectHref = round ? `/alg/sq1/inspect?alg=${encodeURIComponent(round.scramble)}` : '/alg/sq1/inspect';
  const selectionStatus = useMemo(() => tr({
    zh: `已选 ${selectedCount} / ${SQ1_ALG_TRAINER_CASES.length}`,
    en: `${selectedCount} / ${SQ1_ALG_TRAINER_CASES.length} selected`,
  }), [selectedCount]);

  const replaceSelection = (ids: Iterable<string>) => setSelected(new Set(ids));
  const toggleCase = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className={styles.trainer}>
      <div className={styles.toolbar}>
        <button className={styles.secondary} type="button" disabled={!round} onClick={() => round && generate(round.case)}>
          {tr({ zh: '重复情况', en: 'Repeat case' })}
        </button>
        <button className={styles.primary} type="button" disabled={selectedCount === 0} onClick={() => generate()}>
          {tr({ zh: '新打乱', en: 'New scramble' })}
        </button>
        <Link className={styles.secondaryLink} href={inspectHref} prefetch={false} aria-disabled={!round} tabIndex={round ? undefined : -1}>
          {tr({ zh: '检查打乱', en: 'Inspect' })}
        </Link>
        <span className={styles.shortcut}>{tr({ zh: 'Space 新打乱', en: 'Space: new scramble' })}</span>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {round ? (
        <section className={styles.stage} aria-live="polite">
          <Sq1StateSvg
            className={styles.preview}
            state={round.state}
            label={tr({ zh: '当前 SQ1 情况', en: 'Current Square-1 case' })}
          />
          <div className={styles.prompt}>
            <p className={styles.scrambleLabel}>{tr({ zh: '打乱', en: 'Scramble' })}</p>
            <p className={styles.scramble}>{round.scramble}</p>
            <BoolToggle
              value={answerVisible}
              onChange={setAnswerVisible}
              label={tr({ zh: '显示答案', en: 'Show answer' })}
            />
            {answerVisible && (
              <div className={styles.answer}>
                <p><strong>{round.case.name}</strong> <span>{round.case.parity === 'odd' ? tr({ zh: '奇排列', en: 'Odd parity' }) : tr({ zh: '偶排列', en: 'Even parity' })}</span></p>
                <p className={styles.algorithm}>{round.case.algorithm || tr({ zh: '直觉复形', en: 'Intuitive cubeshape' })}</p>
              </div>
            )}
          </div>
        </section>
      ) : !error ? (
        <p className={styles.empty}>{tr({ zh: '选择情况后生成第一条打乱。', en: 'Select cases, then generate your first scramble.' })}</p>
      ) : null}

      <section className={styles.settings} aria-labelledby="sq1-alg-trainer-settings">
        <h2 id="sq1-alg-trainer-settings">{tr({ zh: '训练设置', en: 'Training settings' })}</h2>
        <div className={styles.middleRow}>
          <span>{tr({ zh: '中层', en: 'Middle layer' })}</span>
          <ListSelect
            items={MIDDLE_ITEMS}
            value={middle}
            onChange={(value) => { if (validStrategy(value)) setMiddle(value); }}
            allLabel={tr({ zh: '随机', en: 'Random' })}
            clearable={false}
          />
        </div>
      </section>

      <section className={styles.caseSelection} aria-labelledby="sq1-alg-trainer-cases">
        <div className={styles.selectionHeading}>
          <h2 id="sq1-alg-trainer-cases">{tr({ zh: '情况范围', en: 'Case selection' })}</h2>
          <span aria-live="polite">{selectionStatus}</span>
        </div>
        <div className={styles.selectionActions}>
          <button className={styles.selectionButton} type="button" onClick={() => replaceSelection(ALL_IDS)}>{tr({ zh: '全部', en: 'All' })}</button>
          <button className={styles.selectionButton} type="button" onClick={() => replaceSelection([])}>{tr({ zh: '清空', en: 'None' })}</button>
          <button className={styles.selectionButton} type="button" onClick={() => replaceSelection(SQ1_ALG_TRAINER_CASES.filter((item) => item.parity === 'even').map((item) => item.id))}>{tr({ zh: '全部偶排列', en: 'All even' })}</button>
          <button className={styles.selectionButton} type="button" onClick={() => replaceSelection(SQ1_ALG_TRAINER_CASES.filter((item) => item.parity === 'odd').map((item) => item.id))}>{tr({ zh: '全部奇排列', en: 'All odd' })}</button>
        </div>
        <div className={styles.groups}>
          {SQ1_ALG_TRAINER_GROUPS.map((group) => (
            <details key={group.id} className={styles.group}>
              <summary>{tr(GROUP_LABELS[group.id])}</summary>
              {(['even', 'odd'] as const).map((parity) => {
                const cases = group.cases.filter((item) => item.parity === parity);
                if (cases.length === 0) return null;
                return (
                  <div key={parity} className={styles.parityGroup}>
                    <h3>{parity === 'odd' ? tr({ zh: '奇排列', en: 'Odd parity' }) : tr({ zh: '偶排列', en: 'Even parity' })}</h3>
                    <div className={styles.caseButtons}>
                      {cases.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`${styles.caseButton} ${selected.has(item.id) ? styles.selected : ''}`}
                          aria-pressed={selected.has(item.id)}
                          onClick={() => toggleCase(item.id)}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
