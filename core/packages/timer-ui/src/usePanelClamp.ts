'use client';

// 锚定下拉面板防溢出(issue #29):面板 position:absolute 锚在触发钮下方(left:0)时,
// 触发钮靠右 + 面板较宽 → 右缘越出视口被裁。max-width:90vw 只钳面板自身宽度,
// 钳不住「锚点位置 + 宽度」合起来越界 —— 只能开着时实测再左移。
// 用法:面板条件渲染(open && <div ref={panelRef}>)时传 open + 面板 ref;
// 用 margin-left 修正左右溢出(不碰 transform,保留居中定位),左缘不越界优先;resize 重算。
import { useLayoutEffect, type RefObject } from 'react';

const MARGIN = 8; // 面板与视口边缘的最小间距 px

export function usePanelClamp(open: boolean, ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      el.style.marginLeft = '';
      const left = el.getBoundingClientRect().left; // 出场 scale 动画原点 top left,不影响 left
      const width = el.offsetWidth;                 // layout 宽,不受入场 transform 影响
      // A stable scrollbar gutter can sit inside clientWidth; keep the panel outside it.
      const root = document.documentElement;
      const vw = Math.min(root.clientWidth, root.getBoundingClientRect().right);
      const overRight = left + width - (vw - MARGIN);
      const shift = Math.max(MARGIN - left, -Math.max(0, overRight));
      if (shift !== 0) el.style.marginLeft = `${shift}px`;
    };
    apply();
    // Menus can expand in place (for example, opening a background gallery).
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [open, ref]);
}
