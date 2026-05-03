/**
 * /average — paste your session times, get WCA-style breakdown.
 * No backend, no settings, just a textarea + computed table + summary.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Trash2, ClipboardCheck } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { parseTimeList } from './parse_time';
import { summarize, rollingStats, fmtCs, DNF } from './stats';
import './average.css';

const PRESET_DEMO = `12.34
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

export default function AveragePage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [raw, setRaw] = useState('');

  const values = useMemo(() => parseTimeList(raw), [raw]);
  const summary = useMemo(() => summarize(values), [values]);
  const rolling = useMemo(() => rollingStats(values), [values]);

  const reverseRolling = useMemo(() => [...rolling].reverse(), [rolling]);
  const isPb = (key: 'ao5' | 'ao12' | 'mo3', v: number) => {
    if (v === DNF || !Number.isFinite(v)) return false;
    const best = key === 'ao5' ? summary.bestAo5
      : key === 'ao12' ? summary.bestAo12
      : summary.bestMo3;
    return v === best;
  };

  return (
    <div className="avg-page">
      <header className="avg-header">
        <div className="avg-title">
          <Calculator size={20} className="avg-title-icon" />
          <h1>{t('成绩计算器', 'Average Calculator')}</h1>
          <span className="avg-title-sub">Ao5 · Ao12 · Mo3 · σ</span>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="avg-main">
        <section className="avg-input-pane">
          <div className="avg-input-toolbar">
            <span className="avg-input-label">
              {t('每行一个成绩，支持 12.34 / 1:23.45 / DNF / DNS', 'One time per line — 12.34, 1:23.45, DNF, DNS')}
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
            className="avg-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'12.34\n13.85\nDNF\n11.22\n...'}
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
            <StatCard label="PB" value={fmtCs(summary.best)} sub={t('最佳单次', 'Best single')} highlight />
            <StatCard label={t('平均', 'Mean')} value={fmtCs(summary.mean)} sub={t('算术平均', 'Arithmetic mean')} />
            <StatCard label="σ" value={fmtCs(summary.stdDev)} sub={t('标准差', 'Std deviation')} />
            <StatCard label="Mo3" value={fmtCs(summary.currentMo3)} sub={t(`PB ${fmtCs(summary.bestMo3)}`, `PB ${fmtCs(summary.bestMo3)}`)} />
            <StatCard label="Ao5" value={fmtCs(summary.currentAo5)} sub={t(`PB ${fmtCs(summary.bestAo5)}`, `PB ${fmtCs(summary.bestAo5)}`)} highlight />
            <StatCard label="Ao12" value={fmtCs(summary.currentAo12)} sub={t(`PB ${fmtCs(summary.bestAo12)}`, `PB ${fmtCs(summary.bestAo12)}`)} highlight />
            <StatCard label="DNF" value={String(summary.dnfCount)} sub={`${(summary.dnfRate * 100).toFixed(1)}%`} />
            <StatCard label={t('最差', 'Worst')} value={fmtCs(summary.worst)} sub={t('最差单次', 'Worst single')} />
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
                      <td className={r.value === DNF ? 'avg-cell-dnf' : ''}>{fmtCs(r.value)}</td>
                      <td className={isPb('mo3', r.mo3) ? 'avg-cell-pb' : ''}>{fmtCs(r.mo3)}</td>
                      <td className={isPb('ao5', r.ao5) ? 'avg-cell-pb' : ''}>{fmtCs(r.ao5)}</td>
                      <td className={isPb('ao12', r.ao12) ? 'avg-cell-pb' : ''}>{fmtCs(r.ao12)}</td>
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
