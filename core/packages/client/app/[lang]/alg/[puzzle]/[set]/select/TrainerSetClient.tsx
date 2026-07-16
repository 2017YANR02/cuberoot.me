'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerSelectPage.tsx
import { useEffect, useMemo } from 'react';
import Link from '@/components/AppLink';
import { useRouter, useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { getAlgSetMeta, loadAlg, type AlgCase } from '@cuberoot/shared';
import { useTrainerStore } from '@/lib/trainer-store';
import { caseKey } from '@/lib/trainer-case-key';
import { CaseTreePicker } from '@/app/[lang]/alg/_trainer/trainer-components';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/app/[lang]/alg/_trainer/trainer.css';
import { tr } from '@/i18n/tr';

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
  const scopeSlug = scopeParam?.trim().toLowerCase() || null;

  const puzzle = resolveAlgPuzzle(puzzleParam);   // 接受 event code(333)或 legacy puzzle 名(3x3)
  const meta = puzzle ? getAlgSetMeta(puzzle, setSlug) : undefined;

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const loadSession = useTrainerStore(s => s.loadSession);
  const setSelected = useTrainerStore(s => s.setSelected);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);

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
          {puzzle} · {tr(meta)}{scopeSlug ? ` · ${scopeSlug.toUpperCase()}` : ''}
        </span>
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
        <CaseTreePicker
          puzzle={puzzle}
          set={setSlug}
          cases={scopedCases}
          selected={selectedSet}
          onChange={(next) => setSelected([...next])}
          isZh={isZh}
        />
      )}
    </div>
  );
}
