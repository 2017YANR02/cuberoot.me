'use client';

/**
 * Landing-page site search — STUB port of packages/client/src/components/LandingSearch.tsx.
 *
 * Deferred from the full Vite original (which is 631 lines + a 473-line utils/site_search.ts
 * with dynamic indices for persons / comps / recons / glossary / alg-sets / stats / about /
 * stack tools, plus useSpeechToText + smart_paste). Porting all of that into client-next
 * would balloon this PR — and the static landing cards are by far the most-clicked search
 * targets anyway.
 *
 * What this stub does:
 *   - Free-text input filters the `cards` prop in memory (substring against name+section).
 *   - On Enter (or on dropdown click), navigates to the card's href via next/link.
 *   - Drop-zone for video files → setPendingVideo + router.push('/frame-count').
 *   - No speech, no smart paste, no person/comp/recon search.
 *
 * When the full search is needed, port site_search.ts in full as a follow-up.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Film, LayoutGrid } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { setPendingVideo } from '@/lib/pending-video';
import './landing_search.css';

export interface LandingSearchCard {
  id: string;
  href: string;
  internal: boolean;
  nameEn: string;
  nameZh: string;
  sectionTitleEn: string;
  sectionTitleZh: string;
}

interface Props {
  cards: LandingSearchCard[];
  lang: 'zh' | 'en';
}

const PLACEHOLDERS_ZH = [
  '今天从哪里开始?',
  '最近在参加什么比赛?',
  '想查谁的成绩?',
  '哪个项目的世界纪录?',
  '想看哪一年的统计?',
  '哪个公式还没背会?',
  '今天练 PLL 还是 OLL?',
];
const PLACEHOLDERS_EN = [
  'Where to start today?',
  'Which comp are you at?',
  'Look up a cuber?',
  'Find a world record?',
  'Browse stats by year?',
  'Which alg to drill?',
  'PLL or OLL today?',
];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function rotatingPlaceholder(isZh: boolean): string {
  const list = isZh ? PLACEHOLDERS_ZH : PLACEHOLDERS_EN;
  return list[dayOfYear(new Date()) % list.length];
}

function tokenize(q: string): string[] {
  const withBoundary = q
    .replace(/([^\x00-\x7F])([a-z0-9])/gi, '$1 $2')
    .replace(/([a-z0-9.])([^\x00-\x7F])/gi, '$1 $2');
  return withBoundary.split(/\s+/).map(t => t.trim()).filter(t => t.length > 0);
}

function allTokensIn(haystack: string, tokens: string[]): boolean {
  for (const t of tokens) if (!haystack.includes(t)) return false;
  return true;
}

export default function LandingSearch({ cards, lang }: Props) {
  const isZh = lang === 'zh';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const q = query.trim().toLowerCase();
  const tokens = useMemo(() => tokenize(q), [q]);

  const cardMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [];
    return cards.filter(c => {
      const hay = `${c.nameEn}\n${c.nameZh}\n${c.sectionTitleEn}\n${c.sectionTitleZh}`.toLowerCase();
      return allTokensIn(hay, tokens);
    });
  }, [cards, q, tokens]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const showDropdown = open && q !== '';

  const closeAfter = () => { setOpen(false); setQuery(''); };
  const goCard = (c: LandingSearchCard) => {
    closeAfter();
    if (c.internal) router.push(c.href);
    else window.location.href = c.href;
  };

  const onVideoFile = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('video/')) return;
    setPendingVideo(file);
    closeAfter();
    router.push('/frame-count');
  };

  return (
    <div className="landing-search" ref={wrapRef}>
      <div
        className={`landing-search-input${dragging ? ' is-drag-over' : ''}`}
        onDragOver={e => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          onVideoFile(e.dataTransfer.files[0]);
        }}
      >
        <button
          type="button"
          className="landing-search-plus"
          onClick={() => fileInputRef.current?.click()}
          title={isZh ? '上传视频数帧' : 'Upload video'}
          aria-label={isZh ? '上传视频' : 'Upload video'}
        >
          <Film size={18} strokeWidth={1.75} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={e => onVideoFile(e.target.files?.[0])}
        />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Enter' && cardMatches.length > 0) {
              goCard(cardMatches[0]);
            }
          }}
          placeholder={rotatingPlaceholder(isZh)}
        />
        {query !== '' && (
          <ClearButton
            onClick={() => setQuery('')}
            isZh={isZh}
            variant="standalone"
            className="landing-search-clear"
            preserveFocus
          />
        )}
        <Search size={16} strokeWidth={1.75} />
      </div>

      {showDropdown && (
        <div className="landing-search-panel">
          {cardMatches.length > 0 ? (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <LayoutGrid size={14} strokeWidth={1.75} />
                <h3>{isZh ? '页面' : 'Pages'}</h3>
              </div>
              <div className="landing-search-grid">
                {cardMatches.map(c => (
                  c.internal ? (
                    <Link
                      key={c.id}
                      href={c.href}
                      className="landing-search-item"
                      onClick={closeAfter}
                    >
                      <span className="landing-search-item-name">{isZh ? c.nameZh : c.nameEn}</span>
                      <span className="landing-search-item-meta">{isZh ? c.sectionTitleZh : c.sectionTitleEn}</span>
                    </Link>
                  ) : (
                    <a
                      key={c.id}
                      href={c.href}
                      className="landing-search-item"
                      onClick={closeAfter}
                    >
                      <span className="landing-search-item-name">{isZh ? c.nameZh : c.nameEn}</span>
                      <span className="landing-search-item-meta">{isZh ? c.sectionTitleZh : c.sectionTitleEn}</span>
                    </a>
                  )
                ))}
              </div>
            </section>
          ) : (
            <div className="landing-search-empty">
              {isZh ? '未找到匹配项' : 'No matches found.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
