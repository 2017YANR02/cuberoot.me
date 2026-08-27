'use client';

/**
 * 拍照识别 —— 相机 / 相册取样界面,二阶三阶共用(spec 驱动)。
 *
 * 这里只管「怎么把 6 张照片变成 6·n² 个取样色」:开相机、把取景框对到画面正中的正方形、
 * 按 SCAN_STEPS 一面一面拍、每格取中位色。认色那步全在 lib/cube-photo(纯逻辑、有 fixture 测试)。
 *
 * 取景几何是**所见即所取**的:容器钉成正方形 + video/img 走 object-fit:cover,于是画面正中那块
 * 边长 min(源宽,源高)·BOX_RATIO 的正方形,恰好就是屏幕上白框圈住的那块 —— 取样直接按这个源区域裁。
 *
 * 默认先写回画板核对;调用方也可给识别结果附加明确的求解操作。拍歪一格就是另一个状态,
 * 所以不会在识别完成时静默开算。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, Images, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useT } from '@/hooks/useT';
import { SCAN_STEPS, classifyScan, sampleGridColors, type RGB, type ScanResult, type PhotoFace } from '@/lib/cube-photo';
import { COLOR_HEX, EMPTY_COLOR_HEX, faceletIdx, FACES, type FaceLetter, type PaintSpec } from './_paint-shared';

/** 取景框边长占画面短边的比例(与取样区域是同一个数,别分开改)。 */
const BOX_RATIO = 0.62;
/** 取样时把取景框重采样成多大(足够每格几十个像素取中位数,又不至于 getImageData 太慢)。 */
const CAPTURE_PX = 300;
/** 实时预览取样的分辨率与节流间隔 —— 只是给用户看对没对准,不用高精度。 */
const LIVE_PX = 96;
const LIVE_MS = 160;

const FACE_COLOR: Record<PhotoFace, { zh: string; en: string }> = {
  U: { zh: '白', en: 'white' },
  R: { zh: '红', en: 'red' },
  F: { zh: '绿', en: 'green' },
  D: { zh: '黄', en: 'yellow' },
  L: { zh: '橙', en: 'orange' },
  B: { zh: '蓝', en: 'blue' },
};

const hex = (c: readonly [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export interface PhotoScannerProps {
  spec: PaintSpec;
  /** 认出来的 facelet(未必物理合法)→ 写进画板。 */
  onApply: (facelet: string) => void;
  /** 可选的结果操作;只在六面识别完成后渲染。 */
  resultActions?: (facelet: string) => ReactNode;
  pixelSize: number;
}

export default function PhotoScanner({ spec, onApply, resultActions, pixelSize }: PhotoScannerProps) {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const n = spec.n;
  const per = n * n;
  const palette = spec.colors ?? COLOR_HEX;

  const [shots, setShots] = useState<(RGB[] | null)[]>(() => SCAN_STEPS.map(() => null));
  const [step, setStep] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [camNonce, setCamNonce] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState<RGB[] | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const done = shots.every(Boolean);
  const stageSize = Math.max(240, Math.min(420, pixelSize));

  /** 把任意画面的正中方框重采样到 size×size,取出 n² 个格子的中位色。 */
  const sampleFrom = useCallback((src: CanvasImageSource, sw: number, sh: number, size: number): RGB[] | null => {
    if (!sw || !sh) return null;
    const canvas = workRef.current ?? (workRef.current = document.createElement('canvas'));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const side = Math.min(sw, sh) * BOX_RATIO;
    ctx.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
    return sampleGridColors(ctx.getImageData(0, 0, size, size).data, size, n);
  }, [n]);

  // 相机:拍摄阶段才开,6 张齐了立刻关(省电、也别一直亮着指示灯)。
  useEffect(() => {
    if (done) return;
    let cancelled = false;
    const start = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCamError(t('这个浏览器不支持网页相机,可以改用「从相册选」。', 'This browser has no camera API — use "From photos" instead.'));
        return;
      }
      try {
        const got = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        });
        if (cancelled) { got.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = got;
        setCamError(null);
        // 挂流交给下面那个 effect:报错时 <video> 根本没渲染(被错误提示替掉了),此刻
        // videoRef 还是空的,直接挂会静默丢流 —— 「重试」按钮就是这么坏的。
        setStream(got);
      } catch (e) {
        if (cancelled) return;
        const name = (e as Error).name;
        setCamError(name === 'NotAllowedError'
          ? t('相机权限被拒绝。到浏览器地址栏的站点设置里允许摄像头后重试,或改用「从相册选」。',
            'Camera permission denied. Allow it in the site settings, or use "From photos".')
          : name === 'NotFoundError'
            ? t('没找到摄像头,可以改用「从相册选」。', 'No camera found — use "From photos" instead.')
            : t(`相机打不开(${name})。可以改用「从相册选」。`, `Cannot open the camera (${name}) — use "From photos" instead.`));
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setStream(null);
    };
  }, [done, camNonce, t]);

  // 流拿到之后才轮到 <video>(它要 camError 清空那一轮渲染完才在 DOM 里)。
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    void v.play().catch(() => { /* 自动播放被拦 / 用户切走 —— 「重试」兜底 */ });
  }, [stream]);

  // 实时预览:每 160ms 取一次当前帧的格子色,让用户知道框有没有对上贴纸。
  useEffect(() => {
    if (done || camError) { setLive(null); return; }
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      setLive(sampleFrom(v, v.videoWidth, v.videoHeight, LIVE_PX));
    }, LIVE_MS);
    return () => clearInterval(timer);
  }, [done, camError, sampleFrom]);

  const commit = useCallback((cells: RGB[]) => {
    setShots((prev) => {
      const next = [...prev];
      next[step] = cells;
      return next;
    });
    setStep((s) => {
      for (let k = 1; k <= SCAN_STEPS.length; k++) {
        const cand = (s + k) % SCAN_STEPS.length;
        if (cand !== s && !shots[cand]) return cand;
      }
      return s;
    });
  }, [step, shots]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const cells = sampleFrom(v, v.videoWidth, v.videoHeight, CAPTURE_PX);
    if (cells) commit(cells);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const cells = sampleFrom(img, img.naturalWidth, img.naturalHeight, CAPTURE_PX);
      URL.revokeObjectURL(url);
      if (cells) commit(cells);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setCamError(t('这张图片读不出来,换一张试试。', 'Could not read that image — try another one.'));
    };
    img.src = url;
  };

  // 6 张齐了就认色(纯计算,几毫秒)。
  useEffect(() => {
    if (!shots.every(Boolean)) { setResult(null); return; }
    try {
      setResult(classifyScan(shots as RGB[][], n));
    } catch {
      setResult(null); // 张数/格数对不上是编程错误,不该发生;真发生了就当没拍完
    }
  }, [shots, n]);

  const reset = () => {
    setShots(SCAN_STEPS.map(() => null));
    setStep(0);
    setResult(null);
  };

  const validErr = useMemo(() => {
    if (!result) return null;
    const raw = spec.validate(result.facelet);
    return raw ? spec.friendlyErr(raw, isZh) : null;
  }, [result, spec, isZh]);

  const cur = SCAN_STEPS[step];
  const motionText = (() => {
    if (cur.motion === 'start') {
      return n === 3
        ? t('把魔方举进框里', 'Hold the cube inside the box')
        : t('任选一面开始,举进框里', 'Pick any face to start and hold it in the box');
    }
    if (cur.motion === 'roll') return t('向后翻 90°(顶面推离镜头)', 'Roll 90° back (top away from the camera)');
    if (cur.motion === 'turnLeft') return t('向左转 90°', 'Turn 90° to the left');
    return t('再向左转 180°', 'Turn another 180° to the left');
  })();
  const faceText = n === 3
    ? t(`${FACE_COLOR[cur.face].zh}色朝镜头,${FACE_COLOR[cur.top].zh}色朝上`,
      `${FACE_COLOR[cur.face].en} to the camera, ${FACE_COLOR[cur.top].en} on top`)
    : null;

  return (
    <div className="photo-scan">
      <style>{INLINE_CSS}</style>

      {!done ? (<>
        <div className="ps-hint">
          <span className="ps-hint-step">{t(`第 ${step + 1}/6 面`, `Face ${step + 1} of 6`)}</span>
          <span className="ps-hint-motion">{motionText}</span>
          {faceText && <span className="ps-hint-face">{faceText}</span>}
        </div>

        <div className="ps-stage" style={{ width: stageSize, height: stageSize }}>
          {camError ? (
            <div className="ps-camerr">
              <span>{camError}</span>
              <button type="button" className="ps-btn" onClick={() => setCamNonce((v) => v + 1)}>
                <RefreshCw size={14} />{t('重试', 'Retry')}
              </button>
            </div>
          ) : (
            <video ref={videoRef} className="ps-video" playsInline muted autoPlay />
          )}
          {!camError && (<>
            <div
              className="ps-box"
              style={{
                width: `${BOX_RATIO * 100}%`,
                height: `${BOX_RATIO * 100}%`,
                gridTemplateColumns: `repeat(${n}, 1fr)`,
              }}
            >
              {Array.from({ length: per }, (_, k) => (
                <div key={k} className="ps-cell">
                  {live?.[k] && <span className="ps-dot" style={{ background: hex(live[k]) }} />}
                </div>
              ))}
            </div>
            {n === 3 && (
              <div className="ps-guide" aria-hidden>
                <span className="ps-guide-top" style={{ background: palette[cur.top as FaceLetter] }} />
                <span className="ps-guide-left" style={{ background: palette[cur.left as FaceLetter] }} />
              </div>
            )}
          </>)}
        </div>

        <div className="ps-actions">
          <button type="button" className="ps-btn ps-btn-primary" onClick={shoot} disabled={!!camError}>
            <Camera size={15} />{t('拍摄', 'Capture')}
          </button>
          <button type="button" className="ps-btn" onClick={() => fileRef.current?.click()}>
            <Images size={15} />{t('从相册选', 'From photos')}
          </button>
          {/* 不加 capture:那会在手机上直接拉起相机、跳过相册,而这条路子正是给
              「相机开不了」的场景(微信/企业浏览器拦 getUserMedia)兜底的。
              不带 capture 时 iOS/Android 给的是「照片图库 / 拍照」二选一,两条路都留着。 */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="ps-file"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
      </>) : (
        <div className="ps-result">
          {result && <ResultNet facelet={result.facelet} spec={spec} uncertain={result.uncertain} palette={palette} />}
          <p className={validErr ? 'ps-bad' : 'ps-ok'}>
            {validErr
              ? t(`认出来的状态不合法:${validErr}。多半是某一面拍歪或拍错了 —— 点下面的缩略图重拍那一面,或先应用再去「平面」改几格。`,
                `The recognized state is not legal: ${validErr}. Usually one face was shot in the wrong orientation — retake it below, or apply and fix a few stickers in the 2D view.`)
              : t('识别完成,状态合法。应用后可以在画板上再核对一遍。', 'Recognized, and the state is legal. Apply it and double-check on the painter.')}
          </p>
          {result && result.uncertain.length > 0 && (
            <p className="ps-note">
              {t(`有 ${result.uncertain.length} 格颜色比较接近(已描边),建议核对。`,
                `${result.uncertain.length} sticker(s) were a close call (outlined) — worth a check.`)}
            </p>
          )}
          <div className="ps-actions">
            <button type="button" className="ps-btn ps-btn-primary" onClick={() => result && onApply(result.facelet)} disabled={!result}>
              {t('用这个状态', 'Use this state')}
            </button>
            <button type="button" className="ps-btn" onClick={reset}>{t('全部重拍', 'Start over')}</button>
          </div>
          {result && resultActions?.(result.facelet)}
        </div>
      )}

      <div className="ps-strip">
        {SCAN_STEPS.map((s, i) => (
          <button
            key={s.face}
            type="button"
            className={`ps-face${i === step && !done ? ' is-active' : ''}`}
            onClick={() => { setStep(i); setShots((prev) => prev.map((c, k) => (k === i ? null : c))); }}
            title={t(`重拍第 ${i + 1} 面`, `Retake face ${i + 1}`)}
          >
            <span className="ps-mini" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {Array.from({ length: per }, (_, k) => (
                <span key={k} style={{ background: shots[i] ? hex(shots[i]![k]) : EMPTY_COLOR_HEX }} />
              ))}
            </span>
            <span className="ps-face-no">{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 只读展开图 —— 认完的状态先看一眼再决定要不要用。 */
function ResultNet({ facelet, spec, uncertain, palette }: {
  facelet: string; spec: PaintSpec; uncertain: number[]; palette: Readonly<Record<FaceLetter, string>>;
}) {
  const n = spec.n;
  const ss = 14;
  const flags = new Set(uncertain);
  const base: Record<FaceLetter, [number, number]> = { U: [0, 1], L: [1, 0], F: [1, 1], R: [1, 2], B: [1, 3], D: [2, 1] };
  return (
    <div className="ps-net" style={{ width: ss * 4 * n, height: ss * 3 * n }}>
      {FACES.flatMap((f) => Array.from({ length: n * n }, (_, k) => {
        const r = Math.floor(k / n), c = k % n;
        const idx = faceletIdx(f, r, c, n);
        return (
          <span
            key={idx}
            className={`ps-net-cell${flags.has(idx) ? ' is-uncertain' : ''}`}
            style={{
              left: (base[f][1] * n + c) * ss,
              top: (base[f][0] * n + r) * ss,
              width: ss - 1,
              height: ss - 1,
              background: palette[facelet[idx] as FaceLetter] ?? EMPTY_COLOR_HEX,
            }}
          />
        );
      }))}
    </div>
  );
}

const INLINE_CSS = `
.photo-scan { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; width: 100%; }
.ps-hint {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center;
  gap: 0.3rem 0.6rem; text-align: center;
}
.ps-hint-step { font-size: 0.78rem; color: var(--muted-foreground); }
.ps-hint-motion { font-size: 0.95rem; color: var(--foreground); }
.ps-hint-face { font-size: 0.86rem; color: var(--accent); }

.ps-stage {
  position: relative; overflow: hidden; border-radius: 10px;
  background: color-mix(in srgb, var(--foreground) 8%, transparent);
  max-width: 100%;
}
.ps-video { width: 100%; height: 100%; object-fit: cover; display: block; }
.ps-camerr {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.6rem; padding: 1rem;
  font-size: 0.85rem; line-height: 1.5; color: var(--muted-foreground); text-align: center;
}
/* 取景框画在实时视频上,不是主题表面:黑白两色是固定的(任何主题下都要在照片上看得见),
   不走 --foreground —— 暗色主题里那是浅色,压在浅色墙面的取景画面上会直接消失。 */
.ps-box {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: grid;
  outline: 2px solid color-mix(in srgb, #ffffff 85%, transparent);
  border-radius: 4px; pointer-events: none;
}
.ps-cell {
  border: 1px solid color-mix(in srgb, #ffffff 45%, transparent);
  display: flex; align-items: flex-end; justify-content: flex-end; padding: 2px;
}
.ps-dot {
  width: 9px; height: 9px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, #000000 40%, transparent);
}
.ps-guide { position: absolute; inset: 0; pointer-events: none; }
.ps-guide-top, .ps-guide-left { position: absolute; border-radius: 3px; }
/* 贴着取景框外沿放:上边一条 = 该朝上的那个面色,左边一条 = 该在左边的那个面色。
   框从 (1 - BOX_RATIO)/2 = 19% 处开始,留 5% 的空当。 */
.ps-guide-top { left: 50%; top: 14%; transform: translateX(-50%); width: 22%; height: 5px; }
.ps-guide-left { left: 14%; top: 50%; transform: translateY(-50%); width: 5px; height: 22%; }

.ps-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem; }
/* 与画板工具栏(_PaintToolbar 的 .vc-paint-btn)同一套,但自带一份 —— 二阶那页没有三阶
   cubeopt 页的 .btn,靠外部类会秃成一行裸文字。 */
.ps-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: var(--muted);
  border: 1px solid var(--border-default);
  color: var(--foreground); padding: 0.35rem 0.6rem;
  border-radius: 5px; font-size: 0.8rem; cursor: pointer;
}
.ps-btn:hover:not(:disabled) { border-color: var(--accent); }
.ps-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ps-btn-primary {
  background: var(--accent); color: var(--accent-foreground);
  border-color: var(--accent); font-weight: 600;
}
.ps-file { display: none; }

.ps-result { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.ps-net {
  position: relative;
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  border-radius: 4px;
}
.ps-net-cell { position: absolute; border: 1px solid color-mix(in srgb, var(--foreground) 30%, transparent); border-radius: 2px; }
.ps-net-cell.is-uncertain { outline: 2px solid var(--signal-warning); outline-offset: -2px; }
.ps-ok, .ps-bad, .ps-note { font-size: 0.82rem; line-height: 1.55; max-width: 32rem; text-align: center; margin: 0; }
.ps-ok { color: var(--muted-foreground); }
.ps-bad { color: var(--signal-warning); }
.ps-note { color: var(--muted-foreground); }

.ps-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; }
.ps-face {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 3px; border-radius: 6px; border: 1px solid transparent; background: none;
}
.ps-face.is-active { border-color: var(--accent); }
.ps-face:hover { border-color: var(--border-strong); }
.ps-mini {
  display: grid; gap: 1px; width: 30px; height: 30px;
  border: 1px solid color-mix(in srgb, var(--foreground) 25%, transparent); border-radius: 3px; overflow: hidden;
}
.ps-face-no { font-size: 0.66rem; color: var(--muted-foreground); }
`;
