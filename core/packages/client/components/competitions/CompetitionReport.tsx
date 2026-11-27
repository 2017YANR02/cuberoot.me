import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Download, Medal } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';
import { competitionDateTime } from '@/lib/competition-date';
import { displayCuberName } from '@/lib/cuber-name-display';
import { listCompetitionResults, type CompetitionResult, type OnlineCompetition } from '@/lib/online-competition-api';
import { formatWcaResult } from '@/lib/wca-format-result';
import { eventDisplayName } from '@/lib/wca-events';
import { competitionDeviceName } from './CompetitionDraftForm';
import { competitionAo5 } from './competition-results';

export type ReportData = {
  competition: string;
  organizer: string;
  division: string;
  name: string;
  date: string;
  rank?: number | null;
  final: boolean;
  metrics: Array<{ label: string; value: string }>;
  attempts?: string[];
};

export function ao5ReportData(competition: OnlineCompetition, row: CompetitionResult, t: ReturnType<typeof useT>, lang: 'zh' | 'en'): ReportData {
  const score = competitionAo5(row.attempts, row.project);
  return {
    competition: t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh),
    organizer: competition.organizationName,
    division: `${eventDisplayName(row.project, lang === 'zh')} · ${competitionDeviceName(row.device, t)}`,
    name: displayCuberName(row.displayName, lang === 'zh'),
    date: competitionDateTime(row.recordedAt ?? competition.endsAt).slice(0, 10),
    rank: row.rank, final: !!row.finalizedAt, attempts: score.times,
    metrics: [
      { label: t('Ao5 平均', 'Ao5 average'), value: formatWcaResult(score.average, row.project, 'average') },
      { label: t('最佳单次', 'Best single'), value: formatWcaResult(score.best, row.project, 'single') },
    ],
  };
}

export function useCompetitionResults(id: string, revision: number, enabled = true) {
  const t = useT();
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void listCompetitionResults(id).then(result => { if (active) { setResults(result.results); setError(''); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : t('成绩加载失败。', 'Could not load results.')); });
    return () => { active = false; };
  }, [enabled, id, revision, t]);
  return { results, error };
}

const width = 760;
const height = 520;
const scale = 2;

export function CompetitionRank({ rank, final, podium = final }: { rank: number | null | undefined; final: boolean; podium?: boolean }) {
  if (!rank) return <>—</>;
  if (!podium || rank > 3) return <>{rank}</>;
  return <span className="competition-podium-rank" data-place={rank}>{rank}</span>;
}

export function CompetitionReport({ data, share, renderAttempt }: { data: ReportData; share: boolean; renderAttempt?: (value: string, number: number) => ReactNode }) {
  const t = useT();
  return <section className="competition-report" data-site-surface="panel">
    <div className="competition-report-heading">
      <Medal size={23} aria-hidden />
      <div><h3>{t('完赛战报', 'Competition report')}</h3><p>{data.division}</p></div>
      {data.rank != null && <span className="competition-report-rank"><CompetitionRank rank={data.rank} final={data.final} /> {data.final ? t('最终名次', 'Final rank') : t('组内暂列', 'Provisional rank')}</span>}
    </div>
    <dl className="competition-report-metrics">{data.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
    {data.attempts && <ol className="competition-report-attempts" aria-label={t('五次成绩', 'All attempts')}>
      {data.attempts.map((value, index) => <li key={index}><span>{t(`第 ${index + 1} 把`, `Attempt ${index + 1}`)}</span><strong>{renderAttempt ? renderAttempt(value, index + 1) : value}</strong></li>)}
    </ol>}
    {share && <CompetitionReportShare data={data} />}
  </section>;
}

export function CompetitionReportShare({ data }: { data: ReportData }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return <>
    <button className="competition-secondary competition-report-share" type="button" onClick={() => setOpen(true)}>
      <Download size={16} aria-hidden />{data.final ? t('完赛证书', 'Finisher certificate') : t('生成战报图', 'Share result image')}
    </button>
    {open && <ReportDialog data={data} onClose={() => setOpen(false)} />}
  </>;
}

function ReportDialog({ data, onClose: onDismiss }: { data: ReportData; onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  function onClose() {
    if (dialog.current?.open) dialog.current.close();
    onDismiss();
  }
  const backdropProps = useModalBackdrop(onClose);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const title = data.final ? t('完赛证书', 'Finisher certificate') : t('参赛战报', 'Competition report');
  const status = data.final && data.rank
    ? t(`最终名次  #${data.rank}`, `Final rank  #${data.rank}`)
    : data.final ? t('最终成绩', 'Final result') : t('公示成绩', 'Provisional result');

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) {
      setError(t('当前浏览器无法生成图片。', 'This browser could not create the image.'));
      return;
    }
    const ctx = context;
    function draw() {
      const style = getComputedStyle(ctx.canvas);
      const color = (token: string) => style.getPropertyValue(token).trim();
      const font = 'system-ui, sans-serif';
      function label(value: string, x: number, y: number, size: number, token = '--foreground', weight = 500, max = 664) {
        ctx.fillStyle = color(token);
        ctx.font = `${weight} ${size}px ${font}`;
        ctx.fillText(value, x, y, max);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color('--background');
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = color('--card');
      ctx.beginPath();
      ctx.roundRect(24, 24, width - 48, height - 48, 20);
      ctx.fill();
      ctx.strokeStyle = color('--border-default');
      ctx.stroke();
      ctx.fillStyle = color('--accent');
      ctx.fillRect(48, 51, 24, 5);
      label('CubeRoot', 82, 60, 18, '--accent', 750, 300);
      label(title, 48, 93, 18, '--muted-foreground', 600);
      label(data.competition, 48, 135, 33, '--foreground', 720);
      label(data.organizer, 48, 163, 16, '--muted-foreground');
      label(data.name, 48, 215, 31, '--foreground', 700);
      label(data.division, 48, 244, 16, '--muted-foreground');
      ctx.fillStyle = color('--accent-soft');
      ctx.beginPath();
      ctx.roundRect(48, 267, 664, 104, 12);
      ctx.fill();
      data.metrics.forEach((metric, index) => {
        const x = 66 + index * 335;
        label(metric.label, x, 301, 15, '--muted-foreground', 600, 300);
        label(metric.value, x, 344, 34, '--foreground', 730, 300);
      });
      data.attempts?.forEach((value, index) => {
        const x = 48 + index * 133;
        label(t(`第 ${index + 1} 把`, `Attempt ${index + 1}`), x, 403, 13, '--muted-foreground', 500, 124);
        label(value, x, 429, 20, '--foreground', 650, 124);
      });
      label(status, 48, 472, 17, '--accent', 650, 470);
      ctx.textAlign = 'right';
      label(data.date, 712, 472, 16, '--muted-foreground', 550, 150);
      ctx.textAlign = 'left';
    }
    draw();
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    const html = document.documentElement;
    const theme = new MutationObserver(draw);
    theme.observe(html, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-palette-scheme', 'data-scheme-preview', 'class', 'style'] });
    scheme.addEventListener('change', draw);
    html.addEventListener('transitionend', draw);
    return () => { scheme.removeEventListener('change', draw); html.removeEventListener('transitionend', draw); theme.disconnect(); };
  }, [data, status, t, title]);

  function download() {
    if (!canvas.current?.getContext('2d')) return;
    canvas.current.toBlob(blob => {
      if (!blob) {
        setError(t('图片导出失败，请重试。', 'Could not export the image. Try again.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cuberoot-${data.final ? 'certificate' : 'report'}-${data.date}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  return <dialog ref={dialog} className="competition-report-dialog" aria-labelledby={titleId}
    onClose={onDismiss} onCancel={event => { event.preventDefault(); onClose(); }} {...backdropProps}>
    <div className="competition-report-panel" data-site-surface="popover">
      <header><h3 id={titleId}>{title}</h3><ClearButton variant="standalone" ariaLabel={t('关闭', 'Close')} onClick={onClose} /></header>
      <canvas ref={canvas} width={width * scale} height={height * scale} aria-label={`${data.competition} · ${data.name} · ${status}`}>
        {data.metrics.map(metric => `${metric.label} ${metric.value}`).join(' · ')}
      </canvas>
      {error && <p className="competition-error" role="alert">{error}</p>}
      <button type="button" className="competition-primary" onClick={download}><Download size={16} aria-hidden />{t('下载 PNG', 'Download PNG')}</button>
    </div>
  </dialog>;
}
