/**
 * /trainer landing — pick puzzle + set, jump to selection page.
 *
 * SCD-style: top bar with two dropdowns + Start Training button.
 * Below the bar: bento preview of the selected set's first case (placeholder
 * if no set selected). Bridge-style: actual case picking happens on
 * /trainer/:puzzle/:set.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flag, Eye } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '../alg/CaseThumb';
import LangToggle from '../../components/LangToggle';
import './trainer.css';

const PUZZLE_LABEL: Record<AlgPuzzle, string> = {
  '2x2': '2x2', '3x3': '3x3', '4x4': '4x4', '5x5': '5x5',
  'sq1': 'SQ1', 'megaminx': 'Megaminx', 'pyraminx': 'Pyraminx', 'skewb': 'Skewb',
};

// 公式训练（timer-based,空格起停）—— /trainer/:p/:s
// 默认: ALG_CATALOG 里所有 set 都开放训练。要黑名单某个 set 在这里 filter。
const TRAINABLE_SETS: Record<AlgPuzzle, string[]> = Object.fromEntries(
  ALG_PUZZLES.map(p => [p, ALG_CATALOG[p].map(s => s.slug)])
) as Record<AlgPuzzle, string[]>;

// 识别训练（看图输入名字判对错）—— /recognize/:set
// 加新 set: append slug 后,实现对应 set 在 TrainingPage 的分支(scramble + 答案集)即可
const RECOGNIZE_SETS: Record<AlgPuzzle, string[]> = {
  '2x2': [],
  '3x3': ['pll'],  // 以后扩: 'zbll', 'zbls', ...
  '4x4': [],
  '5x5': [],
  'sq1': [],
  'megaminx': [],
  'pyraminx': [],
  'skewb': [],
};

export default function TrainerLandingPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [puzzle, setPuzzle] = useState<AlgPuzzle>('3x3');
  const [setSlug, setSetSlug] = useState<string>('pll');
  const [first, setFirst] = useState<AlgCase | null>(null);

  // Set is offered if it has EITHER alg-trainer OR recognize-trainer support
  const setOptions = useMemo(() => {
    const offered = new Set([
      ...TRAINABLE_SETS[puzzle],
      ...RECOGNIZE_SETS[puzzle],
    ]);
    return ALG_CATALOG[puzzle].filter(s => offered.has(s.slug));
  }, [puzzle]);

  const canTrain = TRAINABLE_SETS[puzzle].includes(setSlug);
  const canRecognize = RECOGNIZE_SETS[puzzle].includes(setSlug);

  // Reset set choice if current set isn't trainable for the new puzzle
  useEffect(() => {
    if (!setOptions.find(s => s.slug === setSlug)) {
      setSetSlug(setOptions[0]?.slug ?? '');
    }
  }, [setOptions, setSlug]);

  // Load first case for preview. Guard: skip when setSlug isn't valid for the
  // current puzzle (just changed, reset effect hasn't synced yet) to avoid 404.
  useEffect(() => {
    let cancelled = false;
    if (!setSlug) { setFirst(null); return; }
    if (!setOptions.find(s => s.slug === setSlug)) return;
    loadAlg(puzzle, setSlug)
      .then(d => { if (!cancelled) setFirst(d.cases[0] ?? null); })
      .catch(() => { if (!cancelled) setFirst(null); });
    return () => { cancelled = true; };
  }, [puzzle, setSlug, setOptions]);

  const onStartTrain = () => {
    if (!canTrain) return;
    navigate(`/trainer/${puzzle}/${setSlug}`);
  };
  const onStartRecognize = () => {
    if (!canRecognize) return;
    navigate(`/recognize/${setSlug}`);
  };

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <select
          className="trainer-puzzle-select"
          value={puzzle}
          onChange={(e) => setPuzzle(e.target.value as AlgPuzzle)}
        >
          {ALG_PUZZLES.filter(p => TRAINABLE_SETS[p].length > 0).map(p => (
            <option key={p} value={p}>{PUZZLE_LABEL[p]}</option>
          ))}
        </select>

        <select
          className="trainer-set-select"
          value={setSlug}
          onChange={(e) => setSetSlug(e.target.value)}
          disabled={setOptions.length === 0}
        >
          {setOptions.length === 0 && <option value="">—</option>}
          {setOptions.map(s => (
            <option key={s.slug} value={s.slug}>{isZh ? s.zh : s.en}</option>
          ))}
        </select>

        <button
          className={`trainer-start-btn${!canTrain ? ' is-disabled' : ''}`}
          onClick={onStartTrain}
          disabled={!canTrain}
          title={canTrain ? '' : (isZh ? '此 set 暂无公式训练' : 'No alg trainer for this set yet')}
        >
          <Flag size={14} /> {isZh ? '公式训练' : 'Alg Training'}
        </button>

        <button
          className={`trainer-start-btn${!canRecognize ? ' is-disabled' : ''}`}
          onClick={onStartRecognize}
          disabled={!canRecognize}
          title={canRecognize ? '' : (isZh ? '此 set 暂无识别训练' : 'No recognition trainer for this set yet')}
        >
          <Eye size={14} /> {isZh ? '识别训练' : 'Recognition'}
        </button>

        <div className="trainer-spacer" />
        <LangToggle variant="inline" />
      </div>

      {first && (
        <div className="trainer-set-block">
          <div
            className="trainer-set-header"
            onClick={canTrain ? onStartTrain : (canRecognize ? onStartRecognize : undefined)}
            style={{ cursor: (canTrain || canRecognize) ? 'pointer' : 'default' }}
          >
            <span className="trainer-set-title-thumb">
              <CaseThumb
                puzzle={puzzle}
                set={setSlug}
                sticker={first.sticker}
                alg={first.algs.flat()[0]?.alg ?? first.standard ?? ''}
                setup={first.setup}
                size={48}
              />
            </span>
            <span>{isZh ? setOptions.find(s => s.slug === setSlug)?.zh : setOptions.find(s => s.slug === setSlug)?.en}</span>
          </div>
          <div style={{ color: '#888', fontSize: '0.9rem' }}>
            {isZh ? '点击进入选择 case' : 'Click to pick cases'}
          </div>
        </div>
      )}

      {!first && setSlug && (
        <div className="trainer-landing-empty">{isZh ? '加载中…' : 'Loading…'}</div>
      )}
    </div>
  );
}
