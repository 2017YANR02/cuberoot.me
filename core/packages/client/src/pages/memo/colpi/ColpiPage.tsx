/**
 * /memo/colpi/ — UI clone of bestsiteever.net/colpi (by Roman Strakhov, not open source).
 *
 * Front-end-only replica with mock data for portfolio/demo. No backend; vote/login
 * buttons toast a "demo only" notice. Rendered as a single page with header / welcome /
 * 27×27 letter-pair grid / recent-submissions vote list / top-contributors / footer.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Eye, EyeOff, LogIn, ThumbsUp, ThumbsDown, Flag as FlagIcon, X } from 'lucide-react';
import LangToggle from '../../../components/LangToggle';
import { Flag } from '../../../utils/flag';
import { ALPHABET, PAIRS, RECENT_SUBMISSIONS, TOP_CONTRIBUTORS, STATS } from './data';
import type { Category } from './data';
import './colpi.css';

const CATEGORY_DOT: Record<Category, string> = {
  unspecified: '#bbb',
  object:      '#27ae60',
  person:      '#e67e22',
};

const CATEGORY_LABEL: Record<Category, { en: string; zh: string }> = {
  unspecified: { en: 'unspecified', zh: '未分类' },
  object:      { en: 'object',      zh: '物品' },
  person:      { en: 'person',      zh: '人物' },
};

const FILLED_PAIRS = Object.keys(PAIRS).length;
const VALID_PAIR_RE = /^[A-Z]{2}$/;

export default function ColpiPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [search, setSearch] = useState('');
  const [hideOffensive, setHideOffensive] = useState(true);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [activePair, setActivePair] = useState<string | null>(null);
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

  const onCellClick = (pair: string) => setActivePair(pair);
  const onSearch = () => {
    const q = search.trim().toUpperCase();
    if (VALID_PAIR_RE.test(q)) setActivePair(q);
    else showToast(isZh ? '请输入两个英文字母 (A-Z)' : 'Enter exactly 2 letters (A-Z)');
  };

  const activeWords = activePair ? PAIRS[activePair] ?? [] : [];

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
            title={isZh ? '隐藏不雅词' : 'Hide offensive words'}
          >
            {hideOffensive ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{isZh ? '过滤' : 'Filter'}</span>
          </button>
          <LangToggle variant="inline" />
          <button
            className="colpi-login-btn"
            onClick={() => showToast(isZh ? 'Demo 站点,登录已禁用' : 'Demo site — login disabled')}
          >
            <LogIn size={14} /> {isZh ? '登录' : 'Login'}
          </button>
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
                ? '这是一个 UI 复刻演示页,数据为示例数据。原站由 Roman Strakhov 维护。'
                : 'This is a UI clone demo with sample data. The original site is maintained by Roman Strakhov.'}
            </p>
          </div>
          <button className="colpi-welcome-close" onClick={() => setWelcomeOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </section>
      )}

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
                        title={filled ? words!.slice(0, 3).join(', ') : ''}
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
            {isZh ? `共 ${FILLED_PAIRS} 个字母对有词` : `${FILLED_PAIRS} pairs with words`}
          </span>
        </div>
      </section>

      {/* === Active pair detail (modal-like inline) === */}
      {activePair && (
        <section className="colpi-detail">
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
              {activeWords.map(w => (
                <li key={w}>
                  <span className="colpi-detail-word">{w}</span>
                  <span className="colpi-detail-vote">
                    <button onClick={() => showToast(isZh ? '需登录' : 'Login required')}><ThumbsUp size={12} /></button>
                    <button onClick={() => showToast(isZh ? '需登录' : 'Login required')}><ThumbsDown size={12} /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            className="colpi-detail-add"
            onClick={() => showToast(isZh ? 'Demo 站点,提交已禁用' : 'Demo site — submit disabled')}
          >
            + {isZh ? '提交一个新词' : 'Submit a new word'}
          </button>
        </section>
      )}

      {/* === Recently submitted: vote === */}
      <section className="colpi-recent">
        <div className="colpi-section-h">
          {isZh ? '为最近提交的词投票' : 'Vote for recently submitted images'}
        </div>
        <table className="colpi-recent-table">
          <tbody>
            {RECENT_SUBMISSIONS.map(s => (
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
                  <button onClick={() => showToast(isZh ? '需登录' : 'Login required')} title={isZh ? '有用' : 'Useful'}>
                    <ThumbsUp size={12} />
                  </button>
                  <button onClick={() => showToast(isZh ? '需登录' : 'Login required')} title={isZh ? '不合适' : 'Misused'}>
                    <ThumbsDown size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* === Top contributors === */}
      <section className="colpi-leaders">
        <div className="colpi-section-h">
          {isZh ? '近 90 天贡献榜' : 'Top contributors (last 90 days)'}
        </div>
        <table className="colpi-leaders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{isZh ? '名字' : 'Name'}</th>
              <th title={isZh ? '投票活跃度' : 'How much user votes'}>{isZh ? '活跃' : 'Activity'}</th>
              <th title={isZh ? '所提词的价值' : 'Word value'}>{isZh ? '价值' : 'Value'}</th>
              <th>{isZh ? '总分' : 'Valuability'}</th>
            </tr>
          </thead>
          <tbody>
            {TOP_CONTRIBUTORS.map(c => (
              <tr key={c.rank}>
                <td>{c.rank}</td>
                <td>
                  <Flag iso2={c.country} className="colpi-leaders-flag" /> {c.name}
                </td>
                <td>{c.activity}</td>
                <td>{c.value}</td>
                <td className="colpi-valuability">{c.valuability}</td>
              </tr>
            ))}
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
            ? `用户 ${STATS.users} | 英文词条 ${STATS.englishWords} | 全部语言词条 ${STATS.totalWords} (示例数据)`
            : `${STATS.users} users | ${STATS.englishWords} English words | ${STATS.totalWords} total words (sample data)`}
        </p>
      </footer>

      {/* === Toast === */}
      {toast && <div className="colpi-toast">{toast}</div>}
    </div>
  );
}
