'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerSelectPage.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useRouter, useParams } from 'next/navigation';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { getAlgSetMeta, loadAlg, type AlgCase } from '@cuberoot/shared';
import { useTrainerStore } from '@/lib/trainer-store';
import {
  useTrainerMarks, markStatus, markStarred, MARK_STATUS_LABEL,
  type TrainerMarkBrush, type CaseMarkStatus,
} from '@/lib/trainer-marks';
import { caseKey } from '@/lib/trainer-case-key';
import { canonicalZbllSubgroupSlug } from '@/lib/alg_zbll_subgroups';
import { displayZbllToken } from '@/lib/alg_case_display';
import { CaseTreePicker } from '@/app/[lang]/alg/_trainer/trainer-components';
import SetProgressStrip from '@/app/[lang]/alg/_trainer/SetProgressStrip';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { useAlgSrs } from '@/lib/alg-srs-store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/app/[lang]/alg/_trainer/trainer.css';
import '@/app/[lang]/alg/_trainer/memory.css';
import { tr } from '@/i18n/tr';

/** 显示过滤:按标记只看一类(大 set 里找 case 用)。 */
const MARK_FILTERS = ['all', 'none', 'learning', 'mastered', 'paused', 'star'] as const;
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
  useDocumentTitle('公式训练', 'Algorithm Trainer');

  // 从 subgroup 页训练按钮进来带 ?scope=<组slug>:只在该组内选 case(筛选/默认 replace)
  const [scopeParam] = useQueryState('scope');
  // 旧数字制子组 slug(u1 / pi 1 / as1 …)→ 新方向制(ur / pif / asf …),老 ?scope= 链接 / 书签不失效(migration 0081)
  const scopeSlug = canonicalZbllSubgroupSlug(setSlug, scopeParam?.trim().toLowerCase() || null);
  // 按标记过滤显示(筛选 → 默认 replace)
  const [markFilter, setMarkFilter] = useQueryState(
    'mark',
    parseAsStringEnum<MarkFilter>([...MARK_FILTERS]).withDefault('all'),
  );

  const puzzle = resolveAlgPuzzle(puzzleParam);   // 接受 event code(333)或 legacy puzzle 名(3x3)
  const meta = puzzle ? getAlgSetMeta(puzzle, setSlug) : undefined;

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const loadSession = useTrainerStore(s => s.loadSession);
  const setSelected = useTrainerStore(s => s.setSelected);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);

  const marks = useTrainerMarks(s => s.marks);
  const applyMarks = useTrainerMarks(s => s.applyMarks);
  const loadMarks = useTrainerMarks(s => s.loadMarks);
  const loadSrs = useAlgSrs(s => s.loadSrs);
  /** 画笔:null = 普通选择;其余 = 点 cell / 组头 涂该标记(再涂同标记 = 清除)。会话内状态,不进 URL。 */
  const [brush, setBrush] = useState<TrainerMarkBrush | null>(null);

  useEffect(() => {
    if (!puzzle || !meta) return;
    loadMarks(puzzle, setSlug);
    loadSrs(puzzle, setSlug);   // 顶部进度条要显示「待复习」
  }, [puzzle, setSlug, meta, loadMarks, loadSrs]);

  useEffect(() => {
    if (!puzzle || !meta) return;
    if (storePuzzle === puzzle && storeSet === setSlug && cases.length > 0) return;
    loadAlg(puzzle, setSlug)
      .then(d => loadSession(puzzle, setSlug, d.cases))
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzle, setSlug, meta, storePuzzle, storeSet, cases.length, loadSession]);

  // scope 内的 case(与 run 页同一套 top/sub 两级 slug 匹配);无 scope 或 slug 落空 = 全部
  const scopedCases = useMemo(() => {
    if (!scopeSlug || cases.length === 0) return cases;
    const parts = (c: AlgCase) => (c.subgroup || '').toLowerCase().split('/');
    const isTop = cases.some(c => parts(c)[0] === scopeSlug);
    const hit = cases.filter(c => (isTop ? parts(c)[0] : parts(c)[1]) === scopeSlug);
    return hit.length > 0 ? hit : cases;
  }, [cases, scopeSlug]);

  // 过滤后的可见 case(过滤只影响显示,不动 selected)。进度统计在 SetProgressStrip 里算。
  const visibleCases = useMemo(() => {
    if (markFilter === 'all') return scopedCases;
    return scopedCases.filter((c) => {
      const k = caseKey(c);
      if (markFilter === 'star') return markStarred(marks, k);
      const st = markStatus(marks, k);
      return markFilter === 'none' ? !st : st === markFilter;
    });
  }, [scopedCases, marks, markFilter]);

  if (!puzzle || !meta) {
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
    if (brush === 'clear') { applyMarks(keys, { s: null, f: false }); return; }
    if (brush === 'star') {
      const allOn = keys.every(k => markStarred(marks, k));
      applyMarks(keys, { f: !allOn });
      return;
    }
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
  const selectBase = `/alg/${puzzleParam}/${setSlug}/select${scopeQuery}`;

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link
          href={scopeSlug ? `/alg/${puzzleParam}/${setSlug}/${scopeSlug}` : `/alg/${puzzleParam}/${setSlug}`}
          className="trainer-back"
        >
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {puzzle} · {tr(meta)}{scopeSlug ? ` · ${setSlug === 'zbll' ? displayZbllToken(scopeSlug) : scopeSlug.toUpperCase()}` : ''}
        </span>
        {/* 记忆模式按整套排期,不依赖勾选 —— 真 <a>,中键可新开标签页 */}
        <Link
          href={`/alg/${puzzleParam}/${setSlug}/run${scopeQuery ? `${scopeQuery}&` : '?'}mode=memo`}
          className="trainer-memo-btn"
          prefetch={false}
          title={tr({ zh: '看图回忆公式,按记忆强度排期', en: 'Recall from the picture, scheduled by memory strength' })}
        >
          {tr({ zh: '记忆', en: 'Memory' })}
        </Link>
        <button
          className={`trainer-start-btn${!canStart ? ' is-disabled' : ''}`}
          onClick={() => router.push(`${langPrefix}/alg/${puzzleParam}/${setSlug}/run${scopeQuery}`) /* allow-button-nav: disabled 门控(canStart)的开始按钮,选 case 后才跳 /run */}
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
              <span className="trainer-opts-label">{tr({ zh: '标记', en: 'Mark' })}</span>
              <select
                className="trainer-scramble-kind"
                value={brush ?? 'off'}
                onChange={e => setBrush(e.target.value === 'off' ? null : e.target.value as TrainerMarkBrush)}
                aria-label={tr({ zh: '标记画笔', en: 'Mark brush' })}
              >
                <option value="off">{tr({ zh: '关(点选 case)', en: 'Off (pick cases)' })}</option>
                {(['learning', 'mastered', 'paused'] as CaseMarkStatus[]).map(s => (
                  <option key={s} value={s}>{MARK_STATUS_LABEL[s]()}</option>
                ))}
                <option value="star">{tr({ zh: '星标', en: 'Star' })}</option>
                <option value="clear">{tr({ zh: '清除标记', en: 'Clear marks' })}</option>
              </select>
            </label>
            <label className="trainer-marks-tool">
              <span className="trainer-opts-label">{tr({ zh: '只看', en: 'Show' })}</span>
              <select
                className="trainer-scramble-kind"
                value={markFilter}
                onChange={e => setMarkFilter(e.target.value === 'all' ? null : e.target.value as MarkFilter)}
                aria-label={tr({ zh: '按标记过滤', en: 'Filter by mark' })}
              >
                <option value="all">{tr({ zh: '全部', en: 'All' })}</option>
                <option value="none">{tr({ zh: '未学', en: 'Unlearned' })}</option>
                <option value="learning">{MARK_STATUS_LABEL.learning()}</option>
                <option value="mastered">{MARK_STATUS_LABEL.mastered()}</option>
                <option value="paused">{MARK_STATUS_LABEL.paused()}</option>
                <option value="star">{tr({ zh: '星标', en: 'Starred' })}</option>
              </select>
            </label>
            {/* 快选:一键把训练范围对准短板(替换选择;未掌握不含搁置) */}
            <span className="trainer-marks-tool">
              <span className="trainer-opts-label">{tr({ zh: '快选', en: 'Select' })}</span>
              <button type="button" className="trainer-quick-btn"
                onClick={() => quickSelect(k => { const st = markStatus(marks, k); return st !== 'mastered' && st !== 'paused'; })}>
                {tr({ zh: '未掌握', en: 'Not mastered' })}
              </button>
              <button type="button" className="trainer-quick-btn"
                onClick={() => quickSelect(k => markStatus(marks, k) === 'learning')}>
                {MARK_STATUS_LABEL.learning()}
              </button>
              <button type="button" className="trainer-quick-btn"
                onClick={() => quickSelect(k => markStarred(marks, k))}>
                {tr({ zh: '星标', en: 'Starred' })}
              </button>
            </span>
          </div>
          {brush && (
            <div className="trainer-opts-hint">
              {tr({
                zh: '画笔模式:点 case 或组头涂标记,再涂一次擦除;选下拉「关」回到点选',
                en: 'Brush mode: click a case or group header to paint; paint again to erase. Switch to "Off" to pick cases',
              })}
            </div>
          )}

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
        </>
      )}
    </div>
  );
}
