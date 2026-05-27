'use client';

/**
 * KaTeX wrappers used across the God's-number page + sub-components.
 *
 * `<TeX>` / `<TeXBlock>` for explicit math sources; `<MathText>` auto-scans
 * a plain string for common math patterns (scientific notation, subscripts,
 * inequalities, subgroup brackets, asymptotic notation) and renders the
 * detected fragments via KaTeX. Designed for the prose embedded in
 * `god_data.ts` / `god_deep_data.ts` where math is mixed with running text.
 */
import { Fragment, useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function TeX({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }),
    [src],
  );
  return <span className="god-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function TeXBlock({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }),
    [src],
  );
  return <span className="god-tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

const SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  'ᵏ': 'k', '⁻': '-', '⁺': '+',
};
const SUB_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};
const fromMap = (m: Record<string, string>) => (s: string) => s.split('').map((c) => m[c] ?? c).join('');
const fromSup = fromMap(SUP_MAP);
const fromSub = fromMap(SUB_MAP);

// Patterns are tried in priority order. Each match consumes its span. The
// `tex` field is a function from the match groups to the KaTeX source string.
interface Pattern { re: RegExp; tex: (m: RegExpExecArray) => string }
const PATTERNS: Pattern[] = [
  // (a × 10ⁿ)ᵏ — parenthesised scientific raised to k
  { re: /\((\d+(?:\.\d+)?)\s*×\s*10([⁰-⁹⁻⁺]+)\)([ᵏ⁰-⁹]+)/gu, tex: (m) => `\\bigl(${m[1]} \\times 10^{${fromSup(m[2])}}\\bigr)^{${fromSup(m[3])}}` },
  // a × 10ⁿ — scientific
  { re: /(\d+(?:\.\d+)?)\s*×\s*10([⁰-⁹⁻⁺]+)/gu, tex: (m) => `${m[1]} \\times 10^{${fromSup(m[2])}}` },
  // ⟨...⟩ — subgroup generators (greedy until matching ⟩)
  { re: /⟨([^⟩]+)⟩/gu, tex: (m) => `\\langle ${cleanSubgroup(m[1])} \\rangle` },
  // Asymptotic Θ/O/Ω/o/ω followed by parenthesised expression
  { re: /([ΘOΩoω])\(([^()]*?)\)/gu, tex: (m) => `${asympPrefix(m[1])}\\!\\left(${cleanExpr(m[2])}\\right)` },
  // a^(b) — explicit caret exponent like M^(d-1)
  { re: /([A-Za-z])\^\(([^()]+)\)/gu, tex: (m) => `${m[1]}^{${m[2]}}` },
  // Letter + unicode subscript: S₄₈, G₀
  { re: /([A-Z])([₀-₉]+)/gu, tex: (m) => `${m[1]}_{${fromSub(m[2])}}` },
  // Number + unicode superscript: 3⁶, 2²⁷ (also covers 24⁶, 10⁸²)
  { re: /(\d+)([⁰-⁹]+)/gu, tex: (m) => `${m[1]}^{${fromSup(m[2])}}` },
  // ≤ n / ≥ n where n is a number (or letter)
  { re: /≤\s*([0-9A-Za-z]+)/gu, tex: (m) => `\\le ${m[1]}` },
  { re: /≥\s*([0-9A-Za-z]+)/gu, tex: (m) => `\\ge ${m[1]}` },
];

function asympPrefix(s: string): string {
  if (s === 'Θ') return '\\Theta';
  if (s === 'Ω') return '\\Omega';
  if (s === 'ω') return '\\omega';
  return s; // 'O' / 'o' rendered as-is
}

function cleanExpr(s: string): string {
  return s
    .replace(/(\d+)([⁰-⁹]+)/gu, (_m, b, sup) => `${b}^{${fromSup(sup)}}`)
    .replace(/([A-Za-z])([⁰-⁹]+)/gu, (_m, b, sup) => `${b}^{${fromSup(sup)}}`)
    .replace(/([A-Z])([₀-₉]+)/gu, (_m, b, sub) => `${b}_{${fromSub(sub)}}`)
    .replace(/log/g, '\\log')
    .replace(/·/g, ' \\cdot ')
    .replace(/×/g, ' \\times ');
}

function cleanSubgroup(s: string): string {
  // Inside ⟨...⟩ : letters / commas / L² R² etc.
  return s
    .replace(/([A-Z])([⁰-⁹]+)/gu, (_m, b, sup) => `${b}^{${fromSup(sup)}}`)
    .replace(/(\d+)([⁰-⁹]+)/gu, (_m, b, sup) => `${b}^{${fromSup(sup)}}`)
    .replace(/\s+/g, ' ')
    .trim();
}

interface Match { start: number; end: number; tex: string }

/** Render a string with embedded math patterns auto-detected. Returns an array
 *  of plain-string segments interleaved with <TeX> nodes. Use as children. */
export function MathText({ children }: { children: string }) {
  // Collect non-overlapping matches across all patterns.
  const matches: Match[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(children)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (matches.some((x) => !(end <= x.start || start >= x.end))) continue;
      matches.push({ start, end, tex: p.tex(m) });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const out: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (cursor < m.start) out.push(<Fragment key={`t${i}`}>{children.slice(cursor, m.start)}</Fragment>);
    out.push(<TeX key={`m${i}`} src={m.tex} />);
    cursor = m.end;
  });
  if (cursor < children.length) out.push(<Fragment key="tail">{children.slice(cursor)}</Fragment>);
  return <>{out}</>;
}
