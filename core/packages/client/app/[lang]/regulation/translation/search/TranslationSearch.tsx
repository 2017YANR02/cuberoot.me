'use client';

import { parseAsString, useQueryState } from 'nuqs';
import SearchInput from '@/components/SearchInput';
import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useWcaTranslationSearch } from '@/lib/wca-translation-search';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';

export default function TranslationSearch() {
  const t = useT();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const { term, data, failed, loading, matches, fallback } = useWcaTranslationSearch(query);

  return (
    <section className="translation-search" aria-labelledby="translation-search-title">
      <header className="translation-search-heading">
        <h1 id="translation-search-title">{t('官方译文查询', 'Official translation search')}</h1>
        <Link href="/regulation/translation" prefetch={false}>{t('翻译参考', 'Translation reference')} →</Link>
      </header>
      <SearchInput value={query} onChange={setQuery} debounceMs={350} maxLength={200}
        className="translation-search-input" type="search"
        ariaLabel={t('查询官方译文', 'Search official translations')}
        placeholder={t('输入中文、英文或缩写', 'Chinese, English or abbreviation')} />
      {!term && <div className="translation-search-examples">
        <span>{t('试试', 'Try')}</span>
        {['WIC', '魔方', 'Delegate'].map(example => <button className="translation-search-example" key={example} type="button" onClick={() => setQuery(example)}>{example}</button>)}
      </div>}
      <div className="translation-search-status" role="status">
        {loading && t('查询中…', 'Searching…')}
        {failed && t('暂时无法查询，请到 Weblate 查看。', 'Search is unavailable. Please check Weblate.')}
        {data && !matches.length && t('未找到匹配译文。', 'No matching translations.')}
        {data && matches.length > 0 && `${t('显示', 'Showing')} ${matches.length} ${t('条匹配', 'matches')}${matches.length === 10 ? t(' · 最多 10 条', ' · Up to 10') : ''}`}
      </div>
      {data?.stale && <p className="translation-search-note">{t('同步数据较旧，请核对官方最新译文。', 'This snapshot is older. Check the latest official translation.')}</p>}
      {matches.length > 0 && <div className="translation-search-results">
        <div className="translation-search-columns" aria-hidden="true"><span>English</span><span>中文</span></div>
        {matches.map(match => (
          <article className="translation-search-result" id={`translation-${match.component}-${match.unitId}`} key={`${match.component}:${match.unitId}`}>
            <div className="translation-search-pair">
              <div lang="en"><span className="translation-search-label">English</span><p>{match.en}</p></div>
              <div lang="zh-Hans" className="translation-search-target">
                <span className="translation-search-label">中文</span><p>{match.zh}</p>
                <InfoTooltip iconSize={16} ariaLabel={t('译文来源信息', 'Translation source information')}
                  content={<div className="translation-search-info">
                    <a href={match.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方出处', 'Official source')} ↗</a>
                    <div>{t('语境', 'Context')}：{match.key}</div>
                    <div>{t('组件 / 条目', 'Component / unit')}：{match.component} / {match.unitId}</div>
                    {match.hasFailingChecks && <div>{t('官方自动检查有提示', 'Upstream checks flagged issues')}</div>}
                    {(match.sourceForms.length > 1 || match.targetForms.length > 1) && <>
                      <div lang="en">English{match.sourceForms.map((text, i) => <div key={i}>{i + 1}. {text}</div>)}</div>
                      <div lang="zh-Hans">中文{match.targetForms.map((text, i) => <div key={i}>{i + 1}. {text}</div>)}</div>
                    </>}
                  </div>} />
              </div>
            </div>
          </article>
        ))}
      </div>}
      {term && !loading && <a className="translation-search-fallback" href={fallback} target="_blank" rel="noopener noreferrer">{t('到 Weblate 查询', 'Search on Weblate')} ↗</a>}
    </section>
  );
}
