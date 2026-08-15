'use client';

// Ported from packages/client-vite/src/components/OnScreenKeyboard.tsx
//
// 按钮和提交都由调用方给(见 lib/recognize-sets),所以同一份组件既服 PLL 的 21 个名字
// 也服 OLL 的 57 个编号。原来那个「只按首字母答题」的分支从没有人传过 fullNameMode={false},
// 已删。
import { useState, useEffect, useRef, useCallback } from 'react';
import type { RecognizeButton } from '@/lib/recognize-sets';
import './OnScreenKeyboard.css';

interface ButtonFeedback {
  key: string | null;
  type: 'correct' | 'wrong' | null;
}

interface OnScreenKeyboardProps {
  buttons: RecognizeButton[];
  /** 返回判定结果,用来给按钮闪一下绿/红;返回 null 表示这次点击没被受理。 */
  onAnswer: (value: string) => 'correct' | 'wrong' | null;
  className?: string;
}

export default function OnScreenKeyboard({ buttons, onAnswer, className }: OnScreenKeyboardProps) {
  const [feedback, setFeedback] = useState<ButtonFeedback>({ key: null, type: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(
    (value: string) => {
      const result = onAnswer(value);
      if (result) {
        setFeedback({ key: value, type: result });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setFeedback({ key: null, type: null });
        }, 300);
      }
    },
    [onAnswer]
  );

  const getButtonStyle = (key: string): React.CSSProperties => {
    if (feedback.key === key && feedback.type === 'correct') {
      return { backgroundColor: '#198754', color: '#fff', borderColor: '#198754' };
    }
    if (feedback.key === key && feedback.type === 'wrong') {
      return { backgroundColor: '#dc3545', color: '#fff', borderColor: '#dc3545' };
    }
    return {};
  };

  return (
    <div className={`on-screen-keyboard${className ? ` ${className}` : ''}`}>
      {buttons.map(({ value, label, sub }) => (
        <button
          key={value}
          className="kbd-btn"
          style={getButtonStyle(value)}
          onClick={() => handleClick(value)}
        >
          {label}
          {sub && <span className="kbd-btn-sub">{sub}</span>}
        </button>
      ))}
    </div>
  );
}
