'use client';

import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { phases, type Phase, useBuildSnapshot } from './useBuildSnapshot';
import styles from './progress.module.css';

function duration(seconds: number | null | undefined, locale: string) {
  if (seconds == null) return '—';
  const unit = (value: number, name: 'day' | 'hour' | 'minute' | 'second') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'short' }).format(value);
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
  if (hours >= 24) return [unit(Math.floor(hours / 24), 'day'), unit(hours % 24, 'hour')].join(' ');
  if (hours >= 1) return [unit(hours, 'hour'), unit(minutes, 'minute')].join(' ');
  return minutes ? unit(minutes, 'minute') : unit(Math.floor(seconds), 'second');
}

export default function GrhPage() {
  const t = useT(), locale = useLang();
  const { data, error, stale } = useBuildSnapshot();
  const format = (n: number | null | undefined, digits = 0) => n == null
    ? '—' : n.toLocaleString(locale, { maximumFractionDigits: digits });
  const memory = (n: number | null | undefined) => n == null ? '—' : format(n, 1) + ' GiB';
  const percent = data ? data.completed / data.total : null;
  const updated = data && new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(data.updatedAt));
  const phaseLabels: Record<Phase, string> = {
    'main-build': t('编译源代码', 'Compile the source'),
    'rh-axioms': t('核对定理与公理', 'Audit the theorem and axioms'),
    'kernel-replay': t('内核重检', 'Replay the kernel checks'),
  };
  const active = phases.findIndex(phase => phase === (data?.stage === 'failed' ? data.failedStage : data?.stage));
  const status = !data ? (error ? t('暂时无法获取进度', 'Updates unavailable') : t('正在获取进度', 'Loading progress'))
    : data.stage === 'completed' ? t('本次验证已通过', 'Verification passed')
    : data.stage === 'failed' ? t('本次验证已中断', 'Verification stopped')
    : stale ? t('进度更新已延迟', 'Progress updates delayed')
    : error ? t('连接中断，显示上次进度', 'Disconnected · last known progress')
    : active >= 0 ? phaseLabels[phases[active]] : t('准备验证', 'Preparing the run');
  const tone = data?.stage === 'failed' ? 'failed' : stale || error ? 'warning' : data ? 'current' : 'pending';
  const compiling = data?.stage === 'main-build';
  const showRate = compiling && !stale && !error;
  const percentage = percent == null ? '—' : percent.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 2 });

  return (
    <main className={styles.page}>
      <div className={styles.nav}><BackHome /><HeaderToggles /></div>
      <header className={styles.hero}>
        <div>
          <h1>{t('黎曼猜想的 Lean 验证', 'Checking the Riemann Hypothesis in Lean')}</h1>
          <p>{t('我们用 Lean 4.33.1 复核 Levent Alpöge 公布的证明，检验它能否推出黎曼 ζ 函数的每个非平凡零点都在临界线上。', 'This run rebuilds Levent Alpöge’s proposed proof in Lean 4.33.1 to check whether its theorem establishes that every nontrivial zero of the zeta function lies on the critical line.')}</p>
        </div>
        <div className={styles.formula} aria-hidden="true"><span>{t('临界线', 'Critical line')}</span><strong>Re(s) = ½</strong></div>
      </header>

      <section className={styles.progressPanel} data-site-surface="panel" aria-labelledby="grh-progress-title">
        <div className={styles.sectionHead}>
          <h2 id="grh-progress-title">{t('编译进度', 'Compilation progress')}</h2>
          <div className={styles.status} data-tone={tone} role="status">{status}</div>
        </div>
        <div className={styles.counter}>
          <strong>{format(data?.completed)}</strong>
          <span>{t('个模块，共', 'of')} {format(data?.total)} {t('个', 'modules')}</span>
          <b>{percentage}</b>
        </div>
        <progress className={styles.progress} max={data?.total ?? 1} value={data?.completed} aria-labelledby="grh-progress-title" />
        <dl className={styles.metrics}>
          <div><dt>{t('近期编译速度', 'Recent compile rate')}</dt><dd>{showRate && data.ratePerMin != null ? format(data.ratePerMin, 1) + t(' 个/分', ' modules/min') : '—'}</dd></div>
          <div><dt>{t('预计剩余编译时间', 'Est. compilation remaining')}</dt><dd>{showRate ? duration(data.etaSeconds, locale) : '—'}</dd></div>
          <div><dt>{t('已运行时间', 'Run elapsed')}</dt><dd>{duration(data?.elapsedSeconds, locale)}</dd></div>
        </dl>
        <p className={styles.updated}>{updated && data
          ? <>{t('最近更新', 'Last update')} <time dateTime={data.updatedAt}>{updated}</time></>
          : t('等待公开进度快照。', 'Waiting for a published snapshot.')}</p>
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="grh-phases">
          <h2 id="grh-phases">{t('验证步骤', 'Verification steps')}</h2>
          <ol className={styles.steps}>
            {phases.map((phase, i) => {
              const done = data?.stage === 'completed' || (active >= 0 && i < active);
              const failed = active === i && data?.stage === 'failed';
              const current = active === i && !failed;
              const badge = done ? t('已通过', 'Passed') : failed ? t('中断', 'Stopped') :
                current ? (stale || error ? t('上次运行到此', 'Last reported') : t('进行中', 'In progress')) :
                !data || (data.stage === 'failed' && active < 0) ? '—' : t('待运行', 'Pending');
              return <li key={phase} data-state={done ? 'done' : failed ? 'failed' : current ? 'current' : 'pending'}>
                <span className={styles.node} aria-hidden="true" />
                <div><h3>{phaseLabels[phase]}</h3><p>{[
                  t('从源文件构建 Main 及其依赖。', 'Build Main and its imports from the source files.'),
                  t('匹配 mathlib 的 RiemannHypothesis，核对证明使用的公理。', 'Match mathlib’s RiemannHypothesis and check which axioms the proof uses.'),
                  t('用 Lean 的 leanchecker 重新检查编译好的声明。', 'Recheck the compiled declarations with Lean’s leanchecker.'),
                ][i]}</p></div>
                <span className={styles.stageState}>{badge}</span>
              </li>;
            })}
          </ol>
        </section>
        <section aria-labelledby="grh-runtime">
          <h2 id="grh-runtime">{t('运行资源', 'Build resources')}</h2>
          <dl className={styles.resources}>
            <div><dt>{t('当前任务内存', 'Current job memory')}</dt><dd>{memory(data?.processFootprintGiB)}</dd></div>
            <div><dt>{t('内存采样峰值', 'Peak sampled memory')}</dt><dd>{memory(data?.peakFootprintGiB)}</dd></div>
            <div><dt>{t('Lean 工作进程', 'Lean worker processes')}</dt><dd>{format(data?.workerCount)}</dd></div>
          </dl>
        </section>
      </div>

      {data && data.recent.length > 0 && <section className={styles.activity} aria-labelledby="grh-activity">
        <h2 id="grh-activity">{t('最近编译的模块', 'Recently compiled modules')}</h2>
        <ul>{data.recent.map((row, i) => <li key={row.name + i}><code>{row.name}</code><span>{row.duration}</span></li>)}</ul>
      </section>}

      <footer className={styles.notes}>
        <p>{t('原项目还提出了狄利克雷 L 函数的广义黎曼猜想。本次定理与公理审计的目标是经典黎曼猜想。', 'The source also claims a generalized Riemann hypothesis for Dirichlet L-functions. This theorem and axiom audit targets the classical Riemann Hypothesis.')}</p>
        <div><a href="https://alpo.ge/remark.pdf">{t('原始公告（PDF）', 'Original announcement (PDF)')}</a>
          <a href="https://github.com/leanprover-community/mathlib4/blob/0df444a360eaa60ab8c11dca51a86af692955474/Mathlib/NumberTheory/LSeries/RiemannZeta.lean#L185-L186">{t('mathlib 中的猜想定义', 'Definition in mathlib')}</a></div>
      </footer>
    </main>
  );
}
