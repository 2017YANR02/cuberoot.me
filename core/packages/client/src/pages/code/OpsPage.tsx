import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Database, Hammer, UploadCloud, Archive, ChevronDown, Terminal, Sparkles } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { apiUrl } from '../../utils/api_base';
import './ops.css';

type Lang = 'zh' | 'en';
type CategoryId = 'db' | 'build' | 'deploy' | 'backup' | 'prompt';

interface CategoryDef {
  id: CategoryId;
  zh: string;
  en: string;
  Icon: typeof Database;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'db', zh: '数据库', en: 'Database', Icon: Database },
  { id: 'build', zh: '构建', en: 'Build', Icon: Hammer },
  { id: 'deploy', zh: '部署', en: 'Deploy', Icon: UploadCloud },
  { id: 'backup', zh: '备份', en: 'Backup', Icon: Archive },
  { id: 'prompt', zh: 'AI 提示词', en: 'AI Prompt', Icon: Sparkles },
];

interface Variant {
  zh: { label: string; note: string };
  en: { label: string; note: string };
  cmd: string;
}

// DB shape returned by GET /v1/ops/commands (flat title_zh/title_en for SQL friendliness).
interface OpCommand {
  id: string;
  category: CategoryId;
  cwd?: string;
  position: number;
  chips: { zh: string; en: string }[];
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
  cmd: string;
  variants: Variant[];
}


function CodeBlock({ cmd, idx, mode = 'shell' }: { cmd: string; idx: string; mode?: 'shell' | 'prompt' }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="ops-code" data-idx={idx} data-mode={mode}>
      <button
        type="button"
        className="ops-code-copy"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? 'copied' : 'copy'}</span>
      </button>
      <pre className="ops-code-pre">
        {cmd.split('\n').map((line, i) => (
          <div key={i} className="ops-code-line">
            {mode === 'shell' && <span className="ops-code-prompt">$</span>}
            <span className="ops-code-text">{line || ' '}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function VariantBlock({ v, lang, idx, mode }: { v: Variant; lang: Lang; idx: string; mode?: 'shell' | 'prompt' }) {
  return (
    <div className="ops-variant">
      <div className="ops-variant-label">
        <span className="ops-variant-arrow">↳</span>
        {v[lang].label}
      </div>
      <div className="ops-variant-note">{v[lang].note}</div>
      <CodeBlock cmd={v.cmd} idx={idx} mode={mode} />
    </div>
  );
}

function OpCard({ op, lang }: { op: OpCommand; lang: Lang }) {
  const [variantsOpen, setVariantsOpen] = useState(false);
  const cat = CATEGORIES.find((c) => c.id === op.category)!;
  const CatIcon = cat.Icon;
  const title = lang === 'zh' ? op.title_zh : op.title_en;
  const desc = lang === 'zh' ? op.desc_zh : op.desc_en;
  return (
    <article className="ops-card" data-cat={op.category}>
      <div className="ops-card-rail" aria-hidden="true" />
      <header className="ops-card-head">
        <div className="ops-card-cat">
          <CatIcon size={14} strokeWidth={2} />
          <span>{cat[lang]}</span>
        </div>
        {op.cwd && (
          <div className="ops-card-cwd" title="CWD">
            <Terminal size={12} strokeWidth={2} />
            <span>{op.cwd}</span>
          </div>
        )}
      </header>
      <h2 className="ops-card-title">{title}</h2>
      <div className="ops-card-chips">
        {op.chips.map((c, i) => (
          <span key={i} className="ops-chip">{c[lang]}</span>
        ))}
      </div>
      <p className="ops-card-desc">{desc}</p>
      <CodeBlock cmd={op.cmd} idx={`${op.id}-main`} mode={op.category === 'prompt' ? 'prompt' : 'shell'} />
      {op.variants && op.variants.length > 0 && (
        <div className="ops-card-variants">
          <button
            type="button"
            className="ops-variants-toggle"
            onClick={() => setVariantsOpen((o) => !o)}
            aria-expanded={variantsOpen}
          >
            <ChevronDown size={14} className={variantsOpen ? 'ops-chev-open' : ''} />
            <span>
              {lang === 'zh' ? `变体 (${op.variants.length})` : `Variants (${op.variants.length})`}
            </span>
          </button>
          {variantsOpen && (
            <div className="ops-variants-body">
              {op.variants.map((v, i) => (
                <VariantBlock key={i} v={v} lang={lang} idx={`${op.id}-v${i}`} mode={op.category === 'prompt' ? 'prompt' : 'shell'} />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function OpsPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [commands, setCommands] = useState<OpCommand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = lang === 'zh' ? '运维 — CubeRoot' : 'Ops — CubeRoot';
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/v1/ops/commands'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: OpCommand[]) => { if (!cancelled) setCommands(data); })
      .catch((e: Error) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: commands?.length ?? 0 };
    for (const c of CATEGORIES) m[c.id] = 0;
    for (const op of commands ?? []) m[op.category] = (m[op.category] ?? 0) + 1;
    return m;
  }, [commands]);

  const visible = !commands ? [] : (filter === 'all' ? commands : commands.filter((op) => op.category === filter));

  return (
    <div className="ops-page">
      <div className="ops-bg" aria-hidden="true" />
      <div className="ops-bg-glow" aria-hidden="true" />

      <div className="ops-shell">
        <div className="ops-topbar">
          <Link to="/code" className="ops-back">← /code</Link>
          <LangToggle variant="inline" />
        </div>

        <header className="ops-hero">
          <div className="ops-hero-prompt">
            <span className="ops-hero-user">cuberoot</span>
            <span className="ops-hero-at">@</span>
            <span className="ops-hero-host">runbook</span>
            <span className="ops-hero-colon">:</span>
            <span className="ops-hero-path">~</span>
            <span className="ops-hero-sigil">$</span>
          </div>
          <h1 className="ops-hero-title">
            ops<span className="ops-hero-cursor">_</span>
          </h1>
          <p className="ops-hero-sub">
            {lang === 'zh'
              ? '日常维护命令的实战手册。每条带前置条件、耗时、踩坑、复制即跑。'
              : "Hands-on runbook of routine commands. Prereqs, runtime, gotchas — copy-and-go."}
          </p>
        </header>

        <nav className="ops-filters" aria-label={lang === 'zh' ? '分类过滤' : 'category filter'}>
          <button
            type="button"
            className={`ops-filter ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span className="ops-filter-dot" />
            <span>{lang === 'zh' ? '全部' : 'All'}</span>
            <span className="ops-filter-count">{counts.all}</span>
          </button>
          {CATEGORIES.map((c) => {
            const Icon = c.Icon;
            const n = counts[c.id] ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`ops-filter ${filter === c.id ? 'is-active' : ''}`}
                data-cat={c.id}
                onClick={() => setFilter(c.id)}
                disabled={n === 0}
              >
                <Icon size={13} strokeWidth={2} />
                <span>{c[lang]}</span>
                <span className="ops-filter-count">{n}</span>
              </button>
            );
          })}
        </nav>

        <main className="ops-list">
          {err && (
            <div className="ops-empty">
              {lang === 'zh' ? `加载失败: ${err}` : `Failed to load: ${err}`}
            </div>
          )}
          {!err && commands === null && (
            <div className="ops-empty">{lang === 'zh' ? '加载中...' : 'Loading...'}</div>
          )}
          {visible.map((op) => (
            <OpCard key={op.id} op={op} lang={lang} />
          ))}
          {!err && commands !== null && visible.length === 0 && (
            <div className="ops-empty">
              {lang === 'zh' ? '这个分类还没有命令' : 'No commands in this category yet'}
            </div>
          )}
        </main>

        <footer className="ops-foot">
          <span className="ops-foot-text">
            {lang === 'zh' ? '命令会持续增补 · 一处一个原则' : 'Always growing · one-place principle'}
          </span>
          <Link to="/" className="ops-foot-link">CubeRoot</Link>
        </footer>
      </div>
    </div>
  );
}
