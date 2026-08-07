'use client';

/**
 * 训练页顶部的「这一套我练到哪了」进度条 —— 把 /alg/progress 的核心信息前置到正在练的地方。
 *
 * 一条三段进度条(已掌握 / 不熟 / 未学)+ 右侧几个可点的数字:到期、今日已复习、
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
  untouched: number;
  total: number;
}

/** 从标记表里数一套(scope 内)的三态分布。 */
export function countSetProgress(
  keys: string[], status: (k: string) => 'learning' | 'mastered' | undefined,
): SetProgressCounts {
  let mastered = 0, learning = 0;
  for (const k of keys) {
    const s = status(k);
    if (s === 'mastered') mastered++;
    else if (s === 'learning') learning++;
  }
  return { mastered, learning, untouched: keys.length - mastered - learning, total: keys.length };
}

export default function SetProgressStrip({
  keys, selectHref, onStartMemo, compact, showSrs = true, showAllLink = true, showBar = true,
}: {
  /** 本页范围内的全部 case key(scope 生效时 = 该组)。 */
  keys: string[];
  /** select 页地址(带 scope),点标记数跳过去并带 ?mark= 过滤。 */
  selectHref: string;
  /** 点「到期 N」切进记忆模式;不传则该数字只做展示。 */
  onStartMemo?: () => void;
  /** 紧凑版(训练页顶栏下):省掉标题。 */
  compact?: boolean;
  /**
   * 记忆调度那三个数(待复习 / 今日复习 / 连续天)出不出。训练模式传 false ——
   * 随机抽题不排期也不推进它们,摆着只是噪音。标记三态(已掌握/不熟/未学)不受影响:
   * 那是手动标的,哪个模式都在标。
   */
  showSrs?: boolean;
  /** 「进度总览」出不出。run 页传 false —— 那条链接挪到齿轮旁边去了。 */
  showAllLink?: boolean;
  /**
   * 三段横条出不出。记忆模式传 false:那边自己有一条「本场进度」横条,两条长得一样
   * 却讲两件事(整套学习进度 vs 本场队列),并排摆着只会让人分不清在看哪个。
   * 数字仍留着 —— 一行文字不会跟横条打架。
   */
  showBar?: boolean;
}) {
  const marks = useTrainerMarks(s => s.marks);
  const recs = useAlgSrs(s => s.recs);
  const daily = useAlgSrs(s => s.daily);
  const sessionCount = useAlgSrs(s => s.sessionCount);

  const counts = useMemo(
    () => countSetProgress(keys, k => markStatus(marks, k)),
    [keys, marks],
  );
  const due = useMemo(() => {
    const now = Date.now();
    let n = 0;
    for (const k of keys) {
      const r = recs[k];
      if (r && r.n > 0 && r.d <= now) n++;
    }
    return n;
  }, [keys, recs]);

  const todayCount = Math.max(daily[dayKey(Date.now())]?.[0] ?? 0, sessionCount);
  const streak = useMemo(() => streakDays(daily, Date.now()), [daily]);

  if (counts.total === 0) return null;
  const pct = (n: number) => `${(n / counts.total) * 100}%`;
  const markHref = (m: string) => `${selectHref}${selectHref.includes('?') ? '&' : '?'}mark=${m}`;

  return (
    <div className={`trainer-strip${compact ? ' is-compact' : ''}`} data-no-timer>
      {showBar && (
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
        </div>
      )}

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

        {showSrs && (
          <>
            <span className="trainer-strip-sep" aria-hidden />

            {onStartMemo ? (
              <button
                type="button"
                className={`trainer-strip-num is-due${due > 0 ? ' is-hot' : ''}`}
                onClick={onStartMemo}
                title={tr({ zh: '进记忆模式复习到期卡片', en: 'Review the due cards in memory mode' })}
              >
                <b>{due}</b>
                <span>{tr({ zh: '到期', en: 'due' })}</span>
              </button>
            ) : (
              <span className={`trainer-strip-num is-due${due > 0 ? ' is-hot' : ''}`}>
                <b>{due}</b>
                <span>{tr({ zh: '到期', en: 'due' })}</span>
              </span>
            )}
            <span className="trainer-strip-num">
              <b>{todayCount}</b>
              <span>{tr({ zh: '今日已复习', en: 'today' })}</span>
            </span>
            {streak > 0 && (
              <span className="trainer-strip-num is-streak" title={tr({ zh: '连续复习天数', en: 'Review streak' })}>
                <b><Flame size={13} />{streak}</b>
                <span>{tr({ zh: '连续天', en: 'day streak' })}</span>
              </span>
            )}
          </>
        )}

        {showAllLink && (
          <Link href="/alg/progress" className="trainer-strip-more" prefetch={false}>
            {tr({ zh: '进度', en: 'Progress' })}<ChevronRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}
