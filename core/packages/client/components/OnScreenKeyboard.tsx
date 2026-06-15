'use client';

// Ported from packages/client-vite/src/components/OnScreenKeyboard.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '@/lib/session-store';
import { PLL_LETTERS } from '@/lib/pll-helpers';

const FULL_NAME_ROW1 = ['Aa', 'Ab', 'E', 'F', 'Ga', 'Gb', 'Gc'];
const FULL_NAME_ROW2 = ['Gd', 'H', 'Ja', 'Jb', 'Na', 'Nb', 'Ra'];
const FULL_NAME_ROW3 = ['Rb', 'T', 'Ua', 'Ub', 'V', 'Y', 'Z'];

interface ButtonFeedback {
  key: string | null;
  type: 'correct' | 'wrong' | null;
}

interface OnScreenKeyboardProps {
  fullNameMode: boolean;
}

export default function OnScreenKeyboard({ fullNameMode }: OnScreenKeyboardProps) {
  const [feedback, setFeedback] = useState<ButtonFeedback>({ key: null, type: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitAnswer = useSessionStore((s) => s.submitAnswer);
  const gameState = useSessionStore((s) => s.gameState);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(
    (answer: string) => {
      const result = submitAnswer(answer, fullNameMode);
      if (result) {
        setFeedback({ key: answer, type: result });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setFeedback({ key: null, type: null });
        }, 300);
      }
    },
    [submitAnswer, fullNameMode]
  );

  if (gameState !== 'playing') return null;

  const getButtonStyle = (key: string): React.CSSProperties => {
    if (feedback.key === key && feedback.type === 'correct') {
      return { backgroundColor: '#198754', color: '#fff', borderColor: '#198754' };
    }
    if (feedback.key === key && feedback.type === 'wrong') {
      return { backgroundColor: '#dc3545', color: '#fff', borderColor: '#dc3545' };
    }
    return {};
  };

  if (fullNameMode) {
    const renderRow = (names: string[]) => (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
        {names.map((name) => (
          <button
            key={name}
            className="kbd-btn"
            style={{ flex: '1 1 0', maxWidth: '4rem', ...getButtonStyle(name) }}
            onClick={() => handleClick(name)}
          >
            {name}
          </button>
        ))}
      </div>
    );

    return (
      <div className="on-screen-keyboard">
        {renderRow(FULL_NAME_ROW1)}
        {renderRow(FULL_NAME_ROW2)}
        {renderRow(FULL_NAME_ROW3)}
      </div>
    );
  }

  return (
    <div className="on-screen-keyboard">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
        {PLL_LETTERS.map((letter) => (
          <button
            key={letter}
            className="kbd-btn"
            style={{ minWidth: '3rem', ...getButtonStyle(letter) }}
            onClick={() => handleClick(letter)}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
}
