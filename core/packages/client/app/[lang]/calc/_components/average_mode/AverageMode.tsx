/**
 * Average Calculator (embedded in /calc as a tab).
 * Paste session times → WCA-style breakdown (Ao5/Ao12/Mo3/σ).
 */
'use client';

import { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, ClipboardCheck } from 'lucide-react';
import { parseTimeList } from './parse_time';
import { summarize, rollingStats, DNF } from './stats';
import { formatWcaResult } from '@/lib/wca-format-result';
import { shouldAutoAdvance } from '../engine/auto_advance';
import './average_mode.css';
import i18n from '@/i18n/i18n-client';

interface Props {
  event?: string;
}

const DEMO_DEFAULT = `12.34
13.85
DNF
11.22
14.07
12.91
13.40
10.98
14.55
12.12
DNF
13.66`;

const DEMO_FMC = `28
DNF
31
27
30
29
DNF
26`;

export default function AverageMode({ event }: Props) {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const isFmc = event === '333fm';

  const [raw, setRaw] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // NOTE: 输入变化 → 立即检查最后一行是否构成完整成绩 → 立即追加 \n 跳到下一行.
  //       规则与 H2H 输入网格的 cell auto-advance 完全一致 (engine/auto_advance.ts).
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.endsWith('\n')) {
      setRaw(val);
      return;
    }
    const lastLine = val.split('\n').pop() ?? '';
    if (shouldAutoAdvance(lastLine)) {
      const next = val + '\n';
      setRaw(next);
      requestAnimationFrame(() => {
        const ta = taRef.current;
        if (ta) ta.selectionStart = ta.selectionEnd = next.length;
      });
      return;
    }
    setRaw(val);
  };

  const values = useMemo(() => parseTimeList(raw, event), [raw, event]);
  const summary = useMemo(() => summarize(values), [values]);
  const rolling = useMemo(() => rollingStats(values), [values]);
  const PRESET_DEMO = isFmc ? DEMO_FMC : DEMO_DEFAULT;
  // NOTE: 内部统一用 average 编码 (333fm 时步数×100, 其他事件 cs);
  //       走 formatWcaResult 'average' 一次性拿到 333fm/MBLD 的格式.
  const ev = event ?? '333';
  const fmt = (v: number) => Number.isFinite(v)
    ? formatWcaResult(v, ev, 'average')
    : '—';
  const fmtSingle = (v: number) => Number.isFinite(v)
    ? formatWcaResult(isFmc ? v / 100 : v, ev, 'single')
    : '—';

  const reverseRolling = useMemo(() => [...rolling].reverse(), [rolling]);
  const isPb = (key: 'ao5' | 'ao12' | 'mo3', v: number) => {
    if (v === DNF || !Number.isFinite(v)) return false;
    const best = key === 'ao5' ? summary.bestAo5
      : key === 'ao12' ? summary.bestAo12
      : summary.bestMo3;
    return v === best;
  };

  return (
    <div className="avg-mode">
      <main className="avg-main">
        <section className="avg-input-pane">
          <div className="avg-input-toolbar">
            <span className="avg-input-label">
              {isFmc
                ? t('每行一个步数（按空格换行），32 / DNF / DNS', 'One move per line (space to wrap); 32 / DNF / DNS')
                : t('每行一个成绩（输完自动换行），12.34 或 1234（=12.34）/ 1:23.45 / DNF / DNS', 'One time per line (auto-wrap on complete); 12.34 or 1234 (=12.34) / 1:23.45 / DNF / DNS')}
            </span>
            <div className="avg-input-actions">
              <button
                type="button"
                className="avg-btn avg-btn-ghost"
                onClick={() => setRaw(PRESET_DEMO)}
                title={t('载入示例', 'Load demo')}
              >
                <ClipboardCheck size={14} />
                <span>{t('示例', 'Demo')}</span>
              </button>
              <button
                type="button"
                className="avg-btn avg-btn-ghost"
                onClick={() => setRaw('')}
                disabled={!raw}
                title={t('清空', 'Clear')}
              >
                <Trash2 size={14} />
                <span>{t('清空', 'Clear')}</span>
              </button>
            </div>
          </div>
          <textarea
            ref={taRef}
            className="avg-input"
            value={raw}
            onChange={handleChange}
            onKeyDown={(e) => {
              // 空格 / 逗号 / 分号 → 自动换行,免按 Enter
              if (e.key === ' ' || e.key === ',' || e.key === ';') {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const before = raw.slice(0, start);
                // 已经在行尾换行符上则不再追加
                if (start === end && before.endsWith('\n')) return;
                const next = before + '\n' + raw.slice(end);
                setRaw(next);
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = start + 1;
                });
              }
            }}
            placeholder={isFmc ? '28\nDNF\n31\n...' : '12.34\n13.85\nDNF\n11.22\n...'}
            spellCheck={false}
          />
          <div className="avg-input-meta">
            {values.length === 0
              ? t('未识别到成绩', 'No times yet')
              : t(`已识别 ${values.length} 条`, `${values.length} time${values.length > 1 ? 's' : ''}`)}
          </div>
        </section>

        <section className="avg-stats-pane">
          <div className="avg-cards">
            <StatCard label={t('总数', 'Count')} value={String(summary.count)} sub={t(`成功 ${summary.successCount}`, `${summary.successCount} solved`)} />
            <StatCard label="PB" value={fmtSingle(summary.best)} sub={t('最佳单次', 'Best single')} highlight />
            <StatCard label={t('平均', 'Mean')} value={fmt(summary.mean)} sub={t('算术平均', 'Arithmetic mean')} />
            <StatCard label="σ" value={fmt(summary.stdDev)} sub={t('标准差', 'Std deviation')} />
            <StatCard label="Mo3" value={fmt(summary.currentMo3)} sub={t(`PB ${fmt(summary.bestMo3)}`, `PB ${fmt(summary.bestMo3)}`)} />
            <StatCard label="Ao5" value={fmt(summary.currentAo5)} sub={t(`PB ${fmt(summary.bestAo5)}`, `PB ${fmt(summary.bestAo5)}`)} highlight />
            <StatCard label="Ao12" value={fmt(summary.currentAo12)} sub={t(`PB ${fmt(summary.bestAo12)}`, `PB ${fmt(summary.bestAo12)}`)} highlight />
            <StatCard label="DNF" value={String(summary.dnfCount)} sub={`${(summary.dnfRate * 100).toFixed(1)}%`} />
            <StatCard label={t('最差', 'Worst')} value={fmtSingle(summary.worst)} sub={t('最差单次', 'Worst single')} />
          </div>

          {rolling.length > 0 && (
            <div className="avg-table-wrap">
              <table className="avg-table">
                <thead>
                  <tr>
                    <th className="avg-th-num">#</th>
                    <th>{t('成绩', 'Time')}</th>
                    <th>Mo3</th>
                    <th>Ao5</th>
                    <th>Ao12</th>
                  </tr>
                </thead>
                <tbody>
                  {reverseRolling.map((r) => (
                    <tr key={r.i}>
                      <td className="avg-td-num">{r.i + 1}</td>
                      <td className={r.value === DNF ? 'avg-cell-dnf' : ''}>{fmtSingle(r.value)}</td>
                      <td className={isPb('mo3', r.mo3) ? 'avg-cell-pb' : ''}>{fmt(r.mo3)}</td>
                      <td className={isPb('ao5', r.ao5) ? 'avg-cell-pb' : ''}>{fmt(r.ao5)}</td>
                      <td className={isPb('ao12', r.ao12) ? 'avg-cell-pb' : ''}>{fmt(r.ao12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`avg-card${highlight ? ' avg-card-hl' : ''}`}>
      <div className="avg-card-label">{label}</div>
      <div className="avg-card-value">{value}</div>
      {sub && <div className="avg-card-sub">{sub}</div>}
    </div>
  );
}
