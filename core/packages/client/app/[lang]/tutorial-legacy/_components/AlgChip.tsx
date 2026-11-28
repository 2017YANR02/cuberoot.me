/**
 * AlgChip — 可点击复制的公式 chip
 */
import { useCopy } from '@/hooks/useCopy';
import { useCallback } from 'react';
import { CopySuccessIcon } from '@/components/CopySuccessIcon';
import { Copy } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';

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
  const { copied, copy } = useCopy();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void copy(alg);
    },
    [alg, copy],
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
      title={title ?? (copied ? tr({ zh: '已复制', en: 'Copied'
          }) : tr({ zh: '点击复制', en: 'Click to copy'
              }))}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      {algHtml ? (
        <code dangerouslySetInnerHTML={{ __html: algHtml }} />
      ) : (
        <code>{alg}</code>
      )}
      {copied ? (
        <CopySuccessIcon size={24} className="tutorial-chip-icon" aria-label="copied" />
      ) : (
        <Copy className="tutorial-chip-icon" aria-hidden />
      )}
    </span>
  );
}
