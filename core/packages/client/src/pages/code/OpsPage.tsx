import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Database, Hammer, UploadCloud, Archive, ChevronDown, Terminal, Sparkles, Plus, Pencil, Trash2, X } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { useAuthStore, ADMIN_WCA_IDS } from '../../stores/auth_store';
import { createCommand, updateCommand, deleteCommand, listCommands, type OpsCommandInput } from './ops_api';
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

function OpCard({ op, lang, isAdmin, onEdit, onDelete }: { op: OpCommand; lang: Lang; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
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
        <div className="ops-card-head-right">
          {op.cwd && (
            <div className="ops-card-cwd" title="CWD">
              <Terminal size={12} strokeWidth={2} />
              <span>{op.cwd}</span>
            </div>
          )}
          {isAdmin && (
            <>
              <button type="button" className="ops-admin-btn" onClick={onEdit} title={lang === 'zh' ? '编辑' : 'Edit'}>
                <Pencil size={13} />
              </button>
              <button type="button" className="ops-admin-btn ops-admin-btn-danger" onClick={onDelete} title={lang === 'zh' ? '删除' : 'Delete'}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
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
  const user = useAuthStore((s) => s.user);
  const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [commands, setCommands] = useState<OpCommand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: 'add' | 'edit'; op?: OpCommand } | null>(null);

  useEffect(() => {
    document.title = lang === 'zh' ? '运维 — CubeRoot' : 'Ops — CubeRoot';
  }, [lang]);

  const refresh = () => {
    setErr(null);
    listCommands<OpCommand>()
      .then((data) => setCommands(data))
      .catch((e: Error) => setErr(e.message));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

        {isAdmin && (
          <div className="ops-admin-bar">
            <button type="button" className="ops-admin-new" onClick={() => setEditor({ mode: 'add' })}>
              <Plus size={14} />
              <span>{lang === 'zh' ? '新建命令' : 'New command'}</span>
            </button>
            <span className="ops-admin-hint">
              {lang === 'zh' ? 'admin 模式 · 改动即生效 (5min 公共缓存)' : 'admin mode · changes are live (5min public cache)'}
            </span>
          </div>
        )}

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
            <OpCard
              key={op.id}
              op={op}
              lang={lang}
              isAdmin={isAdmin}
              onEdit={() => setEditor({ mode: 'edit', op })}
              onDelete={async () => {
                const t = lang === 'zh' ? `删除 "${op.title_zh}" (${op.id})?` : `Delete "${op.title_en}" (${op.id})?`;
                if (!window.confirm(t)) return;
                try { await deleteCommand(op.id); refresh(); }
                catch (e) { window.alert((e as Error).message); }
              }}
            />
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

      {editor && (
        <OpsEditor
          mode={editor.mode}
          initial={editor.op}
          lang={lang}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Admin editor modal ─────────────────────────────────────────────

function emptyInput(): OpsCommandInput {
  return {
    id: '',
    category: 'db',
    cwd: '',
    chips: [],
    title_zh: '',
    title_en: '',
    desc_zh: '',
    desc_en: '',
    cmd: '',
    variants: [],
  };
}

function toInput(op: OpCommand): OpsCommandInput {
  return {
    category: op.category,
    cwd: op.cwd ?? '',
    chips: op.chips,
    title_zh: op.title_zh,
    title_en: op.title_en,
    desc_zh: op.desc_zh,
    desc_en: op.desc_en,
    cmd: op.cmd,
    variants: op.variants,
  };
}

function OpsEditor({ mode, initial, lang, onClose, onSaved }: {
  mode: 'add' | 'edit';
  initial?: OpCommand;
  lang: Lang;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<OpsCommandInput>(() =>
    mode === 'edit' && initial ? toInput(initial) : emptyInput(),
  );
  const [variantsJson, setVariantsJson] = useState<string>(() =>
    JSON.stringify(form.variants, null, 2),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === 'edit';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof OpsCommandInput>(k: K, v: OpsCommandInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onChipChange = (i: number, side: 'zh' | 'en', v: string) =>
    setForm((f) => ({ ...f, chips: f.chips.map((c, j) => j === i ? { ...c, [side]: v } : c) }));
  const onChipAdd = () => setForm((f) => ({ ...f, chips: [...f.chips, { zh: '', en: '' }] }));
  const onChipDel = (i: number) => setForm((f) => ({ ...f, chips: f.chips.filter((_, j) => j !== i) }));

  const onSave = async () => {
    setError(null);
    let variants: OpsCommandInput['variants'];
    try {
      variants = variantsJson.trim() ? JSON.parse(variantsJson) : [];
      if (!Array.isArray(variants)) throw new Error('variants 必须是数组');
    } catch (e) {
      setError(`variants JSON: ${(e as Error).message}`);
      return;
    }
    const body: OpsCommandInput = { ...form, variants, chips: form.chips.filter((c) => c.zh || c.en), cwd: form.cwd?.trim() || null };
    if (!isEdit) {
      if (!body.id?.trim()) { setError(lang === 'zh' ? 'id 必填' : 'id required'); return; }
      if (!/^[a-z0-9][a-z0-9-]*$/.test(body.id)) { setError(lang === 'zh' ? 'id 必须小写 kebab' : 'id must be lowercase kebab'); return; }
    }
    setSaving(true);
    try {
      if (isEdit && initial) await updateCommand(initial.id, body);
      else await createCommand(body);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ops-modal-backdrop" onClick={onClose}>
      <div className="ops-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="ops-modal-head">
          <h2>{isEdit ? (lang === 'zh' ? '编辑命令' : 'Edit command') : (lang === 'zh' ? '新建命令' : 'New command')}</h2>
          <button type="button" className="ops-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="ops-modal-body">
          {!isEdit && (
            <label className="ops-field">
              <span>id <em>{lang === 'zh' ? '(小写 kebab,创建后不可改)' : '(lowercase kebab, immutable after create)'}</em></span>
              <input value={form.id ?? ''} onChange={(e) => set('id', e.target.value)} placeholder="my-new-command" />
            </label>
          )}
          <div className="ops-field-row">
            <label className="ops-field">
              <span>category {isEdit && <em>{lang === 'zh' ? '(改分类要删后重建)' : '(to change, delete + re-create)'}</em>}</span>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} disabled={isEdit}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.en} ({c.zh})</option>)}
              </select>
            </label>
            <label className="ops-field">
              <span>cwd <em>(optional)</em></span>
              <input value={form.cwd ?? ''} onChange={(e) => set('cwd', e.target.value)} placeholder="core/" />
            </label>
          </div>
          <div className="ops-field-row">
            <label className="ops-field">
              <span>title_zh</span>
              <input value={form.title_zh} onChange={(e) => set('title_zh', e.target.value)} />
            </label>
            <label className="ops-field">
              <span>title_en</span>
              <input value={form.title_en} onChange={(e) => set('title_en', e.target.value)} />
            </label>
          </div>
          <div className="ops-field-row">
            <label className="ops-field">
              <span>desc_zh</span>
              <textarea value={form.desc_zh} onChange={(e) => set('desc_zh', e.target.value)} rows={3} />
            </label>
            <label className="ops-field">
              <span>desc_en</span>
              <textarea value={form.desc_en} onChange={(e) => set('desc_en', e.target.value)} rows={3} />
            </label>
          </div>
          <label className="ops-field">
            <span>chips <em>(prereq / 耗时 / 资源 等小标签)</em></span>
            <div className="ops-chip-edit">
              {form.chips.map((c, i) => (
                <div key={i} className="ops-chip-row">
                  <input placeholder="zh" value={c.zh} onChange={(e) => onChipChange(i, 'zh', e.target.value)} />
                  <input placeholder="en" value={c.en} onChange={(e) => onChipChange(i, 'en', e.target.value)} />
                  <button type="button" className="ops-chip-del" onClick={() => onChipDel(i)} aria-label="remove"><X size={12} /></button>
                </div>
              ))}
              <button type="button" className="ops-chip-add" onClick={onChipAdd}><Plus size={12} /> {lang === 'zh' ? '加一行' : 'add row'}</button>
            </div>
          </label>
          <label className="ops-field">
            <span>cmd <em>{form.category === 'prompt' ? (lang === 'zh' ? '(提示词正文)' : '(prompt body)') : (lang === 'zh' ? '(shell 命令,多行 \\n)' : '(shell command, multi-line ok)')}</em></span>
            <textarea className="ops-field-mono" value={form.cmd} onChange={(e) => set('cmd', e.target.value)} rows={6} />
          </label>
          <label className="ops-field">
            <span>variants <em>{lang === 'zh' ? '(JSON 数组,留空即无)' : '(JSON array, leave empty for none)'}</em></span>
            <textarea className="ops-field-mono" value={variantsJson} onChange={(e) => setVariantsJson(e.target.value)} rows={5} spellCheck={false} />
          </label>
          {error && <div className="ops-modal-error">{error}</div>}
        </div>
        <footer className="ops-modal-foot">
          <button type="button" className="ops-modal-cancel" onClick={onClose} disabled={saving}>{lang === 'zh' ? '取消' : 'Cancel'}</button>
          <button type="button" className="ops-modal-save" onClick={onSave} disabled={saving}>
            {saving ? (lang === 'zh' ? '保存中...' : 'Saving...') : (lang === 'zh' ? '保存' : 'Save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
