/**
 * /memo/colpi/ — UI clone of bestsiteever.net/colpi (by Roman Strakhov, not open source).
 *
 * Word data mirrored from the upstream site via scripts/fetch_colpi_words.mjs
 * (729 pairs, ~11.5k words with categories). Logged-in WCA users can append
 * their own words; submissions persist via localStorage on this device only (no
 * backend yet). Vote buttons still require login but only register locally.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Eye, EyeOff, ThumbsUp, ThumbsDown, Flag as FlagIcon, X } from 'lucide-react';
import LangToggle from '../../../components/LangToggle';
import WcaAuth from '../../../components/WcaAuth';
import { useAuthStore } from '../../../stores/auth_store';
import { ALPHABET, PAIRS, RECENT_SUBMISSIONS } from './data';
import type { Category, PairWord, RecentSubmission } from './data';
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

// Allow letters (any script — incl. CJK), numbers, marks (combining diacritics),
// punctuation, and whitespace. Blocks control chars / oddball symbols, but mixed
// English + 中文 + 全角标点 all pass.
const VALID_WORD_RE = /^[\p{L}\p{N}\p{M}\p{P}\s]+$/u;
const DEFAULT_PAIR = 'AA';

/** Validate pair against ALPHABET (handles ʧ multi-char letter correctly). */
function isValidPair(s: string, alphabet: readonly string[]): boolean {
  const chars = [...s];
  return chars.length === 2 && chars.every(c => alphabet.includes(c));
}
const SUBMITTED_KEY = 'colpi_submitted_v1';
const VOTES_KEY = 'colpi_votes_v1';

type Vote = 1 | -1;
const voteKey = (pair: string, word: string) => `${pair}|${word}`;

interface SubmittedWord {
  pair: string;
  word: string;
  category: Category;
  by: string;       // wcaId
  at: number;       // timestamp ms
}

function readSubmitted(): SubmittedWord[] {
  try {
    const raw = localStorage.getItem(SUBMITTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeSubmitted(items: SubmittedWord[]) {
  try { localStorage.setItem(SUBMITTED_KEY, JSON.stringify(items)); } catch { /* quota / disabled */ }
}

function readVotes(): Record<string, Vote> {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeVotes(items: Record<string, Vote>) {
  try { localStorage.setItem(VOTES_KEY, JSON.stringify(items)); } catch { /* quota / disabled */ }
}

export default function ColpiPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const { pair: urlPair } = useParams<{ pair?: string }>();

  // URL is the source of truth for the active pair: /memo/colpi/AA → activePair = 'AA'.
  // /memo/colpi (no param) defaults to AA via the redirect effect below.
  const decoded = urlPair ? (() => {
    try { return decodeURIComponent(urlPair).toUpperCase(); } catch { return ''; }
  })() : '';
  const activePair: string | null = decoded && isValidPair(decoded, ALPHABET) ? decoded : null;

  // Redirect /memo/colpi (no param) → /memo/colpi/AA, and any invalid pair → AA.
  useEffect(() => {
    if (urlPair === undefined) {
      navigate(`/memo/colpi/${DEFAULT_PAIR}`, { replace: true });
    } else if (decoded && !isValidPair(decoded, ALPHABET)) {
      navigate(`/memo/colpi/${DEFAULT_PAIR}`, { replace: true });
    }
  }, [urlPair, decoded, navigate]);

  const setActivePair = (p: string | null) => {
    if (p === null) {
      navigate('/memo/colpi', { replace: true });
    } else {
      navigate(`/memo/colpi/${encodeURIComponent(p)}`, { replace: true });
    }
  };

  const [search, setSearch] = useState('');
  const [hideOffensive, setHideOffensive] = useState(true);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Local-only user submissions, layered on top of curated PAIRS.
  const [submitted, setSubmitted] = useState<SubmittedWord[]>(() => readSubmitted());
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitWord, setSubmitWord] = useState('');
  const [submitCategory, setSubmitCategory] = useState<Category>('unspecified');

  // Local-only votes (this device, no backend yet).
  const [votes, setVotes] = useState<Record<string, Vote>>(() => readVotes());

  const handleVote = (pair: string, word: string, dir: Vote) => {
    if (!user) {
      showToast(isZh ? '请先登录' : 'Please log in first');
      return;
    }
    const key = voteKey(pair, word);
    const next: Record<string, Vote> = { ...votes };
    if (next[key] === dir) delete next[key];
    else next[key] = dir;
    setVotes(next);
    writeVotes(next);
  };

  const showToast = (msg: string) => {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => () => {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
  }, []);

  // Reset inline submit form when active pair changes.
  useEffect(() => {
    setSubmitOpen(false);
    setSubmitWord('');
    setSubmitCategory('unspecified');
  }, [activePair]);

  // On narrow screens (stacked layout) auto-scroll the detail panel into view
  // when a pair is opened — desktop side-by-side doesn't need it.
  const detailRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!activePair) return;
    if (window.matchMedia('(min-width: 1200px)').matches) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activePair]);

  const onCellClick = (pair: string) => setActivePair(pair);
  const onSearch = () => {
    const q = search.trim().toUpperCase();
    if (isValidPair(q, ALPHABET)) setActivePair(q);
    else showToast(isZh ? '请输入两个英文字母 (A-Z)' : 'Enter exactly 2 letters (A-Z)');
  };

  // Combined view: scraped PAIRS + user submissions for the active pair (deduped),
  // with offensive entries filtered out when hideOffensive is on.
  const wordsForPair = (pair: string): PairWord[] => {
    const seen = new Set<string>();
    const out: PairWord[] = [];
    for (const w of (PAIRS[pair] ?? [])) {
      if (hideOffensive && w.offensive) continue;
      if (!seen.has(w.word)) { seen.add(w.word); out.push(w); }
    }
    for (const s of submitted) {
      if (s.pair === pair && !seen.has(s.word)) {
        seen.add(s.word);
        out.push({ word: s.word, category: s.category });
      }
    }
    return out;
  };
  const activeWords = activePair ? wordsForPair(activePair) : [];

  // Recent submissions = user's local submissions (newest first) + curated samples.
  const recentList: RecentSubmission[] = (() => {
    const fromUser: RecentSubmission[] = [...submitted]
      .sort((a, b) => b.at - a.at)
      .map((s, i) => ({ id: 100000 + i, pair: s.pair, word: s.word, category: s.category }));
    return [...fromUser, ...RECENT_SUBMISSIONS].slice(0, 12);
  })();

  const filledPairs = (() => {
    const set = new Set(Object.keys(PAIRS));
    for (const s of submitted) set.add(s.pair);
    return set.size;
  })();

  const totalEnglishWords = (() => {
    let n = 0;
    for (const k of Object.keys(PAIRS)) n += PAIRS[k].length;
    // Count user submissions that aren't already in curated PAIRS.
    for (const s of submitted) {
      const curated = PAIRS[s.pair] ?? [];
      if (!curated.some(w => w.word === s.word)) n++;
    }
    return n;
  })();

  const handleAddClick = () => {
    if (!user) {
      showToast(isZh ? '请先登录后再提交' : 'Please log in to submit');
      return;
    }
    setSubmitOpen(true);
  };

  const handleAddConfirm = () => {
    if (!user || !activePair) return;
    const word = submitWord.trim().toUpperCase();
    if (!word) { showToast(isZh ? '请输入一个词' : 'Enter a word'); return; }
    if (word.length > 40) { showToast(isZh ? '词太长了' : 'Word too long'); return; }
    if (!VALID_WORD_RE.test(word)) {
      showToast(isZh ? '请输入正常文字' : 'Invalid characters');
      return;
    }
    const existing = wordsForPair(activePair);
    if (existing.some(w => w.word === word)) {
      showToast(isZh ? '这个词已存在' : 'Word already exists');
      return;
    }
    const next: SubmittedWord = {
      pair: activePair,
      word,
      category: submitCategory,
      by: user.wcaId,
      at: Date.now(),
    };
    const list = [next, ...submitted];
    setSubmitted(list);
    writeSubmitted(list);
    setSubmitOpen(false);
    setSubmitWord('');
    setSubmitCategory('unspecified');
    showToast(isZh ? '已提交' : 'Submitted');
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
                ? '词条数据镜像自原站 (bestsiteever.net/colpi,Roman Strakhov 维护);本站为 UI 复刻,登录后可在本机追加自己的关联词。'
                : 'Word data mirrored from the original site (bestsiteever.net/colpi by Roman Strakhov). This is a UI clone — logged-in users can add their own associations locally.'}
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
          {isZh ? '字母对网格 (英文方案)' : 'Language table (english scheme)'}
        </div>
        <div className="colpi-grid-scroll">
          <table className="colpi-grid">
            <thead>
              <tr>
                <th className="colpi-grid-corner">EN</th>
                {ALPHABET.map(c => <th key={c} className="colpi-grid-h">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {ALPHABET.map(r => (
                <tr key={r}>
                  <th className="colpi-grid-h">{r}</th>
                  {ALPHABET.map(c => {
                    const pair = `${r}${c}`;
                    const words = PAIRS[pair];
                    const filled = !!words && words.length > 0;
                    return (
                      <td
                        key={pair}
                        className={`colpi-cell ${filled ? 'filled' : 'empty'} ${activePair === pair ? 'active' : ''}`}
                        title={filled ? words!.slice(0, 3).map(w => w.word).join(', ') : ''}
                        onClick={() => onCellClick(pair)}
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
        <div className="colpi-grid-legend">
          <span className="colpi-legend-swatch filled" /> {isZh ? '已有词' : 'Has words'}
          <span className="colpi-legend-swatch empty" /> {isZh ? '空缺' : 'Empty'}
          <span className="colpi-legend-meta">
            {isZh ? `共 ${filledPairs} 个字母对有词` : `${filledPairs} pairs with words`}
          </span>
        </div>
      </section>

      {/* === Active pair detail (sidebar on desktop, stacked on mobile) === */}
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
              {activeWords.map(w => {
                const v = votes[voteKey(activePair!, w.word)];
                return (
                  <li key={w.word}>
                    <span
                      className="colpi-pao-dot"
                      style={{ background: CATEGORY_DOT[w.category] }}
                      title={isZh ? CATEGORY_LABEL[w.category].zh : CATEGORY_LABEL[w.category].en}
                    />
                    <span className="colpi-detail-word">{w.word}</span>
                    <span className="colpi-detail-vote">
                      <button
                        className={v === 1 ? 'is-voted-up' : ''}
                        onClick={() => handleVote(activePair!, w.word, 1)}
                        title={isZh ? '有用' : 'Useful'}
                      ><ThumbsUp size={12} /></button>
                      <button
                        className={v === -1 ? 'is-voted-down' : ''}
                        onClick={() => handleVote(activePair!, w.word, -1)}
                        title={isZh ? '不合适' : 'Misused'}
                      ><ThumbsDown size={12} /></button>
                    </span>
                  </li>
                );
              })}
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
              <input
                type="text"
                value={submitWord}
                onChange={(e) => setSubmitWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddConfirm();
                  if (e.key === 'Escape') { setSubmitOpen(false); setSubmitWord(''); }
                }}
                placeholder={isZh ? '输入一个词 (例如 ROCKET / 苹果)' : 'Enter a word (e.g. ROCKET, 苹果)'}
                maxLength={40}
                autoFocus
              />
              <select
                value={submitCategory}
                onChange={(e) => setSubmitCategory(e.target.value as Category)}
                aria-label={isZh ? '类别' : 'Category'}
              >
                <option value="unspecified">{CATEGORY_LABEL.unspecified[isZh ? 'zh' : 'en']}</option>
                <option value="object">{CATEGORY_LABEL.object[isZh ? 'zh' : 'en']}</option>
                <option value="person">{CATEGORY_LABEL.person[isZh ? 'zh' : 'en']}</option>
                <option value="action">{CATEGORY_LABEL.action[isZh ? 'zh' : 'en']}</option>
                <option value="place">{CATEGORY_LABEL.place[isZh ? 'zh' : 'en']}</option>
                <option value="other">{CATEGORY_LABEL.other[isZh ? 'zh' : 'en']}</option>
              </select>
              <button className="colpi-detail-add" onClick={handleAddConfirm}>
                {isZh ? '提交' : 'Submit'}
              </button>
              <button
                className="colpi-detail-cancel"
                onClick={() => { setSubmitOpen(false); setSubmitWord(''); }}
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
            </div>
          )}
        </section>
      )}
      </div>

      {/* === Recently submitted: vote === */}
      <section className="colpi-recent">
        <div className="colpi-section-h">
          {isZh ? '为最近提交的词投票' : 'Vote for recently submitted images'}
        </div>
        <table className="colpi-recent-table">
          <tbody>
            {recentList.map(s => {
              const v = votes[voteKey(s.pair, s.word)];
              return (
                <tr key={s.id}>
                  <td>
                    <button type="button" className="colpi-pair-chip" onClick={() => setActivePair(s.pair)}>{s.pair}</button>
                  </td>
                  <td>
                    <span
                      className="colpi-pao-dot"
                      style={{ background: CATEGORY_DOT[s.category] }}
                      title={isZh ? CATEGORY_LABEL[s.category].zh : CATEGORY_LABEL[s.category].en}
                    />
                  </td>
                  <td className="colpi-recent-word">
                    {s.word}
                    <button
                      className="colpi-flag-btn"
                      onClick={() => showToast(isZh ? '已标记为不雅' : 'Marked as offensive')}
                      title={isZh ? '标记为不雅' : 'Mark as offensive'}
                    >
                      <FlagIcon size={11} />
                    </button>
                  </td>
                  <td className="colpi-recent-vote">
                    <button
                      className={v === 1 ? 'is-voted-up' : ''}
                      onClick={() => handleVote(s.pair, s.word, 1)}
                      title={isZh ? '有用' : 'Useful'}
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      className={v === -1 ? 'is-voted-down' : ''}
                      onClick={() => handleVote(s.pair, s.word, -1)}
                      title={isZh ? '不合适' : 'Misused'}
                    >
                      <ThumbsDown size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        <p className="colpi-footer-stats">
          {isZh
            ? `英文词条 ${totalEnglishWords} (本地)`
            : `${totalEnglishWords} English words (local)`}
        </p>
      </footer>

      {/* === Toast === */}
      {toast && <div className="colpi-toast">{toast}</div>}
    </div>
  );
}
