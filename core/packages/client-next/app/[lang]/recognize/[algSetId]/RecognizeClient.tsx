'use client';

// Ported from packages/client/src/pages/TrainingPage.tsx
import { useEffect, useCallback, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import OnScreenKeyboard from '@/components/OnScreenKeyboard';
import { useSessionStore, useSessionHydrated } from '@/lib/session-store';
import { scrambleForCase, inverseScramble } from '@/lib/scramble-generator';
import {
  isPllLetter,
  isSingleLetterPll,
  isTwoLetterPllPrefix,
  validPllSuffixes,
  isHelpKey,
} from '@/lib/pll-helpers';
import pllMap from '@cuberoot/shared/data/pll.json';
import ollMap from '@cuberoot/shared/data/oll.json';
import { VisualCube } from '@/components/VisualCube';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

const typedOllMap = ollMap as Record<string, { name: string; alg: string; alg2: string; group: string }>;

export default function RecognizeClient() {
  const router = useRouter();
  const params = useParams<{ algSetId: string }>();
  const algSetId = (Array.isArray(params?.algSetId) ? params.algSetId[0] : params?.algSetId) ?? '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('识别训练', 'Recognition Training', "識別訓練");
  const hydrated = useSessionHydrated();

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

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [shakeHint, setShakeHint] = useState(false);
  const prevMistakeRef = useRef(mistake);

  const currentCase = currentCaseFn();
  const totalCases = queue.length + results.length - (mistake === '' ? 0 : 1);
  const completed = results.length;
  const progressPercent = totalCases > 0 ? (completed / totalCases) * 100 : 0;

  const scramble = currentCase
    ? algSetId === 'oll'
      ? inverseScramble(typedOllMap[currentCase.name]?.alg || '')
      : scrambleForCase(currentCase, pllMap as Record<string, Record<string, string>>)
    : '';

  useEffect(() => {
    if (!hydrated) return;
    setInitial();
  }, [setInitial, hydrated]);

  useEffect(() => {
    if (prevMistakeRef.current === '' && mistake !== '') {
      setShakeHint(true);
      const t = setTimeout(() => setShakeHint(false), 2000);
      return () => clearTimeout(t);
    }
    prevMistakeRef.current = mistake;
  }, [mistake]);

  useEffect(() => {
    setPendingKey(null);
  }, [currentCase?.name, currentCase?.rotation]);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (typeof document !== 'undefined' && (document.querySelector('.modal.show') || document.querySelector('.noteInput:focus'))) {
        return;
      }

      const withModifiers = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;

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

  const getHint = (): string => {
    if (gameState === 'playing' && pendingKey) {
      return `${pendingKey}_ ...`;
    }
    if (gameState === 'playing' && mistake) {
      return i18n.language === 'zh-Hant' ? (`按 ${currentCase?.name} 繼續，Esc 暫停`) : (isZh
              ? `按 ${currentCase?.name} 继续，Esc 暂停`
              : `Press ${currentCase?.name} to continue, Esc to pause`);
    }
    if (gameState === 'playing' && !mistake) {
      return tr({ zh: '这是哪个 PLL？输入公式名字', en: 'Which PLL is this? Type the algorithm name',
          zhHant: "這是哪個 PLL？輸入公式名字"
    });
    }
    if (gameState === 'paused') {
      return results.length === 0
        ? t('training.pressSpace')
        : (tr({ zh: '按空格继续', en: 'Press Space to continue',
            zhHant: "按空格繼續"
        }));
    }
    return '';
  };

  if (!hydrated) {
    return <div className="training-page" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-mute)' }} />;
  }

  if (gameState === 'evaluationDone') {
    const mistakeCount = results.filter((r) => r.mistake !== '').length;
    const correctCount = results.filter((r) => r.mistake === '').length;
    return (
      <div className="training-page" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>{t('training.complete')}</h2>
        <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
          {tr({ zh: '正确', en: 'Correct',
              zhHant: "正確"
        })} <strong style={{ color: '#198754' }}>{correctCount}</strong> /{' '}
          {tr({ zh: '总计', en: 'Total',
              zhHant: "總計"
        })} <strong>{results.length}</strong>
        </p>
        {mistakeCount > 0 && (
          <p style={{ color: '#dc3545' }}>
            {i18n.language === 'zh-Hant' ? (`錯誤 ${mistakeCount} 次`) : (isZh ? `错误 ${mistakeCount} 次` : `${mistakeCount} mistake${mistakeCount > 1 ? 's' : ''}`)}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn-primary" onClick={startPersonalized}>
            {tr({ zh: '个性化训练（弱项加强）', en: 'Personalized (focus weak cases)',
                zhHant: "個性化訓練（弱項加強）"
            })}
          </button>
          <button className="btn-secondary" onClick={restartEvaluation}>
            {tr({ zh: '重新评估', en: 'Restart evaluation',
                zhHant: "重新評估"
            })}
          </button>
          <button className="btn-secondary" onClick={() => router.push('/')}>
            {tr({ zh: '返回首页', en: 'Home',
                zhHant: "返回首頁"
            })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="training-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
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
          <div style={{ filter: gameState === 'paused' ? 'brightness(0.15)' : 'none' }}>
            <VisualCube
              algorithm=""
              setup={scramble}
              view={mistake ? 'pll-iso' : 'iso'}
              size={350}
              alt={currentCase?.name}
            />
          </div>
        )}
      </div>

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

      {gameState === 'paused' && (
        <button className="btn-primary" onClick={resumePlay} style={{ fontSize: '1.2rem', padding: '0.75rem 2rem' }}>
          {results.length === 0
            ? (tr({ zh: '▶ 开始', en: '▶ Start',
                zhHant: "▶ 開始"
            }))
            : (tr({ zh: '▶ 继续', en: '▶ Continue',
                zhHant: "▶ 繼續"
            }))} (Space)
        </button>
      )}

      {trainMode === 'recognition' && (
        <OnScreenKeyboard fullNameMode={true} />
      )}

      {gameState === 'playing' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button className="btn-secondary" onClick={pausePlay}>
            {tr({ zh: '暂停 (Esc)', en: 'Pause (Esc)',
                zhHant: "暫停 (Esc)"
            })}
          </button>
          {!mistake && (
            <button className="btn-secondary" onClick={giveUpOnCase} style={{ opacity: 0.7 }}>
              {tr({ zh: '放弃 (S/?)', en: 'Give up (S/?)',
                  zhHant: "放棄 (S/?)"
            })}
            </button>
          )}
        </div>
      )}

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
