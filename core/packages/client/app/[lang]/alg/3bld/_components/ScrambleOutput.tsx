'use client';

// Numbered read-only list of generated scrambles + copy-all + stats line + busy spinner.

import { useEffect, useRef, useState, type JSX } from 'react';
import { usePathname } from 'next/navigation';
import TrainingStatsPanel, { TrainingSelfCheck } from '@/components/TrainingStatsPanel';
import { useTrainingStats } from '@/hooks/useTrainingStats';
import { Copy, Check } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';

interface ScrambleOutputProps {
  scrambles: string[];
  info?: string;
  busy?: boolean;
}

export function ScrambleOutput({ scrambles, info, busy }: ScrambleOutputProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const path = usePathname().replace(/^\/(?:en|zh)(?=\/)/, '');
  const group = `bld-drill:${path}`;
  const { record } = useTrainingStats(group);
  const [rated, setRated] = useState<Set<number>>(new Set());
  const recorded = useRef(new Set<number>());
  useEffect(() => { recorded.current.clear(); setRated(new Set()); }, [scrambles]);

  const copyAll = async () => {
    const text = scrambles.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context / permission) — surface the text.
      window.prompt(tr({ zh: '复制下面的打乱:', en: 'Copy the scrambles below:'
    }), text);
    }
  };

  const stat = info ?? `${scrambles.length} ${tr({ zh: '条', en: 'scrambles'
})}`;

  return (
    <div className="bld-scramble-output">
      <div className="bld-scramble-head">
        <span className="bld-stat">{stat}</span>
        {busy && (
          <span className="bld-spinner">
            <Spinner size={15} />
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
          {copied ? tr({ zh: '已复制', en: 'Copied'
                          }) : tr({ zh: '复制全部', en: 'Copy all'
                              })}
        </button>
      </div>

      {scrambles.length === 0 ? (
        <div className="bld-scramble-empty">
          {busy ? tr({ zh: '生成中…', en: 'Generating…' }) : tr({ zh: '暂无打乱', en: 'No scrambles yet'
                          })}
        </div>
      ) : (
        <ol className="bld-scramble-list">
          {scrambles.map((s, i) => (
            <li key={i} className="bld-scramble-item">
              <span className="bld-scramble-idx">{i + 1}.</span>
              <span className="bld-scramble-text">{s}
                <TrainingSelfCheck disabled={busy || rated.has(i)} onResult={correct => {
                  if (recorded.current.has(i)) return;
                  recorded.current.add(i);
                  record(correct);
                  setRated(new Set(recorded.current));
                }} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <TrainingStatsPanel group={group} />
    </div>
  );
}
