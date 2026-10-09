'use client';

import { Check, Copy } from 'lucide-react';
import { useCopy } from '@/hooks/useCopy';

interface Props {
  text: string;
  t: (zh: string, en: string) => string;
}

/** Keep one generated Mega/Kilominx scramble on one clipboard line. These
 * R++/D++/U rows are soft wrapping; arbitrary pasted algs/comments stay intact. */
export function scrambleClipboardText(scramble: string): string {
  if (!/[\r\n]/.test(scramble)) return scramble;
  const tokens = scramble.trim().split(/\s+/);
  return tokens.every((token) => /^(?:[RD](?:\+\+|--)|U'?)$/.test(token))
    ? tokens.join(' ') : scramble;
}

/** Shared bulk-copy action for competition and batch generation modes. */
export default function CopyAllScramblesButton({ text, t }: Props) {
  const { copied, copy } = useCopy();
  const label = copied
    ? t('已复制', 'Copied')
    : t('复制全部打乱', 'Copy all scrambles');

  return (
    <button
      type="button"
      className={`gen-btn gen-copy-all${copied ? ' is-copied' : ''}`}
      onClick={() => copy(text)}
      disabled={!text}
      title={label}
      aria-label={label}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
