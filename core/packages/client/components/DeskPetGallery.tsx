'use client';

// Gallery and story player, opened from the existing search toolbar.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getDeskPetScene, PLAYTIME_SCENES } from '@/lib/deskpet-playtime';
import { ROOTBEAST_COLLECTIONS, ROOTBEAST_SCENES } from '@/lib/deskpet-rootbeast';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';

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
.deskpet-gallery-collection{margin-bottom:12px;}
/* anchored-panel: clamped (CompactSelect body portal and visualViewport bounds) */
.deskpet-gallery-collection-menu{z-index:100050;}
.deskpet-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));
  column-gap:6px;row-gap:2px;}
.deskpet-gallery figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:0;padding:0;}
/* square media cell; clips per-group scale (sprites are authored small with motion
   headroom) so a zoomed figure can't bleed onto its caption or neighbours. */
.deskpet-gallery-media{width:100%;aspect-ratio:1/1;overflow:hidden;display:flex;}
.deskpet-gallery-media img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;}
.deskpet-gallery section[data-pet=rootbeast] img{image-rendering:auto;}
/* Keep dark paws and the radical tail readable in every site theme. */
.deskpet-gallery section[data-pet=rootbeast] .deskpet-gallery-media,
.deskpet-story[data-pet=rootbeast] .deskpet-story-art{
  background:color-mix(in srgb, var(--popover) 18%, white);border-radius:12px;}
/* color-scheme:normal stops the object inheriting the page color-scheme (light dark);
   otherwise Chrome paints the embedded SVG doc an opaque white canvas on OS-light
   machines (visible as white tiles behind the clouds in dark mode). */
.deskpet-gallery-media object{width:100%;height:100%;pointer-events:none;color-scheme:normal;}
.deskpet-gallery figcaption{font-size:.74rem;color:var(--muted-foreground);text-align:center;line-height:1.2;
  margin-top:4px;}
.deskpet-gallery-close{position:absolute;top:10px;right:12px;background:transparent;border:0;cursor:pointer;
  color:var(--muted-foreground);padding:6px;border-radius:8px;display:flex;}
.deskpet-gallery-close:hover{background:var(--accent-soft);color:var(--foreground);}
.deskpet-gallery-tile{display:block;width:100%;padding:0;border:0;background:transparent;cursor:pointer;color:inherit;font:inherit;}
.deskpet-gallery-tile:hover figcaption{color:var(--accent);}
.deskpet-gallery button:focus-visible{outline:2px solid var(--ring);outline-offset:3px;}
.deskpet-story{max-width:600px;margin:0 auto;}
.deskpet-story-art{display:block;width:100%;height:min(42svh,350px);color-scheme:normal;pointer-events:none;}
.deskpet-gallery .deskpet-story h3{font-size:1.2rem;color:var(--foreground);margin:12px 0 8px;}
.deskpet-story p{font-size:.88rem;line-height:1.6;color:var(--muted-foreground);margin:0 0 12px;}
.deskpet-story input{width:100%;accent-color:var(--accent);cursor:pointer;}
.deskpet-story output{display:block;font-size:.75rem;color:var(--muted-foreground);font-variant-numeric:tabular-nums;}
.deskpet-story-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;margin:14px 0;}
.deskpet-story-controls button{display:inline-flex;align-items:center;gap:6px;padding:8px 0;border:0;background:transparent;
  color:var(--foreground);font:inherit;font-size:.84rem;cursor:pointer;white-space:nowrap;}
.deskpet-story-controls button:hover{color:var(--accent);}
.deskpet-story-controls button:disabled{opacity:.4;cursor:default;}
.deskpet-story-controls .deskpet-story-perform{color:var(--accent);font-weight:600;}
@media (max-width:480px){
  .deskpet-gallery-grid{grid-template-columns:repeat(auto-fill,minmax(92px,1fr));}
  .deskpet-gallery{padding:20px 14px;}
}
`;

function PlaytimePreview({ scene, onStep, onPerform }: {
  scene: NonNullable<ReturnType<typeof getDeskPetScene>>; onStep: (delta: number) => void; onPerform: () => void;
}) {
  const animations = useRef<Animation[]>([]);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const control = (pause: boolean, at?: number) => {
    for (const animation of animations.current) {
      if (at !== undefined) animation.currentTime = at;
      if (pause) animation.pause(); else animation.play();
    }
    if (at !== undefined) setTime(at);
    setPaused(pause);
  };
  useEffect(() => {
    if (!ready || paused) return;
    const timer = setInterval(() => {
      const current = animations.current[0]?.currentTime;
      if (typeof current === 'number') setTime(current % scene.durationMs);
    }, 100);
    return () => clearInterval(timer);
  }, [ready, paused, scene.durationMs]);
  return (
    <div className="deskpet-story" data-pet={scene.character}>
      <object
        className="deskpet-story-art" type="image/svg+xml" data={scene.src} aria-label={tr(scene)} tabIndex={-1}
        onLoad={(event) => {
          animations.current = event.currentTarget.contentDocument?.getAnimations() ?? [];
          if (!animations.current.length) { setFailed(true); return; }
          for (const animation of animations.current) animation.effect?.updateTiming({ delay: 0 });
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          control(reduced, reduced ? scene.poster * scene.durationMs : 0);
          setReady(true);
        }}
        onError={() => setFailed(true)}
      />
      <h3>{tr(scene)}</h3>
      <p>{tr({ zh: scene.description, en: scene.descriptionEn })}</p>
      {failed && <p role="status">{tr({ zh: '动画加载失败，请重新打开。', en: 'The animation could not load. Please reopen it.' })}</p>}
      <input type="range" min={0} max={scene.durationMs} step={10} value={time} disabled={!ready}
        aria-label={tr({ zh: '动画进度', en: 'Animation progress' })}
        onChange={(event) => control(true, Number(event.target.value))} />
      <output>{(time / 1000).toFixed(1)} / {scene.duration.toFixed(1)} s</output>
      <div className="deskpet-story-controls">
        <button type="button" onClick={() => onStep(-1)}><ArrowLeft size={15} />{tr({ zh: '上一个', en: 'Previous' })}</button>
        <button type="button" disabled={!ready} onClick={() => control(!paused)}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? tr({ zh: '播放', en: 'Play' }) : tr({ zh: '暂停', en: 'Pause' })}
        </button>
        <button type="button" disabled={!ready} onClick={() => control(false, 0)}><RotateCcw size={15} />{tr({ zh: '重播', en: 'Replay' })}</button>
        <button type="button" onClick={() => onStep(1)}>{tr({ zh: '下一个', en: 'Next' })}<ArrowRight size={15} /></button>
      </div>
      <div className="deskpet-story-controls">
        <button type="button" className="deskpet-story-perform" onClick={onPerform}>
          <Play size={16} />{tr({ zh: '让桌宠表演', en: 'Play on the pet' })}
        </button>
      </div>
    </div>
  );
}

export default function DeskPetGallery({ lang, onClose }: { lang: 'zh' | 'en'; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const collection = ROOTBEAST_COLLECTIONS.find(item => item.id === collectionId);
  const rootBeastScenes = collection
    ? ROOTBEAST_SCENES.filter(item => collection.sceneIds.includes(item.id))
    : ROOTBEAST_SCENES;
  const scene = getDeskPetScene(selected);
  const step = (delta: number) => {
    const scenes = scene?.character === 'rootbeast' ? rootBeastScenes : PLAYTIME_SCENES;
    if (!scenes.length) return;
    const index = scenes.findIndex((item) => item.state === selected);
    setSelected(scenes[(index + delta + scenes.length) % scenes.length].state);
  };

  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      const menu = document.querySelector('.deskpet-gallery-collection-menu');
      if (e.key === 'Escape') {
        // The shared select dismisses its portal before this dialog closes.
        if (menu) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (selected) setSelected(null); else onClose();
      } else if (e.key === 'Tab') {
        const items = [
          ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []),
          ...Array.from(menu?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []),
        ];
        const target = e.shiftKey ? items.at(-1) : items[0];
        if ((e.shiftKey && document.activeElement === items[0]) || (!e.shiftKey && document.activeElement === items.at(-1))) {
          e.preventDefault(); target?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [onClose, selected]);

  return createPortal(
    <div className="deskpet-gallery-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="deskpet-gallery-title" lang={lang}>
      <style>{CSS}</style>
      <div className="deskpet-gallery" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="deskpet-gallery-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
          <X size={18} />
        </button>
        <h2 className="deskpet-gallery-title" id="deskpet-gallery-title">{tr({ zh: '桌宠动画图鉴', en: 'Desk-pet Animations' })}</h2>
        <p className="deskpet-gallery-sub">
          {tr({ zh: '点选动画预览；打开桌宠「随机」可自动播放。', en: 'Select an animation to preview, or turn on Random in the pet toolbar for automatic playback.' })}
        </p>
        {scene ? <>
          <div className="deskpet-story-controls"><button type="button" onClick={() => setSelected(null)}><ArrowLeft size={15} />{scene.character === 'rootbeast' && collection ? tr(collection) : tr({ zh: '所有动画', en: 'All animations' })}</button></div>
          <PlaytimePreview key={scene.state} scene={scene} onStep={step} onPerform={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('clawd:state', { detail: scene.state }));
          }} />
        </> : PET_GALLERY.map((g) => (
          <section key={g.id} data-pet={g.id}>
            <h3>{tr(g)}</h3>
            {g.id === 'rootbeast' && <CompactSelect
              className="deskpet-gallery-collection"
              popupClassName="deskpet-gallery-collection-menu"
              ariaLabel={tr({ zh: '根号兽表情分期', en: 'Root Beast sticker collection' })}
              label={collection ? tr(collection) : tr({ zh: '全部', en: 'All' })}
              value={collectionId}
              onChange={setCollectionId}
              items={[
                { value: 'all', label: tr({ zh: '全部', en: 'All' }) },
                ...ROOTBEAST_COLLECTIONS.map(item => ({ value: item.id, label: tr(item) })),
              ]}
            />}
            <div className="deskpet-gallery-grid">
              {(g.id === 'rootbeast' ? rootBeastScenes : g.anims).map((a) => {
                const zoom = g.scale
                  ? { transform: `scale(${g.scale})`, transformOrigin: g.scaleOrigin || 'center' }
                  : undefined;
                const src = a.src ?? g.base + a.file + (g.v ? `?v=${g.v}` : '');
                if (a.state) return (
                  <button type="button" className="deskpet-gallery-tile" key={a.file}
                    onClick={() => setSelected(a.state!)} aria-label={tr(a)}>
                    <figure><div className="deskpet-gallery-media"><img src={src} alt="" loading="lazy" style={zoom} /></div><figcaption>{tr(a)}</figcaption></figure>
                  </button>
                );
                return (
                  <figure key={a.file}>
                    <div className="deskpet-gallery-media">
                      {g.scripted ? (
                        // script-driven SVG: <object> runs its animation; <img> would stay blank
                        <object type="image/svg+xml" data={src} aria-label={tr(a)} style={zoom} />
                      ) : (
                        <img src={src} alt={tr(a)} loading="lazy" style={zoom} />
                      )}
                    </div>
                    <figcaption>{tr(a)}</figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>, document.body
  );
}
