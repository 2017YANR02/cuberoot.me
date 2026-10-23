'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { ArrowLeft, ExternalLink, ScrollText } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import logs from '../_data/logs.json';
import '../regulation.css';
import './logs.css';

type Kind = 'incidents' | 'disciplinary';
const KINDS: { id: Kind; title: { zh: string; en: string } }[] = [
  { id: 'incidents', title: { zh: '意外事件日志', en: 'Incidents log' } },
  { id: 'disciplinary', title: { zh: '纪律处分日志', en: 'Disciplinary log' } },
];

export default function RegulationLogs() {
  const { i18n } = useTranslation();
  const t = useT();
  const [state, setState] = useQueryStates({
    kind: parseAsStringEnum<Kind>(['incidents', 'disciplinary']).withDefault('incidents'),
    q: parseAsString.withDefault(''),
    entry: parseAsString.withDefault(''),
    view: parseAsStringEnum(['text', 'compare']).withDefault('text'),
  });
  const entries = useMemo(() => {
    const q = state.q.trim().toLocaleLowerCase();
    return logs.filter((e) => e.kind === state.kind && (!q ||
      `${e.id} ${e.date} ${e.title.zh} ${e.title.en} ${e.html.zh.replace(/<[^>]+>/g, ' ')} ${e.html.en.replace(/<[^>]+>/g, ' ')}`.toLocaleLowerCase().includes(q)));
  }, [state.kind, state.q]);
  const selected = entries.find((e) => e.id === state.entry) ?? entries[0];
  const kind = KINDS.find((k) => k.id === state.kind)!;
  const canonicalPath = i18n.language.startsWith('zh') ? '/zh/regulation/logs' : '/regulation/logs';
  const compare = state.view === 'compare';

  return <div className="reg-page reg-logs-page"><div className="reg-wrap reg-logs-wrap">
    <div className="reg-crumb"><Link href="/regulation" className="reg-crumb-link"><ArrowLeft size={15} />{t('竞赛规则', 'Regulations')}</Link></div>
    <header className="reg-hero reg-article-hero">
      <div className="reg-eyebrow"><ScrollText size={18} />WCA</div>
      <h1 className="reg-title">{tr(kind.title)}</h1>
    </header>
    <div className="reg-logs-controls">
      <div className="reg-logs-kinds" role="group" aria-label={t('日志分类', 'Log category')}>
        {KINDS.map((k) => <button className="reg-logs-kind" key={k.id} type="button" aria-pressed={state.kind === k.id} onClick={() => void setState({ kind: k.id, entry: null }, { history: 'replace' })}>{tr(k.title)}</button>)}
      </div>
      <input className="reg-logs-search" type="search" value={state.q} aria-label={t('搜索日志', 'Search logs')} placeholder={t('搜索日志', 'Search logs')} onChange={(event) => void setState({ q: event.target.value, entry: null })} />
      <BoolToggle className="reg-logs-compare" value={compare} onChange={(value) => void setState({ view: value ? 'compare' : 'text' })} label={t('中英对照', 'Chinese / English')} />
    </div>
    <div className="reg-logs-reader">
      <aside className="reg-logs-list" aria-label={t('日志列表', 'Log entries')}>
        {entries.map((e) => <button className="reg-logs-entry" type="button" key={e.id} aria-current={selected?.id === e.id ? 'true' : undefined} onClick={() => void setState({ entry: e.id }, { history: 'push' })}>
          <time dateTime={e.date}>{e.date}</time><span>{tr(e.title)}</span>
        </button>)}
        {!entries.length && <p>{t('没有匹配的日志。', 'No matching entries.')}</p>}
      </aside>
      {selected && <article className="reg-logs-article" key={selected.id}>
        <JsonLd data={articleJsonLd({ headline: tr(selected.title), description: tr(kind.title), url: `${SITE_URL}${canonicalPath}?kind=${state.kind}&entry=${encodeURIComponent(selected.id)}`, lang: i18n.language.startsWith('zh') ? 'zh' : 'en', partOfName: t('竞赛规则', 'Regulations'), partOfUrl: `${SITE_URL}/regulation` })} />
        <div className="reg-logs-meta"><time dateTime={selected.date}>{selected.date}</time><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方原文', 'Official source')}<ExternalLink size={13} /></a></div>
        <h2>{tr(selected.title)}</h2>
        <div className={`reg-logs-columns${compare ? ' reg-logs-columns-compare' : ''}`}>
          {compare ? <><div className="reg-logs-body" lang="zh-Hans" dangerouslySetInnerHTML={{ __html: selected.html.zh }} /><div className="reg-logs-body" lang="en" dangerouslySetInnerHTML={{ __html: selected.html.en }} /></> : <div className="reg-logs-body" dangerouslySetInnerHTML={{ __html: tr(selected.html) }} />}
        </div>
        {selected.supplements.map((s) => <section className="reg-logs-supplement" key={s.id}>
          <div className="reg-logs-meta"><time dateTime={s.date}>{s.date}</time><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方归档', 'Official archive')}<ExternalLink size={13} /></a></div>
          <h3>{tr(s.title)}</h3>
          <div className={`reg-logs-columns${compare ? ' reg-logs-columns-compare' : ''}`}>
            {compare ? <><div className="reg-logs-body" lang="zh-Hans" dangerouslySetInnerHTML={{ __html: s.html.zh }} /><div className="reg-logs-body" lang="en" dangerouslySetInnerHTML={{ __html: s.html.en }} /></> : <div className="reg-logs-body" dangerouslySetInnerHTML={{ __html: tr(s.html) }} />}
          </div>
        </section>)}
      </article>}
    </div>
  </div></div>;
}
