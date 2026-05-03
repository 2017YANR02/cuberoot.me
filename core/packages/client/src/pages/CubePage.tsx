/**
 * @module CubePage
 * /visualcube — 单个魔方图像渲染页，参数走 URL query。灵感来自 visualcube.php API。
 * 不在首页/导航暴露，仅供 share / embed 直链。
 * 实际图片由 server `/api/visualcube.svg` 渲染，本页只是把 query 透传过去。
 */
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

const DEFAULT_ALG = "R U R' U R U2 R'"; // Sune (OLL 27)
const DEFAULT_SIZE = 256;

export default function CubePage() {
  const [params] = useSearchParams();
  const alg = params.get('alg') ?? DEFAULT_ALG;
  const view = params.get('view') ?? 'iso';
  const maskParam = params.get('mask') ?? undefined;
  const size = Math.max(32, Math.min(1000, parseInt(params.get('size') ?? String(DEFAULT_SIZE), 10) || DEFAULT_SIZE));
  const bg = params.get('bg') ?? undefined;
  const cc = params.get('cc') ?? undefined;
  const co = params.get('co') ?? undefined;

  const src = useMemo(() => {
    const qp = new URLSearchParams({ alg, view, size: String(size) });
    if (maskParam) qp.set('mask', maskParam);
    if (bg) qp.set('bg', bg);
    if (cc) qp.set('cc', cc);
    if (co) qp.set('co', co);
    return `/api/visualcube.svg?${qp}`;
  }, [alg, view, maskParam, size, bg, cc, co]);

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
