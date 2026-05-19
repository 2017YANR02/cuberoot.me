import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import { STACK_TOOLS_META, type StackToolMeta } from './stack_data';
import './stack_landing.css';

const GROUPS: { id: 'frontend' | 'backend' | 'edge' | 'dev'; zh: { title: string; sub: string }; en: { title: string; sub: string } }[] = [
  {
    id: 'frontend',
    zh: { title: '前端', sub: '浏览器里跑的那一半' },
    en: { title: 'Frontend', sub: 'The half that runs in the browser' },
  },
  {
    id: 'backend',
    zh: { title: '后端', sub: '那台云服务器上的进程与表' },
    en: { title: 'Backend', sub: 'Processes and tables on that one VM' },
  },
  {
    id: 'edge',
    zh: { title: '边缘 / 网络', sub: 'TLS、DNS、HTTP 在跨进入站点之前' },
    en: { title: 'Edge / Network', sub: 'TLS, DNS, HTTP — before a request even reaches a process' },
  },
  {
    id: 'dev',
    zh: { title: '开发 / AI', sub: '把字打到 commit, 整个写作工具链' },
    en: { title: 'Dev / AI', sub: 'From keystrokes to a commit — the whole authoring chain' },
  },
];

function ToolCard({ tool, lang }: { tool: StackToolMeta; lang: 'zh' | 'en' }) {
  const t = tool[lang];
  return (
    <Link
      to={`/code/stack/${tool.slug}`}
      className="stack-card"
      style={{ ['--accent' as string]: tool.accent }}
    >
      <div className="stack-card-top">
        <div className="stack-card-glyph">{tool.glyph}</div>
        <div className="stack-card-version">{tool.version}</div>
      </div>
      <div className="stack-card-body">
        <h2 className="stack-card-title">{tool.name}</h2>
        <div className="stack-card-tagline">{t.tagline}</div>
        <p className="stack-card-role">{t.role}</p>
      </div>
      <div className="stack-card-foot">
        <span className="stack-card-since">{lang === 'zh' ? '诞生' : 'born'} {tool.since}</span>
        <span className="stack-card-arrow">→</span>
      </div>
    </Link>
  );
}

export default function StackLandingPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? '技术栈 — CubeRoot' : 'Stack — CubeRoot';
  }, [lang]);

  return (
    <div className="stack-landing">
      <div className="stack-landing-bg" />

      <header className="stack-landing-head">
        <div className="stack-landing-topbar">
          <Link to="/code" className="stack-landing-back">
            ← /code
          </Link>
          <LangToggle variant="inline" />
        </div>
        <h1 className="stack-landing-title">
          <span className="stack-landing-prefix">/</span>stack
          <span className="stack-landing-cursor">_</span>
        </h1>
        <p className="stack-landing-sub">
          {lang === 'zh'
            ? '不是"流行清单",是 cuberoot.me 真正用过的 (加上即将用上的) 36 件软件 —— 在生产 VM 上跑的、写它的工具链、以及个人接下来要接入的工具。一件一篇,讲来历、讲长处、讲它在这套架构里干什么活。'
            : 'Not a "trending list" — 36 pieces of software cuberoot.me actually leans on (plus the ones I am about to adopt): what runs on the production VM, the authoring chain that writes it, and personal tooling about to enter the loop. One page each: history, strengths, and the exact job it does in this architecture.'}
        </p>
        <div className="stack-landing-meta">
          <span>{lang === 'zh' ? '快照' : 'Snapshot'}</span>
          <span className="stack-landing-meta-dot">·</span>
          <span>2026-05</span>
          <span className="stack-landing-meta-dot">·</span>
          <Link to="/code/architecture" className="stack-landing-meta-link">
            {lang === 'zh' ? '系统全景在这里 →' : 'Full system topology →'}
          </Link>
        </div>
      </header>

      <div className="stack-landing-summary">
        <div className="stack-summary-row">
          <span className="stack-summary-k">/</span>
          <span className="stack-summary-flow">
            <span className="s-tok s-tok-edge">Cloudflare DNS</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-edge">Let’s Encrypt TLS</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-edge">nginx :443</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-front">SPA (React 19 + Vite 8)</span>
          </span>
        </div>
        <div className="stack-summary-row">
          <span className="stack-summary-k">/</span>
          <span className="stack-summary-flow">
            <span className="s-tok s-tok-edge">nginx :443 (api)</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-back">Hono :3001</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-back">Node 22 (pm2)</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-back">PostgreSQL 13 :5432</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-back">pg_dump 03:00 UTC</span>
          </span>
        </div>
        <div className="stack-summary-row">
          <span className="stack-summary-k">/</span>
          <span className="stack-summary-flow">
            <span className="s-tok s-tok-dev">Claude Opus 4.7</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-dev">Claude Code</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-dev">git</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-dev">GitHub Actions</span>
            <span className="s-arrow">→</span>
            <span className="s-tok s-tok-edge">nginx + acme.sh</span>
          </span>
        </div>
      </div>

      <main className="stack-landing-main">
        {GROUPS.map((g) => {
          const tools = STACK_TOOLS_META.filter((t) => t.group === g.id);
          const text = g[lang];
          return (
            <section key={g.id} className="stack-group">
              <div className="stack-group-head">
                <div className="stack-group-tag">// {g.id}</div>
                <h2 className="stack-group-title">{text.title}</h2>
                <p className="stack-group-sub">{text.sub}</p>
              </div>
              <div className="stack-group-grid">
                {tools.map((t) => (
                  <ToolCard key={t.slug} tool={t} lang={lang} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="stack-landing-foot">
        <div className="stack-landing-foot-line">
          <Link to="/code">/code</Link>
          <span className="stack-landing-meta-dot">·</span>
          <Link to="/code/architecture">/architecture</Link>
          <span className="stack-landing-meta-dot">·</span>
          <Link to="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
