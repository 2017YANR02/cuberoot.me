/**
 * AlgChip — 可点击复制的公式 chip
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';

interface AlgChipProps {
  alg: string;
  /**
   * 渲染用 HTML 片段(已在 build pipeline 净化,只含 <u>/<s>/<em>/<strong>/<sub>/<sup>);
   * Word 源文档里下划线/删除线/斜体等都是指法记号,必须显示。
   */
  algHtml?: string;
  /** 可选 hover 提示文案 override */
  title?: string;
}

export function AlgChip({ alg, algHtml, title }: AlgChipProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(alg);
      } catch {
        // 老浏览器 fallback: 创建临时 textarea
        const ta = document.createElement('textarea');
        ta.value = alg;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          // 彻底失败 — 无反馈
        }
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    },
    [alg],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleClick],
  );

  return (
    <span
      className={'tutorial-chip' + (copied ? ' is-copied' : '')}
      role="button"
      tabIndex={0}
      title={title ?? (copied ? (isZh ? '已复制' : 'Copied') : (isZh ? '点击复制' : 'Click to copy'))}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      {algHtml ? (
        <code dangerouslySetInnerHTML={{ __html: algHtml }} />
      ) : (
        <code>{alg}</code>
      )}
      {copied ? (
        <Check className="tutorial-chip-icon" aria-label="copied" />
      ) : (
        <Copy className="tutorial-chip-icon" aria-hidden />
      )}
    </span>
  );
}
