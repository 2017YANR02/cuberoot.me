'use client';

import { useEffect, useState } from 'react';
import { loadAlg } from '@cuberoot/shared';
import Link from '@/components/AppLink';
import { CaseThumb } from '@/components/CaseThumb';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import { sq1TopLayerQuestions } from '@/lib/recognize-sq1-shapes';
import { SQ1_SHAPE_GUIDE } from './guide-content';
import './guide.css';

type ShapeQuestion = ReturnType<typeof sq1TopLayerQuestions>[number];

export default function Sq1ShapeGuideClient() {
  const [shapes, setShapes] = useState<ShapeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const mobile = useIsMobile(480);
  const thumbSize = mobile ? 108 : 142;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    loadAlg('sq1', 'cs')
      .then((file) => {
        if (!active) return;
        setShapes(sq1TopLayerQuestions(file.cases));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  return (
    <main className="recognition-guide-page">
      <header className="recognition-guide-hero">
        <div className="recognition-guide-heading">
          <span className="recognition-guide-set-mark" aria-hidden>SQ1</span>
          <div>
            <p className="recognition-guide-kicker">{tr(SQ1_SHAPE_GUIDE.kicker)}</p>
            <h1>{tr(SQ1_SHAPE_GUIDE.title)}</h1>
            <p className="recognition-guide-intro">{tr(SQ1_SHAPE_GUIDE.intro)}</p>
          </div>
        </div>

        <div className="recognition-guide-actions">
          <Link href="/recognize/sq1-shape" className="recognition-guide-primary-link" prefetch={false}>
            {tr({ zh: '开始形状训练', en: 'Start shape drill' })}
          </Link>
          <Link href="/alg/sq1/cs" className="recognition-guide-text-link" prefetch={false}>
            {tr({ zh: '查看 CS 公式库', en: 'Open the CS algorithm set' })}
          </Link>
        </div>
      </header>

      <section className="recognition-guide-library" aria-labelledby="sq1-shape-library-title">
        <div className="recognition-guide-library-head">
          <div>
            <p className="recognition-guide-kicker">{tr({ zh: '形状图鉴', en: 'Shape library' })}</p>
            <h2 id="sq1-shape-library-title">{tr(SQ1_SHAPE_GUIDE.libraryTitle)}</h2>
          </div>
        </div>
        <p className="recognition-guide-simplified-note">{tr(SQ1_SHAPE_GUIDE.libraryNote)}</p>

        {loading && (
          <p className="recognition-guide-status">{tr({ zh: '正在加载形状…', en: 'Loading shapes…' })}</p>
        )}
        {error && (
          <div className="recognition-guide-status">
            <p>{tr({ zh: '形状加载失败，请重试。', en: 'Shapes could not be loaded. Try again.' })}</p>
            <button className="recognition-guide-retry" type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {tr({ zh: '重新加载', en: 'Reload' })}
            </button>
          </div>
        )}

        {shapes.length > 0 && (
          <div className="recognition-guide-grid">
            {shapes.map(({ name, source }, index) => (
              <article className="recognition-guide-case recognition-guide-shape" key={name}>
                <span className="recognition-guide-case-art">
                  <CaseThumb
                    puzzle="sq1"
                    set="cs"
                    sticker={source.sticker}
                    alg={source.algs.flat()[0]?.alg ?? source.standard ?? ''}
                    setup={source.setup}
                    size={thumbSize}
                    local
                    sq1Layer="top"
                    loading={index < (mobile ? 4 : 7) ? 'eager' : 'lazy'}
                  />
                </span>
                <strong>{name}</strong>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
