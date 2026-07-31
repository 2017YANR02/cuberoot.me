'use client';

/**
 * 「下载 PDF」按钮 —— `/alg` 下任何列 case 的页面都能挂,点一下把当前这批 case
 * (图 + 名字 + 公式)排成可打印的 A4。排版在 `lib/alg_pdf/sheet.ts`。
 *
 * 三件事值得注意:
 *  - 生成器(jsPDF + svg2pdf,还可能带出 /sim 引擎渲染异形拼图)只在点击那一刻
 *    动态 import —— 挂在页首的一个按钮不该给整个公式库加几百 KB 首屏。
 *  - `build` 是**回调**不是数据:一份 ZBLL 表要遍历几百个 case 拼出来,渲染期
 *    每次都算一遍纯属浪费,点了才算。
 *  - 纸色(浅 / 深)记在 localStorage:挑一次就该在整个公式库里一直有效,
 *    不该每翻一页重挑。默认浅色 —— 深色底打印机要喷满一页墨。
 *  - 表里印的二维码指向**当前这一页**(含语言前缀和筛选参数),扫过去就是在线版。
 *    地址点击那刻现取,不是渲染期算的 —— 筛选改了地址也跟着改。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { ListSelect } from '@/components/ListSelect';
import type { AlgPdfSheetInput, AlgPdfTheme } from '@/lib/alg_pdf/sheet';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';

const THEME_KEY = 'alg-pdf-theme';

export interface AlgPdfButtonProps {
  /** 点击那一刻现算的整份表(标题 / case / 文件名) */
  build: () => Omit<AlgPdfSheetInput, 'onProgress' | 'shouldCancel' | 'theme'>;
  className?: string;
  /** 图标旁的文字;省略 = 只有图标(窄处用) */
  label?: string;
}

export default function AlgPdfButton({ build, className, label = 'PDF' }: AlgPdfButtonProps) {
  const [pct, setPct] = useState<number | null>(null);
  const [theme, setTheme] = useState<AlgPdfTheme>('light');
  const cancelRef = useRef(false);

  // 首帧不读 localStorage:这些页面是静态预渲染的,读了会 hydration 不一致
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === 'dark') setTheme('dark');
    } catch { /* 无痕模式 */ }
  }, []);

  const pickTheme = useCallback((next: string) => {
    const t: AlgPdfTheme = next === 'dark' ? 'dark' : 'light';
    setTheme(t);
    persistItem(THEME_KEY, t);
  }, []);

  const onClick = useCallback(async () => {
    if (pct !== null) { cancelRef.current = true; return; }  // 生成中再点 = 取消
    cancelRef.current = false;
    setPct(0);
    try {
      const { downloadAlgSheet } = await import('@/lib/alg_pdf/sheet');
      const sheet = build();
      if (!sheet.cases.length) return;
      await downloadAlgSheet({
        // 二维码指向当前地址,但去掉 hash(#case 锚点这类只在本次会话有意义)
        url: sheet.url ?? `${window.location.origin}${window.location.pathname}${window.location.search}`,
        ...sheet,
        theme,
        onProgress: (done, total) => setPct(Math.round((done / total) * 100)),
        shouldCancel: () => cancelRef.current,
      });
    } catch (err) {
      console.error('[alg] PDF export failed', err);
      alert(tr({ zh: '生成 PDF 失败,详情见控制台', en: 'PDF export failed — see console' }));
    } finally {
      setPct(null);
    }
  }, [build, theme, pct]);

  const busy = pct !== null;
  // 标签写「纸」而不是光「浅色 / 深色」:这个下拉紧挨着页面本身的视图切换器,
  // 不点明是纸色的话会被当成又一个页面开关。
  const papers = [
    { value: 'light', label: tr({ zh: '浅色纸', en: 'Light paper' }) },
    { value: 'dark', label: tr({ zh: '深色纸', en: 'Dark paper' }) },
  ];
  return (
    <div className={`alg-pdf-group${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`alg-pdf-btn${busy ? ' is-busy' : ''}`}
        onClick={onClick}
        title={busy
          ? tr({ zh: '点击取消', en: 'Click to cancel' })
          : tr({ zh: '下载 PDF —— 打印用的公式表', en: 'Download a printable PDF sheet' })}
      >
        {busy ? <Loader2 size={14} className="alg-pdf-spin" /> : <FileDown size={14} />}
        {busy ? `${pct}%` : label}
      </button>
      <ListSelect
        className="alg-pdf-paper"
        items={papers}
        value={theme}
        onChange={pickTheme}
        allLabel={papers[0].label}
        clearable={false}
      />
    </div>
  );
}
