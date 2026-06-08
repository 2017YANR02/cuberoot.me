'use client';

// Ported from packages/client/src/pages/trainer/TrainerSelectPage.tsx
import { useEffect } from 'react';
import Link from '@/components/AppLink';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Flag } from 'lucide-react';
import { getAlgSetMeta, loadAlg } from '@cuberoot/shared';
import { useTrainerStore } from '@/lib/trainer-store';
import { CaseTreePicker } from '../../_components/trainer-components';
import { resolveAlgPuzzle } from '../../_events';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../trainer.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

export default function TrainerSetClient() {
  const params = useParams<{ puzzle: string; set: string }>();
  const puzzleParam = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '';
  const setSlug = (Array.isArray(params?.set) ? params.set[0] : params?.set) ?? '';
  const router = useRouter();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  useDocumentTitle('公式训练', 'Algorithm Trainer');

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
  const canStart = selectedSet.size > 0;

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link href={`/${lang}/trainer/${puzzleParam}`} className="trainer-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {puzzle} · {(i18n.language.startsWith('zh') ? meta.zh : meta.en)}
        </span>
        <button
          className={`trainer-start-btn${!canStart ? ' is-disabled' : ''}`}
          onClick={() => router.push(`${lang === 'zh' ? '/zh' : ''}/trainer/${puzzleParam}/${setSlug}/run`)}
          disabled={!canStart}
        >
          <Flag size={14} /> {tr({ zh: '开始训练', en: 'Start Training',
              zhHant: "開始訓練"
        })} ({selectedSet.size})
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="trainer-landing-empty">{tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>
      ) : (
        <CaseTreePicker
          puzzle={puzzle}
          set={setSlug}
          cases={cases}
          selected={selectedSet}
          onChange={(next) => setSelected([...next])}
          isZh={isZh}
        />
      )}
    </div>
  );
}
