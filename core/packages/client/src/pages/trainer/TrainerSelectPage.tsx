/**
 * /trainer/:puzzle/:set — pick which cases to train.
 *
 * SCD-style: top bar (puzzle/set/Start), then a tree of subgroups with
 * checkboxes and case thumbnails. Selection is persisted in trainerStore
 * (per-(puzzle, set) localStorage). Start Training jumps to /…/run.
 */
import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Flag } from 'lucide-react';
import { ALG_PUZZLES, getAlgSetMeta, loadAlg, type AlgPuzzle } from '@cuberoot/shared';
import { useTrainerStore } from '../../stores/trainerStore';
import { CaseTreePicker } from './components';
import LangToggle from '../../components/LangToggle';
import './trainer.css';

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

export default function TrainerSelectPage() {
  const { puzzle: puzzleParam = '', set: setSlug = '' } = useParams<{ puzzle: string; set: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

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
      .then(d => loadSession(puzzleParam, setSlug, d.cases))
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
        <Link to="/trainer" className="trainer-back">
          <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
        </Link>
        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {puzzleParam} · {isZh ? meta.zh : meta.en}
        </span>
        <button
          className={`trainer-start-btn${!canStart ? ' is-disabled' : ''}`}
          onClick={() => navigate(`/trainer/${puzzleParam}/${setSlug}/run`)}
          disabled={!canStart}
        >
          <Flag size={14} /> {isZh ? '开始训练' : 'Start Training'} ({selectedSet.size})
        </button>
        <div className="trainer-spacer" />
        <LangToggle variant="inline" />
      </div>

      {cases.length === 0 ? (
        <div className="trainer-landing-empty">{isZh ? '加载中…' : 'Loading…'}</div>
      ) : (
        <CaseTreePicker
          puzzle={puzzleParam}
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
