'use client';

/**
 * 「下载 PDF」按钮 —— `/alg` 下任何需要打印 case 的页面都能挂,点一下
 * 把当前内容排成可打印的 A4。排版在 `lib/alg_pdf/sheet.ts`。
 *
 * 几件事值得注意:
 *  - 生成器(jsPDF + svg2pdf,还可能带出 /sim 引擎渲染异形拼图)只在点击那一刻
 *    动态 import —— 挂在页首的一个按钮不该给整个公式库加几百 KB 首屏。
 *  - `build` 是**回调**不是数据:一份 ZBLL 表要遍历几百个 case 拼出来,渲染期
 *    每次都算一遍纯属浪费,点了才算。
 *  - 纸色(浅 / 深)是**点开之后才出现的两个选项**,选哪个就按哪个生成,不常驻页头:
 *    它一年也改不了两次,不值得为它长期占一个控件。上次选的记在 localStorage 并在菜单里
 *    标出来,免得每次都要想「上回印的是哪种」。默认浅色 —— 深色底打印机要喷满一页墨。
 *  - 页首这一排(PDF / 训练 / 观察)是纯文字:无框、无图标、也不画下拉三角。这排挂在
 *    `align-items: baseline` 的页头上,而 inline-flex 里第一项是 SVG 时基线取的是图标盒子,
 *    带图标的那两个会比「训练」高出 1.7px —— 一排按钮就站不齐。
 *  - 表里印的二维码指向**当前这一页**(含语言前缀和筛选参数),扫过去就是在线版。
 *    地址点击那刻现取,不是渲染期算的 —— 筛选改了地址也跟着改。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import type { AlgPdfSheetInput, AlgPdfTheme } from '@/lib/alg_pdf/sheet';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';

const THEME_KEY = 'alg-pdf-theme';

export interface AlgPdfButtonProps {
  /** 点击那一刻现算的整份表(标题 / case / 文件名) */
  build: () => Omit<AlgPdfSheetInput, 'onProgress' | 'shouldCancel' | 'theme'>
    | Promise<Omit<AlgPdfSheetInput, 'onProgress' | 'shouldCancel' | 'theme'>>;
  className?: string;
  /** 按钮文字 */
  label?: string;
  /** 按钮提示;训练题单与公式表的用途不同 */
  title?: string;
}

export default function AlgPdfButton({ build, className, label = 'PDF', title }: AlgPdfButtonProps) {
  const [pct, setPct] = useState<number | null>(null);
  const [theme, setTheme] = useState<AlgPdfTheme>('light');
  const [open, setOpen] = useState(false);
  const cancelRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);

  // 首帧不读 localStorage:这些页面是静态预渲染的,读了会 hydration 不一致
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === 'dark') setTheme('dark');
    } catch { /* 无痕模式 */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = useCallback(async (paper: AlgPdfTheme) => {
    cancelRef.current = false;
    setPct(0);
    try {
      const { downloadAlgSheet } = await import('@/lib/alg_pdf/sheet');
      const sheet = await build();
      if (!sheet.cases.length) return;
      await downloadAlgSheet({
        // 二维码指向当前地址,但去掉 hash(#case 锚点这类只在本次会话有意义)
        url: sheet.url ?? `${window.location.origin}${window.location.pathname}${window.location.search}`,
        ...sheet,
        theme: paper,
        onProgress: (done, total) => setPct(Math.round((done / total) * 100)),
        shouldCancel: () => cancelRef.current,
      });
    } catch (err) {
      console.error('[alg] PDF export failed', err);
      alert(tr({ zh: '生成 PDF 失败,详情见控制台', en: 'PDF export failed — see console' }));
    } finally {
      setPct(null);
    }
  }, [build]);

  const pick = (paper: AlgPdfTheme) => {
    setOpen(false);
    setTheme(paper);
    persistItem(THEME_KEY, paper);
    void run(paper);
  };

  const busy = pct !== null;
  // 标签写「纸」而不是光「浅色 / 深色」:菜单挨着页面本身的视图切换器弹出来,
  // 不点明是纸色的话会被当成又一个页面开关。
  const papers: { value: AlgPdfTheme; label: string }[] = [
    { value: 'light', label: tr({ zh: '浅色纸', en: 'Light paper' }) },
    { value: 'dark', label: tr({ zh: '深色纸', en: 'Dark paper' }) },
  ];

  return (
    <div ref={rootRef} className={`alg-pdf${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`alg-pdf-btn${busy ? ' is-busy' : ''}`}
        aria-expanded={busy ? undefined : open}
        onClick={() => {
          if (busy) cancelRef.current = true;   // 生成中再点 = 取消
          else setOpen(o => !o);
        }}
        title={busy
          ? tr({ zh: '点击取消', en: 'Click to cancel' })
          : title ?? tr({ zh: '下载 PDF —— 打印用的公式表', en: 'Download a printable PDF sheet' })}
      >
        {busy ? `${pct}%` : label}
      </button>
      {open && !busy && (
        <div ref={panelRef} className="alg-pdf-menu">
          {papers.map(p => (
            <button
              key={p.value}
              type="button"
              className={`alg-pdf-menu-item${theme === p.value ? ' is-current' : ''}`}
              onClick={() => pick(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
