'use client';
/**
 * 虚拟键盘 + toggle 按钮 — 桌面默认收起、提供按钮展开;移动端强制打开,无按钮。
 * Ported from packages/client/src/components/CubeKeyboardSection/CubeKeyboardSection.tsx.
 */
import { useState, type RefObject } from 'react';
import { Keyboard } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import CubeVirtualKeyboard from './CubeVirtualKeyboard';
import { tr } from '@/i18n/tr';

interface Props {
  target: RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  onInput?: () => void;
  enableMarks?: boolean;
}

export default function CubeKeyboardSection({ target, onInput, enableMarks }: Props) {
  const isMobile = useIsMobile();
  const [showKeyboard, setShowKeyboard] = useState(false);

  const visible = isMobile || showKeyboard;
  const labelOn = tr({ zh: '隐藏虚拟键盘', en: 'Hide keyboard'
});
  const labelOff = tr({ zh: '显示虚拟键盘', en: 'Show keyboard'
});

  return (
    <>
      {!isMobile && (
        <button
          type="button"
          className={`vkb-toggle${showKeyboard ? ' active' : ''}`}
          onClick={() => setShowKeyboard(s => !s)}
          aria-label={showKeyboard ? labelOn : labelOff}
          title={showKeyboard ? labelOn : labelOff}
        >
          <Keyboard size={14} />
        </button>
      )}
      {visible && (
        <CubeVirtualKeyboard target={target} onInput={onInput} enableMarks={enableMarks} />
      )}
    </>
  );
}
