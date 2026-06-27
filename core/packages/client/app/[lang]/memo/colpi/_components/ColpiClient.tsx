'use client';

/**
 * /memo/colpi/ — collaborative letter-pair word database (UI clone of
 * bestsiteever.net/colpi by Roman Strakhov).
 *
 * Word data lives in PG (colpi_words / colpi_votes) on api.cuberoot.me. The
 * initial ~11.7k rows are seeded from the upstream site (submitter NULL =
 * mirrored). Logged-in WCA users can submit / edit / delete their own words
 * and vote; admins can edit / delete any word, including upstream entries.
 *
 * Ported from packages/client-vite/src/pages/memo/colpi/ColpiPage.tsx.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Search, Eye, EyeOff, ThumbsUp, ThumbsDown, Flag as FlagIcon, X,
  Pencil, Trash2,
} from 'lucide-react';
import WcaAuth from '@/components/WcaAuth';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/name-utils';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import {
  fetchWords, fetchRecent, submitWord, patchWord, deleteWord, setVote, clearVote,
  type ColpiWord, type Category, type Language,
} from '@/lib/colpi-api';
import LanguagePicker, { LangPopup } from './LanguagePicker';
import { LANG_MAP, langDisplay } from '../_lib/langs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getAlphabet, defaultPairFor } from '../_lib/data';
import '../colpi.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

type LangFilter = string;
type ViewMode = 'all' | 'mine';

const LANG_FILTER_KEY = 'colpi_lang_filter_v1';
const VIEW_MODE_KEY = 'colpi_view_mode_v1';

function readLangFilter(): LangFilter {
  if (typeof window === 'undefined') return 'en';
  const v = localStorage.getItem(LANG_FILTER_KEY) ?? 'en';
  return LANG_MAP[v] ? v : 'en';
}
function readViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'all';
  return localStorage.getItem(VIEW_MODE_KEY) === 'mine' ? 'mine' : 'all';
}

const CATEGORY_DOT: Record<Category, string> = {
  unspecified: '#bbb',
  object:      '#27ae60',
  person:      '#e67e22',
  action:      '#3498db',
  place:       '#9b59b6',
  other:       '#7f8c8d',
};

const CATEGORY_LABEL: Record<Category, { en: string; zh: string
 }> = {
  unspecified: { en: 'unspecified', zh: '未分类'
},
  object:      { en: 'object',      zh: '物品' },
  person:      { en: 'person',      zh: '人物' },
  action:      { en: 'action',      zh: '动作'
},
  place:       { en: 'place',       zh: '地点'
},
  other:       { en: 'other',       zh: '其它' },
};

// Allow letters (any script — incl. CJK), numbers, marks, punctuation, whitespace.
const VALID_WORD_RE = /^[\p{L}\p{N}\p{M}\p{P}\s]+$/u;

function isValidPair(s: string, alphabet: readonly string[]): boolean {
  const chars = [...s];
  return chars.length === 2 && chars.every(c => alphabet.includes(c));
}

/** Uppercase user input only when the alphabet has any A-Z chars (Latin + diacritics).
 *  CJK/Cyrillic/Arabic/Hebrew/Hindi/Thai/Korean alphabets don't have a case concept. */
function shouldUppercase(alphabet: readonly string[]): boolean {
  return alphabet.some(c => /[A-Z]/.test(c));
}
function normalizeWord(raw: string, alphabet: readonly string[]): string {
  return shouldUppercase(alphabet) ? raw.trim().toUpperCase() : raw.trim();
}

function validateWordInput(word: string): string | null {
  if (!word) return tr({ zh: '请输入一个词', en: 'Enter a word'
});
  if (word.length > 40) return tr({ zh: '词太长了', en: 'Word too long'
});
  if (!VALID_WORD_RE.test(word)) return tr({ zh: '请输入正常文字', en: 'Invalid characters'
});
  return null;
}

export default function ColpiClient() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('Colpi 训练', 'Colpi');
  const user = useAuthStore(s => s.user);
  const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ pair?: string | string[] }>();
  const paramPairRaw = params?.pair;
  const paramPair: string | undefined = Array.isArray(paramPairRaw) ? paramPairRaw[0] : paramPairRaw;
  // '_' is the prerendered sentinel ([pair]/page.tsx + next.config rewrite) —
  // the real pair only exists in the browser URL. Resolve it in an effect
  // (keyed on pathname so in-page router.replace navigation stays in sync) so
  // hydration matches the sentinel-rendered HTML.
  const sentinel = paramPair === '_';
  const [resolvedPair, setResolvedPair] = useState<string | null>(null);
  useEffect(() => {
    if (!sentinel) return;
    const m = window.location.pathname.match(/\/memo\/colpi\/([^/?#]+)/);
    setResolvedPair(m ? m[1] : '');
  }, [sentinel, pathname]);
  const pairPending = sentinel && resolvedPair === null;
  const urlPair: string | undefined = sentinel ? (resolvedPair ?? undefined) : paramPair;

  // ── data state ──
  const [wordsByPair, setWordsByPair] = useState<Record<string, ColpiWord[]>>({});
  const [recent, setRecent] = useState<ColpiWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [langFilter, setLangFilterState] = useState<LangFilter>(() => readLangFilter());

  // Re-read langFilter from localStorage on mount in case SSR returned 'en' default.
  useEffect(() => {
    const v = readLangFilter();
    if (v !== langFilter) setLangFilterState(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bulk, rec] = await Promise.all([fetchWords(langFilter), fetchRecent(20)]);
      setWordsByPair(bulk);
      setRecent(rec);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [langFilter]);

  useEffect(() => { void refetchAll(); }, [refetchAll, user?.wcaId]);

  // ── ui state ──
  const [search, setSearch] = useState('');
  const [hideOffensive, setHideOffensive] = useState(true);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readViewMode());
  const setLangFilter = (v: LangFilter) => {
    setLangFilterState(v);
    try { localStorage.setItem(LANG_FILTER_KEY, v); } catch { /* quota */ }
  };
  const setViewMode = (v: ViewMode) => {
    setViewModeState(v);
    try { localStorage.setItem(VIEW_MODE_KEY, v); } catch { /* quota */ }
  };
  // 未登录强制 'all',登录回 localStorage 选择
  useEffect(() => {
    if (!user && viewMode === 'mine') setViewModeState('all');
  }, [user, viewMode]);

  // ── current alphabet (per language, mirrors upstream behavior) ──
  const ALPHABET = getAlphabet(langFilter);
  const DEFAULT_PAIR = defaultPairFor(langFilter);

  // URL → activePair
  const decoded = urlPair ? (() => {
    try {
      const raw = decodeURIComponent(urlPair);
      return shouldUppercase(ALPHABET) ? raw.toUpperCase() : raw;
    } catch { return ''; }
  })() : '';
  const activePair: string | null = decoded && isValidPair(decoded, ALPHABET) ? decoded : null;

  useEffect(() => {
    if (pairPending) return; // sentinel route, real pair not yet read from URL
    if (urlPair === undefined) {
      router.replace(`/memo/colpi/${encodeURIComponent(DEFAULT_PAIR)}`);
    } else if (decoded && !isValidPair(decoded, ALPHABET)) {
      router.replace(`/memo/colpi/${encodeURIComponent(DEFAULT_PAIR)}`);
    }
  }, [pairPending, urlPair, decoded, router, DEFAULT_PAIR, ALPHABET]);

  const setActivePair = (p: string | null) => {
    if (p === null) router.replace('/memo/colpi');
    else router.replace(`/memo/colpi/${encodeURIComponent(p)}`);
  };
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const cornerRef = useRef<HTMLTableCellElement | null>(null);
  // close popup on outside click / Escape
  useEffect(() => {
    if (!langPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cornerRef.current?.contains(t)) return; // trigger toggles itself
      if ((t as HTMLElement)?.closest?.('.colpi-langpicker-popup')) return;
      setLangPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLangPickerOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [langPickerOpen]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = (msg: string) => {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };
  useEffect(() => () => {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
  }, []);

  // submit / edit form state (single shared form for both new + edit)
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formWord, setFormWord] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('unspecified');
  const [formLang, setFormLang] = useState<string>(() => langFilter);
  useEffect(() => {
    setSubmitOpen(false);
    setEditingId(null);
    setFormWord('');
    setFormNote('');
    setFormCategory('unspecified');
  }, [activePair]);
  // Default new submissions to whatever lang the user is browsing.
  useEffect(() => {
    if (!editingId) setFormLang(langFilter);
  }, [langFilter, editingId]);

  // ── derived ──
  const detailRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!activePair) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 1200px)').matches) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activePair]);

  const onSearch = () => {
    const q = shouldUppercase(ALPHABET) ? search.trim().toUpperCase() : search.trim();
    if (isValidPair(q, ALPHABET)) setActivePair(q);
    else showToast(tr({ zh: '不在当前语言字母表里', en: 'Not in current alphabet'
    }));
  };

  // Apply all filters once into a derived map; everything (grid cell fill,
  // active-pair list, totals) reads from this so filters stay in sync.
  const filteredByPair: Record<string, ColpiWord[]> = (() => {
    const out: Record<string, ColpiWord[]> = {};
    const wcaId = user?.wcaId;
    for (const pair of Object.keys(wordsByPair)) {
      let arr = wordsByPair[pair];
      if (hideOffensive) arr = arr.filter(w => !w.offensive);
      arr = arr.filter(w => w.language === langFilter);
      if (viewMode === 'mine' && wcaId) {
        arr = arr.filter(w => w.myVote === 1 || w.submitter?.wcaId === wcaId);
      }
      if (arr.length > 0) out[pair] = arr;
    }
    return out;
  })();
  const wordsForPair = (pair: string): ColpiWord[] => filteredByPair[pair] ?? [];
  const activeWords = activePair ? wordsForPair(activePair) : [];

  const filledPairs = Object.keys(filteredByPair).length;
  const totalWordCount = (() => {
    let n = 0;
    for (const k of Object.keys(filteredByPair)) n += filteredByPair[k].length;
    return n;
  })();

  // Helpers to mutate local state after API success.
  const upsertWordLocal = (w: ColpiWord) => {
    setWordsByPair(prev => {
      const next = { ...prev };
      const list = (next[w.pair] ?? []).filter(x => x.id !== w.id);
      next[w.pair] = [w, ...list];
      return next;
    });
    setRecent(prev => {
      const without = prev.filter(x => x.id !== w.id);
      if (w.submitter) return [w, ...without].slice(0, 20);
      return without;
    });
  };
  const removeWordLocal = (pair: string, id: number) => {
    setWordsByPair(prev => {
      const next = { ...prev };
      next[pair] = (next[pair] ?? []).filter(x => x.id !== id);
      if (next[pair].length === 0) delete next[pair];
      return next;
    });
    setRecent(prev => prev.filter(x => x.id !== id));
  };
  const updateScoreLocal = (id: number, score: number, myVote: 1 | -1 | null) => {
    const apply = (arr: ColpiWord[]) => arr.map(w => w.id === id
      ? { ...w, score, myVote: myVote ?? undefined }
      : w);
    setWordsByPair(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = apply(next[k]);
      return next;
    });
    setRecent(prev => apply(prev));
  };

  // ── submit (new word) ──
  const handleAddClick = () => {
    if (!user) { showToast(tr({ zh: '请先登录后再提交', en: 'Please log in to submit'
    })); return; }
    setEditingId(null);
    setFormWord('');
    setFormNote('');
    setFormCategory('unspecified');
    setSubmitOpen(true);
  };
  const handleSubmitConfirm = async () => {
    if (!user || !activePair) return;
    const word = normalizeWord(formWord, getAlphabet(formLang));
    const err = validateWordInput(word);
    if (err) { showToast(err); return; }
    if (activeWords.some(w => w.word === word)) {
      showToast(tr({ zh: '这个词已存在', en: 'Word already exists'
    })); return;
    }
    try {
      const created = await submitWord({
        pair: activePair, word, category: formCategory, language: formLang as Language,
        country: user.country ?? null,
        note: formNote.trim() || null,
      });
      upsertWordLocal(created);
      setSubmitOpen(false);
      setFormWord('');
      setFormNote('');
      setFormCategory('unspecified');
      showToast(tr({ zh: '已提交', en: 'Submitted' }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  // ── edit (existing word) ──
  const canEdit = (w: ColpiWord) => isAdmin || (!!user && w.submitter?.wcaId === user.wcaId);
  const handleEditClick = (w: ColpiWord) => {
    setSubmitOpen(false);
    setEditingId(w.id);
    setFormWord(w.word);
    setFormNote(w.note ?? '');
    setFormCategory(w.category);
    setFormLang(w.language);
  };
  const handleEditConfirm = async () => {
    if (editingId === null) return;
    const word = normalizeWord(formWord, getAlphabet(formLang));
    const err = validateWordInput(word);
    if (err) { showToast(err); return; }
    try {
      const updated = await patchWord(editingId, {
        word, category: formCategory, language: formLang as Language,
        note: formNote.trim() || null,
      });
      upsertWordLocal(updated);
      setEditingId(null);
      setFormWord('');
      setFormNote('');
      setFormCategory('unspecified');
      showToast(tr({ zh: '已保存', en: 'Saved'
    }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  // ── delete ──
  const handleDelete = async (w: ColpiWord) => {
    if (!canEdit(w)) return;
    const confirmMsg = (isZh
          ? `确认删除"${w.word}"?`
          : `Delete "${w.word}"?`);
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteWord(w.id);
      removeWordLocal(w.pair, w.id);
      showToast(tr({ zh: '已删除', en: 'Deleted'
    }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  // ── vote ──
  const handleVote = async (w: ColpiWord, dir: 1 | -1) => {
    if (!user) { showToast(tr({ zh: '请先登录', en: 'Please log in first'
    })); return; }
    try {
      if (w.myVote === dir) {
        const r = await clearVote(w.id);
        updateScoreLocal(w.id, r.score, r.myVote);
      } else {
        const r = await setVote(w.id, dir);
        updateScoreLocal(w.id, r.score, r.myVote);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="colpi-page">
      {/* === Top bar === */}
      <header className="colpi-topbar">
        <div className="colpi-brand">
          <div className="colpi-logo" aria-hidden>
            <span className="colpi-logo-dot" />
            <span className="colpi-logo-dot" />
            <span className="colpi-logo-dot" />
            <span className="colpi-logo-dot" />
          </div>
          <div className="colpi-brand-text">
            <span className="colpi-brand-title">coLPI</span>
            <span className="colpi-brand-sub">
              {tr({ zh: '盲拧字母对图像协作数据库', en: 'collective letter-pair images database for BLD.'
            })}
            </span>
          </div>
        </div>

        <div className="colpi-search">
          <input
            className="colpi-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            placeholder="LP"
            maxLength={2}
            aria-label={tr({ zh: '搜索字母对', en: 'Search letter pair'
            })}
          />
          <button className="colpi-search-btn" onClick={onSearch} title={tr({ zh: '搜索', en: 'Search'
        })}><Search size={14} /></button>
        </div>

        <div className="colpi-actions">
          <div className="colpi-pill-group" role="tablist" aria-label={tr({ zh: '视图', en: 'View'
        })}>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'all'}
              className={`colpi-pill-btn ${viewMode === 'all' ? 'on' : ''}`}
              onClick={() => setViewMode('all')}
            >{tr({ zh: '全部', en: 'All' })}</button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'mine'}
              className={`colpi-pill-btn ${viewMode === 'mine' ? 'on' : ''}`}
              disabled={!user}
              onClick={() => setViewMode('mine')}
              title={user ? '' : tr({ zh: '需要登录', en: 'Login required'
                          })}
            >{tr({ zh: '我的', en: 'Mine' })}</button>
          </div>
          <button
            className={`colpi-toggle-btn ${hideOffensive ? 'on' : ''}`}
            onClick={() => setHideOffensive(v => !v)}
            title={tr({ zh: '隐藏被标记为不雅的词', en: 'Hide community-flagged offensive words'
            })}
          >
            {hideOffensive ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{tr({ zh: '过滤', en: 'Filter'
            })}</span>
          </button>
          <WcaAuth />
        </div>
      </header>

      {/* === Welcome banner === */}
      {welcomeOpen && (
        <section className="colpi-welcome">
          <div className="colpi-welcome-body">
            <h1>{tr({ zh: '欢迎!', en: 'Welcome!'
            })}</h1>
            <p>
              {tr({ zh: 'CoLPI 是一个盲拧字母对图像的公共数据库。你可以浏览、投票或提交自己的关联词。注意,部分词汇可能令人不适。', en: 'CoLPI is a public collection of letter-pair images for blindfolded cubing. Browse, vote, and submit your own associations. Some words may be considered offensive.'
            })}
            </p>
            <p className="colpi-welcome-disclaimer">
              {tr({ zh: '初始词条镜像自原站 (bestsiteever.net/colpi,Roman Strakhov 维护);本站为 UI 复刻,登录后可提交、编辑自己的词,管理员可改任何词。', en: 'Initial entries mirrored from bestsiteever.net/colpi (Roman Strakhov). UI clone — logged-in users can submit/edit their own words; admins can edit any.'
            })}
            </p>
          </div>
          <button className="colpi-welcome-close" onClick={() => setWelcomeOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </section>
      )}

      <div className="colpi-main">
      {/* === Letter-pair grid === */}
      <section className="colpi-grid-wrap">
        <div className="colpi-section-h">
          {(isZh
                                  ? `字母对网格 (${langDisplay(langFilter, true)})`
                                  : `Language table (${langDisplay(langFilter, false).toLowerCase()} scheme)`)}
        </div>
        <div className="colpi-grid-scroll">
          <table className="colpi-grid">
            <thead>
              <tr>
                <th
                  className="colpi-grid-corner clickable"
                  ref={cornerRef}
                  onClick={() => setLangPickerOpen(o => !o)}
                  title={tr({ zh: '切换语言', en: 'Switch language'
                })}
                >
                  {(LANG_MAP[langFilter]?.code ?? langFilter).toUpperCase()}
                  <span className="colpi-grid-corner-caret">▾</span>
                </th>
                {ALPHABET.map(c => <th key={c} className="colpi-grid-h">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {ALPHABET.map(r => (
                <tr key={r}>
                  <th className="colpi-grid-h">{r}</th>
                  {ALPHABET.map(c => {
                    const pair = `${r}${c}`;
                    const words = filteredByPair[pair];
                    const filled = !!words && words.length > 0;
                    return (
                      <td
                        key={pair}
                        className={`colpi-cell ${filled ? 'filled' : 'empty'} ${activePair === pair ? 'active' : ''}`}
                        title={filled ? words!.slice(0, 3).map(w => w.word).join(', ') : ''}
                        onClick={() => setActivePair(pair)}
                      >
                        {pair}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {langPickerOpen && (
          <LangPopup
            value={langFilter}
            onChange={(v) => setLangFilter(v)}
            onClose={() => setLangPickerOpen(false)}
            popupClassName="colpi-langpicker-popup--corner"
          />
        )}
        <div className="colpi-grid-legend">
          <span className="colpi-legend-swatch filled" /> {tr({ zh: '已有词', en: 'Has words'
        })}
          <span className="colpi-legend-swatch empty" /> {tr({ zh: '空缺', en: 'Empty' })}
          <span className="colpi-legend-meta">
            {loading
              ? tr({ zh: '加载中…', en: 'Loading…'
                                          })
              : loadError
                ? ((isZh ? `加载失败: ${loadError}` : `Load failed: ${loadError}`))
                : (isZh
                                                    ? `共 ${filledPairs} 对 / ${totalWordCount} 个词`
                                                    : `${filledPairs} pairs / ${totalWordCount} words`)}
          </span>
        </div>
      </section>

      {/* === Active pair detail === */}
      {activePair && (
        <section className="colpi-detail" ref={detailRef}>
          <div className="colpi-detail-head">
            <span className="colpi-detail-pair">{activePair}</span>
          </div>
          {activeWords.length === 0 ? (
            <p className="colpi-detail-empty">
              {tr({ zh: '这个字母对暂无词。提交一个吧!', en: 'No words for this pair yet. Be the first to add one!'
            })}
            </p>
          ) : (
            <ul className="colpi-detail-list">
              {activeWords.map(w => editingId === w.id ? (
                <li key={w.id} className="colpi-detail-edit-row">
                  <FormFields
                    isZh={isZh}
                    word={formWord} setWord={setFormWord}
                    note={formNote} setNote={setFormNote}
                    category={formCategory} setCategory={setFormCategory}
                    lang={formLang} setLang={setFormLang}
                    onConfirm={handleEditConfirm}
                    onCancel={() => { setEditingId(null); setFormWord(''); setFormNote(''); }}
                    confirmLabel={tr({ zh: '保存', en: 'Save'
                    })}
                  />
                </li>
              ) : (
                <li key={w.id}>
                  <span
                    className="colpi-pao-dot"
                    style={{ background: CATEGORY_DOT[w.category] }}
                    title={tr(CATEGORY_LABEL[w.category])}
                  />
                  <span className="colpi-detail-word">{w.word}</span>
                  {w.note && <span className="colpi-detail-note">{w.note}</span>}
                  {w.submitter && (
                    <span
                      className="colpi-submitter"
                      title={(w.submitter.name && displayCuberName(w.submitter.name, isZh)) || w.submitter.wcaId}
                    >
                      {w.submitter.country && <Flag iso2={w.submitter.country} className="colpi-submitter-flag" />}
                      <span className="colpi-submitter-name">
                        {(w.submitter.name && displayCuberName(w.submitter.name, isZh)) || w.submitter.wcaId}
                      </span>
                    </span>
                  )}
                  {w.score !== 0 && (
                    <span className={`colpi-score ${w.score > 0 ? 'pos' : 'neg'}`}>
                      {w.score > 0 ? `+${w.score}` : w.score}
                    </span>
                  )}
                  <span className="colpi-detail-vote">
                    <button
                      className={`colpi-vote-btn ${w.myVote === 1 ? 'is-voted-up' : ''}`}
                      onClick={() => handleVote(w, 1)}
                      title={tr({ zh: '有用', en: 'Useful' })}
                    ><ThumbsUp size={12} /></button>
                    <button
                      className={`colpi-vote-btn ${w.myVote === -1 ? 'is-voted-down' : ''}`}
                      onClick={() => handleVote(w, -1)}
                      title={tr({ zh: '不合适', en: 'Misused'
                    })}
                    ><ThumbsDown size={12} /></button>
                  </span>
                  {canEdit(w) && (
                    <span className="colpi-owner-actions">
                      <button className="colpi-owner-btn" onClick={() => handleEditClick(w)} title={tr({ zh: '编辑', en: 'Edit'
                    })}>
                        <Pencil size={12} />
                      </button>
                      <button className="colpi-owner-btn" onClick={() => handleDelete(w)} title={tr({ zh: '删除', en: 'Delete'
                    })}>
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!submitOpen ? (
            <button
              className="colpi-detail-add"
              onClick={handleAddClick}
              title={user ? '' : tr({ zh: '需要登录', en: 'Login required'
                          })}
            >
              + {tr({ zh: '提交一个新词', en: 'Submit a new word'
            })}
            </button>
          ) : (
            <div className="colpi-detail-submit">
              <FormFields
                isZh={isZh}
                word={formWord} setWord={setFormWord}
                note={formNote} setNote={setFormNote}
                category={formCategory} setCategory={setFormCategory}
                lang={formLang} setLang={setFormLang}
                onConfirm={handleSubmitConfirm}
                onCancel={() => { setSubmitOpen(false); setFormWord(''); setFormNote(''); }}
                confirmLabel={tr({ zh: '提交', en: 'Submit' })}
              />
            </div>
          )}
        </section>
      )}
      </div>

      {/* === Recently submitted === */}
      <section className="colpi-recent">
        <div className="colpi-section-h">
          {tr({ zh: '最近提交', en: 'Recent submissions' })}
        </div>
        {recent.length === 0 ? (
          <p className="colpi-detail-empty">
            {tr({ zh: '还没有用户提交。来提交第一个吧!', en: 'No user submissions yet. Be the first!'
            })}
          </p>
        ) : (
          <table className="colpi-recent-table">
            <tbody>
              {recent.map(w => (
                <tr key={w.id}>
                  <td>
                    <button type="button" className="colpi-pair-chip" onClick={() => setActivePair(w.pair)}>{w.pair}</button>
                  </td>
                  <td>
                    <span
                      className="colpi-pao-dot"
                      style={{ background: CATEGORY_DOT[w.category] }}
                      title={tr(CATEGORY_LABEL[w.category])}
                    />
                  </td>
                  <td className="colpi-recent-word">
                    {w.word}
                    {w.note && <span className="colpi-detail-note">{w.note}</span>}
                    {w.submitter && (
                      <span className="colpi-submitter" title={w.submitter.name || w.submitter.wcaId}>
                        {w.submitter.country && <Flag iso2={w.submitter.country} className="colpi-submitter-flag" />}
                        <span className="colpi-submitter-name">{w.submitter.name || w.submitter.wcaId}</span>
                      </span>
                    )}
                    {w.offensive && (
                      <button
                        className="colpi-flag-btn"
                        title={tr({ zh: '已被标记为不雅', en: 'Flagged offensive'
                        })}
                      >
                        <FlagIcon size={11} />
                      </button>
                    )}
                  </td>
                  <td className="colpi-recent-vote">
                    <button
                      className={`colpi-recent-vote-btn ${w.myVote === 1 ? 'is-voted-up' : ''}`}
                      onClick={() => handleVote(w, 1)}
                      title={tr({ zh: '有用', en: 'Useful' })}
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      className={`colpi-recent-vote-btn ${w.myVote === -1 ? 'is-voted-down' : ''}`}
                      onClick={() => handleVote(w, -1)}
                      title={tr({ zh: '不合适', en: 'Misused'
                    })}
                    >
                      <ThumbsDown size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* === Footer === */}
      <footer className="colpi-footer">
        <p>
          {tr({ zh: 'UI 复刻自 ', en: 'UI cloned from '
        })}
          <a href="https://bestsiteever.net/colpi/" target="_blank" rel="noopener noreferrer">
            bestsiteever.net/colpi
          </a>
          {tr({ zh: ',原作者 ', en: ' by ' })}
          <a href="https://bestsiteever.ru/me" target="_blank" rel="noopener noreferrer">
            Roman Strakhov
          </a>
          .
        </p>
      </footer>

      {/* === Toast === */}
      {toast && <div className="colpi-toast">{toast}</div>}
    </div>
  );
}

// ── shared input form for submit + edit ──
function FormFields({
  isZh, word, setWord, note, setNote, category, setCategory, lang, setLang,
  onConfirm, onCancel, confirmLabel,
}: {
  isZh: boolean;
  word: string;
  setWord: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  category: Category;
  setCategory: (c: Category) => void;
  lang: string;
  setLang: (l: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
}) {
  return (
    <>
      <input
        className="colpi-submit-input"
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={tr({ zh: '输入一个词 (例如 ROCKET / 苹果)', en: 'Enter a word (e.g. ROCKET, 苹果)'
        })}
        maxLength={40}
        autoFocus
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={tr({ zh: '备注 (可选,例如 APPLE)', en: 'Note (optional, e.g. APPLE)'
        })}
        maxLength={500}
        className="colpi-form-note colpi-submit-input"
      />
      <select
        className="colpi-submit-select"
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        aria-label={tr({ zh: '类别', en: 'Category'
        })}
      >
        <option value="unspecified">{CATEGORY_LABEL.unspecified[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
        <option value="object">{CATEGORY_LABEL.object[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
        <option value="person">{CATEGORY_LABEL.person[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
        <option value="action">{CATEGORY_LABEL.action[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
        <option value="place">{CATEGORY_LABEL.place[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
        <option value="other">{CATEGORY_LABEL.other[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}</option>
      </select>
      <LanguagePicker value={lang} onChange={setLang} isZh={isZh} />
      <button className="colpi-detail-add" onClick={onConfirm}>{confirmLabel}</button>
      <button className="colpi-detail-cancel" onClick={onCancel}>
        {tr({ zh: '取消', en: 'Cancel' })}
      </button>
    </>
  );
}
