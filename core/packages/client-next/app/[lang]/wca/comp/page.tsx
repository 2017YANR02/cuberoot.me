'use client';
/**
 * /wca/comp — competition index.
 * User pastes a slug or cubing.com / WCA URL → navigate to /wca/comp/[slug]. Lists recent (localStorage).
 * Ported from packages/client/src/pages/comp/CompIndexPage.tsx.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { X as XIcon, HelpCircle } from 'lucide-react';
import HeaderToggles from '@/components/HeaderToggles';
import { Flag } from '@/components/Flag';
import { loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { CompPicker } from '@/components/CompPicker';
import type { Comp } from '@/lib/comp-search';
import { prefetchComp } from '@/lib/comp-link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './comp.css';

function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const RECENT_KEY = 'comp.recent';
const RECENT_MAX = 12;

interface RecentEntry {
  slug: string;
  name: string;
  viewedAt: number;
}

function loadRecent(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const valid = arr.filter((e): e is RecentEntry =>
      e && typeof e.slug === 'string' && typeof e.name === 'string' && typeof e.viewedAt === 'number',
    );
    const dedup = new Map<string, RecentEntry>();
    for (const e of valid) {
      const norm = { ...e, slug: e.slug.replace(/-/g, '') };
      const existing = dedup.get(norm.slug);
      if (!existing || existing.viewedAt < norm.viewedAt) dedup.set(norm.slug, norm);
    }
    return [...dedup.values()].sort((a, b) => b.viewedAt - a.viewedAt);
  } catch { return []; }
}

export default function CompIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('比赛', 'Competitions');
  const router = useRouter();
  const [input, setInput] = useState('');
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [, setFlagDataVer] = useState(0);

  useEffect(() => { setRecent(loadRecent()); }, []);
  useEffect(() => { loadFlagData().then(setFlagDataVer); }, []);

  const removeRecent = (slug: string) => {
    const next = recent.filter(r => r.slug !== slug);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota */ }
  };

  return (
    <div className="comp-index-page">
      <HeaderToggles className="comp-top-bar" />

      <h1 className="comp-page-title">
        {isZh ? 'WCA 比赛' : 'WCA Competitions'}
        <Link
          href="/wca/comp-about"
          className="comp-title-help"
          title={isZh ? '这页是干啥的?' : 'What is this page?'}
          aria-label={isZh ? '查看说明' : 'About this page'}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </Link>
      </h1>
      <p className="comp-page-subtitle">
        {isZh ? '查看 cubing.com 直播比赛的实时按轮次成绩。' : 'Live round-by-round results from cubing.com.'}
      </p>

      <div className="comp-input-row">
        <CompPicker
          className="comp-picker-wrap"
          value={input}
          onChange={(v) => { setInput(v); setErr(null); }}
          onUrlPaste={(id) => router.push(`/wca/comp/${id}`)}
          onPick={(c: Comp) => { router.push(`/wca/comp/${c.id}`); }}
          isZh={isZh}
          placeholder={isZh ? '搜索比赛 / 城市,或粘贴比赛链接' : 'Search competition / city, or paste comp URL'}
        />
      </div>
      {err && <div className="comp-err">{err}</div>}

      <div className="comp-hint">
        {isZh
          ? <>或浏览 <a href="https://cubing.com/" target="_blank" rel="noopener noreferrer">cubing.com</a> / <a href="https://www.worldcubeassociation.org/competitions" target="_blank" rel="noopener noreferrer">WCA</a>。</>
          : <>Or browse <a href="https://cubing.com/" target="_blank" rel="noopener noreferrer">cubing.com</a> / <a href="https://www.worldcubeassociation.org/competitions" target="_blank" rel="noopener noreferrer">WCA</a>.</>
        }
        <Link href="/wca/comp/sources" className="comp-hint-link">{isZh ? '数据源流程' : 'Data source flow'} →</Link>
      </div>

      {recent.length > 0 && (
        <div className="comp-recent">
          <h2 className="comp-recent-title">{isZh ? '最近浏览' : 'Recent'}</h2>
          <ul className="comp-recent-list">
            {recent.map(r => {
              const iso2 = compFlagIso2(r.slug);
              const display = localizeCompName(r.slug, decodeEntities(r.name), isZh);
              return (
                <li key={r.slug} className="comp-recent-item">
                  <button
                    type="button"
                    className="comp-recent-link"
                    onClick={() => router.push(`/wca/comp/${r.slug}`)}
                    onMouseEnter={() => prefetchComp(r.slug)}
                    onFocus={() => prefetchComp(r.slug)}
                    onTouchStart={() => prefetchComp(r.slug)}
                  >
                    <span className="comp-recent-name">
                      {iso2 && <Flag iso2={iso2} className="comp-flag" />}
                      <span>{display}</span>
                    </span>
                    <span className="comp-recent-slug">{r.slug}</span>
                  </button>
                  <button
                    type="button"
                    className="comp-recent-remove"
                    onClick={() => removeRecent(r.slug)}
                    aria-label="Remove"
                    title={isZh ? '移除' : 'Remove'}
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function rememberRecent(slug: string, name: string) {
  if (typeof window === 'undefined') return;
  try {
    const cur = loadRecent().filter(r => r.slug !== slug);
    const next: RecentEntry[] = [{ slug, name, viewedAt: Date.now() }, ...cur].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* quota */ }
}
