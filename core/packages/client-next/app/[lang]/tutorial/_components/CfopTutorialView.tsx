'use client';

/**
 * CfopTutorialView — CFOP 教程「精美版」:hero + 粘性目录(滚动高亮)+ 阅读进度 + 分节正文。
 * 内容来自 restructureCfop(原始 JSON 不动),正文交给 CfopContent 渲染。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { List, X } from 'lucide-react';
import Link from '@/components/AppLink';
import type { ArticlePostContent } from '../_lib/useTutorialCatalog';
import { tutorialMediaUrl } from '../_lib/useTutorialCatalog';
import { restructureCfop } from '../_lib/restructureCfop';
import { CfopContent } from './CfopContent';
import { tr } from '@/i18n/tr';

export function CfopTutorialView({ post }: { post: ArticlePostContent }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const rawHtml = post.content.en ?? post.content.zh ?? '';

  const { hero, bodyHtml, toc } = useMemo(() => restructureCfop(rawHtml), [rawHtml]);

  const [active, setActive] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 滚动高亮当前章节
  useEffect(() => {
    if (!toc.length) return;
    const els = toc
      .map(t => document.getElementById(t.id))
      .filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const visible = new Map<string, number>();
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (visible.size) {
          // 选离视口顶部最近的可见锚点
          const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
          setActive(top);
        }
      },
      { rootMargin: '-72px 0px -65% 0px', threshold: 0 },
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [toc, bodyHtml]);

  // 阅读进度
  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeLabel = useMemo(() => {
    const t = toc.find(x => x.id === active);
    return t ? (isZh ? t.zh : t.en) : tr({ zh: '目录', en: 'Contents'
    });
  }, [active, toc, isZh]);

  return (
    <div className={'cfop-pretty' + (isZh ? '' : ' is-en')}>
      <div className="cfop-progress" aria-hidden>
        <div className="cfop-progress-bar" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {hero && (
        <header className="cfop-hero">
          <div className="cfop-hero-badge">CFOP</div>
          <h1 className="cfop-hero-title">{isZh ? hero.titleZh : hero.titleEn}</h1>
          <p className="cfop-hero-sub">{isZh ? hero.titleEn : hero.titleZh}</p>
          {(hero.intro.zh || hero.intro.en) && (
            <div className="cfop-hero-intro">
              {isZh ? (
                <>
                  {hero.intro.zh && <p>{hero.intro.zh}</p>}
                  {hero.intro.en && <p className="cfop-hero-intro-alt">{hero.intro.en}</p>}
                </>
              ) : (
                <>
                  {hero.intro.en && <p>{hero.intro.en}</p>}
                  {hero.intro.zh && <p className="cfop-hero-intro-alt">{hero.intro.zh}</p>}
                </>
              )}
            </div>
          )}
          {hero.pillars.length > 0 && (
            <ol className="cfop-pillars">
              {hero.pillars.map((p, i) => {
                const inner = (
                  <>
                    <span className="cfop-pillar-step">{i + 1}</span>
                    <span className="cfop-pillar-img">
                      {p.img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tutorialMediaUrl(p.img)} alt={p.label} loading="lazy" decoding="async" />
                      )}
                    </span>
                    <span className="cfop-pillar-label">{p.label}</span>
                  </>
                );
                return (
                  <li key={i} className="cfop-pillar">
                    {p.href ? (
                      <Link href={p.href} className="cfop-pillar-link">
                        {inner}
                      </Link>
                    ) : (
                      <div className="cfop-pillar-link is-static">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </header>
      )}

      <div className="cfop-layout">
        {toc.length > 0 && (
          <>
            {/* 移动端粘性目录条 */}
            <div className="cfop-toc-mobilebar">
              <button
                className="cfop-toc-mobilebtn"
                onClick={() => setTocOpen(o => !o)}
                aria-expanded={tocOpen}
              >
                {tocOpen ? <X size={16} /> : <List size={16} />}
                <span className="cfop-toc-current">{activeLabel}</span>
              </button>
            </div>

            <aside className={'cfop-toc' + (tocOpen ? ' is-open' : '')}>
              <div className="cfop-toc-title">{tr({ zh: '目录', en: 'Contents'
            })}</div>
              <nav>
                {toc.map(t => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    onClick={jump(t.id)}
                    className={
                      'cfop-toc-item' +
                      (t.level === 2 ? ' is-sub' : '') +
                      (active === t.id ? ' is-active' : '')
                    }
                  >
                    {isZh ? t.zh : t.en}
                  </a>
                ))}
              </nav>
            </aside>
            {tocOpen && <div className="cfop-toc-scrim" onClick={() => setTocOpen(false)} />}
          </>
        )}

        <div className="cfop-body" ref={bodyRef}>
          <CfopContent html={bodyHtml} />
        </div>
      </div>
    </div>
  );
}
