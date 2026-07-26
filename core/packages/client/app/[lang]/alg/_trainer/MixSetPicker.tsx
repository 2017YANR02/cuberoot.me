'use client';

/**
 * 合练缺成员时的现场选集器。
 *
 * `/alg/<puzzle>/mix/{run,select}` 不带 `?sets=`(或只带一套)时,页面原本只甩一句
 * 「至少要选两套」—— 这页没有任何可点的东西,是死路。这里把该选的直接摆出来:
 * 勾两套以上原地进合练,存过的组合一键开练,再给一条回全部公式集的出口。
 *
 * 动作一律真 `<a>`(href 由勾选算出)—— 中键 / Ctrl 点能新开标签页。
 */
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { ALG_CATALOG, type AlgPuzzle } from '@cuberoot/shared';
import { MIX_MIN_SETS, mixHref } from '@/lib/alg-mix';
import { useSavedMixes } from '@/lib/alg-mix-saved';
import { tr } from '@/i18n/tr';

interface MixSetPickerProps {
  puzzle: AlgPuzzle;
  /** URL 里的 puzzle 段(可能是 event code `333`);拼 href 用原样,免得把用户弹到另一条路径 */
  puzzleParam: string;
  /** 用户本来要去哪一层 —— 选够成员就送他去那儿 */
  leaf: 'run' | 'select';
  /** URL 里已解析出的成员(通常 0 或 1 套) */
  initial: readonly string[];
}

export default function MixSetPicker({ puzzle, puzzleParam, leaf, initial }: MixSetPickerProps) {
  const [picked, setPicked] = useState<string[]>(() => [...initial]);
  const saved = useSavedMixes(s => s.list);
  const hydrate = useSavedMixes(s => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  const sets = ALG_CATALOG[puzzle] ?? [];
  const mine = saved.filter(m => m.puzzle === puzzle);
  const ready = picked.length >= MIX_MIN_SETS;
  const toggle = (slug: string) =>
    setPicked(cur => (cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug]));

  return (
    <div className="trainer-mix-pick">
      <h1 className="trainer-mix-pick-title">{tr({ zh: '合练', en: 'Combined drill' })}</h1>
      <p className="trainer-mix-pick-hint">
        {tr({
          zh: '选两套以上一起练。进度仍按各套分别记 —— 合练里标的,单独练那套时照样看得见。',
          en: 'Pick two or more sets to drill together. Progress still lands in each set — what you mark here shows up when you drill that set alone.',
        })}
      </p>

      <div className="trainer-mix-pick-grid">
        {sets.map((s) => {
          const on = picked.includes(s.slug);
          return (
            <button
              key={s.slug}
              type="button"
              className={`trainer-mix-pick-item${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(s.slug)}
            >
              {tr(s)}
            </button>
          );
        })}
      </div>

      <div className="trainer-mix-pick-actions">
        {ready ? (
          <>
            <Link href={mixHref(puzzleParam, picked, leaf)} className="trainer-opts-btn" prefetch={false}>
              {leaf === 'run'
                ? tr({ zh: '开始合练', en: 'Start drilling' })
                : tr({ zh: '挑 case', en: 'Pick cases' })} ({picked.length})
            </Link>
            <Link
              href={mixHref(puzzleParam, picked, leaf === 'run' ? 'select' : 'run')}
              className="trainer-opts-btn is-ghost"
              prefetch={false}
            >
              {leaf === 'run'
                ? tr({ zh: '先挑 case', en: 'Pick cases first' })
                : tr({ zh: '直接开练', en: 'Drill now' })}
            </Link>
          </>
        ) : (
          <span className="trainer-mix-pick-need">
            {picked.length === 0
              ? tr({ zh: '勾两套开始', en: 'Tick two sets to start' })
              : tr({ zh: '再勾一套就能开练', en: 'One more set to go' })}
          </span>
        )}
        <Link href={`/alg/${puzzleParam}`} className="trainer-mix-pick-back" prefetch={false}>
          {tr({ zh: '看全部公式集', en: 'Browse all sets' })}
        </Link>
      </div>

      {mine.length > 0 && (
        <div className="trainer-mix-pick-saved">
          <span className="trainer-opts-label">{tr({ zh: '我的合集', en: 'My mixes' })}</span>
          {mine.map(m => (
            <Link key={m.id} href={mixHref(puzzleParam, m.sets, leaf)} className="alg-mix-saved-link" prefetch={false}>
              {m.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
