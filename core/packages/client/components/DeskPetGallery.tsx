'use client';

// Gallery and story player, opened from the existing search toolbar.

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Download, Play, Pause, RotateCcw } from '@app-foundation/icons/lucide';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getDeskPetScene, PLAYTIME_SCENES } from '@/lib/deskpet-playtime';
import { ROOTBEAST_COLLECTIONS, ROOTBEAST_SCENES } from '@/lib/deskpet-rootbeast';
import { ORIGINAL_CHARACTERS, ORIGINAL_COLLECTIONS, ORIGINAL_SCENES } from '@/lib/deskpet-originals';
import { saveBlob, snapshotSvgElement, svgToRasterBlob } from '@/lib/puzzle-image/image-export';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import LazyVisible from '@/components/LazyVisible';
import { Tooltip } from '@/components/Tooltip';
import { tr } from '@/i18n/tr';

const CSS = `
.deskpet-gallery-overlay{position:fixed;inset:0;z-index:100040;display:flex;align-items:center;
  justify-content:center;padding:24px 16px;overflow:auto;
  background:color-mix(in srgb, var(--foreground) 45%, transparent);
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
.deskpet-gallery{position:relative;width:100%;
  background:transparent;padding:0;}
.deskpet-gallery-title{margin:0 0 4px;font-size:1.05rem;font-weight:600;color:var(--foreground);text-align:center;}
.deskpet-gallery h3{margin:18px 0 10px;font-size:.82rem;color:var(--muted-foreground);font-weight:600;}
.deskpet-gallery-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:18px 0 12px;}
.deskpet-gallery-pet-option{display:flex;align-items:center;gap:8px;white-space:nowrap;}
.deskpet-gallery-pet-thumb{display:flex;align-items:center;justify-content:center;width:26px;height:26px;overflow:hidden;flex:none;}
.deskpet-gallery-pet-thumb img{width:26px;height:26px;object-fit:contain;}
/* anchored-panel: clamped (CompactSelect body portal and visualViewport bounds) */
.deskpet-gallery-collection-menu{z-index:100050;}
.deskpet-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));
  gap:14px;}
.deskpet-gallery figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:0;padding:0 0 16px;}
/* square media cell; clips per-group scale (sprites are authored small with motion
   headroom) so a zoomed figure can't bleed onto its caption or neighbours. */
.deskpet-gallery-media{position:relative;width:100%;aspect-ratio:1/1;overflow:hidden;display:flex;}
.deskpet-gallery-media img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;}
.deskpet-gallery section[data-pet=rootbeast] img{image-rendering:auto;}
.deskpet-gallery section[data-pixel=false] img{image-rendering:auto;}
/* A faint silhouette edge keeps dark paws and tails readable without a backdrop. */
.deskpet-gallery section[data-pet=rootbeast] .deskpet-gallery-media object,
.deskpet-gallery section[data-light=true] .deskpet-gallery-media object{
  filter:drop-shadow(0 0 .5px var(--foreground));}
/* color-scheme:normal stops the object inheriting the page color-scheme (light dark);
   otherwise Chrome paints the embedded SVG doc an opaque white canvas on OS-light
   machines (visible as white tiles behind the clouds in dark mode). */
.deskpet-gallery-media object{width:100%;height:100%;pointer-events:none;color-scheme:normal;}
.deskpet-gallery figcaption{font-size:.74rem;color:var(--muted-foreground);text-align:center;line-height:1.2;
  margin-top:4px;}
.deskpet-gallery-close{position:absolute;top:10px;right:12px;background:transparent;border:0;cursor:pointer;
  color:var(--muted-foreground);padding:6px;border-radius:8px;display:flex;}
.deskpet-gallery-close:hover{background:var(--accent-soft);color:var(--foreground);}
.deskpet-gallery-tile{display:flex;flex-direction:column;width:100%;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;cursor:pointer;color:inherit;font:inherit;}
.deskpet-gallery-tile figure{width:100%;}
.deskpet-gallery-tile figcaption{width:100%;padding:0 12px;text-align:left;line-height:1.5;}
.deskpet-gallery-scene-name{display:block;font-weight:600;color:var(--foreground);}
.deskpet-gallery-scene-description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere;margin-top:5px;font-size:.72rem;color:var(--muted-foreground);}
.deskpet-gallery-tile:hover .deskpet-gallery-scene-name{color:var(--accent);}
.deskpet-gallery button:focus-visible{outline:2px solid var(--ring);outline-offset:3px;}
.deskpet-story{max-width:600px;margin:0 auto;}
.deskpet-story-art{position:relative;display:block;width:100%;height:min(42svh,350px);color-scheme:normal;}
.deskpet-story-art object{width:100%;height:100%;pointer-events:none;}
/* Keep the controllable SVG visible while a real image supplies the native save menu. */
.deskpet-gallery .deskpet-save-image{position:absolute;inset:0;width:100%;height:100%;opacity:0;object-fit:contain;}
.deskpet-gallery .deskpet-story h3{font-size:1.2rem;color:var(--foreground);margin:12px 0 8px;}
.deskpet-story p{font-size:.88rem;line-height:1.6;color:var(--muted-foreground);margin:0 0 12px;}
.deskpet-story-details{margin:22px 0 0;}
.deskpet-story-details h4{margin:0 0 8px;font-size:.84rem;font-weight:600;color:var(--foreground);}
.deskpet-story-details ul{margin:0;padding-left:1.2em;display:grid;gap:7px;font-size:.84rem;line-height:1.6;color:var(--muted-foreground);}
.deskpet-story-details li::marker{color:var(--accent);}
.deskpet-story input{width:100%;accent-color:var(--accent);cursor:pointer;}
.deskpet-story-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;margin:14px 0;}
.deskpet-story-controls button,.deskpet-story-controls a{display:inline-flex;align-items:center;gap:6px;padding:8px 0;border:0;background:transparent;
  color:var(--foreground);font:inherit;font-size:.84rem;cursor:pointer;white-space:nowrap;text-decoration:none;}
.deskpet-story-controls button:hover{color:var(--accent);}
.deskpet-story-controls button:disabled{opacity:.4;cursor:default;}
.deskpet-story-controls.deskpet-story-playback{gap:8px;}
.deskpet-story-playback button{justify-content:center;min-width:44px;min-height:44px;}
.deskpet-story-controls .deskpet-download{align-self:center;}
.deskpet-download .compact-select-current{display:inline-flex;align-items:center;gap:6px;}
.deskpet-story-controls .deskpet-story-perform{color:var(--accent);font-weight:600;}
@media (max-width:480px){
  .deskpet-gallery-grid{grid-template-columns:repeat(auto-fill,minmax(125px,1fr));}
  .deskpet-gallery{padding:0;}
}
`;

function SceneTile({ src, label, description, posterMs, zoom, onSelect }: {
  src: string; label: string; description?: string; posterMs: number; zoom?: CSSProperties; onSelect: () => void;
}) {
  const descriptionId = useId();
  return <button type="button" className="deskpet-gallery-tile" onClick={onSelect} aria-label={label}
    aria-describedby={description ? descriptionId : undefined}>
    <figure>
      <LazyVisible className="deskpet-gallery-media" minHeight={0} rootMargin="0px" unmountWhenHidden>
        <object type="image/svg+xml" data={src} aria-hidden="true" tabIndex={-1} style={zoom}
          onLoad={(event) => {
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            for (const animation of event.currentTarget.contentDocument?.getAnimations() ?? []) {
              animation.effect?.updateTiming({ delay: 0 });
              animation.currentTime = reduced ? posterMs : 0;
              if (reduced) animation.pause(); else animation.play();
            }
          }} />
        <img className="deskpet-save-image" src={src} alt="" aria-hidden="true" draggable={false} style={zoom} />
      </LazyVisible>
      <figcaption>
        <span className="deskpet-gallery-scene-name">{label}</span>
        {description && <span className="deskpet-gallery-scene-description" id={descriptionId}>{description}</span>}
      </figcaption>
    </figure>
  </button>;
}

function PlaytimePreview({ scene, onStep }: {
  scene: NonNullable<ReturnType<typeof getDeskPetScene>>; onStep: (delta: number) => void;
}) {
  const art = useRef<HTMLObjectElement>(null);
  const animations = useRef<Animation[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const details = 'details' in scene ? scene.details : undefined;
  const download = async (format: 'png' | 'svg') => {
    if (downloading) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      let blob: Blob;
      if (format === 'svg') {
        const response = await fetch(scene.src);
        if (!response.ok) throw new Error('SVG download failed');
        blob = await response.blob();
      } else {
        const source = art.current?.contentDocument?.querySelector('svg');
        if (!source) throw new Error('SVG not ready');
        const frame = snapshotSvgElement(source, { freezeAnimations: true });
        blob = await svgToRasterBlob(frame.svg, { width: frame.width * 2, height: frame.height * 2 });
      }
      saveBlob(blob, `${scene.state.replace(':', '-')}.${format}`);
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  };
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
      <div className="deskpet-story-art"
        style={{ imageRendering: ORIGINAL_CHARACTERS.find(pet => pet.id === scene.character)?.pixel ? 'pixelated' : 'auto' }}
      >
        <object
          ref={art}
          type="image/svg+xml" data={scene.src} aria-label={tr(scene)} tabIndex={-1}
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
        <img className="deskpet-save-image" src={scene.src} alt="" aria-hidden="true" draggable={false} />
      </div>
      <h3>{tr(scene)}</h3>
      <p>{tr({ zh: scene.description, en: scene.descriptionEn })}</p>
      {failed && <p role="status">{tr({ zh: '动画加载失败，请重新打开。', en: 'The animation could not load. Please reopen it.' })}</p>}
      <input type="range" min={0} max={scene.durationMs} step={10} value={time} disabled={!ready}
        aria-label={tr({ zh: '动画进度', en: 'Animation progress' })}
        onChange={(event) => control(true, Number(event.target.value))} />
      <div className="deskpet-story-controls deskpet-story-playback">
        <Tooltip content={tr({ zh: '上一个', en: 'Previous' })}>{tip =>
          <button {...tip} type="button" aria-label={tr({ zh: '上一个', en: 'Previous' })} onClick={() => onStep(-1)}><ArrowLeft size={15} aria-hidden="true" /></button>
        }</Tooltip>
        <Tooltip content={paused ? tr({ zh: '播放', en: 'Play' }) : tr({ zh: '暂停', en: 'Pause' })}>{tip =>
          <button {...tip} type="button" disabled={!ready} aria-label={paused ? tr({ zh: '播放', en: 'Play' }) : tr({ zh: '暂停', en: 'Pause' })} onClick={() => control(!paused)}>
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          </button>
        }</Tooltip>
        <Tooltip content={tr({ zh: '重播', en: 'Replay' })}>{tip =>
          <button {...tip} type="button" disabled={!ready} aria-label={tr({ zh: '重播', en: 'Replay' })} onClick={() => control(false, 0)}><RotateCcw size={15} aria-hidden="true" /></button>
        }</Tooltip>
        <Tooltip content={tr({ zh: '下一个', en: 'Next' })}>{tip =>
          <button {...tip} type="button" aria-label={tr({ zh: '下一个', en: 'Next' })} onClick={() => onStep(1)}><ArrowRight size={15} aria-hidden="true" /></button>
        }</Tooltip>
      </div>
      <div className="deskpet-story-controls">
        <CompactSelect<'png' | 'svg'>
          className="deskpet-download" popupClassName="deskpet-gallery-collection-menu"
          unstyledTrigger disabled={downloading}
          ariaLabel={downloading ? tr({ zh: '正在下载…', en: 'Downloading…' }) : tr({ zh: '下载', en: 'Download' })}
          label={<Download size={16} aria-hidden="true" />}
          items={[{ value: 'png', label: 'PNG', disabled: !ready }, { value: 'svg', label: 'SVG' }]}
          onChange={format => void download(format)}
        />
        <AppLink className="deskpet-story-perform" href={`/pets?pet=${scene.character}`} prefetch={false}>
          <Play size={16} />{tr({ zh: '和它一起玩', en: 'Spend time together' })}
        </AppLink>
      </div>
      {downloadFailed && <p role="status">{tr({ zh: '下载失败，请重试。', en: 'Download failed. Please try again.' })}</p>}
      {details && details.length > 0 && <section className="deskpet-story-details" aria-label={tr({ zh: '动作细节', en: 'Animation details' })}>
        <h4>{tr({ zh: '动作细节', en: 'Animation details' })}</h4>
        <ul>{details.map(detail => <li key={detail.en}>{tr(detail)}</li>)}</ul>
      </section>}
    </div>
  );
}

export default function DeskPetGallery({ character, characters, selected, setSelected, collectionId, setCollectionId }: {
  character: string;
  characters: { id: string; label: { zh: string; en: string }; thumb: string; thumbScale?: number }[];
  selected: string | null;
  setSelected: (value: string | null) => void;
  collectionId: string;
  setCollectionId: (value: string) => void;
}) {
  const petId = character;
  const isOriginal = ORIGINAL_CHARACTERS.some(item => item.id === petId);
  const collections = petId === 'rootbeast' ? ROOTBEAST_COLLECTIONS : isOriginal ? ORIGINAL_COLLECTIONS : [];
  const collection = collections.find(item => item.id === collectionId);
  const rootCollection = ROOTBEAST_COLLECTIONS.find(item => item.id === collectionId);
  const rootBeastScenes = rootCollection
    ? ROOTBEAST_SCENES.filter(item => rootCollection.sceneIds.includes(item.id))
    : ROOTBEAST_SCENES;
  const originalScenes = ORIGINAL_SCENES.filter(item => item.character === petId && (!collection || item.collection === collection.id));
  const selectedScene = getDeskPetScene(selected);
  const scene = selectedScene && selectedScene.character === petId && characters.some(item => item.id === selectedScene.character) ? selectedScene : undefined;
  const pet = characters.find(item => item.id === petId) ?? characters[0];
  const groups = PET_GALLERY.filter(group => group.id === pet?.id || (pet?.id === 'clawd' && ['cubing', 'moves'].includes(group.id)));
  const step = (delta: number) => {
    const scenes = scene?.character === 'rootbeast' ? rootBeastScenes : isOriginal ? originalScenes : PLAYTIME_SCENES;
    if (!scenes.length) return;
    const index = scenes.findIndex((item) => item.state === selected);
    setSelected(scenes[(index + delta + scenes.length) % scenes.length].state);
  };

  return <div className="deskpet-gallery">
      <style>{CSS}</style>
        {scene ? <>
          <div className="deskpet-story-controls"><button type="button" onClick={() => setSelected(null)}><ArrowLeft size={15} />{collection ? tr(collection) : tr({ zh: '所有动画', en: 'All animations' })}</button></div>
          <PlaytimePreview key={scene.state} scene={scene} onStep={step} />
        </> : <>
          <div className="deskpet-gallery-filters">
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
                // Story view boxes include their props; only the smaller base sprites need zoom.
                const zoom = g.scale && !a.state?.startsWith('playtime:')
                  ? { transform: `scale(${g.scale})`, transformOrigin: g.scaleOrigin || 'center' }
                  : undefined;
                const src = a.src ?? g.base + a.file + (g.v ? `?v=${g.v}` : '');
                if (a.state) {
                  const preview = getDeskPetScene(a.state);
                  return <SceneTile key={a.file} src={src} label={tr(a)} zoom={zoom}
                    description={preview ? tr({ zh: preview.description, en: preview.descriptionEn }) : undefined}
                    posterMs={preview ? preview.poster * preview.durationMs : 0}
                    onSelect={() => setSelected(a.state!)} />;
                }
                return (
                  <figure key={a.file}>
                    <LazyVisible className="deskpet-gallery-media" minHeight={0} rootMargin="0px" unmountWhenHidden>
                      {g.scripted ? (
                        // script-driven SVG: <object> runs its animation; <img> would stay blank
                        <>
                          <object type="image/svg+xml" data={src} aria-label={tr(a)} style={zoom} />
                          <img className="deskpet-save-image" src={src} alt="" aria-hidden="true" draggable={false} style={zoom} />
                        </>
                      ) : (
                        <img src={src} alt={tr(a)} loading="lazy" style={zoom} />
                      )}
                    </LazyVisible>
                    <figcaption>{tr(a)}</figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}</>}
    </div>;
}
