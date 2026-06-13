'use client';

// Collapsible "full regulations" section for a chapter. Renders every clause of
// the official article (aligned EN / 简体 / 繁體, built by scripts/build-reg-clauses.mjs
// into _data/reg-clauses/<id>.json). Each chapter page statically imports its own
// JSON and passes it here, so the text ships in the SSG HTML (good for search /
// no-JS) and stays lean per page.
//
// Native <details> on purpose: content lives in the DOM, opens without JS.

import { useTranslation } from 'react-i18next';
import { ChevronRight, FileText } from 'lucide-react';
import { useT } from '../../../../hooks/useT';

export interface RegClause { id: string; depth: number; en: string; zh: string; zhHant: string }
export interface RegClauseDoc {
  articleId: string;
  version: { en: string; zh: string };
  title: { en: string; zh: string; zhHant: string };
  clauses: RegClause[];
}

export default function FullClauses({ data }: { data: RegClauseDoc }) {
  const { i18n } = useTranslation();
  const t = useT();
  const lang = i18n.language;
  const isZh = lang.startsWith('zh');
  const pick = (c: { en: string; zh: string; zhHant: string }) =>
    lang === 'zh-Hant' ? c.zhHant || c.zh : isZh ? c.zh : c.en;

  const n = data.clauses.length;
  const ver = isZh ? data.version.zh : data.version.en;

  return (
    <details className="reg-full">
      <summary className="reg-full-summary">
        <ChevronRight size={18} className="reg-full-chevron" />
        <FileText size={17} />
        <span className="reg-full-summary-title">
          {t('完整条款', 'Full regulations', "完整條款")}
        </span>
        <span className="reg-full-count">{t(`${n} 条`, `${n} clauses`, `${n} 條`)}</span>
      </summary>

      <div className="reg-full-body">
        <ol className="reg-full-list">
          {data.clauses.map((c) => (
            <li
              key={c.id}
              className="reg-cl"
              data-depth={Math.min(c.depth, 4)}
              style={{ ['--d' as string]: Math.min(c.depth, 4) }}
            >
              <span className="reg-cl-id">{c.id}</span>
              <span className="reg-cl-text">{pick(c)}</span>
            </li>
          ))}
        </ol>

        <p className="reg-full-note">
          {t(
            `条款依据 WCA《竞赛规则》(${ver}) 官方中文翻译整理。翻译仅供参考,如与英文原文有出入,以英文为准。`,
            `Clauses from the WCA Regulations (${ver}). Translations are for reference only; the official English text is authoritative.`, `條款依據 WCA《競賽規則》(${ver}) 官方中文翻譯整理。翻譯僅供參考,如與英文原文有出入,以英文為準。`
          )}{' '}
          <a
            href="https://www.worldcubeassociation.org/regulations/full/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('英文原文', 'Official English')}
          </a>
        </p>
      </div>
    </details>
  );
}
