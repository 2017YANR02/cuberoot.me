'use client';

// 浮层的「点外面关 / 按 Esc 关」。站内已经有三处锚定面板(RecentScrambles、
// SubsetColorPicker、AlgPdfButton)各抄了一遍同样的 effect,/calendar 顶栏两个浮层
// 要第四第五份时提出来的。
//
// 只管关闭 —— 面板怎么定位、要不要钳视口(usePanelClamp)由调用方自己决定。
//
// 触发钮必须单独传:浮层常常不是钮的子节点(fixed / 顶栏外挂),不把钮排除掉的话
// 点钮会「先关再开」,表现就是按钮按不动。
import { useEffect, useRef, type RefObject } from 'react';

export function usePopoverDismiss(
  open: boolean,
  close: () => void,
  panel: RefObject<HTMLElement | null>,
  trigger?: RefObject<HTMLElement | null>,
): void {
  // close 多半是行内箭头函数,进依赖会每帧重挂一次监听 —— 放 ref 里只读最新的。
  const latest = useRef(close);
  latest.current = close;

  useEffect(() => {
    if (!open) return;
    const inside = (t: Node | null): boolean =>
      !!t && (!!panel.current?.contains(t) || !!trigger?.current?.contains(t));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target as Node)) latest.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      latest.current();
      trigger?.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, panel, trigger]);
}
