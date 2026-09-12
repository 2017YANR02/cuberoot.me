'use client';

// Gallery and story player, opened from the existing search toolbar.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from 'lucide-react';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getDeskPetScene, PLAYTIME_SCENES } from '@/lib/deskpet-playtime';
import { ROOTBEAST_COLLECTIONS, ROOTBEAST_SCENES } from '@/lib/deskpet-rootbeast';
import { ORIGINAL_CHARACTERS, ORIGINAL_COLLECTIONS, ORIGINAL_SCENES } from '@/lib/deskpet-originals';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
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
.deskpet-gallery h3{margin:18px 0 10px;font-size:.82rem;color:var(--muted-foreground);font-weight:600;}
.deskpet-gallery-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:18px 0 12px;}
.deskpet-gallery-pet-option{display:flex;align-items:center;gap:8px;white-space:nowrap;}
.deskpet-gallery-pet-thumb{display:flex;align-items:center;justify-content:center;width:26px;height:26px;overflow:hidden;flex:none;}
.deskpet-gallery-pet-thumb img{width:26px;height:26px;object-fit:contain;}
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
.deskpet-gallery section[data-pixel=false] img{image-rendering:auto;}
/* Keep dark paws and the radical tail readable in every site theme. */
.deskpet-gallery section[data-pet=rootbeast] .deskpet-gallery-media,
.deskpet-gallery section[data-light=true] .deskpet-gallery-media,
.deskpet-story[data-light=true] .deskpet-story-art,
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
    <div className="deskpet-story" data-pet={scene.character} data-light={ORIGINAL_CHARACTERS.some(pet => pet.id === scene.character)}>
      <object
        className="deskpet-story-art" type="image/svg+xml" data={scene.src} aria-label={tr(scene)} tabIndex={-1}
        style={{ imageRendering: ORIGINAL_CHARACTERS.find(pet => pet.id === scene.character)?.pixel ? 'pixelated' : 'auto' }}
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

export default function DeskPetGallery({ lang, character, characters, onClose }: {
  lang: 'zh' | 'en';
  character: string;
  characters: { id: string; label: { zh: string; en: string }; thumb: string; thumbScale?: number }[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedPetId, setPetId] = useState(character);
  const petId = characters.some(item => item.id === selectedPetId) ? selectedPetId : characters[0]?.id;
  const [collectionId, setCollectionId] = useState('all');
  const backdropProps = useModalBackdrop(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOriginal = ORIGINAL_CHARACTERS.some(item => item.id === petId);
  const collections = petId === 'rootbeast' ? ROOTBEAST_COLLECTIONS : isOriginal ? ORIGINAL_COLLECTIONS : [];
  const collection = collections.find(item => item.id === collectionId);
  const rootCollection = ROOTBEAST_COLLECTIONS.find(item => item.id === collectionId);
  const rootBeastScenes = rootCollection
    ? ROOTBEAST_SCENES.filter(item => rootCollection.sceneIds.includes(item.id))
    : ROOTBEAST_SCENES;
  const originalScenes = ORIGINAL_SCENES.filter(item => item.character === petId && (!collection || item.collection === collection.id));
  const selectedScene = getDeskPetScene(selected);
  const scene = selectedScene && characters.some(item => item.id === selectedScene.character) ? selectedScene : undefined;
  const pet = characters.find(item => item.id === petId) ?? characters[0];
  const groups = PET_GALLERY.filter(group => group.id === pet?.id || (pet?.id === 'clawd' && ['cubing', 'moves'].includes(group.id)));
  const petLabel = (item: typeof pet) => item && <span className="deskpet-gallery-pet-option">
    <span className="deskpet-gallery-pet-thumb"><img src={item.thumb} alt="" style={{ transform: `scale(${item.thumbScale ?? 1})` }} /></span>
    {tr(item.label)}
  </span>;
  const step = (delta: number) => {
    const scenes = scene?.character === 'rootbeast' ? rootBeastScenes : isOriginal ? originalScenes : PLAYTIME_SCENES;
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
    <div className="deskpet-gallery-overlay" {...backdropProps} role="dialog" aria-modal="true" aria-labelledby="deskpet-gallery-title" lang={lang}>
      <style>{CSS}</style>
      <div className="deskpet-gallery" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="deskpet-gallery-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
          <X size={18} />
        </button>
        <h2 className="deskpet-gallery-title" id="deskpet-gallery-title">{tr({ zh: '桌宠图鉴', en: 'Desk-pet Gallery' })}</h2>
        {scene ? <>
          <div className="deskpet-story-controls"><button type="button" onClick={() => setSelected(null)}><ArrowLeft size={15} />{collection ? tr(collection) : tr({ zh: '所有动画', en: 'All animations' })}</button></div>
          <PlaytimePreview key={scene.state} scene={scene} onStep={step} onPerform={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('clawd:state', { detail: scene.state }));
          }} />
        </> : <>
          <div className="deskpet-gallery-filters">
            <CompactSelect
              popupClassName="deskpet-gallery-collection-menu"
              ariaLabel={tr({ zh: '图鉴宠物', en: 'Gallery pet' })}
              label={petLabel(pet)} value={pet?.id ?? ''} onChange={(id) => { setPetId(id); setCollectionId('all'); }}
              items={characters.map(item => ({ value: item.id, label: petLabel(item) }))}
            />
            {collections.length > 0 && <CompactSelect
              popupClassName="deskpet-gallery-collection-menu"
              ariaLabel={tr({ zh: '表情分期', en: 'Sticker collection' })}
              label={collection ? tr(collection) : tr({ zh: '全部', en: 'All' })}
              value={collectionId} onChange={setCollectionId}
              items={[
                { value: 'all', label: tr({ zh: '全部', en: 'All' }) },
                ...collections.map(item => ({ value: item.id, label: tr(item) })),
              ]}
            />}
          </div>
          {groups.map((g) => (
          <section key={g.id} data-pet={g.id} data-pixel={g.pixel} data-light={g.lightBackground}>
            {groups.length > 1 && <h3>{tr(g)}</h3>}
            <div className="deskpet-gallery-grid">
              {(g.id === 'rootbeast' ? rootBeastScenes : isOriginal ? originalScenes : g.anims).map((a) => {
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
        ))}</>}
      </div>
    </div>, document.body
  );
}
