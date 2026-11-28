import { useEffect, useId, useRef, useState } from 'react';
import { X, Zap, ZapOff } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { recordingRates, rememberRecordingFormat } from '@/lib/video-recon/engine/camera-source';
import { nativeRecordingFormats, type NativeRecordingFormat } from '@/lib/video-recon/engine/native-review-camera';
import './camera-format.css';

type LensSettings = MediaTrackSettings & { zoom?: number; torch?: boolean };
type LensCapabilities = MediaTrackCapabilities & { zoom?: MediaSettingsRange; torch?: boolean | boolean[] };

export function CameraRecordingFormat({ track, disabled, onChanging, onSystemCamera, nativeFormat, onNativeFormat }: {
  nativeFormat?: NativeRecordingFormat; onNativeFormat?(format?: NativeRecordingFormat): void;
  track: MediaStreamTrack; disabled: boolean; onChanging(value: boolean): void; onSystemCamera?: () => void;
}) {
  const t = useT();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [systemFallback, setSystemFallback] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [settings, setSettings] = useState<LensSettings>(() => track.getSettings());
  const { width = 0, height = 0, frameRate = 0, zoom = 1, torch = false } = settings;
  const size = nativeFormat?.height ?? Math.min(width, height);
  const fps = nativeFormat?.rate ?? Math.round(frameRate);
  const front = settings.facingMode === 'user';
  const [nativePairs, setNativePairs] = useState<string[]>([]);
  useEffect(() => {
    if (!onNativeFormat) return;
    let active = true;
    nativeRecordingFormats(front).then(pairs => { if (active) setNativePairs(pairs); }).catch(() => {});
    return () => { active = false; };
  }, [front, onNativeFormat]);
  const caps: LensCapabilities = track.getCapabilities?.() ?? {};
  const label = (value: number) => value === 1080 ? t('高清', 'HD') : value === 2160 ? '4K' : `${value}p`;
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const embedded = window.parent !== window && !!sheet.current?.closest('.timer-video-embedded');
    if (embedded) window.parent.postMessage({ type: 'cuberoot:video-review:format', open: true }, '*');
    const panel = sheet.current;
    panel?.querySelector('button')?.focus({ preventScroll: true });
    const page = panel?.closest<HTMLElement>('[data-viewfinder]');
    const syncHeight = () => { if (panel && page) page.style.setProperty('--camera-sheet-height', panel.offsetHeight + 'px'); };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    if (panel) observer.observe(panel);
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !sheet.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); event.preventDefault(); close(); }
    };
    const hostBack = (event: MessageEvent) => {
      if (event.source === window.parent && event.data?.type === 'cuberoot:video-review:close-format') close();
    };
    if (embedded) window.addEventListener('message', hostBack);
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      if (embedded) window.parent.postMessage({ type: 'cuberoot:video-review:format', open: false }, '*');
      window.removeEventListener('message', hostBack);
      observer.disconnect();
      page?.style.removeProperty('--camera-sheet-height');
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  function available(h: number, rate: number) {
    const { width: w, height: d, frameRate: f } = caps;
    return !(w?.max && d?.max && (Math.min(w.max, d.max) < h || Math.max(w.max, d.max) < h * 16 / 9))
      && !(f?.max && rate > f.max + .5) && !(f?.min && rate < f.min - .5) && !rejected.includes(`${h}/${rate}`);
  }
  function supported(h: number, rate: number) {
    return nativePairs.includes(`${h}/${rate}`) || available(h, rate);
  }
  async function apply(h: number, rate: number, lens?: { zoom: number } | { torch: boolean }, resolutionChange = false) {
    if (disabled || pending.current) return;
    pending.current = true;
    onChanging(true);
    setError('');
    setSystemFallback(false);
    const previous = track.getConstraints();
    try {
      if (!lens && nativePairs.includes(`${h}/${rate}`) &&
        (rate > 60 || h === 2160 && rate >= 60 || !available(h, rate))) {
        onNativeFormat?.({ height: h, rate, front, trackId: track.id });
        return;
      }
      if (lens) {
        await track.applyConstraints({ ...previous, advanced: [...(previous.advanced ?? []).map(existing => {
          const copy = { ...existing }; delete copy[Object.keys(lens)[0] as keyof MediaTrackConstraintSet]; return copy;
        }), lens as MediaTrackConstraintSet] });
      } else {
        const current = track.getSettings();
        const landscapeWidth = h === Math.min(current.width ?? 0, current.height ?? 0) ? Math.max(current.width ?? width, current.height ?? height) : Math.round(h * 16 / 9);
        const portrait = (current.width ?? width) < (current.height ?? height);
        const request = (w: number, d: number) => track.applyConstraints({ ...previous,
          width: { exact: w }, height: { exact: d }, frameRate: resolutionChange ? { ideal: rate } : { exact: rate } });
        try { await request(portrait ? h : landscapeWidth, portrait ? landscapeWidth : h); }
        catch (cause) {
          if (!(cause instanceof DOMException && cause.name === 'OverconstrainedError')) throw cause;
          await request(portrait ? landscapeWidth : h, portrait ? h : landscapeWidth);
        }
      }
      const actual: LensSettings = track.getSettings();
      if (lens ? ('zoom' in lens ? Math.abs((actual.zoom ?? 1) - lens.zoom) > .05 : !!actual.torch !== lens.torch) :
        Math.min(actual.width ?? 0, actual.height ?? 0) !== h || (!resolutionChange && Math.abs((actual.frameRate ?? 0) - rate) > .5)) {
        await track.applyConstraints(previous);
        throw new Error('Unsupported configuration');
      }
      if (!lens) {
        onNativeFormat?.(undefined);
        rememberRecordingFormat(h, Math.round(actual.frameRate ?? rate));
      }
    } catch (cause) {
      if (!lens && cause instanceof Error && (cause.name === 'OverconstrainedError' || cause.message === 'Unsupported configuration')) setRejected(values => [...values, `${h}/${rate}`]);
      setError(t('当前镜头不支持此设置', 'Unavailable on this camera'));
    } finally {
      setSettings(track.getSettings());
      pending.current = false;
      onChanging(false);
    }
  }
  const systemAvailable = !!onSystemCamera && /iPhone|iPad|Macintosh.*Mobile/.test(navigator.userAgent);
  const hasTorch = caps.torch === true || Array.isArray(caps.torch) && caps.torch.includes(true);
  const zooms = [0.5, 1, 2].filter(z => caps.zoom?.min !== undefined && caps.zoom?.max !== undefined && z >= caps.zoom.min && z <= caps.zoom.max);
  return <>
    <div className="camera-format-trigger">
      {hasTorch && !nativeFormat && <button type="button" disabled={disabled} aria-pressed={torch} aria-label={t('补光灯', 'Torch')}
        onClick={() => void apply(size, fps, {torch: !torch})}>{torch ? <Zap /> : <ZapOff />}</button>}
      <button type="button" ref={trigger} aria-label={t('格式', 'Format')} aria-expanded={open} aria-controls={id} disabled={disabled}
        onClick={() => { setOpen(!open); setError(''); setSystemFallback(false); }}><span>{label(size)}</span><small>{fps}</small></button>
    </div>
    {zooms.length > 1 && !nativeFormat && <div className="camera-zooms" role="group" aria-label={t('变焦', 'Zoom')}>
      {zooms.map(z => <button type="button" key={z} aria-label={`${z}×`} aria-pressed={zoom === z} disabled={disabled}
        onClick={() => void apply(size, fps, { zoom: z })}>{z === .5 ? '.5' : z}{zoom === z && '×'}</button>)}
    </div>}
    {open && <div id={id} ref={sheet} className="camera-format-sheet" role="dialog" aria-label={t('格式', 'Format')}>
      <header><button type="button" aria-label={t('关闭格式', 'Close format')} onClick={close}><X size={21} /></button>
        <span>{t('格式', 'Format')}</span></header>
      <div className="camera-format-row" role="group" aria-label={t('分辨率', 'Resolution')}>
        <span>{t('分辨率', 'Resolution')}</span>
        {[1080, 2160].map(h => <button type="button" key={h} disabled={disabled || !recordingRates.some(rate => supported(h, rate))}
          aria-pressed={size === h} onClick={() => {
            const rates = recordingRates.filter(rate => supported(h, rate));
            const nextRate = rates.filter(rate => rate <= fps).pop() ?? rates[0];
            if (nextRate) void apply(h, nextRate, undefined, true);
          }}>{label(h)}</button>)}
      </div>
      <div className="camera-format-row" role="group" aria-label={t('帧速率', 'Frame rate')}>
        <span>{t('帧速率', 'Frame rate')}</span>
        {recordingRates.map(rate => {
          const selectable = supported(size, rate);
          const external = !selectable && systemAvailable;
          return <button type="button" key={rate} disabled={disabled || !selectable && !external}
            data-external={external || undefined} aria-pressed={fps === rate}
            aria-label={external ? t(`${rate} 帧，查看系统相机选项`, `${rate} fps, view system camera options`) : undefined}
            onClick={() => {
              if (external) { setSystemFallback(true); setError(t('当前镜头不支持此设置', 'Unavailable on this camera')); }
              else void apply(size, rate);
            }}><span className="camera-format-rate">{rate}</span></button>;
        })}
      </div>
      {error && <p className="camera-format-message" role="status">{error}</p>}
      {systemFallback && onSystemCamera && <button className="camera-system-format" type="button" disabled={disabled}
        onClick={() => { close(); onSystemCamera(); }}>{t('打开系统相机', 'Open system camera')}</button>}
    </div>}
    {!open && error && <span className="camera-format-error" role="status">{error}</span>}
  </>;
}
