'use client';

import { useEffect, useState } from 'react';
import type { ReconIntakeCase, ReconSourceMetadata } from '@cuberoot/shared/recon-ground-truth';
import Link from '@/components/AppLink';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import PersonLink from '@/components/PersonLink';
import { Flag } from '@/components/Flag';
import { loadFlagData, personFlagIso2 } from '@/lib/country-flags';
import { tr, useLang } from '@/i18n/tr';
import { resolveIntakeSource } from '@/lib/recon-intake-api';
import { CompCell } from '@/components/CompCell/CompCell';

export default function SourceInfo({ source }: { source: ReconIntakeCase['sourceSnapshot'] }) {
  const isZh = useLang() === 'zh';
  const [, setFlagsLoaded] = useState(false);
  const [current, setCurrent] = useState<{ id: number; metadata: ReconSourceMetadata } | null>(null);
  const [failed, setFailed] = useState(false);
  const sourceId = source?.id;
  const savedMetadata = source?.metadata;
  useEffect(() => {
    setCurrent(null); setFailed(false);
    if (!sourceId || savedMetadata) return;
    let active = true;
    void resolveIntakeSource(source).then(value => {
      if (active && value?.metadata) setCurrent({ id: sourceId, metadata: value.metadata });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [sourceId, savedMetadata]);
  useEffect(() => {
    let active = true;
    void loadFlagData().then(() => { if (active) setFlagsLoaded(true); });
    return () => { active = false; };
  }, []);
  if (!source) return <p className="gt-source-missing">{tr({ zh: '未关联来源复盘', en: 'No source reconstruction linked' })}</p>;
  const metadata = source.metadata ?? (current?.id === source.id ? current.metadata : undefined);
  const person = (name: string | null | undefined, id: string | null | undefined) => {
    if (!name && !id) return '—';
    const iso2 = id ? personFlagIso2(id) : null;
    return <PersonLink wcaId={id ?? ''} name={name ?? id ?? ''} isZh={isZh}
      flag={iso2 ? <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" /> : undefined} />;
  };
  return <section className="gt-source-info" aria-label={tr({ zh: '来源复盘', en: 'Source reconstruction' })}>
    <div className="gt-source-heading"><Link href={`/recon/${source.id}`} prefetch={false} target="_blank">{tr({ zh: '来源复盘', en: 'Source reconstruction' })} #{source.id}</Link>
      {(source.metadataOrigin === 'current' || (!source.metadata && metadata)) && <InfoTooltip content={tr({ zh: '来源资料为当前信息', en: 'Source details reflect current information' })} />}
    </div>
    <dl className="gt-source-facts">
      <div><dt>{tr({ zh: '原成绩', en: 'Original result' })}</dt><dd>{metadata?.value || '—'}</dd></div>
      <div><dt>{tr({ zh: '日期', en: 'Date' })}</dt><dd>{metadata?.date || '—'}</dd></div>
      <div><dt>{tr({ zh: '选手', en: 'Solver' })}</dt><dd>{person(metadata?.person, metadata?.personId)}</dd></div>
      <div><dt>{tr({ zh: '复盘人', en: 'Reconstructor' })}</dt><dd>{person(metadata?.reconer, metadata?.reconerId)}</dd></div>
      <div><dt>{tr({ zh: '收录者', en: 'Collector' })}</dt><dd>{person(metadata?.collector, metadata?.collectorId)}</dd></div>
      {metadata?.competition && <div className="gt-source-competition"><dt>{tr({ zh: '比赛', en: 'Competition' })}</dt><dd><CompCell compId={metadata.competitionId ?? ''} compName={metadata.competition} country={metadata.country} isZh={isZh} date={metadata.date} /></dd></div>}
    </dl>
    {failed && <p role="status">{tr({ zh: '无法读取来源资料，可打开原复盘查看。', en: 'Source details are unavailable. Open the original reconstruction to check.' })}</p>}
  </section>;
}
