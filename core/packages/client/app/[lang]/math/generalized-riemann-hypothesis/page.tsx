'use client';

import PageBackLink from '@/components/PageBackLink';
import { MathProse, TeX } from './Math';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { phases, type Phase, useBuildSnapshot } from './useBuildSnapshot';
import RiemannExplorer from './RiemannExplorer';
import ProofRoute from './ProofRoute';
import ZeroReflection from './ZeroReflection';
import TheoryNotes from './TheoryNotes';
import guide from './explainer.module.css';
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
  const replaying = data?.stage === 'kernel-replay' || data?.stage === 'completed' || data?.failedStage === 'kernel-replay';
  const replay = data?.replayProgress;
  const total = replaying ? replay?.total : data?.total;
  const done = replaying ? replay?.done : data?.completed;
  const percent = total && done != null ? Math.floor(done * 10000 / total) / 10000 : null;
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
      <div className={styles.nav}><PageBackLink fallback="/math" /><HeaderToggles /></div>
      <header className={styles.hero}>
        <div>
          <h1><MathProse>{t(String.raw`狄利克雷 \(L\) 函数的广义黎曼猜想`, String.raw`The Generalized Riemann Hypothesis for Dirichlet \(L\)-functions`)}</MathProse></h1>
          <p><MathProse>{t(
            String.raw`Levent Alpöge 公布的 Lean 源码声明了狄利克雷 \(L\) 函数的广义黎曼猜想（GRH），并由此推导经典黎曼猜想（RH）。本机编译包含两组定理的整个项目，再单独核对经典 RH 的命题与公理。`,
            String.raw`Levent Alpöge’s Lean source claims the generalized Riemann hypothesis (GRH) for Dirichlet \(L\)-functions and derives the classical Riemann hypothesis (RH) from it. Our local run compiles both sets of theorems, then separately audits the statement and axioms of classical RH.`,
          )}</MathProse></p>
        </div>
        <div className={styles.formula}><span>{t('临界线', 'Critical line')}</span><strong><TeX src={String.raw`\operatorname{Re}(s)=\tfrac12`} /></strong></div>
      </header>
      <nav className={guide.contents} aria-label={t('本页目录', 'On this page')}>
        <a href="#live">{t('实时验证', 'Live verification')}</a>
        <a href="#zeros">{t('认识零点', 'Explore the zeros')}</a>
        <a href="#proof-route">{t('证明路线', 'The proposed proof')}</a>
        <a href="#symmetry">{t('对称性实验', 'Try the symmetry')}</a>
        <a href="#theory-value">{t('素数与理论价值', 'Primes and new ideas')}</a>
      </nav>

      <section id="live" className={styles.progressPanel} data-site-surface="panel" aria-labelledby="grh-progress-title">
        <div className={styles.sectionHead}>
          <h2 id="grh-progress-title">{replaying ? t('内核重检进度', 'Kernel replay progress') : t('编译进度', 'Compilation progress')}</h2>
          <div className={styles.status} data-tone={tone} role="status">{status}</div>
        </div>
        {replaying && !total ? <p>{replay?.phase === 'loading'
          ? t('正在载入声明并统计总数。', 'Loading declarations and counting the total.')
          : t('此轮尚无声明计数。', 'No declaration count has been reported for this run.')}</p> : <div className={styles.counter}>
          <strong>{format(done)}</strong>
          <span>{replaying ? t('条声明已核对，共', 'of') : t('个模块，共', 'of')} {format(total)} {replaying ? t('条', 'declarations checked') : t('个', 'modules')}</span>
          <b>{percentage}</b>
        </div>}
        <progress className={styles.progress} max={total || 1} value={total ? done : undefined} aria-labelledby="grh-progress-title" />
        <dl className={styles.metrics}>
          {!replaying && <>
            <div><dt>{t('近期编译速度', 'Recent compile rate')}</dt><dd>{showRate && data.ratePerMin != null ? format(data.ratePerMin, 1) + t(' 个/分', ' modules/min') : '—'}</dd></div>
            <div><dt>{t('预计剩余编译时间', 'Est. compilation remaining')}</dt><dd>{showRate ? duration(data.etaSeconds, locale) : '—'}</dd></div>
          </>}
          <div><dt>{t('验证总用时', 'Total run time')}</dt><dd>{duration(data?.elapsedSeconds, locale)}</dd></div>
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
                  t('在新的环境中，用 Lean 内核重新核对 Main 及其依赖的声明。', 'Replay declarations from Main and its imports in a fresh Lean kernel environment.'),
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

      <aside className={styles.notes}>
        <p><MathProse>{t(
          String.raw`作者的广义命题涵盖每个正整数模数的所有狄利克雷特征 \(\chi\)。它断言，如果 \(L(s,\chi)=0\) 且 \(0<\operatorname{Re}(s)<1\)，那么 \(\operatorname{Re}(s)=\tfrac12\)。取模 \(1\) 的平凡特征就得到黎曼 \(\zeta\) 函数的情形。`,
          String.raw`The generalized statement covers every Dirichlet character \(\chi\) of every positive modulus. It says that if \(L(s,\chi)=0\) and \(0<\operatorname{Re}(s)<1\), then \(\operatorname{Re}(s)=\tfrac12\). The trivial character modulo \(1\) gives the Riemann \(\zeta\) function.`,
        )}</MathProse></p>
        <div><a href="https://alpo.ge/remark.pdf">{t('原始公告（PDF）', 'Original announcement (PDF)')}</a>
          <a href="https://github.com/Deicyde/riemann-hypothesis/blob/40e56bab026552e089d7afcfeff08d2defb9c005/src/Main.lean#L4-L12">{t('作者声明的五条定理', 'Five theorem statements in the source')}</a>
          <a href="https://github.com/leanprover-community/mathlib4/blob/0df444a360eaa60ab8c11dca51a86af692955474/Mathlib/NumberTheory/LSeries/RiemannZeta.lean#L185-L186">{t('mathlib 中的猜想定义', 'Definition in mathlib')}</a></div>
      </aside>

      <RiemannExplorer />
      <ProofRoute />
      <ZeroReflection />
      <TheoryNotes />
    </main>
  );
}
