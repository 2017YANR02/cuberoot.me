'use client';

// C1 — 盲拧记忆宫殿演示. A 4-step illustrated explainer of how blindfolded
// cubers memorize a cube (Speffz lettering -> word images -> a memory journey).
// Self-contained: schematic colored grid + letter overlays, no 3D image.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pause, Play } from 'lucide-react';
import { useT } from '../../../hooks/useT';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import { useInView, useReducedMotion } from './_hooks';
import './_MemoryPalace.css';

const STEP_COUNT = 4;
const AUTO_MS = 4200;

// One stylized face (the U/white face) of a scrambled cube, plus the Speffz
// sticker letters that ring it (A B C D clockwise from top-left, here laid on
// the visible 8 non-center stickers). The colors are the canonical WCA faces.
type CellSpec = { face: CubeFace; letter: string | null };

const FACE_LAYOUT: CellSpec[] = [
  { face: 'F', letter: 'A' },
  { face: 'R', letter: 'B' },
  { face: 'L', letter: 'C' },
  { face: 'D', letter: 'D' },
  { face: 'U', letter: null }, // center — no letter
  { face: 'B', letter: 'E' },
  { face: 'R', letter: 'F' },
  { face: 'L', letter: 'G' },
  { face: 'F', letter: 'H' },
];

const SOLVED_LAYOUT: CellSpec[] = Array.from({ length: 9 }, () => ({ face: 'U' as CubeFace, letter: null }));

function CubeGrid({ layout, lettered, reduced }: { layout: CellSpec[]; lettered: boolean; reduced: boolean }) {
  return (
    <div className="mp-grid" data-lettered={lettered}>
      {layout.map((c, i) => (
        <div key={i} className="mp-cell" style={{ background: CUBE_FILL[c.face] }}>
          {lettered && c.letter && (
            <span
              className="mp-letter"
              style={{
                color: CUBE_ON_FILL[c.face],
                opacity: reduced ? 1 : undefined,
                animationDelay: reduced ? '0s' : `${0.05 + i * 0.05}s`,
              }}
            >
              {c.letter}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MemoryPalace() {
  useTranslation();
  const t = useT();
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: true });
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  // auto-advance only once visible & playing & motion allowed
  useEffect(() => {
    if (!playing || !inView || reduced) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEP_COUNT), AUTO_MS);
    return () => clearTimeout(id);
  }, [playing, inView, reduced, step]);

  const go = useCallback((dir: 1 | -1) => {
    setPlaying(false);
    setStep((s) => Math.min(STEP_COUNT - 1, Math.max(0, s + dir)));
  }, []);

  const stepLabels = [
    t('看一眼', 'Glance'),
    t('编码', 'Encode', "編碼"),
    t('记路线', 'Walk it', "記路線"),
    t('蒙眼还原', 'Recall', "矇眼還原"),
  ];

  // letter -> vivid word "image" pairs (the building blocks of the journey)
  const pairs = [
    { a: 'A', b: 'F', faceA: 'F' as CubeFace, faceB: 'R' as CubeFace, zh: '斧头', en: 'Axe', noteZh: '砍向门口', noteEn: 'swung at the door' },
    { a: 'C', b: 'D', faceA: 'L' as CubeFace, faceB: 'D' as CubeFace, zh: '橙汁', en: 'Cider', noteZh: '洒在沙发', noteEn: 'spilled on the couch' },
    { a: 'G', b: 'H', faceA: 'L' as CubeFace, faceB: 'F' as CubeFace, zh: '蛋糕', en: 'Gateau', noteZh: '摆上厨房', noteEn: 'on the kitchen counter' },
  ];

  const journey = [
    { placeZh: '门口', placeEn: 'Doorway', wordZh: '斧头', wordEn: 'Axe' },
    { placeZh: '沙发', placeEn: 'Couch', wordZh: '橙汁', wordEn: 'Cider' },
    { placeZh: '厨房', placeEn: 'Kitchen', wordZh: '蛋糕', wordEn: 'Gateau' },
  ];

  const eyebrow = `${t('步骤', 'Step', "步驟")} ${step + 1} / ${STEP_COUNT}`;

  const titles = [
    t('先看一眼', 'Take one good look'),
    t('把贴纸变成字母', 'Turn stickers into letters', "把貼紙變成字母"),
    t('沿熟悉的路线安放', 'Hang them along a route', "沿熟悉的路線安放"),
    t('蒙眼,凭记忆还原', 'Blindfold on, recall it', "矇眼,憑記憶還原"),
  ];

  const descs = [
    <>
      {t('盲拧选手在戴眼罩前,只有几十秒观察打乱。', 'Before the blindfold goes on, a solver has only seconds to study the scramble. ', "盲擰選手在戴眼罩前,只有幾十秒觀察打亂。")}
      <b>{t('不需要过目不忘的超强记忆力——靠的是一套可以学的编码方法。', 'No photographic memory — just a learnable encoding system.', "不需要過目不忘的超強記憶力——靠的是一套可以學的編碼方法。")}</b>
    </>,
    <>
      {t('每个贴纸位置都有一个固定字母(Speffz 记号)。字母', 'Each sticker position carries a fixed letter (Speffz lettering). Letters pair up — ', "每個貼紙位置都有一個固定字母(Speffz 記號)。字母")}
      <b>{t('两两成对', 'two at a time', "兩兩成對")}</b>
      {t(',再把每对变成一个鲜明的词或画面。', ' — and every pair becomes a vivid word or picture.', ",再把每對變成一個鮮明的詞或畫面。")}
    </>,
    <>
      {t('把这些画面挂到一条熟悉的路线上——这就是', 'Place those pictures along a familiar route — this is the ', "把這些畫面掛到一條熟悉的路線上——這就是")}
      <b>{t('记忆宫殿', 'memory palace', "記憶宮殿")}</b>
      {t('。走一遍门口、沙发、厨房,顺序就记住了。', '. Walk the doorway, couch, kitchen, and the order sticks.', "。走一遍門口、沙發、廚房,順序就記住了。")}
    </>,
    <>
      {t('戴上眼罩,沿着同一条路线把画面取回来,逐对还原。', 'With the blindfold on, retrace the same route, recall each image, and solve pair by pair. ', "戴上眼罩,沿著同一條路線把畫面取回來,逐對還原。")}
      <b>{t('这是技巧,不是天赋。', "It's a technique, not innate talent.", "這是技巧,不是天賦。")}</b>
    </>,
  ];

  const animClass = reduced ? '' : 'mp-anim';

  return (
    <div ref={ref} className={`mp-root${reduced ? ' mp-reduced' : ''}`}>
      {/* stepper header */}
      <div className="mp-bar">
        <div className="mp-dots">
          {stepLabels.map((label, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="mp-dot-line" data-done={i <= step ? 'true' : 'false'} aria-hidden />}
              <button
                type="button"
                className="mp-dot"
                data-state={i === step ? 'active' : i < step ? 'done' : 'todo'}
                onClick={() => {
                  setPlaying(false);
                  setStep(i);
                }}
                aria-label={`${t('步骤', 'Step', "步驟")} ${i + 1}: ${label}`}
                aria-current={i === step}
              >
                <span className="mp-dot-mark">{i + 1}</span>
                <span className="mp-dot-label">{label}</span>
              </button>
            </span>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            className="mp-play"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t('暂停', 'Pause', "暫停") : t('自动播放', 'Auto-play', "自動播放")}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            <span>{playing ? t('暂停', 'Pause', "暫停") : t('自动播放', 'Play', "自動播放")}</span>
          </button>
        )}
      </div>

      {/* stage */}
      <div className="mp-stage">
        <div className="mp-stage-text">
          <div className="mp-eyebrow">{eyebrow}</div>
          <div className="mp-title" key={`tt-${step}`}>
            <span className={animClass}>{titles[step]}</span>
          </div>
          <p className="mp-desc" key={`ds-${step}`}>
            <span className={animClass}>{descs[step]}</span>
          </p>
        </div>

        <div className="mp-stage-visual" key={`vz-${step}`}>
          {/* Step 1 & 4 share the cube; 2 lettered cube; 3 the journey */}
          {step === 0 && (
            <div className={`mp-cube ${animClass}`}>
              <CubeGrid layout={FACE_LAYOUT} lettered={false} reduced={reduced} />
            </div>
          )}

          {step === 1 && (
            <div className={`mp-pairs ${animClass}`}>
              <div className="mp-cube" data-lettered="true" style={{ width: '8.5rem', margin: '0 auto 0.4rem' }}>
                <CubeGrid layout={FACE_LAYOUT} lettered reduced={reduced} />
              </div>
              {pairs.map((p) => (
                <div className="mp-pair" key={p.a + p.b}>
                  <div className="mp-pair-letters">
                    <span className="mp-chip" style={{ background: CUBE_FILL[p.faceA], color: CUBE_ON_FILL[p.faceA] }}>{p.a}</span>
                    <span className="mp-chip" style={{ background: CUBE_FILL[p.faceB], color: CUBE_ON_FILL[p.faceB] }}>{p.b}</span>
                  </div>
                  <ChevronRight size={16} className="mp-pair-arrow" aria-hidden />
                  <div className="mp-pair-word">
                    {t(p.zh, p.en)}
                    <small>{t(p.noteZh, p.noteEn)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className={`mp-journey ${animClass}`}>
              {journey.map((s, i) => (
                <div className="mp-stop" key={s.placeEn}>
                  <div className="mp-stop-node">
                    <span className="mp-stop-bead" />
                    {i < journey.length - 1 && <span className="mp-stop-rail" />}
                  </div>
                  <div
                    className={reduced ? 'mp-stop-body' : 'mp-stop-body mp-stagger'}
                    style={reduced ? undefined : { animationDelay: `${0.1 + i * 0.18}s` }}
                  >
                    <span className="mp-stop-place">{t(s.placeZh, s.placeEn)}</span>
                    <span className="mp-stop-word">{t(s.wordZh, s.wordEn)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className={`mp-cube ${animClass}`}>
              <CubeGrid layout={SOLVED_LAYOUT} lettered={false} reduced={reduced} />
              <div className="mp-blindfold">
                <EyeOff size={34} className="mp-blindfold-icon" aria-hidden />
              </div>
              <div className="mp-solved-tag">
                <Eye size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden />
                {t('眼罩之下,已经还原', 'Solved, sight unseen', "眼罩之下,已經還原")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* footer nav */}
      <div className="mp-nav">
        <button type="button" className="mp-btn" onClick={() => go(-1)} disabled={step === 0}>
          <ChevronLeft size={18} />
          {t('上一步', 'Back')}
        </button>
        <button type="button" className="mp-btn mp-btn-primary" onClick={() => go(1)} disabled={step === STEP_COUNT - 1}>
          {t('下一步', 'Next')}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
