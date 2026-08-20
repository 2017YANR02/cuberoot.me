'use client';

/**
 * /alg/progress/cases — 「不熟 / 已掌握 / 未学」点开之后的那张清单。
 *
 * progress 页只报计数,这里回答「那些究竟是谁」:每行一张图 + **公式文本** + 忘过几次 / 何时到期。
 * 公式取和缩略图同一条(`algs[0] ?? standard`),图文不会打架。
 *
 * 三层数据,按需拉:
 *   ① 哪些套有记录 —— progress 页同款总览(计数,便宜)
 *   ② 那些套的标记明细 + 记忆排期 —— 逐套拉,套数是个位数
 *   ③ case 本体(图 / 公式)—— 每套几百 KB,**只拉当前这档真的会出现的套**
 * 「未学」是补集,必须有整套 key 才算得出来 —— 虚拟集(LSLL 57 万)算不出,单独说明。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, Loader2, Dumbbell } from 'lucide-react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ALG_PUZZLES, loadAlg, type AlgPuzzle, type AlgCase } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { CaseThumb } from '@/components/CaseThumb';
import { eventDisplayName } from '@/lib/wca-events';
import { virtualAlgSet } from '@/lib/alg-virtual-sets';
import { setLabel } from '@/lib/alg-mix';
import { loadMarkOverview, loadMarkDetails, MARK_STATUS_LABEL, type CaseMarks } from '@/lib/trainer-marks';
import { loadSrsDashboard } from '@/lib/alg-srs-store';
import { type SrsRecs, MASTER_DAYS } from '@/lib/alg-srs';
import { mixSessionId, presetSessionSelection } from '@/lib/trainer-store';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import { primaryCaseName } from '@/lib/alg_case_display';
import { algCaseHref } from '@/lib/alg_case_link';
import {
  collectCases, sortCases, drillQueue, groupByPuzzle,
  CASE_FILTERS, CASE_SORTS, type CaseFilter, type CaseSort,
  type SetCaseSource, type ProgressCase,
} from '@/lib/alg-progress-cases';
import { tr } from '@/i18n/tr';
import '../../alg.css';
import '../progress.css';
import './cases.css';

const FILTER_LABEL: Record<CaseFilter, () => string> = {
  learning: () => MARK_STATUS_LABEL.learning(),
  mastered: () => MARK_STATUS_LABEL.mastered(),
  none: () => tr({ zh: '未学', en: 'New' }),
};

const SORT_LABEL: Record<CaseSort, () => string> = {
  weak: () => tr({ zh: '最该回头看', en: 'Shakiest first' }),
  due: () => tr({ zh: '快到期', en: 'Due soonest' }),
  set: () => tr({ zh: '按公式集', en: 'By set' }),
};

/** 「3 天后 / 今天 / 逾期 2 天」。没记录 = 还没进排期。 */
function dueLabel(d: number | undefined, now: number): string {
  if (d == null) return tr({ zh: '未排期', en: 'Not scheduled' });
  const days = Math.round((d - now) / 86_400_000);
  if (days <= -1) return tr({ zh: `逾期 ${-days} 天`, en: `${-days}d overdue` });
  if (days <= 0) return tr({ zh: '今天', en: 'Today' });
  if (days === 1) return tr({ zh: '明天', en: 'Tomorrow' });
  return tr({ zh: `${days} 天后`, en: `in ${days}d` });
}

interface PageData {
  /** `puzzle/set` → 标记明细。 */
  marks: Record<string, CaseMarks>;
  /** `puzzle/set` → 记忆排期。 */
  recs: Record<string, SrsRecs>;
  /** 有记录的套。 */
  sets: Array<{ puzzle: AlgPuzzle; set: string }>;
}

export default function AlgProgressCasesPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [filter, setFilter] = useQueryState(
    'mark', parseAsStringEnum([...CASE_FILTERS]).withDefault('learning'),
  );
  const [sort, setSort] = useQueryState(
    'sort', parseAsStringEnum([...CASE_SORTS]).withDefault('weak'),
  );
  /** 只看某一套(`puzzle/slug`)。progress 页每套那行的数字带它进来。 */
  const [scope, setScope] = useQueryState('set');

  const [data, setData] = useState<PageData | null>(null);
  /** `puzzle/set` → 整套 case(图 + 公式的来源)。按当前档按需灌进来。 */
  const [algBySet, setAlgBySet] = useState<Record<string, AlgCase[]>>({});
  const [loadingAlgs, setLoadingAlgs] = useState(false);

  // ① + ②:哪些套有记录,以及它们的标记 / 排期明细
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [ov, srs] = await Promise.all([loadMarkOverview(), loadSrsDashboard(Date.now())]);
      const keys = new Set([...Object.keys(ov), ...Object.keys(srs.recs)]);
      const sets: PageData['sets'] = [];
      for (const k of keys) {
        const [p, ...rest] = k.split('/');
        if (!(ALG_PUZZLES as readonly string[]).includes(p)) continue;
        sets.push({ puzzle: p as AlgPuzzle, set: rest.join('/') });
      }
      const marks = await loadMarkDetails(sets);
      if (alive) setData({ marks, recs: srs.recs, sets });
    })();
    return () => { alive = false; };
  }, []);

  /** `?set=` 限定的那一套;没限定就是全部有记录的套。 */
  const scopedSets = useMemo(
    () => (data ? data.sets.filter(s => !scope || `${s.puzzle}/${s.set}` === scope) : []),
    [data, scope],
  );

  /**
   * 这一档真的需要哪些套的 case 本体。不熟 / 已掌握从标记里就知道有没有命中,
   * 只有命中的套才值得下载;「未学」是补集,必须把有记录的套全拉下来才算得出来。
   */
  const neededSets = useMemo(() => {
    if (!data) return [];
    return scopedSets.filter(({ puzzle, set }) => {
      const virtual = virtualAlgSet(puzzle, set);
      if (virtual && !virtual.loadCasesByKeys) return false;
      if (virtual && filter === 'none') return false;   // 少量已标记 key 不能拿来算全集补集
      if (filter === 'none') return true;
      const m = data.marks[`${puzzle}/${set}`] ?? {};
      for (const k in m) {
        const v = m[k];
        if (v.s === filter) return true;
      }
      return false;
    });
  }, [data, scopedSets, filter]);

  // ③:按需拉 case 本体。已经拉过的不重拉(切档来回不会重复下载)
  useEffect(() => {
    const missing = neededSets.filter(s => !(`${s.puzzle}/${s.set}` in algBySet));
    if (missing.length === 0) { setLoadingAlgs(false); return; }
    let alive = true;
    setLoadingAlgs(true);
    void Promise.all(missing.map(({ puzzle, set }) => {
      const ps = `${puzzle}/${set}`;
      const virtual = virtualAlgSet(puzzle, set);
      const load = virtual?.loadCasesByKeys
        ? virtual.loadCasesByKeys(
            Object.entries(data?.marks[ps] ?? {})
              .filter(([, mark]) => mark.s != null)
              .map(([key]) => key),
          )
        : loadAlg(puzzle, set).then(f => f.cases);
      return load
        .then(cases => [ps, cases] as const)
        .catch(() => [ps, [] as AlgCase[]] as const);
    })).then(pairs => {
      if (!alive) return;
      setAlgBySet(prev => ({ ...prev, ...Object.fromEntries(pairs) }));
      setLoadingAlgs(false);
    });
    return () => { alive = false; };
  }, [neededSets, algBySet, data]);

  const sources = useMemo<SetCaseSource[]>(() => {
    if (!data) return [];
    return scopedSets.map(({ puzzle, set }) => {
      const ps = `${puzzle}/${set}`;
      const cases = algBySet[ps];
      const virtual = virtualAlgSet(puzzle, set);
      return {
        puzzle, set,
        marks: data.marks[ps] ?? {},
        recs: data.recs[ps],
        allKeys: !virtual && cases ? cases.map(caseKey) : undefined,
      };
    });
  }, [data, scopedSets, algBySet]);

  const rows = useMemo(
    () => sortCases(collectCases(sources, filter), sort),
    [sources, filter, sort],
  );
  const byPuzzle = useMemo(() => groupByPuzzle(rows), [rows]);

  /** 「未学」这一档里,算不出补集的套(虚拟集)—— 数字报不了就明说,不装作没有。 */
  const unlistable = useMemo(() => {
    if (filter !== 'none') return [];
    return scopedSets.filter(s => virtualAlgSet(s.puzzle, s.set));
  }, [filter, scopedSets]);

  /**
   * 「专练」:算好队列写进那场会话的勾选,再由链接本身跳过去。
   *
   * 用真链接(不是 button + router.push)是为了中键新开;而中键不触发 click,所以落盘挂在
   * mousedown 上 —— 左键 / 中键都会先经过它,键盘 Enter 再由 onClick 兜住。
   */
  const drillFor = useCallback((puzzle: AlgPuzzle, cases: ProgressCase[]) => {
    const queue = drillQueue(cases, Date.now());
    if (queue.length === 0) return null;
    const sets = [...new Set(queue.map(c => c.set))].sort();
    // 一套就是一场普通会话;多套才走合练(合练 key 要带 set 前缀,与 caseKey 的约定一致)
    const single = sets.length === 1;
    const sessionId = single ? sets[0] : mixSessionId(sets);
    const keys = queue.map(c => (single ? c.key : `${c.set}:${c.key}`));
    const href = single
      ? `/alg/${puzzle}/${sets[0]}/run`
      : `/alg/${puzzle}/mix/run?sets=${sets.map(encodeURIComponent).join(',')}`;
    return { href, n: queue.length, apply: () => presetSessionSelection(puzzle, sessionId, keys) };
  }, []);

  const loading = data == null;

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg/progress" className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '学习进度', en: 'Progress' })}
        </Link>
        <h1 className="alg-cat-title">
          <span>{tr({ zh: '公式清单', en: 'Algorithm list' })}</span>
        </h1>
      </div>

      <div className="alg-prog-body">
        <div className="alg-cases-toolbar">
          <label className="alg-cases-tool">
            <span>{tr({ zh: '看', en: 'Show' })}</span>
            <select className="alg-cases-select" value={filter}
              onChange={e => void setFilter(e.target.value as CaseFilter)}>
              {CASE_FILTERS.map(f => <option key={f} value={f}>{FILTER_LABEL[f]()}</option>)}
            </select>
          </label>
          <label className="alg-cases-tool">
            <span>{tr({ zh: '排序', en: 'Sort' })}</span>
            <select className="alg-cases-select" value={sort}
              onChange={e => void setSort(e.target.value as CaseSort)}>
              {CASE_SORTS.map(s => <option key={s} value={s}>{SORT_LABEL[s]()}</option>)}
            </select>
          </label>
          {/* 从某一套点进来时,说清楚现在只看它 —— 否则「怎么只有这么几个」无从解释 */}
          {scope && scopedSets.length > 0 && (
            <button
              type="button"
              className="alg-cases-scope"
              onClick={() => void setScope(null)}
              aria-label={tr({ zh: '看全部公式集', en: 'Show all sets' })}
            >
              {setLabel(scopedSets[0].puzzle, scopedSets[0].set)}
              <span aria-hidden>×</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="alg-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div>
        ) : (
          <>
            {loadingAlgs && (
              <div className="alg-prog-loading">
                <Loader2 size={15} className="alg-prog-spin" /> {tr({ zh: '加载公式…', en: 'Loading algorithms…' })}
              </div>
            )}

            {rows.length === 0 && !loadingAlgs && (
              <div className="alg-empty">
                {tr({
                  zh: `没有「${FILTER_LABEL[filter]()}」的公式。`,
                  en: `Nothing marked ${FILTER_LABEL[filter]().toLowerCase()}.`,
                })}
              </div>
            )}

            {ALG_PUZZLES.filter(p => byPuzzle.has(p)).map(p => {
              const cases = byPuzzle.get(p)!;
              // 「未学」这档不给专练按钮:队列只收不熟 / 忘过,在一张全是新 case 的表上
              // 会算出「专练 1」对着「70」,读起来像坏了。未学的下一步是去学,不是专练
              const drill = filter === 'none' ? null : drillFor(p, cases);
              return (
                <section key={p} className="alg-prog-section">
                  <h2 className="alg-cases-group-title">
                    <EventIcon event={p} className="alg-prog-group-icon" />
                    <span>{eventDisplayName(p, isZh)}</span>
                    <i className="alg-cases-count">{cases.length}</i>
                    {drill && (
                      <Link
                        href={drill.href}
                        className="alg-cases-drill"
                        prefetch={false}
                        onMouseDown={drill.apply}
                        onClick={drill.apply}
                      >
                        <Dumbbell size={13} />
                        {tr({ zh: `专练 ${drill.n}`, en: `Drill ${drill.n}` })}
                      </Link>
                    )}
                  </h2>
                  <div className="alg-cases-list">
                    {cases.map(row => (
                      <CaseRow key={`${row.ps}|${row.key}`} row={row} cases={algBySet[row.ps]} />
                    ))}
                  </div>
                </section>
              );
            })}

            {unlistable.length > 0 && (
              <p className="alg-prog-sub">
                {tr({
                  zh: `${unlistable.map(s => setLabel(s.puzzle, s.set)).join('、')} 的「未学」列不出来:这套是按需枚举的,没有一张固定的全表可以拿来相减。不熟和已掌握照常显示。`,
                  en: `“New” cannot be listed for ${unlistable.map(s => setLabel(s.puzzle, s.set)).join(', ')} — that set is enumerated on demand, so there is no fixed full list to subtract from. Shaky and mastered cases still show.`,
                })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 一行 = 图 + 名字 + 公式 + 记忆状态。case 本体还没到 / 查不到时只降级掉图和公式,不整行消失。 */
function CaseRow({ row, cases }: { row: ProgressCase; cases: AlgCase[] | undefined }) {
  const now = Date.now();
  const c = cases ? findCaseByKey(cases, row.key) : undefined;
  const alg = c ? (c.algs.flat()[0]?.alg ?? c.standard ?? '') : '';
  const name = c ? primaryCaseName(row.puzzle, row.set, c) : (row.key.split('|').pop() ?? row.key);
  const virtual = virtualAlgSet(row.puzzle, row.set);
  const href = c
    ? (virtual ? virtual.caseHref(c) : algCaseHref(row.puzzle, row.set, c))
    : (virtual ? virtual.selectHref(null) : `/alg/${row.puzzle}/${row.set}`);

  return (
    <Link href={href} className="alg-case-row" prefetch={false}>
      {c
        ? <CaseThumb puzzle={row.puzzle} set={row.set} sticker={c.sticker}
            alg={alg} setup={c.setup} size={54} />
        : <span className="alg-case-blank" aria-hidden />}
      <span className="alg-case-main">
        <span className="alg-case-name">
          {name}
          <i className="alg-case-set">{setLabel(row.puzzle, row.set)}</i>
        </span>
        <code className="alg-case-alg">{alg || tr({ zh: '公式未加载', en: 'algorithm unavailable' })}</code>
      </span>
      <span className="alg-case-meta">
        {row.status && <b className={`alg-case-tag is-${row.status}`}>{MARK_STATUS_LABEL[row.status]()}</b>}
        {row.rec && row.rec.l > 0 && (
          <b className="alg-case-tag is-lapse">{tr({ zh: `忘过 ${row.rec.l}`, en: `${row.rec.l}× lapsed` })}</b>
        )}
        <i>{dueLabel(row.rec?.d, now)}</i>
        {row.rec && row.rec.iv >= MASTER_DAYS && (
          <i className="alg-case-mature">{tr({ zh: '长期记住', en: 'Long-term' })}</i>
        )}
      </span>
    </Link>
  );
}
