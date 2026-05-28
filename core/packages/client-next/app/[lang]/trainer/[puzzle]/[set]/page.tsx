'use client';

// Ported from packages/client/src/pages/trainer/TrainerSelectPage.tsx
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Flag } from 'lucide-react';
import { ALG_PUZZLES, getAlgSetMeta, loadAlg, type AlgPuzzle } from '@cuberoot/shared';
import { useTrainerStore } from '@/lib/trainer-store';
import { CaseTreePicker } from '../../_components/trainer-components';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../trainer.css';

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

export default function TrainerSelectPage() {
  const params = useParams<{ puzzle: string; set: string }>();
  const puzzleParam = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '';
  const setSlug = (Array.isArray(params?.set) ? params.set[0] : params?.set) ?? '';
  const router = useRouter();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('公式训练', 'Algorithm Trainer');

  const validPuzzle = isPuzzle(puzzleParam);
  const meta = validPuzzle ? getAlgSetMeta(puzzleParam, setSlug) : undefined;

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const loadSession = useTrainerStore(s => s.loadSession);
  const setSelected = useTrainerStore(s => s.setSelected);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);

  useEffect(() => {
    if (!validPuzzle || !meta) return;
    if (storePuzzle === puzzleParam && storeSet === setSlug && cases.length > 0) return;
    loadAlg(puzzleParam, setSlug)
      .then(d => loadSession(puzzleParam as AlgPuzzle, setSlug, d.cases))
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzleParam, setSlug, validPuzzle, meta, storePuzzle, storeSet, cases.length, loadSession]);

  if (!validPuzzle || !meta) {
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {isZh ? '未知公式集' : 'Unknown set'}: {puzzleParam}/{setSlug}
        </div>
      </div>
    );
  }

  const selectedSet = new Set(selected);
  const canStart = selectedSet.size > 0;

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link href="/trainer" className="trainer-back">
          <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
        </Link>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {puzzleParam} · {isZh ? meta.zh : meta.en}
        </span>
        <button
          className={`trainer-start-btn${!canStart ? ' is-disabled' : ''}`}
          onClick={() => router.push(`/trainer/${puzzleParam}/${setSlug}/run`)}
          disabled={!canStart}
        >
          <Flag size={14} /> {isZh ? '开始训练' : 'Start Training'} ({selectedSet.size})
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="trainer-landing-empty">{isZh ? '加载中…' : 'Loading…'}</div>
      ) : (
        <CaseTreePicker
          puzzle={puzzleParam as AlgPuzzle}
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
