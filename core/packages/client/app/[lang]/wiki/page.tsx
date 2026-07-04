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
import { ChevronLeft, Search, Pencil, MessageSquarePlus, Plus, Trash2 } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { ClearButton } from '@/components/ClearButton';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import {
  fetchWikiTerms, createTerm, updateTerm, deleteTerm,
  createAddition, updateAddition, deleteAddition,
  type WikiList,
} from '@/lib/wiki-api';
import './wiki.css';
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

export default function WikiPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
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

  const onSaveTerm = async (id: number, head: string, body: string) => {
    await updateTerm(id, { head, body });
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
  const onCreateTerm = async (letter: string, head: string, body: string) => {
    await createTerm({ letter, head, body });
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
            placeholder={tr({ zh: '搜索术语 (如 CFOP / 翻棱 / sune)', en: 'Search terms (e.g. CFOP / EO / sune)'
            })}
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
                {sec.entries.map(e => (
                  <li key={e.id} id={slugify(e.head) || `term-${e.id}`} className="wiki-entry">
                    {editingTermId === e.id ? (
                      <TermForm
                        initialHead={e.head}
                        initialBody={e.body}
                        onCancel={() => setEditingTermId(null)}
                        onSave={(head, body) => onSaveTerm(e.id, head, body)}
                        isZh={isZh}
                      />
                    ) : (
                      <>
                        <div className="wiki-entry-head-row">
                          <h3 className="wiki-entry-head">{e.head}</h3>
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
                        {e.body && <div className="wiki-entry-body">{renderBodyLines(e.body)}</div>}
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
                ))}
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
          onSave={(letter, head, body) => onCreateTerm(letter, head, body)}
          isZh={isZh}
        />
      )}
    </div>
  );
}

function TermForm(props: {
  initialHead: string;
  initialBody: string;
  onCancel: () => void;
  onSave: (head: string, body: string) => Promise<void> | void;
  isZh: boolean;
}) {
  const [head, setHead] = useState(props.initialHead);
  const [body, setBody] = useState(props.initialBody);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!head.trim()) { setErr('head required'); return; }
    setSaving(true);
    setErr(null);
    try { await props.onSave(head.trim(), body.trim()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="wiki-form">
      <input
        type="text"
        className="wiki-form-input"
        value={head}
        onChange={e => setHead(e.target.value)}
        placeholder={props.isZh ? '术语标题 (英文 + 可选中文)' : 'Term head'}
        maxLength={200}
      />
      <textarea
        className="wiki-form-textarea"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={props.isZh ? '描述,可中英双语,可多段。' : 'Description (EN/ZH, multi-line OK).'}
        rows={4}
        maxLength={8192}
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
  onSave: (letter: string, head: string, body: string) => Promise<void> | void;
  isZh: boolean;
}) {
  const [head, setHead] = useState('');
  const [body, setBody] = useState('');
  const [letter, setLetter] = useState('A');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = head.trim().charAt(0).toUpperCase();
    if (/^[A-Z]$/.test(c)) setLetter(c);
    else if (c) setLetter('#');
  }, [head]);

  const onSubmit = async () => {
    if (!head.trim()) { setErr('head required'); return; }
    setSaving(true);
    setErr(null);
    try { await props.onSave(letter, head.trim(), body.trim()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="wiki-modal-backdrop" onClick={props.onCancel}>
      <div className="wiki-modal" onClick={e => e.stopPropagation()}>
        <h3 className="wiki-modal-title">{props.isZh ? '新建术语' : 'New term'}</h3>

        <label className="wiki-form-label">
          {props.isZh ? '术语标题' : 'Head'}
          <input
            type="text"
            className="wiki-form-input"
            value={head}
            onChange={e => setHead(e.target.value)}
            placeholder={props.isZh ? '例如 OLL (Orientation of LL) 顶层色向' : 'e.g. OLL (Orientation of LL) 顶层色向'}
            maxLength={200}
            autoFocus
          />
        </label>

        <label className="wiki-form-label">
          {props.isZh ? '字母分组' : 'Letter'}
          <select
            className="wiki-form-input"
            value={letter}
            onChange={e => setLetter(e.target.value)}
          >
            {LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        <label className="wiki-form-label">
          {props.isZh ? '描述 (可选)' : 'Body (optional)'}
          <textarea
            className="wiki-form-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={props.isZh ? '可中英双语,可多段。' : 'EN/ZH, multi-line OK.'}
            rows={4}
            maxLength={8192}
          />
        </label>

        {err && <div className="wiki-form-err">{err}</div>}

        <div className="wiki-form-actions">
          <button type="button" className="wiki-btn wiki-btn-ghost" onClick={props.onCancel} disabled={saving}>
            {props.isZh ? '取消' : 'Cancel'}
          </button>
          <button type="button" className="wiki-btn wiki-btn-primary" onClick={() => void onSubmit()} disabled={saving}>
            {saving ? (props.isZh ? '保存中…' : 'Saving…') : (props.isZh ? '创建' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}
