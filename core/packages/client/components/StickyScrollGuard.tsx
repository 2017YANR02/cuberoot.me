'use client';

// 统计表吸顶容器(.sticky-scroll)的溢出守卫。桌面端容器为保住 thead 相对视口吸顶而
// overflow:visible(见 sticky-table.css),表格比容器宽时会穿出卡片边框、甚至把页面撑出
// 横向滚动(issue #23:/wca/grand-slam、选手页成绩表)。纯 CSS 无法「仅在真溢出时」切
// overflow-x:auto(一旦常设,吸顶在所有表上全废),故用 ResizeObserver 全局观察:
// 内容超宽 → 打 .stk-overflow(容器自滚动,吸顶失效);放得下 → 摘除(吸顶恢复)。
// 挂根 layout 一次覆盖全站,新表零接入成本。
import { useEffect } from 'react';

export default function StickyScrollGuard() {
  useEffect(() => {
    // 窄屏已由 sticky-table.css 保证横滚，无需在每批成绩挂载后强制计算整表布局。
    const mobile = window.matchMedia('(max-width: 767px)');
    const pending = new Set<Element>();
    let frame = 0;
    const flush = () => {
      frame = 0;
      // 先完成所有布局读取，再写 class，避免多表之间读写交错触发重复布局。
      const measured = [...pending].filter(host => host.isConnected)
        .map(host => [host, host.scrollWidth > host.clientWidth + 1] as const);
      pending.clear();
      for (const [host, overflow] of measured) host.classList.toggle('stk-overflow', overflow);
    };
    const check = (host: Element) => {
      if (mobile.matches) return;
      pending.add(host);
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const host = e.target.classList.contains('sticky-scroll')
          ? e.target
          : e.target.closest('.sticky-scroll');
        if (host) check(host);
      }
    });
    const seen = new WeakSet<Element>();
    const scan = () => {
      if (mobile.matches) return;
      for (const host of document.querySelectorAll('.sticky-scroll')) {
        if (!seen.has(host)) { seen.add(host); ro.observe(host); }
        // 子元素(表格)也要观察:数据加载后内容宽度才定,容器自身 box 不一定变
        for (const child of host.children) {
          if (!seen.has(child)) { seen.add(child); ro.observe(child); }
        }
        check(host);
      }
    };
    const mo = new MutationObserver(scan);
    const syncViewport = () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending.clear();
      if (mobile.matches) {
        for (const host of document.querySelectorAll('.sticky-scroll.stk-overflow')) host.classList.remove('stk-overflow');
      } else {
        mo.observe(document.body, { childList: true, subtree: true });
        scan();
      }
    };
    syncViewport();
    mobile.addEventListener('change', syncViewport);
    return () => {
      mo.disconnect(); ro.disconnect();
      mobile.removeEventListener('change', syncViewport);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
