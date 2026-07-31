/**
 * 一张 case 的缩略图 → **SVG 字符串**(PDF 导出用)。
 *
 * 屏幕上那张图走 `<CaseThumb>`(React 组件树);PDF 里要的是能喂给 svg2pdf 的字符串,
 * 所以这里按同一套分支再走一遍 —— 分支表见 `components/CaseThumb.tsx`,
 * **改那边的分支要同步改这里**。NxN 的视角 / 遮罩逻辑没有复制:它已经抽成
 * `cubeThumbParams()`,两边共用同一份。
 *
 * 全部本地渲染,不发网络请求 —— 一份 PDF 动辄几百张图,走 `/v1/visualcube.svg`
 * 就是几百个请求。
 */
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { toWca as toWcaSkewb, invert as invertSkewbAlg } from '@cuberoot/shared/skewb-notation';
import { renderSkewbPyramidSvgParametric } from '@cuberoot/shared/skewb-pyramid-svg';
import { cubeThumbParams, SR_PUZZLES } from '@/components/CaseThumb';
import { renderEngineSvg, engineForwardAlg } from '@/components/EnginePuzzleSVG';

export interface CaseSvgInput {
  puzzle: AlgPuzzle;
  set: string;
  sticker: AlgSticker;
  /** 这张卡当前显示的公式(= case 态的解法,逆着看) */
  alg: string;
  /** 有 setup 就直接正向摆到 case 态,不用逆公式 */
  setup?: string;
  /** 显式遮罩(二级选择页那种 `coll` 掩码);SR 拼图忽略 */
  mask?: string;
  /** SVG 的标称边长(px)。PDF 里最终尺寸由 svg2pdf 的 viewBox 缩放定,这里只影响描边比例。 */
  size?: number;
}

/** sr-puzzlegen 是 DOM 渲染器(往宿主元素里塞 <svg>),借个离屏容器取字符串。 */
let srHost: HTMLDivElement | null = null;
function getSrHost(): HTMLDivElement {
  if (srHost && srHost.isConnected) return srHost;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(div);
  srHost = div;
  return div;
}

async function renderSrSvg(type: string, puzzle: Record<string, unknown>, size: number): Promise<string | null> {
  const mod = await import('@cuberoot/vendor-sr-puzzlegen');
  const host = getSrHost();
  host.innerHTML = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mod.SVG(host, type as any, { width: size, height: size, puzzle } as any);
    // sr 往宿主里塞的是 `<div class="svg-renderer"><svg>…`,取里面那层 —— 直接拿
    // innerHTML 的话根节点是 div,svg2pdf 认不出来,图会**静默**不出现。
    return host.querySelector('svg')?.outerHTML ?? null;
  } catch (err) {
    console.warn('[alg_pdf] sr render failed', type, err);
    return null;
  } finally {
    host.innerHTML = '';
  }
}

/** 同一张图在一份 PDF 里会被反复要(组封面 / 同 case 多视角),缓存住。 */
const cache = new Map<string, string | null>();
const CACHE_CAP = 4000;

export async function algCaseSvg(input: CaseSvgInput): Promise<string | null> {
  const { puzzle, set, sticker, alg, setup, mask, size = 160 } = input;
  const key = `${puzzle}|${set}|${sticker.kind}|${mask ?? ''}|${size}|${setup ?? ''}|${alg}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = await renderCaseSvg(input);
  if (cache.size >= CACHE_CAP) cache.clear();
  cache.set(key, svg);
  return svg;
}

async function renderCaseSvg({
  puzzle, set, sticker, alg, setup, mask, size = 160,
}: CaseSvgInput): Promise<string | null> {
  // ── sq1:屏幕上那张 <img> 打的是 /v1/visualcube.svg?pzl=sq1,服务端落到 /sim 引擎
  //    iso 渲染(routes/cube.ts)。这里直接在本地跑同一个引擎。
  if (puzzle === 'sq1') {
    // 记号规范化在 renderEngineSvg 里做(与服务端 routes/cube.ts 同序:先逆再 canonical)
    const driver = setup && setup.trim() ? { alg: setup } : { case: alg };
    return renderEngineSvg('sq1', engineForwardAlg('sq1', driver), size);
  }
  if (SR_PUZZLES.includes(puzzle)) {
    const xform = puzzle === 'skewb' ? (s: string) => toWcaSkewb(s, 'sarah') : (s: string) => s;
    const driver = setup && setup.trim() ? { alg: xform(setup) } : { case: xform(alg) };
    if (puzzle === 'pyraminx') {
      return renderEngineSvg('pyraminx', engineForwardAlg('pyraminx', driver), size);
    }
    if (puzzle === 'skewb') {
      // skewb-top 不是 sr 渲染,是自绘的扇形俯视图(见 PuzzleSVG 的 customSvg 分支)
      const scramble = driver.case ? invertSkewbAlg(driver.case) : (driver.alg ?? '');
      try {
        return renderSkewbPyramidSvgParametric(scramble);
      } catch (err) {
        console.warn('[alg_pdf] skewb-top render failed', err);
        return null;
      }
    }
    // megaminx-top:sr 特有的俯视形态,没有本地重写版
    return renderSrSvg('megaminx-top', driver, size);
  }
  const p = cubeThumbParams(puzzle, set, sticker, mask);
  return renderFromSimpleQuery({
    ...(setup ? { setup } : { case: alg }),
    view: p.view,
    size,
    pzl: p.puzzleSize,
    ...(p.mask ? { mask: p.mask } : {}),
    ...(p.hideGreySides ? { ngs: '1' } : {}),
  });
}
