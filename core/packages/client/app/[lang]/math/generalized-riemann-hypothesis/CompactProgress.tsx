'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import styles from './progress.module.css';

interface CompactSnapshot {
  done: number;
  total: number;
  stage: 'passed' | 'failed' | 'build' | 'audit';
  sampled: number;
  audit: number;
  recent: string[];
}

export default function CompactProgress() {
  const t = useT(), lang = useLang();
  const [data, setData] = useState<CompactSnapshot>();
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const res = await fetch('/api/local/grh-compact', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error();
        const next: CompactSnapshot = await res.json();
        if (controller.signal.aborted) return;
        setData(next);
        const finished = next.stage === 'passed' || next.stage === 'failed';
        setDelayed(!finished && Date.now() - next.sampled > 20_000);
        if (finished) return;
      } catch {
        if (controller.signal.aborted) return;
        setDelayed(true);
      }
      timer = setTimeout(refresh, 3000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  const status = delayed ? t('采样中断，等待更新', 'Updates delayed')
    : !data ? t('读取进度中', 'Loading progress')
    : { build: t('正在编译', 'Compiling'), audit: t('正在检查公理', 'Auditing axioms'),
      passed: t('五条定理核验通过', 'All five theorems verified'), failed: t('核验已停止', 'Verification stopped') }[data.stage];

  return <section id="compact" className={styles.progressPanel} aria-labelledby="compact-title" data-site-surface="panel">
    <div className={styles.sectionHead}>
      <h2 id="compact-title">{t('精简版 · 本机核验进度', 'Compact edition · local verification')}</h2>
      <span role="status" className={styles.status} data-tone={delayed ? 'warning' : data?.stage === 'failed' ? 'failed' : 'current'}>{status}</span>
    </div>
    <p><a href="#live">{t('查看 11 月 23 日的原版核验记录', 'View the November 23 verification of the original proof')}</a></p>
    {data && <>
      <div className={styles.counter}><strong>{data.done}</strong><span>/ {data.total} {t('个源码模块已编译', 'source modules compiled')}</span>
        <b>{(data.done / data.total).toLocaleString(lang, { style: 'percent', maximumFractionDigits: 1 })}</b></div>
      <progress className={styles.progress} value={data.done} max={data.total} aria-labelledby="compact-title" />
      <div className={styles.activity}><h3>{t('最近编译完成', 'Recently compiled')}</h3>
        <ul>{data.recent.map(name => <li key={name}><code>{name}</code></li>)}</ul></div>
      <div className={styles.updated}>{t('已输出公理清单的定理', 'Theorem axiom lists reported')} {data.audit} / 5 · {t('采样时间', 'Sampled at')} {new Date(data.sampled).toLocaleTimeString(lang)}</div>
    </>}
  </section>;
}
