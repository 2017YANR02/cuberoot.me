'use client';

import { useTranslation } from 'react-i18next';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import PageBackLink from '@/components/PageBackLink';
import MoreToggle from '@/components/MoreToggle';
import { useLang } from '@/i18n/tr';
import benchmark from './benchmark.generated.json';
import './accuracy.css';

const scenarios = ['drift', 'batch', 'latency'] as const;
const families = [
  ['drift', 'driftFamily'], ['transport', 'transportFamily'], ['session-age', 'ageFamily'],
  ['threshold', 'thresholdFamily'], ['fallback', 'fallbackFamily'], ['numeric-origin', 'originFamily'],
] as const;
const sourceUrl = `https://github.com/2017YANR02/cuberoot.me/tree/${benchmark.implementationCommit}/core/packages/client/scripts/smart-cube-timing`;

export default function TimerAccuracyPage() {
  const lang = useLang();
  const { t } = useTranslation(undefined, { keyPrefix: 'timerAccuracy', lng: lang });
  const { before, current, cstimer } = benchmark.overall;
  const count = (n: number, total = current.cases) => `${n} / ${total}`;

  return <div className="accuracy-page">
    <header className="accuracy-header">
      <div className="accuracy-header-start"><PageBackLink fallback="/timer" /><AppLink href="/timer" prefetch={false}>CubeRoot · {t('timer')}</AppLink></div>
      <HeaderToggles />
    </header>
    <main className="accuracy-main">
      <header className="accuracy-intro">
        <h1>{t('title')}</h1>
        <p className="accuracy-lead">{t('intro')}</p>
        <p className="accuracy-meta">{t('date', { date: benchmark.measuredAt.slice(0, 10) })}</p>
      </header>

      <section id="results" aria-labelledby="accuracy-results">
        <h2 id="accuracy-results">{t('resultsTitle', { count: current.cases })}</h2>
        <p>{t('resultsIntro')}</p>
        <div className="accuracy-table-wrap"><table className="accuracy-table">
          <caption className="sr-only">{t('resultsTitle', { count: current.cases })}</caption>
          <thead><tr><th scope="col">{t('metric')}</th><th scope="col">CubeRoot</th><th scope="col">csTimer</th></tr></thead>
          <tbody>
            <tr><th scope="row">{t('within')}</th><td>{count(current.casesWithin10Ms)}</td><td>{count(cstimer.casesWithin10Ms)}</td></tr>
            <tr><th scope="row">{t('p95')}</th><td>≈ {current.p95AbsoluteErrorMs.toFixed(0)} ms</td><td>≈ {cstimer.p95AbsoluteErrorMs.toFixed(0)} ms</td></tr>
            <tr><th scope="row">{t('max')}</th><td>{current.maxAbsoluteErrorMs.toFixed(0)} ms</td><td>{cstimer.maxAbsoluteErrorMs.toFixed(0)} ms</td></tr>
          </tbody>
        </table></div>
        <p>{t('improvement', { before: before.casesWithin10Ms, current: current.casesWithin10Ms })}</p>
        <p className="accuracy-note">{t('comparison', benchmark.comparisons.cstimer)}</p>
      </section>

      <section aria-labelledby="accuracy-examples">
        <h2 id="accuracy-examples">{t('examplesTitle')}</h2>
        <div className="accuracy-table-wrap"><table className="accuracy-table accuracy-examples">
          <caption className="sr-only">{t('examplesTitle')}</caption>
          <thead><tr><th scope="col">{t('scenario')}</th><th scope="col">{t('before')}</th><th scope="col">CubeRoot</th><th scope="col">csTimer</th></tr></thead>
          <tbody>{benchmark.examples.map((example, index) => <tr key={example.id}>
            <th scope="row">{t(scenarios[index])}</th>
            {(['before', 'current', 'cstimer'] as const).map(key => <td key={key}>{(example[`${key}Ms`] / 1000).toFixed(3)}</td>)}
          </tr>)}</tbody>
        </table></div>
        <p className="accuracy-note">{t('examplesNote')}</p>
      </section>

      <section aria-labelledby="accuracy-limits">
        <h2 id="accuracy-limits">{t('limitsTitle')}</h2>
        <ul className="accuracy-limits">
          <li>{t('calibrationLimit')}</li>
          <li>{t('fallbackLimit')}</li>
          <li>{t('hardwareLimit')}</li>
        </ul>
      </section>

      <details className="accuracy-details">
        <MoreToggle as="summary">{t('technical')}</MoreToggle>
        <div className="accuracy-method">
          <p>{t('method')}</p>
          <p>{t('formula')}</p>
          <p>{t('alignment', { count: benchmark.consistentMoveEnds, total: current.cases })}</p>
          <p>{t('history', benchmark.comparisons.previous)}</p>
          <h3>{t('groupsTitle')}</h3>
          <div className="accuracy-table-wrap"><table className="accuracy-table">
            <thead><tr><th scope="col">{t('scenario')}</th><th scope="col">CubeRoot</th><th scope="col">csTimer</th></tr></thead>
            <tbody>{families.map(([key, label]) => {
              const group = benchmark.groups[key];
              return <tr key={key}><th scope="row">{t(label)}</th><td>{count(group.current.casesWithin10Ms, group.current.cases)}</td><td>{count(group.cstimer.casesWithin10Ms, group.cstimer.cases)}</td></tr>;
            })}</tbody>
          </table></div>
          <p className="accuracy-note">{t('groupHelp')}</p>
          <h3>{t('versions')}</h3>
          <dl className="accuracy-versions">
            <div><dt>CubeRoot</dt><dd><code>{benchmark.implementationCommit}</code></dd></div>
            <div><dt>{t('benchmarkHead')}</dt><dd><code>{benchmark.benchmarkHead}</code></dd></div>
            <div><dt>csTimer</dt><dd><code>{benchmark.cstimerCommit}</code></dd></div>
            <div><dt>{t('corpusHash')}</dt><dd><code>{benchmark.corpusSha256}</code></dd></div>
            <div><dt>{t('reportHash')}</dt><dd><code>{benchmark.sha256}</code></dd></div>
          </dl>
          <p>{t('versionNote')}</p>
          <p>{t('reproduction')}</p>
          <pre><code>{'cd core\npnpm --filter @cuberoot/shared build\npnpm --filter @cuberoot/client bench:smart-cube-timing --offline'}</code></pre>
          <div className="accuracy-source-links">
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t('sourceLink')}</a>
            <a href={`https://github.com/cs0x7f/cstimer/tree/${benchmark.cstimerCommit}`} target="_blank" rel="noopener noreferrer">{t('cstimerSource')}</a>
          </div>
        </div>
      </details>
      <footer className="accuracy-footer">
        <div><span>{t('fullData')}</span><a href={benchmark.downloads.csv} download>CSV</a><a href={benchmark.downloads.json} download>JSON</a></div>
        <AppLink href="/timer" prefetch={false}>{t('openTimer')}</AppLink>
      </footer>
    </main>
  </div>;
}
