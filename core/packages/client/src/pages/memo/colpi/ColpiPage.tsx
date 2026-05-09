/**
 * /memo/colpi/ — collaborative letter-pair word database (UI clone of
 * bestsiteever.net/colpi by Roman Strakhov).
 *
 * Word data lives in PG (colpi_words / colpi_votes) on api.cuberoot.me. The
 * initial ~11.7k rows are seeded from the upstream site (submitter NULL =
 * mirrored). Logged-in WCA users can submit / edit / delete their own words
 * and vote; admins can edit / delete any word, including upstream entries.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, Eye, EyeOff, ThumbsUp, ThumbsDown, Flag as FlagIcon, X,
  Pencil, Trash2,
} from 'lucide-react';
import LangToggle from '../../../components/LangToggle';
import WcaAuth from '../../../components/WcaAuth';
import { Flag } from '../../../utils/flag';
import { displayCuberName } from '../../../utils/name_utils';
import { useAuthStore, ADMIN_WCA_IDS } from '../../../stores/auth_store';
import {
  fetchWords, fetchRecent, submitWord, patchWord, deleteWord, setVote, clearVote,
  type ColpiWord, type Category, type Language,
} from '../../../utils/colpi_api';
import LanguagePicker, { LangPopup } from './LanguagePicker';
import { LANG_MAP, langDisplay } from './langs';

type LangFilter = string;   // any of LANGS codes
type ViewMode = 'all' | 'mine';

const LANG_FILTER_KEY = 'colpi_lang_filter_v1';
const VIEW_MODE_KEY = 'colpi_view_mode_v1';

function readLangFilter(): LangFilter {
  const v = localStorage.getItem(LANG_FILTER_KEY) ?? 'en';
  return LANG_MAP[v] ? v : 'en';
}
function readViewMode(): ViewMode {
  return localStorage.getItem(VIEW_MODE_KEY) === 'mine' ? 'mine' : 'all';
}
import { getAlphabet, defaultPairFor } from './data';
import './colpi.css';

const CATEGORY_DOT: Record<Category, string> = {
  unspecified: '#bbb',
  object:      '#27ae60',
  person:      '#e67e22',
  action:      '#3498db',
  place:       '#9b59b6',
  other:       '#7f8c8d',
};

const CATEGORY_LABEL: Record<Category, { en: string; zh: string }> = {
  unspecified: { en: 'unspecified', zh: '未分类' },
  object:      { en: 'object',      zh: '物品' },
  person:      { en: 'person',      zh: '人物' },
  action:      { en: 'action',      zh: '动作' },
  place:       { en: 'place',       zh: '地点' },
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

function validateWordInput(word: string, isZh: boolean): string | null {
  if (!word) return isZh ? '请输入一个词' : 'Enter a word';
  if (word.length > 40) return isZh ? '词太长了' : 'Word too long';
  if (!VALID_WORD_RE.test(word)) return isZh ? '请输入正常文字' : 'Invalid characters';
  return null;
}

export default function ColpiPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const user = useAuthStore(s => s.user);
  const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
  const navigate = useNavigate();
  const { pair: urlPair } = useParams<{ pair?: string }>();

  // ── data state ──
  const [wordsByPair, setWordsByPair] = useState<Record<string, ColpiWord[]>>({});
  const [recent, setRecent] = useState<ColpiWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bulk, rec] = await Promise.all([fetchWords(), fetchRecent(20)]);
      setWordsByPair(bulk);
      setRecent(rec);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refetchAll(); }, [refetchAll, user?.wcaId]);

  // ── ui state ──
  const [search, setSearch] = useState('');
  const [hideOffensive, setHideOffensive] = useState(true);
  const [langFilter, setLangFilterState] = useState<LangFilter>(() => readLangFilter());
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
    if (urlPair === undefined) {
      navigate(`/memo/colpi/${encodeURIComponent(DEFAULT_PAIR)}`, { replace: true });
    } else if (decoded && !isValidPair(decoded, ALPHABET)) {
      navigate(`/memo/colpi/${encodeURIComponent(DEFAULT_PAIR)}`, { replace: true });
    }
  }, [urlPair, decoded, navigate, DEFAULT_PAIR, ALPHABET]);

  const setActivePair = (p: string | null) => {
    if (p === null) navigate('/memo/colpi', { replace: true });
    else navigate(`/memo/colpi/${encodeURIComponent(p)}`, { replace: true });
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
  const [formCategory, setFormCategory] = useState<Category>('unspecified');
  const [formLang, setFormLang] = useState<string>(() => langFilter);
  useEffect(() => {
    setSubmitOpen(false);
    setEditingId(null);
    setFormWord('');
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
    if (window.matchMedia('(min-width: 1200px)').matches) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activePair]);

  const onSearch = () => {
    const q = shouldUppercase(ALPHABET) ? search.trim().toUpperCase() : search.trim();
    if (isValidPair(q, ALPHABET)) setActivePair(q);
    else showToast(isZh ? '不在当前语言字母表里' : 'Not in current alphabet');
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
      // Only show user-submitted words in the "recent" list (mirroring the API).
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
    if (!user) { showToast(isZh ? '请先登录后再提交' : 'Please log in to submit'); return; }
    setEditingId(null);
    setFormWord('');
    setFormCategory('unspecified');
    setSubmitOpen(true);
  };
  const handleSubmitConfirm = async () => {
    if (!user || !activePair) return;
    const word = normalizeWord(formWord, getAlphabet(formLang));
    const err = validateWordInput(word, isZh);
    if (err) { showToast(err); return; }
    if (activeWords.some(w => w.word === word)) {
      showToast(isZh ? '这个词已存在' : 'Word already exists'); return;
    }
    try {
      const created = await submitWord({
        pair: activePair, word, category: formCategory, language: formLang as Language,
        country: user.country ?? null,
      });
      upsertWordLocal(created);
      setSubmitOpen(false);
      setFormWord('');
      setFormCategory('unspecified');
      showToast(isZh ? '已提交' : 'Submitted');
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
    setFormCategory(w.category);
    setFormLang(w.language);
  };
  const handleEditConfirm = async () => {
    if (editingId === null) return;
    const word = normalizeWord(formWord, getAlphabet(formLang));
    const err = validateWordInput(word, isZh);
    if (err) { showToast(err); return; }
    try {
      const updated = await patchWord(editingId, { word, category: formCategory, language: formLang as Language });
      upsertWordLocal(updated);
      setEditingId(null);
      setFormWord('');
      setFormCategory('unspecified');
      showToast(isZh ? '已保存' : 'Saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  // ── delete ──
  const handleDelete = async (w: ColpiWord) => {
    if (!canEdit(w)) return;
    const confirmMsg = isZh
      ? `确认删除"${w.word}"?`
      : `Delete "${w.word}"?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteWord(w.id);
      removeWordLocal(w.pair, w.id);
      showToast(isZh ? '已删除' : 'Deleted');
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  // ── vote ──
  const handleVote = async (w: ColpiWord, dir: 1 | -1) => {
    if (!user) { showToast(isZh ? '请先登录' : 'Please log in first'); return; }
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
              {isZh ? '盲拧字母对图像协作数据库' : 'collective letter-pair images database for BLD.'}
            </span>
          </div>
        </div>

        <div className="colpi-search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            placeholder="LP"
            maxLength={2}
            aria-label={isZh ? '搜索字母对' : 'Search letter pair'}
          />
          <button onClick={onSearch} title={isZh ? '搜索' : 'Search'}><Search size={14} /></button>
        </div>

        <div className="colpi-actions">
          <div className="colpi-pill-group" role="tablist" aria-label={isZh ? '视图' : 'View'}>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'all'}
              className={viewMode === 'all' ? 'on' : ''}
              onClick={() => setViewMode('all')}
            >{isZh ? '全部' : 'All'}</button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'mine'}
              className={viewMode === 'mine' ? 'on' : ''}
              disabled={!user}
              onClick={() => setViewMode('mine')}
              title={user ? '' : (isZh ? '需要登录' : 'Login required')}
            >{isZh ? '我的' : 'Mine'}</button>
          </div>
          <button
            className={`colpi-toggle-btn ${hideOffensive ? 'on' : ''}`}
            onClick={() => setHideOffensive(v => !v)}
            title={isZh ? '隐藏被标记为不雅的词' : 'Hide community-flagged offensive words'}
          >
            {hideOffensive ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{isZh ? '过滤' : 'Filter'}</span>
          </button>
          <LangToggle variant="inline" />
          <WcaAuth />
        </div>
      </header>

      {/* === Welcome banner === */}
      {welcomeOpen && (
        <section className="colpi-welcome">
          <div className="colpi-welcome-body">
            <h1>{isZh ? '欢迎!' : 'Welcome!'}</h1>
            <p>
              {isZh
                ? 'CoLPI 是一个盲拧字母对图像的公共数据库。你可以浏览、投票或提交自己的关联词。注意,部分词汇可能令人不适。'
                : 'CoLPI is a public collection of letter-pair images for blindfolded cubing. Browse, vote, and submit your own associations. Some words may be considered offensive.'}
            </p>
            <p className="colpi-welcome-disclaimer">
              {isZh
                ? '初始词条镜像自原站 (bestsiteever.net/colpi,Roman Strakhov 维护);本站为 UI 复刻,登录后可提交、编辑自己的词,管理员可改任何词。'
                : 'Initial entries mirrored from bestsiteever.net/colpi (Roman Strakhov). UI clone — logged-in users can submit/edit their own words; admins can edit any.'}
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
          {isZh
            ? `字母对网格 (${langDisplay(langFilter, true)})`
            : `Language table (${langDisplay(langFilter, false).toLowerCase()} scheme)`}
        </div>
        <div className="colpi-grid-scroll">
          <table className="colpi-grid">
            <thead>
              <tr>
                <th
                  className="colpi-grid-corner clickable"
                  ref={cornerRef}
                  onClick={() => setLangPickerOpen(o => !o)}
                  title={isZh ? '切换语言' : 'Switch language'}
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
            isZh={isZh}
            onClose={() => setLangPickerOpen(false)}
            popupClassName="colpi-langpicker-popup--corner"
          />
        )}
        <div className="colpi-grid-legend">
          <span className="colpi-legend-swatch filled" /> {isZh ? '已有词' : 'Has words'}
          <span className="colpi-legend-swatch empty" /> {isZh ? '空缺' : 'Empty'}
          <span className="colpi-legend-meta">
            {loading
              ? (isZh ? '加载中…' : 'Loading…')
              : loadError
                ? (isZh ? `加载失败: ${loadError}` : `Load failed: ${loadError}`)
                : isZh
                  ? `共 ${filledPairs} 对 / ${totalWordCount} 个词`
                  : `${filledPairs} pairs / ${totalWordCount} words`}
          </span>
        </div>
      </section>

      {/* === Active pair detail === */}
      {activePair && (
        <section className="colpi-detail" ref={detailRef}>
          <div className="colpi-detail-head">
            <span className="colpi-detail-pair">{activePair}</span>
            <button className="colpi-detail-close" onClick={() => setActivePair(null)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          {activeWords.length === 0 ? (
            <p className="colpi-detail-empty">
              {isZh ? '这个字母对暂无词。提交一个吧!' : 'No words for this pair yet. Be the first to add one!'}
            </p>
          ) : (
            <ul className="colpi-detail-list">
              {activeWords.map(w => editingId === w.id ? (
                <li key={w.id} className="colpi-detail-edit-row">
                  <FormFields
                    isZh={isZh}
                    word={formWord} setWord={setFormWord}
                    category={formCategory} setCategory={setFormCategory}
                    lang={formLang} setLang={setFormLang}
                    onConfirm={handleEditConfirm}
                    onCancel={() => { setEditingId(null); setFormWord(''); }}
                    confirmLabel={isZh ? '保存' : 'Save'}
                  />
                </li>
              ) : (
                <li key={w.id}>
                  <span
                    className="colpi-pao-dot"
                    style={{ background: CATEGORY_DOT[w.category] }}
                    title={isZh ? CATEGORY_LABEL[w.category].zh : CATEGORY_LABEL[w.category].en}
                  />
                  <span className="colpi-detail-word">{w.word}</span>
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
                      className={w.myVote === 1 ? 'is-voted-up' : ''}
                      onClick={() => handleVote(w, 1)}
                      title={isZh ? '有用' : 'Useful'}
                    ><ThumbsUp size={12} /></button>
                    <button
                      className={w.myVote === -1 ? 'is-voted-down' : ''}
                      onClick={() => handleVote(w, -1)}
                      title={isZh ? '不合适' : 'Misused'}
                    ><ThumbsDown size={12} /></button>
                  </span>
                  {canEdit(w) && (
                    <span className="colpi-owner-actions">
                      <button onClick={() => handleEditClick(w)} title={isZh ? '编辑' : 'Edit'}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(w)} title={isZh ? '删除' : 'Delete'}>
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
              title={user ? '' : (isZh ? '需要登录' : 'Login required')}
            >
              + {isZh ? '提交一个新词' : 'Submit a new word'}
            </button>
          ) : (
            <div className="colpi-detail-submit">
              <FormFields
                isZh={isZh}
                word={formWord} setWord={setFormWord}
                category={formCategory} setCategory={setFormCategory}
                lang={formLang} setLang={setFormLang}
                onConfirm={handleSubmitConfirm}
                onCancel={() => { setSubmitOpen(false); setFormWord(''); }}
                confirmLabel={isZh ? '提交' : 'Submit'}
              />
            </div>
          )}
        </section>
      )}
      </div>

      {/* === Recently submitted === */}
      <section className="colpi-recent">
        <div className="colpi-section-h">
          {isZh ? '最近提交' : 'Recent submissions'}
        </div>
        {recent.length === 0 ? (
          <p className="colpi-detail-empty">
            {isZh ? '还没有用户提交。来提交第一个吧!' : 'No user submissions yet. Be the first!'}
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
                      title={isZh ? CATEGORY_LABEL[w.category].zh : CATEGORY_LABEL[w.category].en}
                    />
                  </td>
                  <td className="colpi-recent-word">
                    {w.word}
                    {w.submitter && (
                      <span className="colpi-submitter" title={w.submitter.name || w.submitter.wcaId}>
                        {w.submitter.country && <Flag iso2={w.submitter.country} className="colpi-submitter-flag" />}
                        <span className="colpi-submitter-name">{w.submitter.name || w.submitter.wcaId}</span>
                      </span>
                    )}
                    {w.offensive && (
                      <button
                        className="colpi-flag-btn"
                        title={isZh ? '已被标记为不雅' : 'Flagged offensive'}
                      >
                        <FlagIcon size={11} />
                      </button>
                    )}
                  </td>
                  <td className="colpi-recent-vote">
                    <button
                      className={w.myVote === 1 ? 'is-voted-up' : ''}
                      onClick={() => handleVote(w, 1)}
                      title={isZh ? '有用' : 'Useful'}
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      className={w.myVote === -1 ? 'is-voted-down' : ''}
                      onClick={() => handleVote(w, -1)}
                      title={isZh ? '不合适' : 'Misused'}
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
          {isZh ? 'UI 复刻自 ' : 'UI cloned from '}
          <a href="https://bestsiteever.net/colpi/" target="_blank" rel="noopener noreferrer">
            bestsiteever.net/colpi
          </a>
          {isZh ? ',原作者 ' : ' by '}
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
  isZh, word, setWord, category, setCategory, lang, setLang,
  onConfirm, onCancel, confirmLabel,
}: {
  isZh: boolean;
  word: string;
  setWord: (s: string) => void;
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
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={isZh ? '输入一个词 (例如 ROCKET / 苹果)' : 'Enter a word (e.g. ROCKET, 苹果)'}
        maxLength={40}
        autoFocus
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        aria-label={isZh ? '类别' : 'Category'}
      >
        <option value="unspecified">{CATEGORY_LABEL.unspecified[isZh ? 'zh' : 'en']}</option>
        <option value="object">{CATEGORY_LABEL.object[isZh ? 'zh' : 'en']}</option>
        <option value="person">{CATEGORY_LABEL.person[isZh ? 'zh' : 'en']}</option>
        <option value="action">{CATEGORY_LABEL.action[isZh ? 'zh' : 'en']}</option>
        <option value="place">{CATEGORY_LABEL.place[isZh ? 'zh' : 'en']}</option>
        <option value="other">{CATEGORY_LABEL.other[isZh ? 'zh' : 'en']}</option>
      </select>
      <LanguagePicker value={lang} onChange={setLang} isZh={isZh} />
      <button className="colpi-detail-add" onClick={onConfirm}>{confirmLabel}</button>
      <button className="colpi-detail-cancel" onClick={onCancel}>
        {isZh ? '取消' : 'Cancel'}
      </button>
    </>
  );
}
