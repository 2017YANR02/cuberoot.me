'use client';

// Ported from packages/client-vite/src/pages/TrainingPage.tsx
//
// 集合之间的差异(题库 / 题图 / 答题输入 / 摊牌文案)全在 lib/recognize-sets,这里只跑流程。
import { useEffect, useCallback, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import OnScreenKeyboard from '@/components/OnScreenKeyboard';
import Link from '@/components/AppLink';
import { sessionStoreFor, useSessionHydrated } from '@/lib/session-store';
import { isHelpKey } from '@/lib/pll-helpers';
import { recognizeSetFor } from '@/lib/recognize-sets';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';

export default function RecognizeClient() {
  const params = useParams<{ algSetId: string }>();
  const algSetId = (Array.isArray(params?.algSetId) ? params.algSetId[0] : params?.algSetId) ?? '';
  const recog = recognizeSetFor(algSetId);
  const useStore = sessionStoreFor(recog.id);
  const { t } = useTranslation();
  const hydrated = useSessionHydrated(useStore);
  // DB 题库(COLL / ELL / ZBLL / 1LLL)现拉;PLL / OLL 没有 load,一上来就是就绪的。
  const [dataReady, setDataReady] = useState(!recog.load);
  useEffect(() => {
    if (!recog.load) { setDataReady(true); return; }
    let cancelled = false;
    setDataReady(false);
    recog.load().then(() => { if (!cancelled) setDataReady(true); });
    return () => { cancelled = true; };
  }, [recog]);

  const gameState = useStore((s) => s.gameState);
  const trainMode = useStore((s) => s.trainMode);
  const queue = useStore((s) => s.queue);
  const results = useStore((s) => s.results);
  const mistake = useStore((s) => s.mistake);
  const setInitial = useStore((s) => s.setInitial);
  const pausePlay = useStore((s) => s.pausePlay);
  const resumePlay = useStore((s) => s.resumePlay);
  const submitAnswer = useStore((s) => s.submitAnswer);
  const giveUpOnCase = useStore((s) => s.giveUpOnCase);
  const restartEvaluation = useStore((s) => s.restartEvaluation);
  const startPersonalized = useStore((s) => s.startPersonalized);
  const currentCaseFn = useStore((s) => s.currentCase);

  // 半截的前缀(`G_` / `1_`)。判定读 ref 不读 state:两次击键落在同一帧时,state 还没更新,
  // 后一次会拿到旧的 null 而把前一次白敲。state 只用来显示。
  const pendingRef = useRef<string | null>(null);
  const [pendingKey, setPendingKeyState] = useState<string | null>(null);
  const setPendingKey = useCallback((v: string | null) => {
    pendingRef.current = v;
    setPendingKeyState(v);
  }, []);
  const [shakeHint, setShakeHint] = useState(false);
  const prevMistakeRef = useRef(mistake);

  const currentCase = currentCaseFn();
  const totalCases = queue.length + results.length - (mistake === '' ? 0 : 1);
  const completed = results.length;
  const progressPercent = totalCases > 0 ? (completed / totalCases) * 100 : 0;
  const image = currentCase ? recog.image(currentCase, mistake !== '') : null;
  const hasRecognitionGuide = algSetId === 'pll' || algSetId === 'oll';

  useEffect(() => {
    if (!hydrated || !dataReady) return;
    setInitial();
  }, [setInitial, hydrated, dataReady]);

  useEffect(() => {
    if (prevMistakeRef.current === '' && mistake !== '') {
      setShakeHint(true);
      const t = setTimeout(() => setShakeHint(false), 2000);
      return () => clearTimeout(t);
    }
    prevMistakeRef.current = mistake;
  }, [mistake]);

  // 换题、或换集合(换 store)时,半截的前缀不能跟着走过去。
  useEffect(() => {
    setPendingKey(null);
  }, [setPendingKey, currentCase?.name, currentCase?.rotation, recog.id]);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (typeof document !== 'undefined' && (document.querySelector('.modal.show') || document.querySelector('.noteInput:focus'))) {
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const pending = pendingRef.current;

      if (e.key === 'Escape') {
        setPendingKey(null);
        pausePlay();
        e.preventDefault();
        return;
      }
      if (pending && e.key === 'Backspace') {
        setPendingKey(null);
        e.preventDefault();
        return;
      }
      if (isHelpKey(e.key)) {
        setPendingKey(null);
        giveUpOnCase();
        e.preventDefault();
        return;
      }
      // 空格只在暂停时是「继续」;答题中它不该顶掉一个半截的编号。
      if (e.key === ' ' && !pending) {
        resumePlay();
        e.preventDefault();
        return;
      }

      const step = recog.step(pending, e.key);
      if (step.kind === 'answer') {
        submitAnswer(step.answer);
        setPendingKey(null);
        e.preventDefault();
        return;
      }
      if (step.kind === 'pending') {
        setPendingKey(step.pending);
        e.preventDefault();
        return;
      }
      // 已经攒了前缀时,别让无关键落到别处去(原 PLL 逻辑就是这么拦的)。
      if (pending) e.preventDefault();
    },
    [setPendingKey, pausePlay, resumePlay, submitAnswer, giveUpOnCase, recog]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const getHint = (): string => {
    if (gameState === 'playing' && pendingKey) {
      return `${pendingKey}_ ...`;
    }
    if (gameState === 'playing' && mistake && currentCase) {
      const label = (recog.answerLabel ?? recog.label)(currentCase.name);
      return tr({
        zh: `按 ${label} 继续，Esc 暂停`,
        en: `Press ${label} to continue, Esc to pause`,
      });
    }
    if (gameState === 'playing' && !mistake) {
      return tr(recog.prompt);
    }
    if (gameState === 'paused') {
      return results.length === 0
        ? t('training.pressSpace')
        : tr({ zh: '按空格继续', en: 'Press Space to continue' });
    }
    return '';
  };

  if (!hydrated || !dataReady) {
    return <div className="training-page" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-mute)' }} />;
  }

  if (gameState === 'evaluationDone') {
    const mistakeCount = results.filter((r) => r.mistake !== '').length;
    const correctCount = results.filter((r) => r.mistake === '').length;
    return (
      <div className="training-page" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>{t('training.complete')}</h2>
        <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
          {tr({ zh: '正确', en: 'Correct' })}{' '}
          <strong style={{ color: '#198754' }}>{correctCount}</strong> /{' '}
          {tr({ zh: '总计', en: 'Total' })} <strong>{results.length}</strong>
        </p>
        {mistakeCount > 0 && (
          <p style={{ color: '#dc3545' }}>
            {tr({
              zh: `错误 ${mistakeCount} 次`,
              en: `${mistakeCount} mistake${mistakeCount > 1 ? 's' : ''}`,
            })}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn-primary" onClick={startPersonalized}>
            {tr({ zh: '个性化训练（弱项加强）', en: 'Personalized (focus weak cases)' })}
          </button>
          <button className="btn-secondary" onClick={restartEvaluation}>
            {tr({ zh: '重新评估', en: 'Restart evaluation' })}
          </button>
          <Link className="btn-secondary" href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            {tr({ zh: '返回首页', en: 'Home' })}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="training-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
      {hasRecognitionGuide && (
        <div style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
          <Link
            className="btn-secondary"
            href={`/recognize/${algSetId}/guide`}
            prefetch={false}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            {tr({ zh: '识别指南', en: 'Recognition guide' })}
          </Link>
        </div>
      )}
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

      <div style={{ margin: '1rem 0' }}>
        {image && (
          <div style={{ filter: gameState === 'paused' ? 'brightness(0.15)' : 'none' }}>
            <VisualCube
              setup={image.setup}
              view={image.view}
              mask={image.mask}
              size={image.size}
              hideGreySides={image.hideGreySides}
              alt={currentCase ? recog.label(currentCase.name) : undefined}
            />
          </div>
        )}
      </div>

      <div
        style={{
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          margin: '0.75rem 0',
          animation: shakeHint ? 'headShake 1s ease' : undefined,
        }}
      >
        {getHint()}
      </div>

      {gameState === 'paused' && (
        <button className="btn-primary" onClick={resumePlay} style={{ fontSize: '1.2rem', padding: '0.75rem 2rem' }}>
          {results.length === 0
            ? tr({ zh: '▶ 开始', en: '▶ Start' })
            : tr({ zh: '▶ 继续', en: '▶ Continue' })} (Space)
        </button>
      )}

      {trainMode === 'recognition' && gameState === 'playing' && (
        <OnScreenKeyboard buttons={recog.buttons()} onAnswer={submitAnswer} />
      )}

      {gameState === 'playing' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button className="btn-secondary" onClick={pausePlay}>
            {tr({ zh: '暂停 (Esc)', en: 'Pause (Esc)' })}
          </button>
          {!mistake && (
            <button className="btn-secondary" onClick={giveUpOnCase} style={{ opacity: 0.7 }}>
              {tr({ zh: '放弃 (S/?)', en: 'Give up (S/?)' })}
            </button>
          )}
        </div>
      )}

      {gameState === 'playing' && mistake && currentCase && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <hr style={{ borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)' }} />
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {recog.label(currentCase.name)}
          </div>
          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
            {recog.solution(currentCase.name)}
          </div>
        </div>
      )}
    </div>
  );
}
