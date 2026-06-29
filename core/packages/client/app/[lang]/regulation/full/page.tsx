'use client';

// /regulation/full — a verbatim, self-hosted mirror of the official WCA
// Regulations: the full combined document in one page, English text alongside
// the official Chinese translation. The text is built into
// _data/reg-clauses/_full.json from the official CC BY 3.0 sources
// (scripts/build-reg-clauses.mjs) with no paraphrase, so it can be regenerated /
// auto-synced when the regs change. Every clause carries an id (#4d, #A4d1) and
// every official cross-reference resolves to an in-page anchor, so other pages on
// this site can deep-link the rules without leaving for worldcubeassociation.org.

import type { ReactNode } from 'react';
import { ChevronLeft, ArrowUp } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { useT } from '../../../../hooks/useT';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { REG_ARTICLES } from '../_data/articles';
import doc from '../_data/reg-clauses/_full.json';
import '../regulation.css';
import './reg-full.css';

const byNum = new Map(REG_ARTICLES.map((a) => [a.num, a]));

const REG = 'regulations:regulation:';
const ART = 'regulations:article:';
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
// Leading label tag: ALL-CAPS (EN) or 2–4 CJK chars (ZH), and not a markdown link.
const TAG_RE = /^\[([A-Z][A-Z ]{2,}|[一-鿿]{2,4})\](?!\()\s*/;

// Render clause / note text to nodes. `[label](target)` spans become in-page
// anchors (official cross-refs), external links, or plain label text. When
// `selfId` is given, every plain-text run is wrapped in its own anchor to this
// clause — so clicking anywhere on the text deep-links the clause, while cross-
// references stay as separate sibling anchors (never nested, still selectable).
function renderRich(text: string, selfId?: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  const pushText = (s: string) => {
    if (!s) return;
    if (selfId) out.push(<a key={k++} href={`#${selfId}`} className="reg-cl-self">{s}</a>);
    else out.push(s);
  };
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text))) {
    if (m.index > last) pushText(text.slice(last, m.index));
    const [, label, target] = m;
    if (target.startsWith(REG)) {
      out.push(<a key={k++} className="reg-doc-xref" href={`#${target.slice(REG.length)}`}>{label}</a>);
    } else if (target.startsWith(ART)) {
      out.push(<a key={k++} className="reg-doc-xref" href={`#article-${target.slice(ART.length)}`}>{label}</a>);
    } else if (/^(https?:|mailto:)/.test(target)) {
      out.push(<a key={k++} href={target} target="_blank" rel="noopener noreferrer">{label}</a>);
    } else {
      pushText(label);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

// Clause / note line: lift a leading [LABEL] into a badge, then render the rest.
function RichText({ text, selfId }: { text: string; selfId?: string }) {
  const tag = text.match(TAG_RE);
  const body = tag ? text.slice(tag[0].length) : text;
  return (
    <>
      {tag
        ? selfId
          ? <a href={`#${selfId}`} className="reg-doc-tag">{tag[1]}</a>
          : <span className="reg-doc-tag">{tag[1]}</span>
        : null}
      {renderRich(body, selfId)}
    </>
  );
}

function NoteBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((blk, i) => {
        const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length && lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="reg-doc-note-list">
              {lines.map((l, j) => (
                <li key={j}><RichText text={l.slice(2)} /></li>
              ))}
            </ul>
          );
        }
        return <p key={i}><RichText text={lines.join(' ')} /></p>;
      })}
    </>
  );
}

export default function RegulationFull() {
  const t = useT(); // subscribes to language changes so tr() picks the live locale
  useDocumentTitle('WCA 竞赛规则 · 全文', 'WCA Regulations · Full text');

  const version = tr(doc.version);

  return (
    <div className="reg-page" id="top">
      <div className="reg-wrap reg-doc">
        <Link href="/regulation" className="reg-crumb">
          <ChevronLeft size={16} /> {t('WCA 竞赛规则', 'WCA Regulations')}
        </Link>

        <header className="reg-hero">
          <div className="reg-eyebrow">
            <img src="/icons/wca.svg" alt="WCA" />
            {t('官方规则全文 · 中英对照', 'Official full text')}
          </div>
          <h1 className="reg-title">
            WCA <span className="reg-code">{t('竞赛规则', 'Regulations')}</span>
          </h1>
          <p className="reg-doc-version">{t(`版本：${version}`, `Version: ${version}`)}</p>
          <p className="reg-doc-attr">
            {t('依据 ', 'Per the ')}
            <a href="https://www.worldcubeassociation.org/regulations/full/" target="_blank" rel="noopener noreferrer">
              {t('WCA 官方规则', 'official WCA Regulations')}
            </a>
            {t(',以 ', ', licensed under ')}
            <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>
            {t(
              ' 授权转载。翻译仅供参考,如与英文原文有出入,以英文为准。',
              '. Translations are for reference; if a translation differs from the official English, the English text is authoritative.',
            )}
          </p>
        </header>

        <section className="reg-doc-notes">
          {doc.notes.map((n, i) => {
            const note = tr(n);
            return (
              <div className="reg-doc-note" key={i}>
                <h3 className="reg-doc-note-h">{note.heading}</h3>
                <NoteBody body={note.body} />
              </div>
            );
          })}
        </section>

        <nav className="reg-doc-toc" aria-label={t('目录', 'Contents')}>
          {doc.articles.map((a) => {
            const Icon = byNum.get(a.id)?.Icon;
            return (
              <a key={a.id} href={`#article-${a.id}`} className="reg-doc-toc-item">
                {Icon ? <Icon size={16} /> : null}
                <span>{tr(a.heading)}</span>
              </a>
            );
          })}
        </nav>

        {doc.articles.map((a) => {
          const Icon = byNum.get(a.id)?.Icon;
          return (
            <section key={a.id} id={`article-${a.id}`} className="reg-doc-art">
              <h2 className="reg-doc-art-h">
                {Icon ? <span className="reg-doc-art-icon"><Icon size={22} /></span> : null}
                <a href={`#article-${a.id}`} className="reg-doc-art-anchor">{tr(a.heading)}</a>
              </h2>
              <ol className="reg-doc-clauses">
                {a.clauses.map((c) => (
                  <li
                    key={c.id}
                    id={c.id}
                    className="reg-cl"
                    data-depth={Math.min(c.depth, 4)}
                    data-guide={c.id.endsWith('+') ? '' : undefined}
                    style={{ ['--d' as string]: Math.min(c.depth, 4) }}
                  >
                    <a href={`#${c.id}`} className="reg-cl-id">{c.id}</a>
                    <span className="reg-cl-text"><RichText text={tr(c)} selfId={c.id} /></span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        <footer className="reg-footer">
          <p className="reg-foot-note">
            {t(
              `本页镜像 WCA《竞赛规则》(${version}) 官方全文,依据 CC BY 3.0 授权转载。中文为 WCA 官方翻译,仅供参考;如与英文原文有出入,以英文为准。`,
              `This page mirrors the official WCA Regulations (${version}) under CC BY 3.0. The Chinese text is the official WCA translation, provided for reference; if it differs from the official English, the English text is authoritative.`,
            )}{' '}
            <a href="https://www.worldcubeassociation.org/regulations/full/" target="_blank" rel="noopener noreferrer">
              {t('WCA 官网原文', 'Official source')}
            </a>
          </p>
        </footer>

        <a href="#top" className="reg-fab" aria-label={t('回到顶部', 'Back to top')}>
          <ArrowUp size={20} />
        </a>
      </div>
    </div>
  );
}
