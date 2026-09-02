'use client';

// 锚定下拉面板防溢出(issue #29):面板 position:absolute 锚在触发钮下方(left:0)时,
// 触发钮靠右 + 面板较宽 → 右缘越出视口被裁。max-width:90vw 只钳面板自身宽度,
// 钳不住「锚点位置 + 宽度」合起来越界 —— 只能开着时实测再左移。
// 用法:面板条件渲染(open && <div ref={panelRef}>)时传 open + 面板 ref;
// 超出右缘就设负 margin-left(不碰 transform,避开出场动画冲突),左缘不越界优先;resize 重算。
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
      const vw = document.documentElement.clientWidth;
      const overRight = left + width - (vw - MARGIN);
      const shift = Math.min(Math.max(0, overRight), Math.max(0, left - MARGIN));
      if (shift > 0) el.style.marginLeft = `${-shift}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [open, ref]);
}
