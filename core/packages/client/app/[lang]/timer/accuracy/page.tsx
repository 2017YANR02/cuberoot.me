'use client';

import { useTranslation } from 'react-i18next';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { ArrowRight, Clock3, Download, Radio } from '@app-foundation/icons/lucide';
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
const implementations = ['before', 'current', 'cstimer'] as const;
const sourceUrl = `https://github.com/2017YANR02/cuberoot.me/tree/${benchmark.implementationCommit}/core/packages/client/scripts/smart-cube-timing`;

export default function TimerAccuracyPage() {
  const lang = useLang();
  const { t } = useTranslation(undefined, { keyPrefix: 'timerAccuracy', lng: lang });
  const [scenario, setScenario] = useQueryState('scenario', parseAsStringLiteral(scenarios).withDefault('drift'));
  const example = benchmark.examples[scenarios.indexOf(scenario)];
  const comparison = benchmark.comparisons.cstimer;
  const { current, cstimer } = benchmark.overall;
  const seconds = (ms: number) => `${(ms / 1000).toFixed(3)} ${t('seconds')}`;
  const count = (n: number, total = current.cases) => t('ofCases', { count: n, total });

  return <div className="accuracy-page">
    <header className="accuracy-header">
      <div className="accuracy-header-start"><PageBackLink fallback="/timer" /><span>CubeRoot <span aria-hidden="true">/</span> {t('kicker')}</span></div>
      <HeaderToggles />
    </header>

    <main className="accuracy-main">
      <section className="accuracy-hero" aria-labelledby="accuracy-title">
        <div>
          <p className="accuracy-eyebrow">{t('date', { date: benchmark.measuredAt.slice(0, 10) })}</p>
          <h1 id="accuracy-title">{t('title')}</h1>
          <p className="accuracy-lead">{t('intro')}</p>
          <div className="accuracy-links">
            <a className="accuracy-primary" href="#results">{t('jumpResults')}<ArrowRight size={16} aria-hidden="true" /></a>
            <AppLink href="/timer" prefetch={false}>{t('openTimer')}</AppLink>
          </div>
          <p className="accuracy-scope">{t('scope')}</p>
        </div>
        <dl className="accuracy-proof">
          <div><dt>{t('casesLabel')}</dt><dd>{current.cases}</dd></div>
          <div><dt>{t('withinLabel')}</dt><dd>{current.casesWithin10Ms}<small> / {current.cases}</small></dd></div>
          <div><dt>{t('alignedLabel')}</dt><dd>{benchmark.consistentMoveEnds}<small> / {current.cases}</small></dd></div>
        </dl>
      </section>

      <section className="accuracy-section" aria-labelledby="accuracy-why">
        <p className="accuracy-section-number" aria-hidden="true">01</p>
        <h2 id="accuracy-why">{t('whyTitle')}</h2>
        <p className="accuracy-section-intro">{t('whyBody')}</p>
        <div className="accuracy-clock-flow">
          <div><Clock3 size={22} aria-hidden="true" /><h3>{t('deviceLabel')}</h3><p>{t('deviceBody')}</p></div>
          <div><Radio size={22} aria-hidden="true" /><h3>{t('hostLabel')}</h3><p>{t('hostBody')}</p></div>
          <div><span className="accuracy-equals" aria-hidden="true">≈</span><h3>{t('calibratedLabel')}</h3><p>{t('calibratedBody')}</p></div>
        </div>
        <h3 className="accuracy-subtitle">{t('fixesTitle')}</h3>
        <div className="accuracy-features">
          {['driftFix', 'batchFix', 'continuityFix'].map(key => <div key={key}><h3>{t(`${key}Title`)}</h3><p>{t(`${key}Body`)}</p></div>)}
        </div>
      </section>

      <section className="accuracy-section" aria-labelledby="accuracy-examples">
        <p className="accuracy-section-number" aria-hidden="true">02</p>
        <h2 id="accuracy-examples">{t('examplesTitle')}</h2>
        <p className="accuracy-section-intro">{t('examplesIntro')}</p>
        <div className="accuracy-scenarios" role="group" aria-label={t('scenarioLabel')}>
          {scenarios.map(key => <button key={key} type="button" aria-pressed={scenario === key}
            onClick={() => void setScenario(key)}>{t(key)}</button>)}
        </div>
        <div className="accuracy-example" data-site-surface="panel" aria-live="polite">
          <div className="accuracy-example-copy">
            <p className="accuracy-caption">{t('trueDuration')}</p>
            <p className="accuracy-true-time">{seconds(example.durationMs)}</p>
            <p>{t(`${scenario}Body`)}</p>
            <p className="accuracy-case-id">{t('caseId')} <code>{example.id}</code></p>
          </div>
          <div className="accuracy-time-bars"><dl>
            {implementations.map(key => <div className="accuracy-time-row" key={key}>
              <dt>{t(key)}</dt><dd>{seconds(example[`${key}Ms`])}</dd>
              <div className="accuracy-time-track" aria-hidden="true">
                <span className="accuracy-time-fill" style={{ width: `${example[`${key}Ms`] / 12500 * 100}%` }} />
                <span className="accuracy-time-reference" style={{ left: `${example.durationMs / 12500 * 100}%` }} />
              </div>
            </div>)}
          </dl><div className="accuracy-scale" aria-hidden="true"><span>0</span><span>12.5 {t('seconds')}</span></div></div>
        </div>
      </section>

      <section className="accuracy-section" id="results" aria-labelledby="accuracy-results">
        <p className="accuracy-section-number" aria-hidden="true">03</p>
        <h2 id="accuracy-results">{t('resultsTitle')}</h2>
        <p className="accuracy-section-intro">{t('resultsIntro')}</p>
        <div className="accuracy-table-wrap">
          <table className="accuracy-table">
            <caption className="sr-only">{t('resultsTitle')}</caption>
            <thead><tr><th scope="col">{t('metric')}</th><th scope="col">{t('current')}</th><th scope="col">{t('cstimer')}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{t('within')}</th><td>{count(current.casesWithin10Ms)}</td><td>{count(cstimer.casesWithin10Ms)}</td></tr>
              <tr><th scope="row">{t('p95')}</th><td>{current.p95AbsoluteErrorMs.toFixed(3)} ms</td><td>{cstimer.p95AbsoluteErrorMs.toFixed(3)} ms</td></tr>
              <tr><th scope="row">{t('max')}</th><td>{current.maxAbsoluteErrorMs.toFixed(0)} ms</td><td>{cstimer.maxAbsoluteErrorMs.toFixed(0)} ms</td></tr>
            </tbody>
          </table>
        </div>
        <p className="accuracy-note">{t('p95Help')}</p>
        <p className="accuracy-note">{t('worstHelp')}</p>
        <h3 className="accuracy-subtitle">{t('pairTitle')}</h3>
        <dl className="accuracy-comparison">
          {([['improved', 'better'], ['similar', 'similar'], ['regressed', 'worse']] as const).map(([key, label]) =>
            <div key={key}><dt>{t(label)}</dt><dd>{comparison[key]}</dd></div>)}
        </dl>
        <p className="accuracy-note">{t('pairHelp')}</p>
        <details className="accuracy-details">
          <MoreToggle as="summary">{t('groupsTitle')}</MoreToggle>
          <div className="accuracy-table-wrap"><table className="accuracy-table">
            <thead><tr><th scope="col">{t('family')}</th><th scope="col">{t('current')}</th><th scope="col">{t('cstimer')}</th></tr></thead>
            <tbody>{families.map(([key, label]) => {
              const group = benchmark.groups[key];
              return <tr key={key}><th scope="row">{t(label)}</th><td>{count(group.current.casesWithin10Ms, group.current.cases)}</td><td>{count(group.cstimer.casesWithin10Ms, group.cstimer.cases)}</td></tr>;
            })}</tbody>
          </table></div>
          <p className="accuracy-note">{t('groupHelp')}</p>
        </details>
        <h3 className="accuracy-subtitle">{t('historyTitle')}</h3>
        <div className="accuracy-history">
          {(['before', 'previous', 'current'] as const).map(key => <div key={key}>
            <span>{t(key)}</span><strong>{count(benchmark.overall[key].casesWithin10Ms)}</strong>
          </div>)}
        </div>
        <p className="accuracy-note">{t('within')}</p>
        <p>{t('historyBody', benchmark.comparisons.previous)}</p>
      </section>

      <section className="accuracy-section" aria-labelledby="accuracy-limits">
        <p className="accuracy-section-number" aria-hidden="true">04</p>
        <h2 id="accuracy-limits">{t('limitsTitle')}</h2>
        <p className="accuracy-section-intro">{t('limitsIntro')}</p>
        <div className="accuracy-limits">
          {['short', 'ramp', 'fallback', 'hardware'].map(key => <div key={key}><h3>{t(`${key}Title`)}</h3><p>{t(`${key}Body`)}</p></div>)}
        </div>
      </section>

      <section className="accuracy-section" aria-labelledby="accuracy-method">
        <p className="accuracy-section-number" aria-hidden="true">05</p>
        <h2 id="accuracy-method">{t('methodTitle')}</h2>
        <p className="accuracy-section-intro">{t('methodIntro')}</p>
        <p className="accuracy-note">{t('corpusScope')}</p>
        <div className="accuracy-downloads">
          <a href={benchmark.downloads.csv} download><Download size={16} aria-hidden="true" />{t('downloadCsv')}</a>
          <a href={benchmark.downloads.json} download><Download size={16} aria-hidden="true" />{t('downloadJson')}</a>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t('sourceLink')}<ArrowRight size={15} aria-hidden="true" /></a>
          <a href={`https://github.com/cs0x7f/cstimer/tree/${benchmark.cstimerCommit}`} target="_blank" rel="noopener noreferrer">{t('cstimerSource')}<ArrowRight size={15} aria-hidden="true" /></a>
        </div>
        <details className="accuracy-details">
          <MoreToggle as="summary">{t('technical')}</MoreToggle>
          <dl className="accuracy-versions">
            <div><dt>{t('testedCommit')}</dt><dd><code>{benchmark.implementationCommit}</code></dd></div>
            <div><dt>{t('benchmarkHead')}</dt><dd><code>{benchmark.benchmarkHead}</code></dd></div>
            <div><dt>{t('referenceCommit')}</dt><dd><code>{benchmark.cstimerCommit}</code></dd></div>
            <div><dt>{t('corpusHash')}</dt><dd><code>{benchmark.corpusSha256}</code></dd></div>
            <div><dt>{t('reportHash')}</dt><dd><code>{benchmark.sha256}</code></dd></div>
          </dl>
          <p>{t('versionNote')}</p><p>{t('formula')}</p><p>{t('reproduction')}</p>
          <pre><code>{'cd core\npnpm --filter @cuberoot/shared build\npnpm --filter @cuberoot/client bench:smart-cube-timing --offline'}</code></pre>
        </details>
      </section>
      <footer className="accuracy-footer"><span>{t('footer')}</span><AppLink href="/timer" prefetch={false}>{t('openTimer')}<ArrowRight size={16} aria-hidden="true" /></AppLink></footer>
    </main>
  </div>;
}
