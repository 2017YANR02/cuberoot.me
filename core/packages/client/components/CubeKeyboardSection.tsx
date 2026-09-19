'use client';
/**
 * 虚拟键盘 + toggle 按钮 — 桌面默认收起、提供按钮展开;移动端强制打开,无按钮。
 * Ported from packages/client-vite/src/components/CubeKeyboardSection/CubeKeyboardSection.tsx.
 */
import { useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import CubeVirtualKeyboard from './CubeVirtualKeyboard';
import { tr } from '@/i18n/tr';

interface Props {
  target: RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  onInput?: () => void;
  enableMarks?: boolean;
  /** 收起状态点击入口前先激活对应输入框。 */
  onActivate?: () => void;
  /** 移动端是否显示——省略时沿用旧行为(移动端恒显示);传入后按此值决定(如跟随目标框的聚焦态)。 */
  mobileVisible?: boolean;
  /** 将桌面开关放到输入框工具栏，键盘仍在原位置展开。 */
  toggleContainer?: HTMLElement | null;
}

export default function CubeKeyboardSection({ target, onInput, enableMarks, onActivate, mobileVisible = true, toggleContainer }: Props) {
  const isMobile = useIsMobile();
  const [showKeyboard, setShowKeyboard] = useState(false);

  const visible = isMobile ? mobileVisible : showKeyboard;
  const labelOn = tr({ zh: '隐藏虚拟键盘', en: 'Hide keyboard'
});
  const labelOff = tr({ zh: '显示虚拟键盘', en: 'Show keyboard'
});

  const toggleBtn = !isMobile ? (
    <button
      type="button"
      className={`vkb-toggle${showKeyboard ? ' active' : ''}${showKeyboard && !toggleContainer ? ' vkb-toggle--inline' : ''}`}
      onClick={() => {
        if (!showKeyboard) onActivate?.();
        setShowKeyboard(s => !s);
      }}
      aria-label={showKeyboard ? labelOn : labelOff}
      title={showKeyboard ? labelOn : labelOff}
    >
      <Keyboard size={14} />
    </button>
  ) : null;

  return (
    <>
      {/* 收起时按钮单独占一行;展开后挪进键盘内(触发器行最右侧)省空间 */}
      {toggleContainer ? createPortal(toggleBtn, toggleContainer) : toggleBtn && !showKeyboard && toggleBtn}
      {visible && (
        <CubeVirtualKeyboard
          target={target}
          onInput={onInput}
          enableMarks={enableMarks}
          toggleButton={!toggleContainer && toggleBtn && showKeyboard ? toggleBtn : undefined}
        />
      )}
    </>
  );
}
