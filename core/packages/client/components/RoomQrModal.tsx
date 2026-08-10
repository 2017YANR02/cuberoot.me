'use client';

// 房间邀请二维码弹窗:把邀请链接编成二维码,队友扫码即进房。
// 训练器(/alg 联机房)与 /timer 联机对战共用 —— 调用方只管把邀请 url + 房间码传进来。
// 二维码用 uqr 本地生成 SVG(自成一体,不依赖外部 CDN);永远 深底/白 高对比,不随主题反色 —— 扫码可靠。
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { renderSVG } from 'uqr';
import { X, Copy, Check } from 'lucide-react';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import './room-qr-modal.css';

export function RoomQrModal({ url, code, onClose }: { url: string; code: string; onClose: () => void }) {
  const { copied, copy } = useCopy();
  // ecc:'M' 容错够扫;border 留白(quiet zone)不能省,否则部分相机识别不到。
  const svg = useMemo(
    () => renderSVG(url, { border: 2, ecc: 'M', blackColor: '#111', whiteColor: '#fff' }),
    [url],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 齿轮面板有 transform,position:fixed 会以它为包含块(撑不满视口)—— portal 到 body 避开。
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="room-qr-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="room-qr-modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="room-qr-close"
          onClick={onClose}
          aria-label={tr({ zh: '关闭', en: 'Close' })}
        >
          <X size={18} />
        </button>
        <h2>{tr({ zh: '扫码加入', en: 'Scan to join' })}</h2>
        <div className="room-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="room-qr-code-text">{code}</div>
        <button
          type="button"
          className="room-qr-link"
          onClick={() => copy(url)}
          title={tr({ zh: '复制邀请链接', en: 'Copy invite link' })}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span className="room-qr-link-text">{url}</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
