'use client';

// Desk-pet animation gallery — opened from the DeskPetSearch toolbar. Shows every
// showcase animation per character as a plain <img> grid (so even states the
// runtime doesn't drive yet still preview). Overlay sits above the search backdrop.

import { useEffect } from 'react';
import { X, Boxes } from 'lucide-react';
import { PET_GALLERY } from '@/lib/deskpet-gallery';

const CSS = `
.deskpet-gallery-overlay{position:fixed;inset:0;z-index:100040;display:flex;align-items:center;
  justify-content:center;padding:24px 16px;overflow:auto;
  background:color-mix(in srgb, var(--foreground) 45%, transparent);
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
.deskpet-gallery{position:relative;width:min(960px,96vw);max-height:88vh;overflow:auto;
  background:var(--popover);border:1px solid var(--border-default);border-radius:16px;
  padding:20px 22px 24px;}
.deskpet-gallery-title{margin:0 0 4px;font-size:1.05rem;font-weight:600;color:var(--foreground);text-align:center;}
.deskpet-gallery-sub{margin:0 0 12px;font-size:.78rem;color:var(--muted-foreground);text-align:center;}
.deskpet-gallery h3{margin:18px 0 10px;font-size:.82rem;color:var(--muted-foreground);font-weight:600;}
.deskpet-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));
  column-gap:6px;row-gap:2px;}
/* PLL 表演 launcher — a real interactive 3D cube, set apart from the static tiles.
   Spans the whole grid row, accent-tinted, so it reads as a button not a thumbnail. */
.deskpet-gallery-launch{grid-column:1/-1;display:flex;align-items:center;gap:10px;
  width:100%;margin:0 0 8px;padding:12px 14px;cursor:pointer;text-align:left;
  background:color-mix(in srgb, var(--accent) 14%, var(--card));
  border:1px solid color-mix(in srgb, var(--accent) 40%, var(--border-default));
  border-radius:12px;color:var(--foreground);}
.deskpet-gallery-launch:hover{background:color-mix(in srgb, var(--accent) 22%, var(--card));
  border-color:var(--accent);}
.deskpet-gallery-launch svg{flex:none;color:var(--accent);}
.deskpet-gallery-launch-text{display:flex;flex-direction:column;gap:1px;}
.deskpet-gallery-launch-title{font-size:.86rem;font-weight:600;line-height:1.2;}
.deskpet-gallery-launch-sub{font-size:.72rem;color:var(--muted-foreground);line-height:1.2;}
.deskpet-gallery figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:0;padding:0;}
/* square media cell; clips per-group scale (sprites are authored small with motion
   headroom) so a zoomed figure can't bleed onto its caption or neighbours. */
.deskpet-gallery-media{width:100%;aspect-ratio:1/1;overflow:hidden;display:flex;}
.deskpet-gallery-media img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;}
/* color-scheme:normal stops the object inheriting the page color-scheme (light dark);
   otherwise Chrome paints the embedded SVG doc an opaque white canvas on OS-light
   machines (visible as white tiles behind the clouds in dark mode). */
.deskpet-gallery-media object{width:100%;height:100%;pointer-events:none;color-scheme:normal;}
.deskpet-gallery figcaption{font-size:.74rem;color:var(--muted-foreground);text-align:center;line-height:1.2;
  margin-top:4px;}
.deskpet-gallery-close{position:absolute;top:10px;right:12px;background:transparent;border:0;cursor:pointer;
  color:var(--muted-foreground);padding:6px;border-radius:8px;display:flex;}
.deskpet-gallery-close:hover{background:var(--accent-soft);color:var(--foreground);}
@media (max-width:480px){
  .deskpet-gallery-grid{grid-template-columns:repeat(auto-fill,minmax(92px,1fr));}
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
              {g.id === 'cubing' && (
                <button
                  type="button"
                  className="deskpet-gallery-launch"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('clawd:perform'));
                  }}
                >
                  <Boxes size={26} />
                  <span className="deskpet-gallery-launch-text">
                    <span className="deskpet-gallery-launch-title">{zh ? 'PLL 表演' : 'PLL Show'}</span>
                    <span className="deskpet-gallery-launch-sub">
                      {zh ? '点击启动真实 3D 魔方表演' : 'Launch the interactive 3D cube'}
                    </span>
                  </span>
                </button>
              )}
              {g.anims.map((a) => {
                const zoom = g.scale
                  ? { transform: `scale(${g.scale})`, transformOrigin: g.scaleOrigin || 'center' }
                  : undefined;
                const src = g.base + a.file + (g.v ? `?v=${g.v}` : '');
                return (
                  <figure key={a.file}>
                    <div className="deskpet-gallery-media">
                      {g.scripted ? (
                        // script-driven SVG: <object> runs its animation; <img> would stay blank
                        <object type="image/svg+xml" data={src} aria-label={zh ? a.zh : a.en} style={zoom} />
                      ) : (
                        <img src={src} alt={zh ? a.zh : a.en} loading="lazy" style={zoom} />
                      )}
                    </div>
                    <figcaption>{zh ? a.zh : a.en}</figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
