'use client';

/**
 * 训练页顶部的「这一套我练到哪了」进度条 —— 把 /alg/progress 的核心信息前置到正在练的地方。
 *
 * 一条四段进度条(已掌握 / 不熟 / 搁置 / 未学)+ 右侧几个可点的数字:到期、今日已复习、
 * 连续天数。数字本身就是入口:点「到期」直接切进记忆模式,点标记数跳到 select 页的对应筛选。
 *
 * 只读 —— 它不改任何状态,数据全来自 trainer-marks / alg-srs 两个 store。
 */
import { useMemo } from 'react';
import Link from '@/components/AppLink';
import { Flame, ChevronRight } from 'lucide-react';
import { useTrainerMarks, markStatus } from '@/lib/trainer-marks';
import { useAlgSrs } from '@/lib/alg-srs-store';
import { streakDays, dayKey } from '@/lib/alg-srs';
import { tr } from '@/i18n/tr';

export interface SetProgressCounts {
  mastered: number;
  learning: number;
  paused: number;
  untouched: number;
  total: number;
}

/** 从标记表里数一套(scope 内)的四态分布。 */
export function countSetProgress(
  keys: string[], status: (k: string) => 'learning' | 'mastered' | 'paused' | undefined,
): SetProgressCounts {
  let mastered = 0, learning = 0, paused = 0;
  for (const k of keys) {
    const s = status(k);
    if (s === 'mastered') mastered++;
    else if (s === 'learning') learning++;
    else if (s === 'paused') paused++;
  }
  return { mastered, learning, paused, untouched: keys.length - mastered - learning - paused, total: keys.length };
}

export default function SetProgressStrip({
  keys, selectHref, onStartMemo, compact,
}: {
  /** 本页范围内的全部 case key(scope 生效时 = 该组)。 */
  keys: string[];
  /** select 页地址(带 scope),点标记数跳过去并带 ?mark= 过滤。 */
  selectHref: string;
  /** 点「到期 N」切进记忆模式;不传则该数字只做展示。 */
  onStartMemo?: () => void;
  /** 紧凑版(训练页顶栏下):省掉标题。 */
  compact?: boolean;
}) {
  const marks = useTrainerMarks(s => s.marks);
  const recs = useAlgSrs(s => s.recs);
  const daily = useAlgSrs(s => s.daily);
  const sessionCount = useAlgSrs(s => s.sessionCount);

  const counts = useMemo(
    () => countSetProgress(keys, k => markStatus(marks, k)),
    [keys, marks],
  );
  // 记忆队列跳过「搁置」(见 MemoryTrainer),这里也得跳 —— 否则点进去发现没那么多卡,
  // 这个数字就是在骗人。
  const due = useMemo(() => {
    const now = Date.now();
    let n = 0;
    for (const k of keys) {
      if (markStatus(marks, k) === 'paused') continue;
      const r = recs[k];
      if (r && r.n > 0 && r.d <= now) n++;
    }
    return n;
  }, [keys, recs, marks]);

  const todayCount = Math.max(daily[dayKey(Date.now())]?.[0] ?? 0, sessionCount);
  const streak = useMemo(() => streakDays(daily, Date.now()), [daily]);

  if (counts.total === 0) return null;
  const pct = (n: number) => `${(n / counts.total) * 100}%`;
  const markHref = (m: string) => `${selectHref}${selectHref.includes('?') ? '&' : '?'}mark=${m}`;

  return (
    <div className={`trainer-strip${compact ? ' is-compact' : ''}`} data-no-timer>
      <div
        className="trainer-strip-bar"
        role="img"
        aria-label={tr({
          zh: `已掌握 ${counts.mastered} / ${counts.total}`,
          en: `${counts.mastered} of ${counts.total} mastered`,
        })}
      >
        <span className="is-mastered" style={{ width: pct(counts.mastered) }} />
        <span className="is-learning" style={{ width: pct(counts.learning) }} />
        <span className="is-paused" style={{ width: pct(counts.paused) }} />
      </div>

      <div className="trainer-strip-nums">
        <Link href={markHref('mastered')} className="trainer-strip-num is-mastered" prefetch={false}>
          <b>{counts.mastered}</b>
          <span>{tr({ zh: '已掌握', en: 'mastered' })}</span>
        </Link>
        {counts.learning > 0 && (
          <Link href={markHref('learning')} className="trainer-strip-num is-learning" prefetch={false}>
            <b>{counts.learning}</b>
            <span>{tr({ zh: '不熟', en: 'shaky' })}</span>
          </Link>
        )}
        <Link href={markHref('none')} className="trainer-strip-num" prefetch={false}>
          <b>{counts.untouched}</b>
          <span>{tr({ zh: '未学', en: 'new' })}</span>
        </Link>

        <span className="trainer-strip-sep" aria-hidden />

        {onStartMemo ? (
          <button
            type="button"
            className={`trainer-strip-num is-due${due > 0 ? ' is-hot' : ''}`}
            onClick={onStartMemo}
            title={tr({ zh: '进记忆模式复习到期卡片', en: 'Review the due cards in memory mode' })}
          >
            <b>{due}</b>
            <span>{tr({ zh: '待复习', en: 'due' })}</span>
          </button>
        ) : (
          <span className={`trainer-strip-num is-due${due > 0 ? ' is-hot' : ''}`}>
            <b>{due}</b>
            <span>{tr({ zh: '待复习', en: 'due' })}</span>
          </span>
        )}
        <span className="trainer-strip-num">
          <b>{todayCount}</b>
          <span>{tr({ zh: '今日复习', en: 'today' })}</span>
        </span>
        {streak > 0 && (
          <span className="trainer-strip-num is-streak" title={tr({ zh: '连续复习天数', en: 'Review streak' })}>
            <b><Flame size={13} />{streak}</b>
            <span>{tr({ zh: '连续天', en: 'day streak' })}</span>
          </span>
        )}

        <Link href="/alg/progress" className="trainer-strip-more" prefetch={false}>
          {tr({ zh: '进度总览', en: 'All progress' })}<ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}
