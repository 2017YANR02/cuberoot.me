'use client';

// Desk-pet animation gallery — opened from the DeskPetSearch toolbar. Shows every
// showcase animation per character as a plain <img> grid (so even states the
// runtime doesn't drive yet still preview). Overlay sits above the search backdrop.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { PET_GALLERY } from '@/lib/deskpet-gallery';

const CSS = `
.deskpet-gallery-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;
  justify-content:center;padding:24px 16px;overflow:auto;
  background:color-mix(in srgb, var(--foreground) 45%, transparent);
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
.deskpet-gallery{position:relative;width:min(720px,96vw);max-height:88vh;overflow:auto;
  background:var(--popover);border:1px solid var(--border-default);border-radius:16px;
  padding:20px 22px 24px;}
.deskpet-gallery-title{margin:0 0 4px;font-size:1.05rem;font-weight:600;color:var(--foreground);text-align:center;}
.deskpet-gallery-sub{margin:0 0 12px;font-size:.78rem;color:var(--muted-foreground);text-align:center;}
.deskpet-gallery h3{margin:18px 0 10px;font-size:.82rem;color:var(--muted-foreground);font-weight:600;}
.deskpet-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px;}
.deskpet-gallery figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:10px 4px;border-radius:10px;background:var(--muted);}
.deskpet-gallery figure img{width:52px;height:52px;object-fit:contain;image-rendering:pixelated;}
.deskpet-gallery figcaption{font-size:.7rem;color:var(--muted-foreground);text-align:center;line-height:1.2;}
.deskpet-gallery-close{position:absolute;top:10px;right:12px;background:transparent;border:0;cursor:pointer;
  color:var(--muted-foreground);padding:6px;border-radius:8px;display:flex;}
.deskpet-gallery-close:hover{background:var(--accent-soft);color:var(--foreground);}
@media (max-width:480px){
  .deskpet-gallery-grid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));}
  .deskpet-gallery figure img{width:44px;height:44px;}
}
`;

export default function DeskPetGallery({ lang, onClose }: { lang: 'zh' | 'en'; onClose: () => void }) {
  const zh = lang === 'zh';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="deskpet-gallery-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <style>{CSS}</style>
      <div className="deskpet-gallery" onClick={(e) => e.stopPropagation()}>
        <button className="deskpet-gallery-close" onClick={onClose} aria-label={zh ? '关闭' : 'Close'}>
          <X size={18} />
        </button>
        <h2 className="deskpet-gallery-title">{zh ? '桌宠动画图鉴' : 'Desk-pet Animations'}</h2>
        <p className="deskpet-gallery-sub">
          {zh ? '魔方秀 30 连 加 三个形象的全部动画' : '30 cube animations plus every character animation'}
        </p>
        {PET_GALLERY.map((g) => (
          <section key={g.id}>
            <h3>{zh ? g.zh : g.en}</h3>
            <div className="deskpet-gallery-grid">
              {g.anims.map((a) => (
                <figure key={a.file}>
                  <img src={g.base + a.file} alt={zh ? a.zh : a.en} loading="lazy" />
                  <figcaption>{zh ? a.zh : a.en}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
