/**
 * @module CubePage
 * /cube — 单个魔方图像渲染，参数走 URL query。灵感来自 visualcube.php API。
 * 不在首页/导航暴露，仅供 share / embed 直链。
 */
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { renderCubeSVG, Masking, type ICubeOptions } from '@cuberoot/visualcube';

const DEFAULT_ALG = "R U R' U R U2 R'"; // Sune (OLL 27)
const DEFAULT_SIZE = 256;

function svgToDataUri(opts: ICubeOptions): string {
  return 'data:image/svg+xml,' + encodeURIComponent(renderCubeSVG(opts));
}

function findMask(name?: string): Masking | undefined {
  if (!name) return undefined;
  const lookup = (Object.values(Masking) as string[]).find(v => v.toLowerCase() === name.toLowerCase());
  return lookup as Masking | undefined;
}

export default function CubePage() {
  const [params] = useSearchParams();
  const alg = params.get('alg') ?? DEFAULT_ALG;
  const view = params.get('view') ?? 'iso';
  const maskParam = params.get('mask') ?? undefined;
  const size = Math.max(32, Math.min(1000, parseInt(params.get('size') ?? String(DEFAULT_SIZE), 10) || DEFAULT_SIZE));
  const bg = params.get('bg') ?? undefined;

  const src = useMemo(() => {
    const opts: ICubeOptions = { case: alg, width: size, height: size };
    // bg accepts: hex (with/without `#`), or any other string passed verbatim
    // (CSS named colors like `red`, `transparent`). Only prepend `#` when it
    // looks like a bare hex.
    if (bg) opts.backgroundColor = bg.startsWith('#') ? bg : /^[0-9a-f]{3,8}$/i.test(bg) ? '#' + bg : bg;

    // Pick mask: explicit `mask` param wins, else infer from `view`.
    const explicitMask = findMask(maskParam);
    if (explicitMask) opts.mask = explicitMask;
    else if (view === 'f2l') opts.mask = Masking.F2L;
    else if (view === 'oll') opts.mask = Masking.OLL;
    else if (view === 'pll') opts.mask = Masking.LL;

    // Pick view: plan or isometric (default)
    if (view === 'plan' || view === 'oll' || view === 'pll') opts.view = 'plan';

    return svgToDataUri(opts);
  }, [alg, view, maskParam, size, bg]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
    }}>
      <img src={src} width={size} height={size} alt={`Cube ${alg}`} />
      <div style={{ fontFamily: 'monospace', fontSize: 13, opacity: 0.7, textAlign: 'center', maxWidth: 600 }}>
        <div><strong>alg:</strong> {alg}</div>
        <div><strong>view:</strong> {view}{maskParam ? ` · mask: ${maskParam}` : ''} · size: {size}</div>
      </div>
    </div>
  );
}
