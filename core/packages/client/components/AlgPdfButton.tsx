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
 *
 * 纸色这个二选一没用 `PillToggle`:它单独站在按钮旁边时,跟同一行已有的「图/表」
 * 视图开关长得一模一样,读起来像第二个页面级开关,看不出管的是 PDF。做成同一个
 * 边框里的分段控件(动作 + 它的选项),归属一眼就清楚。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Loader2, Moon, Sun } from 'lucide-react';
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
  const [dark, setDark] = useState(false);
  const cancelRef = useRef(false);

  // 首帧不读 localStorage:这些页面是静态预渲染的,读了会 hydration 不一致
  useEffect(() => {
    try { setDark(localStorage.getItem(THEME_KEY) === 'dark'); } catch { /* 无痕模式 */ }
  }, []);

  const pickTheme = useCallback((next: boolean) => {
    setDark(next);
    persistItem(THEME_KEY, next ? 'dark' : 'light');
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
        ...sheet,
        theme: (dark ? 'dark' : 'light') satisfies AlgPdfTheme,
        onProgress: (done, total) => setPct(Math.round((done / total) * 100)),
        shouldCancel: () => cancelRef.current,
      });
    } catch (err) {
      console.error('[alg] PDF export failed', err);
      alert(tr({ zh: '生成 PDF 失败,详情见控制台', en: 'PDF export failed — see console' }));
    } finally {
      setPct(null);
    }
  }, [build, dark, pct]);

  const busy = pct !== null;
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
      <button
        type="button"
        className="alg-pdf-paper"
        onClick={() => pickTheme(!dark)}
        disabled={busy}
        aria-pressed={dark}
        aria-label={tr({ zh: 'PDF 纸色', en: 'PDF paper colour' })}
        title={dark
          ? tr({ zh: '深色纸:适合屏幕上看。点一下换成浅色', en: 'Dark paper — good on screen. Click for light' })
          : tr({ zh: '浅色纸:适合打印。点一下换成深色', en: 'Light paper — good for printing. Click for dark' })}
      >
        {dark ? <Moon size={12} /> : <Sun size={12} />}
        {dark ? tr({ zh: '深色', en: 'Dark' }) : tr({ zh: '浅色', en: 'Light' })}
      </button>
    </div>
  );
}
