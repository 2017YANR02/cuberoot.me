'use client';

/**
 * /wiki — 魔方术语表 (collaborative).
 *
 * 协作模型:
 *   - seed 词条 (source='seed') 不可改 (admin 例外)
 *   - 任何登录用户可创建新 term (source='user'),自己创建的可改
 *   - 任何登录用户可在任意 term 下追加 wiki_addition;自己的可改可删
 *   - admin 全权
 *   - 没有真删,仅软删
 *
 * 1:1 port from packages/client-vite/src/pages/wiki/WikiPage.tsx (Vite SPA).
 */
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, Pencil, MessageSquarePlus, Plus, Trash2, Link2 } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { ClearButton } from '@/components/ClearButton';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import {
  fetchWikiTerms, createTerm, updateTerm, deleteTerm,
  createAddition, updateAddition, deleteAddition,
  type WikiList, type WikiTerm, type TermInput,
} from '@/lib/wiki-api';
import { useHashHighlight } from '@/hooks/useHashHighlight';
import { useQueryState, parseAsBoolean } from 'nuqs';
import BoolToggle from '@/components/BoolToggle';
import './wiki.css';
import '@/components/hash-highlight.css';
import { tr } from '@/i18n/tr';

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function renderBodyLines(body: string) {
  const urlRe = /(https?:\/\/[^\s)]+)/g;
  return body.split('\n').map((line, i) => {
    const parts: (string | { url: string })[] = [];
    let last = 0;
    for (const m of line.matchAll(urlRe)) {
      if (m.index! > last) parts.push(line.slice(last, m.index!));
      parts.push({ url: m[1] });
      last = m.index! + m[1].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <p key={i} className="wiki-entry-body-line">
        {parts.map((p, j) =>
          typeof p === 'string'
            ? <span key={j}>{p}</span>
            : <a key={j} href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
        )}
      </p>
    );
  });
}

function slugify(head: string) {
  return head
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** 词条是否已迁到结构化双语(0079+):任一 en/zh 列非 null。 */
function isMigrated(e: WikiTerm) {
  return e.headEn != null || e.headZh != null || e.bodyEn != null || e.bodyZh != null;
}

/** 极小语言标签 EN / 中;仅「中英对照」模式下前置于每段,标注语言归属。 */
function LangTag({ k }: { k: 'en' | 'zh' }) {
  return <span className={`wiki-lang-tag wiki-lang-tag-${k}`} aria-hidden="true">{k === 'en' ? 'EN' : '中'}</span>;
}

/**
 * 词条标题按显示模式渲染。
 *   both & 双语齐全 → EN 一行 + 中 一行,各前置 LangTag;
 *   否则(single 模式,或仅一种语言) → 只显示该语言,缺则回退另一语;
 *   旧行未迁移(无结构化字段)→ 回退 combined head。
 * 末尾统一附「复制链接」锚点图标(移进本函数,避免 both 模式下图标落到孤立一行)。
 */
function renderHead(e: WikiTerm, both: boolean, single: 'zh' | 'en') {
  const en = e.headEn?.trim();
  const zh = e.headZh?.trim();
  const icon = <Link2 size={12} className="wiki-entry-anchor-icon" aria-hidden="true" />;
  if (!en && !zh) return <>{e.head}{icon}</>;
  if (both && en && zh) {
    return (
      <span className="wiki-head-bi">
        <span className="wiki-head-seg">
          <LangTag k="en" /><span className="wiki-head-en">{en}</span>
        </span>
        <span className="wiki-head-seg">
          <LangTag k="zh" /><span className="wiki-head-zh">{zh}</span>
        </span>
        {icon}
      </span>
    );
  }
  const pick = single === 'zh' ? (zh || en) : (en || zh);
  return <>{pick}{icon}</>;
}

/**
 * 词条正文按显示模式渲染。both & 双语齐全 → EN 段 + 中 段各成块并前置 LangTag;
 * 否则只显示该语言(缺则回退另一语);旧行未迁移→回退 combined body。返回 null 表无正文。
 */
function renderTermBody(e: WikiTerm, both: boolean, single: 'zh' | 'en') {
  const en = e.bodyEn?.trim();
  const zh = e.bodyZh?.trim();
  if (!en && !zh) return e.body ? renderBodyLines(e.body) : null;
  if (both && en && zh) {
    return (
      <>
        <div className="wiki-body-lang wiki-body-en">
          <LangTag k="en" /><div className="wiki-body-lang-text">{renderBodyLines(en)}</div>
        </div>
        <div className="wiki-body-lang wiki-body-zh">
          <LangTag k="zh" /><div className="wiki-body-lang-text">{renderBodyLines(zh)}</div>
        </div>
      </>
    );
  }
  const pick = single === 'zh' ? (zh || en) : (en || zh);
  return pick ? renderBodyLines(pick) : null;
}

/** 编辑表单初值:已迁移→四字段;旧行(未迁移)→把 combined 塞进 EN 框避免丢内容。 */
function termInitial(e: WikiTerm): TermInput {
  if (isMigrated(e)) {
    return { headEn: e.headEn ?? '', headZh: e.headZh ?? '', bodyEn: e.bodyEn ?? '', bodyZh: e.bodyZh ?? '' };
  }
  return { headEn: e.head, headZh: '', bodyEn: e.body, bodyZh: '' };
}

export default function WikiPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  // 显示模式:中英对照(both)/ 仅当前站点语言。both 默认开,保留「中英对照」品牌;
  // 关掉则跟随桌宠语言钮(i18n.language)= 仅中文 / 仅英文。
  const [showBoth, setShowBoth] = useQueryState('bi', parseAsBoolean.withDefault(true));
  const singleLang: 'zh' | 'en' = isZh ? 'zh' : 'en';
  useDocumentTitle('Wiki', 'Wiki');
  const user = useAuthStore(s => s.user);
  const isLoggedIn = !!user;
  const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
  // 所有权键(与服务端一致):非 WCA 账号也能判定自己的词条。admin 判定仍用真实 wcaId。
  const myKey = user ? computeOwnerKey(user.uid, user.wcaId) : '';

  const [data, setData] = useState<WikiList | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [editingAdditionId, setEditingAdditionId] = useState<number | null>(null);
  const [addingNoteFor, setAddingNoteFor] = useState<number | null>(null);
  const [newTermOpen, setNewTermOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await fetchWikiTerms();
      setData(d);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q) return data.sections;
    return data.sections
      .map(s => ({
        ...s,
        entries: s.entries.filter(e =>
          e.head.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          e.additions.some(a => a.body.toLowerCase().includes(q))
        ),
      }))
      .filter(s => s.entries.length > 0);
  }, [data, q]);

  const totalEntries = data?.sections.reduce((n, s) => n + s.entries.length, 0) ?? 0;
  const matchedEntries = filtered.reduce((n, s) => n + s.entries.length, 0);

  const handleJump = (letter: string) => {
    const el = document.getElementById(`wiki-section-${letter}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const [activeLetter, setActiveLetter] = useState<string>('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (q || !data) return;
    const observer = new IntersectionObserver(
      es => {
        const visible = es
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const letter = visible.target.getAttribute('data-letter');
          if (letter) setActiveLetter(letter);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [q, data]);

  // 深链:URL hash 指向某个词条的 slug(如 #lsll-…,搜索跳转/分享链接/点标题都用它)。
  // 词条异步 fetch 后才渲染,故 deps:[data] —— 数据到位再定位;.wiki-entry 自带
  // scroll-margin-top:100px,block:'start' 留出顶部余量;落点闪 1.8s。
  useHashHighlight({ highlightClass: 'hash-flash-target', block: 'start', linger: 1800, deps: [data] });

  const onSaveTerm = async (id: number, v: TermInput) => {
    await updateTerm(id, v);
    setEditingTermId(null);
    await reload();
  };
  const onDeleteTerm = async (id: number) => {
    if (!confirm(tr({ zh: '删除该词条? (admin 操作)', en: 'Delete this term? (admin)'
    }))) return;
    await deleteTerm(id);
    await reload();
  };
  const onSaveAddition = async (id: number, body: string) => {
    await updateAddition(id, body);
    setEditingAdditionId(null);
    await reload();
  };
  const onDeleteAddition = async (id: number) => {
    if (!confirm(tr({ zh: '删除这条增补?', en: 'Delete this addition?'
    }))) return;
    await deleteAddition(id);
    await reload();
  };
  const onCreateAddition = async (termId: number, body: string) => {
    await createAddition(termId, body);
    setAddingNoteFor(null);
    await reload();
  };
  const onCreateTerm = async (letter: string, v: TermInput) => {
    await createTerm({ letter, ...v });
    setNewTermOpen(false);
    await reload();
  };

  return (
    <div className="wiki-page">
      <header className="wiki-header">
        <HomeLink className="wiki-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home'
        })}</span>
        </HomeLink>
        <BoolToggle
          className="wiki-bi-toggle"
          value={showBoth}
          onChange={(v) => void setShowBoth(v)}
          label={tr({ zh: '中英对照', en: 'Bilingual' })}
          ariaLabel={tr({ zh: '中英对照显示', en: 'Show both languages' })}
        />
      </header>

      <main className="wiki-main">
        <h1 className="wiki-title">{tr({ zh: '魔方百科', en: 'Cubing Wiki' })}</h1>
        <p className="wiki-lead">
          {(isZh
                              ? `${totalEntries} 条术语,中英对照,登录可增补。资料汇编自 `
                              : `${totalEntries} terms, EN/ZH, sign in to contribute. Compiled from `)}
          <a href="https://www.speedsolving.com/wiki" target="_blank" rel="noopener noreferrer">
            speedsolving.com/wiki
          </a>
          {tr({ zh: ' 等公开资料。', en: ' and other public sources.'
        })}
        </p>

        <div className="wiki-search-wrap">
          <Search size={16} className="wiki-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="wiki-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && <ClearButton onClick={() => setQuery('')} isZh={isZh} preserveFocus />}
        </div>

        {q && (
          <div className="wiki-search-meta">
            {(isZh ? `匹配 ${matchedEntries} 条` : `${matchedEntries} match${matchedEntries === 1 ? '' : 'es'}`)}
          </div>
        )}

        {!q && (
          <nav className="wiki-alpha-bar" aria-label={tr({ zh: '按字母跳转', en: 'Jump by letter'
        })}>
            {LETTERS.map(letter => (
              <button
                key={letter}
                type="button"
                className={`wiki-alpha-btn${activeLetter === letter ? ' is-active' : ''}`}
                onClick={() => handleJump(letter)}
              >
                {letter}
              </button>
            ))}
          </nav>
        )}

        {loadErr && (
          <div className="wiki-empty wiki-empty-error">
            {tr({ zh: '加载失败: ', en: 'Failed to load: '
            })}{loadErr}
            <button type="button" className="wiki-btn wiki-btn-mini" onClick={() => void reload()}>
              {tr({ zh: '重试', en: 'Retry'
            })}
            </button>
          </div>
        )}

        {!data && !loadErr && (
          <div className="wiki-empty">{tr({ zh: '加载中…', en: 'Loading…'
        })}</div>
        )}

        <div className="wiki-sections">
          {data && filtered.length === 0 && (
            <div className="wiki-empty">{tr({ zh: '没有匹配项。', en: 'No matches.'
            })}</div>
          )}
          {filtered.map(sec => (
            <section
              key={sec.letter}
              id={`wiki-section-${sec.letter}`}
              data-letter={sec.letter}
              ref={el => { sectionRefs.current[sec.letter] = el; }}
              className="wiki-section"
            >
              <h2 className="wiki-section-title">{sec.letter}</h2>
              <ul className="wiki-entries">
                {sec.entries.map(e => {
                  const slug = slugify(e.head) || `term-${e.id}`;
                  return (
                  <li key={e.id} id={slug} className="wiki-entry">
                    {editingTermId === e.id ? (
                      <TermForm
                        initial={termInitial(e)}
                        onCancel={() => setEditingTermId(null)}
                        onSave={(v) => onSaveTerm(e.id, v)}
                      />
                    ) : (
                      <>
                        <div className="wiki-entry-head-row">
                          <h3 className="wiki-entry-head">
                            <a
                              className="wiki-entry-head-link"
                              href={`#${slug}`}
                              title={tr({ zh: '该词条链接', en: 'Link to this term' })}
                            >
                              {renderHead(e, showBoth, singleLang)}
                            </a>
                          </h3>
                          {(isAdmin || (isLoggedIn && myKey === e.ownerWcaId)) && (
                            <button
                              type="button"
                              className="wiki-action-btn"
                              onClick={() => setEditingTermId(e.id)}
                              title={tr({ zh: '编辑', en: 'Edit'
                            })}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              className="wiki-action-btn wiki-action-btn-danger"
                              onClick={() => void onDeleteTerm(e.id)}
                              title={tr({ zh: '删除 (admin)', en: 'Delete (admin)'
                            })}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        {(() => { const b = renderTermBody(e, showBoth, singleLang); return b ? <div className="wiki-entry-body">{b}</div> : null; })()}
                        {e.source === 'user' && e.ownerName && (
                          <div className="wiki-entry-meta">
                            — {e.ownerName}
                          </div>
                        )}
                      </>
                    )}

                    {e.additions.length > 0 && (
                      <ul className="wiki-additions">
                        {e.additions.map(a => (
                          <li key={a.id} className="wiki-addition">
                            {editingAdditionId === a.id ? (
                              <AdditionForm
                                initialBody={a.body}
                                onCancel={() => setEditingAdditionId(null)}
                                onSave={(body) => onSaveAddition(a.id, body)}
                                isZh={isZh}
                              />
                            ) : (
                              <>
                                <div className="wiki-addition-body">{renderBodyLines(a.body)}</div>
                                <div className="wiki-addition-meta">
                                  <span>+ {a.ownerName || a.ownerWcaId}</span>
                                  {(isAdmin || myKey === a.ownerWcaId) && (
                                    <>
                                      <button
                                        type="button"
                                        className="wiki-action-btn wiki-action-btn-inline"
                                        onClick={() => setEditingAdditionId(a.id)}
                                        title={tr({ zh: '编辑', en: 'Edit'
                                        })}
                                      >
                                        <Pencil size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        className="wiki-action-btn wiki-action-btn-inline wiki-action-btn-danger"
                                        onClick={() => void onDeleteAddition(a.id)}
                                        title={tr({ zh: '删除', en: 'Delete'
                                        })}
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {isLoggedIn && (
                      addingNoteFor === e.id ? (
                        <AdditionForm
                          initialBody=""
                          onCancel={() => setAddingNoteFor(null)}
                          onSave={(body) => onCreateAddition(e.id, body)}
                          isZh={isZh}
                        />
                      ) : (
                        <button
                          type="button"
                          className="wiki-add-note-btn"
                          onClick={() => setAddingNoteFor(e.id)}
                        >
                          <MessageSquarePlus size={13} />
                          {tr({ zh: '增补', en: 'Add note'
                        })}
                        </button>
                      )
                    )}
                  </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>

      {isLoggedIn && (
        <button
          type="button"
          className="wiki-fab"
          onClick={() => setNewTermOpen(true)}
          title={tr({ zh: '新建术语', en: 'New term'
        })}
          aria-label={tr({ zh: '新建术语', en: 'New term'
        })}
        >
          <Plus size={20} />
        </button>
      )}

      {newTermOpen && (
        <NewTermModal
          onCancel={() => setNewTermOpen(false)}
          onSave={(letter, v) => onCreateTerm(letter, v)}
        />
      )}
    </div>
  );
}

/** 双语词条表单主体:en/zh 各一组 标题+描述 框。新建与编辑共用。 */
function BilingualFields(props: { v: TermInput; set: (patch: Partial<TermInput>) => void }) {
  const { v, set } = props;
  return (
    <>
      <div className="wiki-form-bi">
        <input
          type="text" className="wiki-form-input" value={v.headEn}
          onChange={e => set({ headEn: e.target.value })}
          placeholder={tr({ zh: '标题 EN(如 OLL (Orientation of LL))', en: 'Head EN (e.g. OLL (Orientation of LL))' })}
          maxLength={200}
        />
        <input
          type="text" className="wiki-form-input" value={v.headZh}
          onChange={e => set({ headZh: e.target.value })}
          placeholder={tr({ zh: '标题中文(如 顶层色向)', en: 'Head ZH (e.g. 顶层色向)' })}
          maxLength={200}
        />
      </div>
      <div className="wiki-form-bi">
        <textarea
          className="wiki-form-textarea" value={v.bodyEn}
          onChange={e => set({ bodyEn: e.target.value })}
          placeholder={tr({ zh: '描述 EN(可选,可多段)', en: 'Body EN (optional, multi-line)' })}
          rows={3} maxLength={8192}
        />
        <textarea
          className="wiki-form-textarea" value={v.bodyZh}
          onChange={e => set({ bodyZh: e.target.value })}
          placeholder={tr({ zh: '描述中文(可选,可多段)', en: 'Body ZH (optional, multi-line)' })}
          rows={3} maxLength={8192}
        />
      </div>
    </>
  );
}

function useTermInput(initial: TermInput) {
  const [v, setV] = useState<TermInput>(initial);
  const set = useCallback((patch: Partial<TermInput>) => setV(p => ({ ...p, ...patch })), []);
  const trimmed = (): TermInput => ({
    headEn: v.headEn.trim(), headZh: v.headZh.trim(), bodyEn: v.bodyEn.trim(), bodyZh: v.bodyZh.trim(),
  });
  return { v, set, trimmed };
}

function TermForm(props: {
  initial: TermInput;
  onCancel: () => void;
  onSave: (v: TermInput) => Promise<void> | void;
}) {
  const { v, set, trimmed } = useTermInput(props.initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    const t = trimmed();
    if (!t.headEn && !t.headZh) { setErr(tr({ zh: '英文或中文标题至少填一个', en: 'Head required (EN or ZH)' })); return; }
    setSaving(true);
    setErr(null);
    try { await props.onSave(t); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="wiki-form">
      <BilingualFields v={v} set={set} />
      {err && <div className="wiki-form-err">{err}</div>}
      <div className="wiki-form-actions">
        <button type="button" className="wiki-btn wiki-btn-ghost" onClick={props.onCancel} disabled={saving}>
          {tr({ zh: '取消', en: 'Cancel' })}
        </button>
        <button type="button" className="wiki-btn wiki-btn-primary" onClick={() => void onSubmit()} disabled={saving}>
          {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
        </button>
      </div>
    </div>
  );
}

function AdditionForm(props: {
  initialBody: string;
  onCancel: () => void;
  onSave: (body: string) => Promise<void> | void;
  isZh: boolean;
}) {
  const [body, setBody] = useState(props.initialBody);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!body.trim()) { setErr('body required'); return; }
    setSaving(true);
    setErr(null);
    try { await props.onSave(body.trim()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="wiki-form wiki-form-addition">
      <textarea
        className="wiki-form-textarea"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={props.isZh ? '增补内容,可换行。' : 'Your note (multi-line OK).'}
        rows={3}
        maxLength={8192}
        autoFocus
      />
      {err && <div className="wiki-form-err">{err}</div>}
      <div className="wiki-form-actions">
        <button type="button" className="wiki-btn wiki-btn-ghost" onClick={props.onCancel} disabled={saving}>
          {props.isZh ? '取消' : 'Cancel'}
        </button>
        <button type="button" className="wiki-btn wiki-btn-primary" onClick={() => void onSubmit()} disabled={saving}>
          {saving ? (props.isZh ? '保存中…' : 'Saving…') : (props.isZh ? '保存' : 'Save')}
        </button>
      </div>
    </div>
  );
}

function NewTermModal(props: {
  onCancel: () => void;
  onSave: (letter: string, v: TermInput) => Promise<void> | void;
}) {
  const { v, set, trimmed } = useTermInput({ headEn: '', headZh: '', bodyEn: '', bodyZh: '' });
  const [letter, setLetter] = useState('A');
  const [letterTouched, setLetterTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 依英文标题首字母自动归组(A..Z / 非字母→#);用户手动改过后不再自动
  useEffect(() => {
    if (letterTouched) return;
    const c = (v.headEn.trim() || v.headZh.trim()).charAt(0).toUpperCase();
    if (/^[A-Z]$/.test(c)) setLetter(c);
    else if (c) setLetter('#');
  }, [v.headEn, v.headZh, letterTouched]);

  const onSubmit = async () => {
    const t = trimmed();
    if (!t.headEn && !t.headZh) { setErr(tr({ zh: '英文或中文标题至少填一个', en: 'Head required (EN or ZH)' })); return; }
    setSaving(true);
    setErr(null);
    try { await props.onSave(letter, t); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="wiki-modal-backdrop" onClick={props.onCancel}>
      <div className="wiki-modal" onClick={e => e.stopPropagation()}>
        <h3 className="wiki-modal-title">{tr({ zh: '新建术语', en: 'New term' })}</h3>

        <BilingualFields v={v} set={set} />

        <label className="wiki-form-label">
          {tr({ zh: '字母分组', en: 'Letter' })}
          <select
            className="wiki-form-input wiki-form-letter"
            value={letter}
            onChange={e => { setLetter(e.target.value); setLetterTouched(true); }}
          >
            {LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        {err && <div className="wiki-form-err">{err}</div>}

        <div className="wiki-form-actions">
          <button type="button" className="wiki-btn wiki-btn-ghost" onClick={props.onCancel} disabled={saving}>
            {tr({ zh: '取消', en: 'Cancel' })}
          </button>
          <button type="button" className="wiki-btn wiki-btn-primary" onClick={() => void onSubmit()} disabled={saving}>
            {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '创建', en: 'Create' })}
          </button>
        </div>
      </div>
    </div>
  );
}
