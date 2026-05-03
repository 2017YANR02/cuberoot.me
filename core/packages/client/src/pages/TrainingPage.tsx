/**
 * TrainingPage — 从 pll_recognition_trainer/src/views/TrainerView.vue 原版移植
 *
 * 双模式：
 * - 识别模式：显示魔方图 → 键盘/屏幕按钮选择 PLL 名字 → 判对错
 * - 计时模式：显示打乱 → 空格/触摸启停计时器
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CubeView from '../components/CubeView';
import OnScreenKeyboard from '../components/OnScreenKeyboard';
import { useSessionStore } from '../stores/sessionStore';
import { scrambleForCase, inverseScramble } from '../utils/scrambleGenerator';
import {
  isPllLetter,
  isSingleLetterPll,
  isTwoLetterPllPrefix,
  validPllSuffixes,
  isHelpKey,
} from '../utils/pllHelpers';
import pllMap from '@cuberoot/shared/data/pll.json';
import ollMap from '@cuberoot/shared/data/oll.json';
import { VisualCube } from '../components/VisualCube';

const typedOllMap = ollMap as Record<string, { name: string; alg: string; alg2: string; group: string }>;

export function TrainingPage() {
  const navigate = useNavigate();
  const { algSetId } = useParams<{ algSetId: string }>();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const gameState = useSessionStore((s) => s.gameState);
  const trainMode = useSessionStore((s) => s.trainMode);
  const queue = useSessionStore((s) => s.queue);
  const results = useSessionStore((s) => s.results);
  const mistake = useSessionStore((s) => s.mistake);
  const setInitial = useSessionStore((s) => s.setInitial);
  const pausePlay = useSessionStore((s) => s.pausePlay);
  const resumePlay = useSessionStore((s) => s.resumePlay);
  const submitAnswer = useSessionStore((s) => s.submitAnswer);
  const giveUpOnCase = useSessionStore((s) => s.giveUpOnCase);
  const restartEvaluation = useSessionStore((s) => s.restartEvaluation);
  const startPersonalized = useSessionStore((s) => s.startPersonalized);
  const currentCaseFn = useSessionStore((s) => s.currentCase);

  // NOTE: 与原版相同，缓存两字母 PLL 的第一个按键
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [shakeHint, setShakeHint] = useState(false);
  const prevMistakeRef = useRef(mistake);

  const currentCase = currentCaseFn();
  const totalCases = queue.length + results.length - (mistake === '' ? 0 : 1);
  const completed = results.length;
  const progressPercent = totalCases > 0 ? (completed / totalCases) * 100 : 0;

  // NOTE: PLL 用 scrambleForCase，OLL 用公式反转
  const scramble = currentCase
    ? algSetId === 'oll'
      ? inverseScramble(typedOllMap[currentCase.name]?.alg || '')
      : scrambleForCase(currentCase, pllMap as Record<string, Record<string, string>>)
    : '';

  // 初始化
  useEffect(() => {
    setInitial();
  }, [setInitial]);

  // 答错时触发摇头动画
  useEffect(() => {
    if (prevMistakeRef.current === '' && mistake !== '') {
      setShakeHint(true);
      const t = setTimeout(() => setShakeHint(false), 2000);
      return () => clearTimeout(t);
    }
    prevMistakeRef.current = mistake;
  }, [mistake]);

  // case 变化时清空 pendingKey
  useEffect(() => {
    setPendingKey(null);
  }, [currentCase?.name, currentCase?.rotation]);

  // ---- 键盘事件（原版 TrainerView.vue handleKeyPress） ----
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // FIXME: 和原版一样，modal/note 输入时忽略
      if (document.querySelector('.modal.show') || document.querySelector('.noteInput:focus')) {
        return;
      }

      const withModifiers = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;

      // 全名模式下有缓冲前缀键
      if (pendingKey) {
        if (!withModifiers && e.key === 'Escape') {
          setPendingKey(null);
          pausePlay();
          e.preventDefault();
          return;
        }
        if (!withModifiers && e.key === 'Backspace') {
          setPendingKey(null);
          e.preventDefault();
          return;
        }
        if (!withModifiers && isHelpKey(e.key)) {
          setPendingKey(null);
          giveUpOnCase();
          e.preventDefault();
          return;
        }
        if (!withModifiers) {
          const suffix = e.key.toLowerCase();
          const suffixes = validPllSuffixes[pendingKey];
          if (suffixes && suffixes.includes(suffix)) {
            const fullName = pendingKey + suffix;
            submitAnswer(fullName, true);
            setPendingKey(null);
            e.preventDefault();
            return;
          }
          e.preventDefault();
          return;
        }
      }

      if (!withModifiers && e.key === 'Escape') {
        setPendingKey(null);
        pausePlay();
        e.preventDefault();
        return;
      }
      if (!withModifiers && e.key === ' ') {
        resumePlay();
        e.preventDefault();
        return;
      }
      if (!withModifiers && isPllLetter(e.key.toUpperCase())) {
        const letter = e.key.toUpperCase();
        // NOTE: 默认使用全名模式（和 pll_recognition_trainer 一样）
        if (isSingleLetterPll(letter)) {
          submitAnswer(letter, true);
        } else if (isTwoLetterPllPrefix(letter)) {
          setPendingKey(letter);
        }
        e.preventDefault();
        return;
      }
      if (!withModifiers && isHelpKey(e.key)) {
        giveUpOnCase();
        e.preventDefault();
        return;
      }
    },
    [pendingKey, pausePlay, resumePlay, submitAnswer, giveUpOnCase]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // ---- 提示文字（原版 keyPressHint） ----
  const getHint = (): string => {
    if (gameState === 'playing' && pendingKey) {
      return `${pendingKey}_ ...`;
    }
    if (gameState === 'playing' && mistake) {
      return isZh
        ? `按 ${currentCase?.name} 继续，Esc 暂停`
        : `Press ${currentCase?.name} to continue, Esc to pause`;
    }
    if (gameState === 'playing' && !mistake) {
      return isZh ? '这是哪个 PLL？输入公式名字' : 'Which PLL is this? Type the algorithm name';
    }
    if (gameState === 'paused') {
      return results.length === 0
        ? t('training.pressSpace')
        : (isZh ? '按空格继续' : 'Press Space to continue');
    }
    return '';
  };

  // ---- 一轮结束视图 ----
  if (gameState === 'evaluationDone') {
    const mistakeCount = results.filter((r) => r.mistake !== '').length;
    const correctCount = results.filter((r) => r.mistake === '').length;
    return (
      <div className="training-page" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>{t('training.complete')}</h2>
        <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
          {isZh ? '正确' : 'Correct'} <strong style={{ color: '#198754' }}>{correctCount}</strong> /{' '}
          {isZh ? '总计' : 'Total'} <strong>{results.length}</strong>
        </p>
        {mistakeCount > 0 && (
          <p style={{ color: '#dc3545' }}>
            {isZh ? `错误 ${mistakeCount} 次` : `${mistakeCount} mistake${mistakeCount > 1 ? 's' : ''}`}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn-primary" onClick={startPersonalized}>
            {isZh ? '🔄 个性化训练（弱项加强）' : '🔄 Personalized (focus weak cases)'}
          </button>
          <button className="btn-secondary" onClick={restartEvaluation}>
            {isZh ? '🔁 重新评估' : '🔁 Restart evaluation'}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            {isZh ? '🏠 返回首页' : '🏠 Home'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="training-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
      {/* 进度条 */}
      <div style={{ width: '100%', maxWidth: '600px', marginBottom: '1rem' }}>
        <div
          style={{
            height: '22px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#0d6efd',
              transition: 'width 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {completed}/{totalCases}
          </div>
        </div>
      </div>

      {/* 魔方图 */}
      <div style={{ margin: '1rem 0' }}>
        {algSetId === 'oll' ? (
          <div style={{ filter: gameState === 'paused' ? 'brightness(0.15)' : 'none' }}>
            <VisualCube
              algorithm={typedOllMap[currentCase?.name || '']?.alg || ''}
              view="oll"
              size={200}
              alt={currentCase?.name}
            />
          </div>
        ) : (
          <CubeView
            scramble={scramble}
            viewType={mistake ? 'cube-pll' : 'cube'}
            size={350}
          />
        )}
      </div>

      {/* 提示文字 */}
      <div
        style={{
          color: '#adb5bd',
          textAlign: 'center',
          margin: '0.75rem 0',
          animation: shakeHint ? 'headShake 1s ease' : undefined,
        }}
      >
        {getHint()}
      </div>

      {/* 暂停/开始按钮 */}
      {gameState === 'paused' && (
        <button className="btn-primary" onClick={resumePlay} style={{ fontSize: '1.2rem', padding: '0.75rem 2rem' }}>
          {results.length === 0
            ? (isZh ? '▶ 开始' : '▶ Start')
            : (isZh ? '▶ 继续' : '▶ Continue')} (Space)
        </button>
      )}

      {/* 屏幕键盘（识别模式时显示） */}
      {trainMode === 'recognition' && (
        <OnScreenKeyboard fullNameMode={true} />
      )}

      {/* 游戏中按钮 */}
      {gameState === 'playing' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button className="btn-secondary" onClick={pausePlay}>
            {isZh ? '⏸ 暂停 (Esc)' : '⏸ Pause (Esc)'}
          </button>
          {!mistake && (
            <button className="btn-secondary" onClick={giveUpOnCase} style={{ opacity: 0.7 }}>
              {isZh ? '🏳️ 放弃 (S/?)' : '🏳️ Give up (S/?)'}
            </button>
          )}
        </div>
      )}

      {/* 答错后显示正确信息 */}
      {gameState === 'playing' && mistake && currentCase && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <hr style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {currentCase.name}
          </div>
          <div style={{ color: '#adb5bd', fontSize: '0.9rem' }}>
            {(pllMap as Record<string, Record<string, string>>)[currentCase.name]?.noAuf || ''}
          </div>
        </div>
      )}
    </div>
  );
}
