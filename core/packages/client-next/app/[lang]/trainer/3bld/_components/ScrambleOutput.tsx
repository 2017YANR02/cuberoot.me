'use client';

// Numbered read-only list of generated scrambles + copy-all + stats line + busy spinner.

import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Loader2 } from 'lucide-react';
import { tr } from '@/i18n/tr';

interface ScrambleOutputProps {
  scrambles: string[];
  info?: string;
  busy?: boolean;
}

export function ScrambleOutput({ scrambles, info, busy }: ScrambleOutputProps): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    const text = scrambles.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context / permission) — surface the text.
      window.prompt(tr({ zh: '复制下面的打乱:', en: 'Copy the scrambles below:',
          zhHant: "複製下面的打亂:"
    }), text);
    }
  };

  const stat = info ?? `${scrambles.length} ${tr({ zh: '条', en: 'scrambles',
      zhHant: "條"
})}`;

  return (
    <div className="bld-scramble-output">
      <div className="bld-scramble-head">
        <span className="bld-stat">{stat}</span>
        {busy && (
          <span className="bld-spinner">
            <Loader2 size={15} />
            {tr({ zh: '生成中…', en: 'Generating…' })}
          </span>
        )}
        <span className="bld-spacer" />
        <button
          type="button"
          className="bld-copy-btn"
          onClick={copyAll}
          disabled={busy || scrambles.length === 0}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? (tr({ zh: '已复制', en: 'Copied',
              zhHant: "已複製"
        })) : (tr({ zh: '复制全部', en: 'Copy all',
            zhHant: "複製全部"
        }))}
        </button>
      </div>

      {scrambles.length === 0 ? (
        <div className="bld-scramble-empty">
          {busy ? (tr({ zh: '生成中…', en: 'Generating…' })) : (tr({ zh: '暂无打乱', en: 'No scrambles yet',
              zhHant: "暫無打亂"
        }))}
        </div>
      ) : (
        <ol className="bld-scramble-list">
          {scrambles.map((s, i) => (
            <li key={i} className="bld-scramble-item">
              <span className="bld-scramble-idx">{i + 1}.</span>
              <span className="bld-scramble-text">{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
