/**
 * /comp — cubing.com 直播比赛入口页
 *
 * 用户输入比赛 slug (例 "Xian-Cherry-Blossom-2026") 或粘贴完整 cubing.com URL,
 * 跳转到 /comp/:slug 看实时成绩。下方列最近浏览过的比赛 (localStorage)。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, X as XIcon, ExternalLink } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { Flag } from '../../utils/flag';
import { loadFlagData, compFlagIso2 } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';
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
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e): e is RecentEntry =>
      e && typeof e.slug === 'string' && typeof e.name === 'string' && typeof e.viewedAt === 'number',
    );
  } catch { return []; }
}

function parseSlug(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  // Full URL: extract last path segment
  const urlMatch = t.match(/cubing\.com\/live\/([A-Za-z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];
  // Plain slug
  if (/^[A-Za-z0-9_-]+$/.test(t)) return t;
  return null;
}

export default function CompIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [, setFlagDataVer] = useState(0);

  useEffect(() => { setRecent(loadRecent()); }, []);
  // 拉 comp_names_zh.json + comp_countries.json,recent 才能查到中文名 + 国旗
  useEffect(() => { loadFlagData().then(setFlagDataVer); }, []);

  const onGo = () => {
    const slug = parseSlug(input);
    if (!slug) { setErr(isZh ? '请输入 cubing.com 比赛 slug 或 URL' : 'Enter a cubing.com slug or URL'); return; }
    setErr(null);
    navigate(`/comp/${slug}`);
  };

  const removeRecent = (slug: string) => {
    const next = recent.filter(r => r.slug !== slug);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <div className="comp-index-page">
      <div className="comp-top-bar">
        <LangToggle variant="fixed" />
        <ThemeToggle />
      </div>

      <h1 className="comp-page-title">{isZh ? '比赛直播' : 'Live Competitions'}</h1>
      <p className="comp-page-subtitle">
        {isZh ? '查看 cubing.com 直播比赛的实时按轮次成绩。' : 'Live round-by-round results from cubing.com.'}
      </p>

      <div className="comp-input-row">
        <input
          type="text"
          className="comp-input"
          value={input}
          onChange={e => { setInput(e.target.value); setErr(null); }}
          onKeyDown={e => { if (e.key === 'Enter') onGo(); }}
          placeholder={isZh ? 'cubing.com slug 或完整 URL,例: Xian-Cherry-Blossom-2026' : 'cubing.com slug or full URL, e.g. Xian-Cherry-Blossom-2026'}
          autoFocus
        />
        <button type="button" className="comp-go-btn" onClick={onGo}>
          {isZh ? '打开' : 'Open'} <ArrowRight size={16} />
        </button>
      </div>
      {err && <div className="comp-err">{err}</div>}

      <div className="comp-hint">
        <a href="https://cubing.com/" target="_blank" rel="noopener noreferrer">
          cubing.com <ExternalLink size={12} />
        </a>
        <span className="comp-hint-text">
          {isZh ? ' 上点开任意 Live 比赛,把 URL 末段 slug 粘到这里。' : ' Pick any Live comp on cubing.com and paste the URL slug here.'}
        </span>
      </div>

      {recent.length > 0 && (
        <div className="comp-recent">
          <h2 className="comp-recent-title">{isZh ? '最近浏览' : 'Recent'}</h2>
          <ul className="comp-recent-list">
            {recent.map(r => {
              const wcaId = r.slug.replace(/-/g, '');
              const iso2 = compFlagIso2(wcaId);
              const display = localizeCompName(wcaId, decodeEntities(r.name), isZh);
              return (
              <li key={r.slug} className="comp-recent-item">
                <button
                  type="button"
                  className="comp-recent-link"
                  onClick={() => navigate(`/comp/${r.slug}`)}
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
  try {
    const cur = loadRecent().filter(r => r.slug !== slug);
    const next: RecentEntry[] = [{ slug, name, viewedAt: Date.now() }, ...cur].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}
