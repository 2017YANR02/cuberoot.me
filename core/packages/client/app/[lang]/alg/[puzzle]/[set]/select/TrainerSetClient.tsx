'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerSelectPage.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useRouter, useParams } from 'next/navigation';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eraser, MousePointer2 } from 'lucide-react';
import { getAlgSetMeta, loadAlg, type AlgCase } from '@cuberoot/shared';
import { MIX_SLUG, MIX_MIN_SETS, parseMixSets, mixTitle, mixHref, loadMixCases, setLabel } from '@/lib/alg-mix';
import { useTrainerStore, mixSessionId } from '@/lib/trainer-store';
import {
  useTrainerMarks, markStatus, MARK_STATUS_LABEL,
  type TrainerMarkBrush,
} from '@/lib/trainer-marks';
import { caseKey } from '@/lib/trainer-case-key';
import { canonicalZbllSubgroupSlug } from '@/lib/alg_zbll_subgroups';
import { sortByCp } from '@/lib/alg_cp_order';
import { displayZbllToken, primaryCaseName } from '@/lib/alg_case_display';
import { sortAlgItemsBySignedLabel } from '@/lib/alg_group_order';
import { CaseTreePicker, TrainerMarkBadge } from '@/app/[lang]/alg/_trainer/trainer-components';
import MixSetPicker from '@/app/[lang]/alg/_trainer/MixSetPicker';
import SetProgressStrip from '@/app/[lang]/alg/_trainer/SetProgressStrip';
import { ListSelect } from '@/components/ListSelect';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { useAlgSrs } from '@/lib/alg-srs-store';
import '@/app/[lang]/alg/_trainer/trainer.css';
import '@/app/[lang]/alg/_trainer/memory.css';
import { tr } from '@/i18n/tr';

/** 显示过滤:按标记只看一类(大 set 里找 case 用)。 */
const MARK_FILTERS = ['all', 'none', 'learning', 'mastered'] as const;
type MarkFilter = (typeof MARK_FILTERS)[number];

export default function TrainerSetClient() {
  const params = useParams<{ lang: string; puzzle: string; set: string }>();
  const puzzleParam = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '';
  const setSlug = (Array.isArray(params?.set) ? params.set[0] : params?.set) ?? '';
  const router = useRouter();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  // Pattern B:en 裸 URL、zh 带 /zh —— 非 Link 导航按路由参数手补前缀(同 AppLink 的判定源)
  const langPrefix = params?.lang === 'zh' ? '/zh' : '';

  // 从 subgroup 页训练按钮进来带 ?scope=<组slug>:只在该组内选 case(筛选/默认 replace)
  const [scopeParam] = useQueryState('scope');
  // 合练没有子组范围可言(?scope= 是某一套内部的分组),一律忽略
  const isMix = setSlug === MIX_SLUG;
  // 旧数字制子组 slug(u1 / pi 1 / as1 …)→ 新方向制(ur / pif / asf …),老 ?scope= 链接 / 书签不失效(migration 0081)
  const scopeSlug = isMix
    ? null
    : canonicalZbllSubgroupSlug(setSlug, scopeParam?.trim().toLowerCase() || null);
  // 按标记过滤显示(筛选 → 默认 replace)
  const [markFilter, setMarkFilter] = useQueryState(
    'mark',
    parseAsStringEnum<MarkFilter>([...MARK_FILTERS]).withDefault('all'),
  );

  const puzzle = resolveAlgPuzzle(puzzleParam);   // 接受 event code(333)或 legacy puzzle 名(3x3)

  // mix 是 SSG 哨兵页,静态 HTML 看不到 `?sets=`。客户端首帧必须继续渲染同一份
  // 加载壳,挂载后才能按 query 切到选题页,否则整棵子树会触发 hydration #418。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 合练:`/alg/<puzzle>/mix/select?sets=pll,zbll`
  const [setsParam] = useQueryState('sets');
  const mixSets = useMemo(
    () => (isMix ? parseMixSets(puzzle ?? null, setsParam) : []),
    [isMix, puzzle, setsParam],
  );
  const mixKey = mixSets.join(',');
  const mixReady = mounted && isMix && mixSets.length >= MIX_MIN_SETS;
  // 必须 memo:合练的 meta 是现造的字面量,身份每次 render 都变,而它进了装载 effect 的
  // 依赖 —— 不 memo 就是「effect → set state → 新 meta → effect」的死循环。
  const meta = useMemo(() => (
    puzzle
      ? (isMix
          ? (mixReady
              ? { zh: mixTitle(puzzle, mixSets), en: mixTitle(puzzle, mixSets) }
              : undefined)
          : getAlgSetMeta(puzzle, setSlug))
      : undefined
  ), [puzzle, isMix, mixReady, mixSets, setSlug]);

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const loadSession = useTrainerStore(s => s.loadSession);
  const loadMixSession = useTrainerStore(s => s.loadMixSession);
  const setSelected = useTrainerStore(s => s.setSelected);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);

  const marks = useTrainerMarks(s => s.marks);
  const applyMarks = useTrainerMarks(s => s.applyMarks);
  const loadMarks = useTrainerMarks(s => s.loadMarks);
  const loadMarksMulti = useTrainerMarks(s => s.loadMarksMulti);
  const loadSrs = useAlgSrs(s => s.loadSrs);
  const loadSrsMulti = useAlgSrs(s => s.loadSrsMulti);
  /** 画笔:null = 普通选择;其余 = 点 cell / 组头 涂该标记(再涂同标记 = 清除)。会话内状态,不进 URL。 */
  const [brush, setBrush] = useState<TrainerMarkBrush | null>(null);

  useEffect(() => {
    if (!puzzle || !meta) return;
    if (isMix) {
      const sets = mixKey.split(',').filter(Boolean);
      loadMarksMulti(puzzle, sets);
      loadSrsMulti(puzzle, sets);
      return;
    }
    loadMarks(puzzle, setSlug);
    loadSrs(puzzle, setSlug);   // 顶部进度条要显示「待复习」
  }, [puzzle, setSlug, meta, isMix, mixKey, loadMarks, loadSrs, loadMarksMulti, loadSrsMulti]);

  useEffect(() => {
    if (!puzzle || !meta) return;
    const sessionId = isMix ? mixSessionId(mixKey.split(',').filter(Boolean)) : setSlug;
    if (storePuzzle === puzzle && storeSet === sessionId && cases.length > 0) return;
    if (isMix) {
      const sets = mixKey.split(',').filter(Boolean);
      loadMixCases(puzzle, sets)
        .then(all => loadMixSession(puzzle, sets, all))
        .catch(e => console.error('[trainer] loadMixCases failed', e));
      return;
    }
    loadAlg(puzzle, setSlug)
      .then(d => loadSession(puzzle, setSlug, d.cases))
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzle, setSlug, meta, isMix, mixKey, storePuzzle, storeSet, cases.length, loadSession, loadMixSession]);

  // scope 内的 case(与 run 页同一套 top/sub 两级 slug 匹配);无 scope 或 slug 落空 = 全部。
  // 顺序和公式库一致(ZBLL / COLL 把角块已成型和对角换提到组内最前),否则同一批 case
  // 在库里和选集页排得不一样。
  const scopedCases = useMemo(() => {
    const allByCp = sortByCp(setSlug, cases);
    const all = puzzle
      ? sortAlgItemsBySignedLabel(
          allByCp,
          c => primaryCaseName(puzzle, c.srcSet ?? setSlug, c),
        )
      : allByCp;
    if (!scopeSlug || all.length === 0) return all;
    const parts = (c: AlgCase) => (c.subgroup || '').toLowerCase().split('/');
    const isTop = all.some(c => parts(c)[0] === scopeSlug);
    const hit = all.filter(c => (isTop ? parts(c)[0] : parts(c)[1]) === scopeSlug);
    return hit.length > 0 ? hit : all;
  }, [cases, puzzle, scopeSlug, setSlug]);

  // 过滤后的可见 case(过滤只影响显示,不动 selected)。进度统计在 SetProgressStrip 里算。
  const visibleCases = useMemo(() => {
    if (markFilter === 'all') return scopedCases;
    return scopedCases.filter((c) => {
      const k = caseKey(c);
      const st = markStatus(marks, k);
      return markFilter === 'none' ? !st : st === markFilter;
    });
  }, [scopedCases, marks, markFilter]);

  if (!puzzle || !meta) {
    // 合练成员不够:直接给选集器(SSG 壳读不到 query,挂载前先「加载中」免闪)
    if (puzzle && isMix) {
      return (
        <div className="trainer-root">
          {mounted
            ? <MixSetPicker puzzle={puzzle} puzzleParam={puzzleParam} leaf="select" initial={mixSets} />
            : <div className="trainer-landing-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div>}
        </div>
      );
    }
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {tr({ zh: '未知公式集', en: 'Unknown set' })}: {puzzleParam}/{setSlug}
        </div>
      </div>
    );
  }

  const selectedSet = new Set(selected);
  const scopedSelectedCount = scopedCases.filter(c => selectedSet.has(caseKey(c))).length;
  const canStart = scopedSelectedCount > 0;
  const scopeQuery = scopeSlug ? `?scope=${encodeURIComponent(scopeSlug)}` : '';

  /** 画笔落地:整批已是目标态 → 清该维度(再涂一次 = 擦掉),否则涂上。 */
  const onPaint = (keys: string[]) => {
    if (!brush || keys.length === 0) return;
    if (brush === 'clear') { applyMarks(keys, { s: null }); return; }
    const allOn = keys.every(k => markStatus(marks, k) === brush);
    applyMarks(keys, { s: allOn ? null : brush });
  };

  /** 按标记快选:scope 内选择集替换为该类 case(可预期,不与旧选择混叠);scope 外的选择保留。 */
  const quickSelect = (pred: (k: string) => boolean) => {
    const inScope = new Set(scopedCases.map(caseKey));
    const kept = selected.filter(k => !inScope.has(k));
    setSelected([...kept, ...scopedCases.map(caseKey).filter(pred)]);
  };

  // 进度条统计 scope 内的整套(不受「只看某类」的显示过滤影响)
  const scopedKeys = scopedCases.map(caseKey);
  const selectBase = isMix
    ? mixHref(puzzleParam, mixSets, 'select')
    : `/alg/${puzzleParam}/${setSlug}/select${scopeQuery}`;
  const runBase = isMix
    ? mixHref(puzzleParam, mixSets, 'run')
    : `/alg/${puzzleParam}/${setSlug}/run${scopeQuery}`;
  const backHref = isMix
    ? `/alg/${puzzleParam}`
    : (scopeSlug ? `/alg/${puzzleParam}/${setSlug}/${scopeSlug}` : `/alg/${puzzleParam}/${setSlug}`);
  const brushItems = [
    {
      value: 'off',
      label: tr({ zh: '选情况', en: 'Pick cases' }),
      icon: <MousePointer2 size={16} strokeWidth={2.5} />,
    },
    {
      value: 'learning',
      label: tr({ zh: '标记不熟', en: 'Mark shaky' }),
      icon: <TrainerMarkBadge status="learning" inline />,
    },
    {
      value: 'mastered',
      label: tr({ zh: '标记已掌握', en: 'Mark mastered' }),
      icon: <TrainerMarkBadge status="mastered" inline />,
    },
    {
      value: 'clear',
      label: tr({ zh: '清除标记', en: 'Clear marks' }),
      icon: <Eraser size={16} strokeWidth={2.5} />,
    },
    {
      value: 'select-unmastered',
      label: tr({ zh: '选未掌握', en: 'Select not mastered' }),
      icon: <MousePointer2 size={16} strokeWidth={2.5} />,
      separatorBefore: true,
    },
    {
      value: 'select-learning',
      label: tr({ zh: '选不熟', en: 'Select shaky' }),
      icon: <MousePointer2 size={16} strokeWidth={2.5} />,
    },
  ];

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link
          href={backHref}
          className="trainer-back"
          aria-label={tr({ zh: '返回公式集', en: 'Back to alg set' })}
        >
          <ArrowLeft size={14} />
        </Link>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {puzzle} · {tr(meta)}{scopeSlug ? ` · ${setSlug === 'zbll' ? displayZbllToken(scopeSlug) : scopeSlug.toUpperCase()}` : ''}
        </span>
        {/* 记忆模式按整套排期,不依赖勾选 —— 真 <a>,中键可新开标签页 */}
        <Link
          href={`${runBase}${runBase.includes('?') ? '&' : '?'}mode=memo`}
          className="trainer-memo-btn"
          prefetch={false}
          title={tr({ zh: '看图回忆公式,按记忆强度排期', en: 'Recall from the picture, scheduled by memory strength' })}
        >
          {tr({ zh: '记忆', en: 'Memory' })}
        </Link>
        <button
          className={`trainer-start-btn${!canStart ? ' is-disabled' : ''}`}
          onClick={() => router.push(`${langPrefix}${runBase}`) /* allow-button-nav: disabled 门控(canStart)的开始按钮,选 case 后才跳 /run */}
          disabled={!canStart}
        >
          {tr({ zh: '训练', en: 'Train'
        })} ({scopedSelectedCount})
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="trainer-landing-empty">{tr({ zh: '加载中…', en: 'Loading…'
        })}</div>
      ) : (
        <>
          {/* 本 set 学习进度 + 待复习 / 连续天数。与 run 页共用同一条(components 单一源) */}
          <SetProgressStrip keys={scopedKeys} selectHref={selectBase} />

          <div className="trainer-marks-toolbar">
            <label className="trainer-marks-tool">
              <span className="trainer-opts-label">{tr({ zh: '只看', en: 'Show' })}</span>
              <select
                className="trainer-scramble-kind trainer-filter-select"
                value={markFilter}
                onChange={e => setMarkFilter(e.target.value === 'all' ? null : e.target.value as MarkFilter)}
                aria-label={tr({ zh: '按标记过滤', en: 'Filter by mark' })}
              >
                <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
                <option value="none">{tr({ zh: '未学', en: 'Unlearned' })}</option>
                <option value="learning">{MARK_STATUS_LABEL.learning()}</option>
                <option value="mastered">{MARK_STATUS_LABEL.mastered()}</option>
              </select>
            </label>
            <div className="trainer-marks-tool">
              <ListSelect
                className="trainer-brush-select"
                items={brushItems}
                value={brush ?? 'off'}
                onChange={next => {
                  if (next === 'select-unmastered') {
                    quickSelect(k => markStatus(marks, k) !== 'mastered');
                    return;
                  }
                  if (next === 'select-learning') {
                    quickSelect(k => markStatus(marks, k) === 'learning');
                    return;
                  }
                  setBrush(next === 'off' ? null : next as TrainerMarkBrush);
                }}
                allLabel={tr({ zh: '选情况', en: 'Pick cases' })}
                clearable={false}
              />
            </div>
          </div>
          {/* 合练按成员集分块 —— 两套里都有叫「T」的组,混在一棵树里会并成一组、认不出谁是谁 */}
          {isMix ? mixSets.map(slug => {
            const own = visibleCases.filter(c => c.srcSet === slug);
            if (own.length === 0) return null;
            return (
              <section key={slug} className="trainer-mix-section">
                <h2 className="trainer-mix-section-title">
                  {setLabel(puzzle, slug)}
                  <span>{own.filter(c => selectedSet.has(caseKey(c))).length}/{own.length}</span>
                </h2>
                <CaseTreePicker
                  puzzle={puzzle}
                  set={slug}
                  cases={own}
                  selected={selectedSet}
                  onChange={(next) => setSelected([...next])}
                  isZh={isZh}
                  marks={marks}
                  brush={brush}
                  onPaint={onPaint}
                />
              </section>
            );
          }) : (
            <CaseTreePicker
              puzzle={puzzle}
              set={setSlug}
              cases={visibleCases}
              selected={selectedSet}
              onChange={(next) => setSelected([...next])}
              isZh={isZh}
              marks={marks}
              brush={brush}
              onPaint={onPaint}
            />
          )}
        </>
      )}
    </div>
  );
}
