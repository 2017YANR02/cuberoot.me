/**
 * Token chip editor: simple-mode replacement for the giant <textarea>.
 *
 * Per alg row:
 *   <input>  (raw, single-line, what user types)
 *   chips below — one per whitespace-separated token. Tap chip to cycle the
 *   finger-trick mark: none → underline → wavy → strike → none.
 *
 * Storage: builds AlgEntry { alg: clean-text, algHtml? } where algHtml wraps
 * each marked token with <u>/<u class="wavy">/<s>. Multi-token-spanning markup
 * is intentionally NOT supported here (per user spec — every mark = single token).
 */
import { X, Plus } from 'lucide-react';
import type { AlgEntry } from '@cuberoot/shared';
import './alg.css';

type Mark = 'u' | 'wavy' | 's' | null;
const MARK_CYCLE: Mark[] = [null, 'u', 'wavy', 's'];

function nextMark(m: Mark): Mark {
  const i = MARK_CYCLE.indexOf(m);
  return MARK_CYCLE[(i + 1) % MARK_CYCLE.length];
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Walk algHtml left→right; for each whitespace-separated text chunk emit
 *  a {text, mark} pair using the currently-open inline tag (if any). */
function parseAlgHtmlTokens(algHtml: string): { text: string; mark: Mark }[] {
  const out: { text: string; mark: Mark }[] = [];
  let i = 0, curMark: Mark = null, curText = '';
  const flush = () => { if (curText) { out.push({ text: curText, mark: curMark }); curText = ''; } };
  while (i < algHtml.length) {
    const c = algHtml[i];
    if (c === '<') {
      const end = algHtml.indexOf('>', i);
      if (end === -1) break;
      const tag = algHtml.slice(i, end + 1);
      const isClose = tag.startsWith('</');
      const m = /<\/?([a-z]+)([^>]*)>/i.exec(tag);
      if (m) {
        const name = m[1].toLowerCase();
        const attrs = m[2];
        if (isClose) curMark = null;
        else if (name === 'u') curMark = /\bclass\s*=\s*["']?wavy["']?/i.test(attrs) ? 'wavy' : 'u';
        else if (name === 's') curMark = 's';
        // em / strong: ignored — we drop unsupported marks on first edit
      }
      i = end + 1;
    } else if (/\s/.test(c)) {
      flush();
      i++;
    } else {
      curText += c;
      i++;
    }
  }
  flush();
  return out;
}

/** Pull (text, marks[]) out of an existing AlgEntry. */
function parseEntry(entry: AlgEntry): { text: string; marks: Mark[] } {
  if (!entry.algHtml) {
    const toks = tokenize(entry.alg);
    return { text: entry.alg, marks: toks.map(() => null) };
  }
  const parsed = parseAlgHtmlTokens(entry.algHtml);
  const text = parsed.map(p => p.text).join(' ');
  const marks = parsed.map(p => p.mark);
  return { text, marks };
}

/** Build AlgEntry from current text + marks. Drops trailing marks for ghost tokens. */
function buildEntry(text: string, marks: Mark[]): AlgEntry {
  const tokens = tokenize(text);
  const cleanText = tokens.join(' ');
  const hasMark = tokens.some((_, i) => marks[i]);
  if (!hasMark) return { alg: cleanText };
  const wrapped = tokens.map((tok, i) => {
    const m = marks[i] ?? null;
    if (m === 'u')    return `<u>${tok}</u>`;
    if (m === 'wavy') return `<u class="wavy">${tok}</u>`;
    if (m === 's')    return `<s>${tok}</s>`;
    return tok;
  });
  return { alg: cleanText, algHtml: wrapped.join(' ') };
}

interface RowProps {
  text: string;
  marks: Mark[];
  onChange: (text: string, marks: Mark[]) => void;
  onDelete: () => void;
  isZh: boolean;
  showDelete: boolean;
  placeholder?: string;
}

function AlgRowEditor({ text, marks, onChange, onDelete, isZh, showDelete, placeholder }: RowProps) {
  const tokens = tokenize(text);

  const handleTextChange = (newText: string) => {
    const oldTokens = tokens;
    const newTokens = tokenize(newText);
    // Preserve mark by position-AND-text match; otherwise reset to null.
    const newMarks: Mark[] = newTokens.map((tok, i) => (i < oldTokens.length && oldTokens[i] === tok ? (marks[i] ?? null) : null));
    onChange(newText, newMarks);
  };

  const cycleMark = (i: number) => {
    const padded = tokens.map((_, j) => marks[j] ?? null);
    padded[i] = nextMark(padded[i]);
    onChange(text, padded);
  };

  return (
    <div className="alg-token-row">
      <div className="alg-token-input-line">
        <input
          className="alg-token-input"
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={placeholder}
        />
        {showDelete && (
          <button type="button" className="alg-token-delete" onClick={onDelete} title={isZh ? '删除此条' : 'Delete row'}>
            <X size={14} />
          </button>
        )}
      </div>
      {tokens.length > 0 && (
        <div className="alg-token-chips" title={isZh ? '点 token 切换 下划/波浪/删除/无' : 'Tap a token to cycle marks'}>
          {tokens.map((tok, i) => {
            const m = marks[i] ?? null;
            return (
              <button
                key={i}
                type="button"
                className={`alg-token-chip alg-token-chip-${m ?? 'none'}`}
                onClick={() => cycleMark(i)}
              >
                {tok}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface AlgsTokenEditorProps {
  value: AlgEntry[];
  onChange: (entries: AlgEntry[]) => void;
  isZh: boolean;
}

export default function AlgsTokenEditor({ value, onChange, isZh }: AlgsTokenEditorProps) {
  const rows = value.length === 0 ? [{ alg: '' }] : value;
  const parsed = rows.map(parseEntry);

  const handleRowChange = (i: number, text: string, marks: Mark[]) => {
    const newParsed = [...parsed];
    newParsed[i] = { text, marks };
    onChange(newParsed.map(p => buildEntry(p.text, p.marks)));
  };

  const handleDelete = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    onChange(next.length === 0 ? [{ alg: '' }] : next);
  };

  const handleAdd = () => {
    onChange([...rows, { alg: '' }]);
  };

  return (
    <div className="alg-token-editor">
      {parsed.map((p, i) => (
        <AlgRowEditor
          key={i}
          text={p.text}
          marks={p.marks}
          onChange={(t, m) => handleRowChange(i, t, m)}
          onDelete={() => handleDelete(i)}
          isZh={isZh}
          showDelete={parsed.length > 1}
          placeholder={i === 0 ? "R U R' U'" : ''}
        />
      ))}
      <button type="button" className="alg-token-add" onClick={handleAdd}>
        <Plus size={14} /> {isZh ? '添加公式' : 'Add alg'}
      </button>
    </div>
  );
}
