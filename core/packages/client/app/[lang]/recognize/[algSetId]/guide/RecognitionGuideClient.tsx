'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { loadAlg, type AlgCase, type AlgFile } from '@cuberoot/shared';
import Link from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { CaseThumb } from '@/components/CaseThumb';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import { primaryCaseName } from '@/lib/alg_case_display';
import {
  algCaseDetailHref,
  buildCaseSlugMap,
  caseSlugBase,
} from '@/lib/alg_case_link';
import {
  RECOGNITION_GUIDES,
  guideGroupLabel,
  isGuideSetId,
  type GuideSetId,
} from './guide-content';
import '@/components/recognition-guide.css';

interface CaseGroup {
  name: string;
  cases: AlgCase[];
}

function groupCases(cases: AlgCase[], order: string[]): CaseGroup[] {
  const grouped = new Map<string, AlgCase[]>();
  for (const c of cases) {
    const key = c.subgroup?.trim() || 'Other';
    const bucket = grouped.get(key);
    if (bucket) bucket.push(c);
    else grouped.set(key, [c]);
  }

  const rank = new Map(order.map((name, index) => [name, index]));
  return [...grouped.entries()]
    .sort(([a], [b]) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER))
    .map(([name, groupCases]) => ({ name, cases: groupCases }));
}

function RecognitionCase({
  c,
  setId,
  slug,
  simplified,
  size,
  eager,
}: {
  c: AlgCase;
  setId: GuideSetId;
  slug: string;
  simplified: boolean;
  size: number;
  eager: boolean;
}) {
  const alg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  const name = primaryCaseName('3x3', setId, c);
  return (
    <article className="recognition-guide-case">
      <Link
        href={algCaseDetailHref('3x3', setId, slug)}
        className="recognition-guide-case-link"
        prefetch={false}
        aria-label={tr({ zh: `查看 ${name} 公式`, en: `Open algorithms for ${name}` })}
      >
        <span className="recognition-guide-case-art">
          <CaseThumb
            puzzle="3x3"
            set={setId}
            sticker={c.sticker}
            alg={alg}
            setup={c.setup}
            size={size}
            simplifyRecognition={simplified}
            loading={eager ? 'eager' : 'lazy'}
          />
        </span>
        <strong>{name}</strong>
      </Link>
    </article>
  );
}

export default function RecognitionGuideClient() {
  const params = useParams<{ algSetId: string }>();
  const rawSetId = Array.isArray(params?.algSetId) ? params.algSetId[0] : params?.algSetId;
  const setId: GuideSetId = rawSetId && isGuideSetId(rawSetId) ? rawSetId : 'pll';
  const spec = RECOGNITION_GUIDES[setId];
  const [simplified, setSimplified] = useQueryState('simple', parseAsBoolean.withDefault(true));
  const [data, setData] = useState<AlgFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mobile = useIsMobile(480);
  const thumbSize = mobile ? 108 : 142;

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    loadAlg('3x3', setId)
      .then((file) => {
        if (active) setData(file);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : tr({ zh: '加载失败', en: 'Failed to load cases' }));
      });
    return () => { active = false; };
  }, [setId, reloadKey]);

  const groups = useMemo(
    () => groupCases(data?.cases ?? [], spec.groupOrder),
    [data, spec.groupOrder],
  );
  const slugMap = useMemo(
    () => buildCaseSlugMap(data?.cases ?? [], setId),
    [data, setId],
  );

  return (
    <main className="recognition-guide-page">
      <header className="recognition-guide-hero">
        <div className="recognition-guide-heading">
          <span className="recognition-guide-set-mark" aria-hidden>{setId.toUpperCase()}</span>
          <div>
            <p className="recognition-guide-kicker">{tr(spec.kicker)}</p>
            <h1>{tr(spec.title)}</h1>
            <p className="recognition-guide-intro">{tr(spec.intro)}</p>
          </div>
        </div>

        <ol className="recognition-guide-steps">
          {spec.steps.map((step) => (
            <li key={step.title.en}>
              <strong>{tr(step.title)}</strong>
              <span>{tr(step.body)}</span>
            </li>
          ))}
        </ol>

        <section className="recognition-guide-reference" aria-labelledby="recognition-guide-reference-title">
          <div>
            <h2 id="recognition-guide-reference-title">{tr(spec.reference.title)}</h2>
            <p>{tr(spec.reference.intro)}</p>
          </div>
          <ul>
            {spec.reference.items.map(item => (
              <li key={item.term}>
                <code>{item.term}</code>
                <span>{tr(item.label)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="recognition-guide-actions">
          <Link href={`/recognize/${setId}`} className="recognition-guide-primary-link" prefetch={false}>
            {tr({ zh: '开始观察训练', en: 'Start recognition drill' })}
          </Link>
          <Link href={`/alg/3x3/${setId}`} className="recognition-guide-text-link" prefetch={false}>
            {tr({ zh: '查看完整公式库', en: 'Open the full algorithm set' })}
          </Link>
        </div>
      </header>

      <section className="recognition-guide-library" aria-labelledby="recognition-guide-cases-title">
        <div className="recognition-guide-library-head">
          <div>
            <p className="recognition-guide-kicker">{tr({ zh: '情况速查', en: 'Case field guide' })}</p>
            <h2 id="recognition-guide-cases-title">
              {tr({
                zh: `${spec.caseCount} 个 ${setId.toUpperCase()} 情况`,
                en: `All ${spec.caseCount} ${setId.toUpperCase()} cases`,
              })}
            </h2>
          </div>
          <BoolToggle
            value={simplified}
            onChange={setSimplified}
            label={tr({ zh: '简化图', en: 'Simplified view' })}
          />
        </div>
        <p className="recognition-guide-simplified-note">{tr(spec.simplifiedNote)}</p>

        {!data && !error && (
          <p className="recognition-guide-status">{tr({ zh: '正在加载情况…', en: 'Loading cases…' })}</p>
        )}
        {error && (
          <div className="recognition-guide-status">
            <p>{tr({ zh: '情况加载失败，请重试。', en: 'Cases could not be loaded. Try again.' })}</p>
            <button className="recognition-guide-retry" type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {tr({ zh: '重新加载', en: 'Reload' })}
            </button>
          </div>
        )}

        {groups.map((group, groupIndex) => (
          <section className="recognition-guide-group" key={group.name}>
            <h3>{tr(guideGroupLabel(group.name))}</h3>
            <div className="recognition-guide-grid">
              {group.cases.map((c, caseIndex) => {
                const slug = c.id == null
                  ? caseSlugBase(setId, c)
                  : (slugMap.byId.get(c.id) ?? caseSlugBase(setId, c));
                return (
                  <RecognitionCase
                    key={c.id ?? c.name}
                    c={c}
                    setId={setId}
                    slug={slug}
                    simplified={simplified}
                    size={thumbSize}
                    eager={groupIndex === 0 && caseIndex < (mobile ? 4 : 7)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
