'use client';

/**
 * 「下载 PDF」按钮 —— `/alg` 下任何列 case 的页面都能挂,点一下把当前这批 case
 * (图 + 名字 + 公式)排成可打印的 A4。排版在 `lib/alg_pdf/sheet.ts`。
 *
 * 两件事值得注意:
 *  - 生成器(jsPDF + svg2pdf,还可能带出 /sim 引擎渲染异形拼图)只在点击那一刻
 *    动态 import —— 挂在页首的一个按钮不该给整个公式库加几百 KB 首屏。
 *  - `build` 是**回调**不是数据:一份 ZBLL 表要遍历几百个 case 拼出来,渲染期
 *    每次都算一遍纯属浪费,点了才算。
 */
import { useCallback, useRef, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { AlgPdfSheetInput } from '@/lib/alg_pdf/sheet';
import { tr } from '@/i18n/tr';

export interface AlgPdfButtonProps {
  /** 点击那一刻现算的整份表(标题 / case / 文件名) */
  build: () => Omit<AlgPdfSheetInput, 'onProgress' | 'shouldCancel'>;
  className?: string;
  /** 图标旁的文字;省略 = 只有图标(窄处用) */
  label?: string;
}

export default function AlgPdfButton({ build, className, label = 'PDF' }: AlgPdfButtonProps) {
  const [pct, setPct] = useState<number | null>(null);
  const cancelRef = useRef(false);

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
        onProgress: (done, total) => setPct(Math.round((done / total) * 100)),
        shouldCancel: () => cancelRef.current,
      });
    } catch (err) {
      console.error('[alg] PDF export failed', err);
      alert(tr({ zh: '生成 PDF 失败,详情见控制台', en: 'PDF export failed — see console' }));
    } finally {
      setPct(null);
    }
  }, [build, pct]);

  const busy = pct !== null;
  return (
    <button
      type="button"
      className={`alg-pdf-btn${busy ? ' is-busy' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={busy
        ? tr({ zh: '点击取消', en: 'Click to cancel' })
        : tr({ zh: '下载 PDF —— 打印用的公式表', en: 'Download a printable PDF sheet' })}
    >
      {busy ? <Loader2 size={14} className="alg-pdf-spin" /> : <FileDown size={14} />}
      {busy ? `${pct}%` : label}
    </button>
  );
}
