'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ImagePlus, Upload, Trash2, Crop } from '@app-foundation/icons/lucide';
import { ValueField } from './SettingDrawer';
import { PICTURE_FACE_ORDER, DEFAULT_PICTURE_CROP, countPictureFaces, drawPictureCrop, emptyPictureFaces, fileToPictureEditSourceDataUrl, normalizePictureCrop, panPictureCropBy, pictureCropGeometry, pictureEditSourceToFaceDataUrl, rotatePictureCropTo, zoomPictureCropAt, type PictureCrop, type PictureFace, type PictureFaces } from './engine/nxn/pictureCube';
import { ClearButton } from '@/components/ClearButton';
import BoolToggle from '@/components/BoolToggle';
import { useModalBackdrop } from '@/hooks/useModalDismiss';

const PICTURE_FACE_LABELS: Record<PictureFace, readonly [string, string]> = {
  U: ['上面', 'Up'], R: ['右面', 'Right'], F: ['前面', 'Front'],
  D: ['下面', 'Down'], L: ['左面', 'Left'], B: ['后面', 'Back'],
};

export function PictureFaceMiniNet({ faces }: { faces: PictureFaces }) {
  return (
    <span className="sim-picture-mini" aria-hidden>
      {PICTURE_FACE_ORDER.map((face) => (
        <span key={face} data-face={face}>
          {faces[face] ? <img src={faces[face]} alt="" /> : <span>{face}</span>}
        </span>
      ))}
    </span>
  );
}

const PICTURE_CROP_SIZE = 384;

function defaultPictureCrops(): Record<PictureFace, PictureCrop> {
  return Object.fromEntries(
    PICTURE_FACE_ORDER.map((face) => [face, { ...DEFAULT_PICTURE_CROP }]),
  ) as Record<PictureFace, PictureCrop>;
}

function PictureCropWorkspace({
  face, source, initialCrop, order, busy, onReplace, onApply, t,
}: {
  face: PictureFace;
  source: string;
  initialCrop: PictureCrop;
  order: number;
  busy: boolean;
  onReplace: () => void;
  onApply: (crop: PictureCrop) => void;
  t: (zh: string, en: string) => string;
}) {
  const [crop, setCrop] = useState<PictureCrop>(() => normalizePictureCrop(initialCrop));
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef(crop);
  const pointersRef = useRef(new Map<number, { clientX: number; clientY: number }>());
  const gestureRef = useRef<
    | {
      kind: 'drag';
      pointerId: number;
      clientX: number;
      clientY: number;
      crop: PictureCrop;
    }
    | {
      kind: 'pinch';
      pointerIds: readonly [number, number];
      distance: number;
      centerX: number;
      centerY: number;
      crop: PictureCrop;
    }
    | null
  >(null);

  cropRef.current = crop;

  const commitCrop = useCallback((next: PictureCrop) => {
    const normalized = normalizePictureCrop(next);
    cropRef.current = normalized;
    setCrop(normalized);
  }, []);

  useEffect(() => {
    setCrop(normalizePictureCrop(initialCrop));
    pointersRef.current.clear();
    gestureRef.current = null;
    setDragging(false);
    setDimensions({ width: 0, height: 0 });
    setImageError(false);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      imageRef.current = image;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => setImageError(true);
    image.src = source;
    return () => {
      imageRef.current = null;
      image.onload = null;
      image.onerror = null;
    };
  }, [initialCrop, source]);

  const geometry = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return null;
    return pictureCropGeometry(
      dimensions.width,
      dimensions.height,
      PICTURE_CROP_SIZE,
      crop,
    );
  }, [crop, dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !dimensions.width || !dimensions.height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPictureCrop(
      ctx,
      image,
      dimensions.width,
      dimensions.height,
      PICTURE_CROP_SIZE,
      crop,
    );
  }, [crop, dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!dimensions.width || !dimensions.height) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const delta = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2 ? event.deltaY * rect.height : event.deltaY;
      const anchorX = ((event.clientX - rect.left) / rect.width - 0.5) * PICTURE_CROP_SIZE;
      const anchorY = ((event.clientY - rect.top) / rect.height - 0.5) * PICTURE_CROP_SIZE;
      commitCrop(zoomPictureCropAt(
        dimensions.width,
        dimensions.height,
        PICTURE_CROP_SIZE,
        cropRef.current,
        cropRef.current.zoom * Math.exp(-delta * 0.002),
        anchorX,
        anchorY,
      ));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [commitCrop, dimensions.height, dimensions.width]);

  const gridCount = order >= 2 && order <= 12 ? order : 0;
  const [zhFace, enFace] = PICTURE_FACE_LABELS[face];

  const setRotation = (rotation: number) => {
    if (!dimensions.width || !dimensions.height) {
      commitCrop({ ...cropRef.current, rotation });
      return;
    }
    commitCrop(rotatePictureCropTo(
      dimensions.width,
      dimensions.height,
      PICTURE_CROP_SIZE,
      cropRef.current,
      rotation,
    ));
  };

  const beginPinch = () => {
    const pair = [...pointersRef.current.entries()].slice(0, 2);
    if (pair.length < 2) return;
    const [[firstId, first], [secondId, second]] = pair;
    gestureRef.current = {
      kind: 'pinch',
      pointerIds: [firstId, secondId],
      distance: Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)),
      centerX: (first.clientX + second.clientX) / 2,
      centerY: (first.clientY + second.clientY) / 2,
      crop: cropRef.current,
    };
    setDragging(true);
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    const remaining = [...pointersRef.current.entries()][0];
    if (remaining) {
      const [pointerId, point] = remaining;
      gestureRef.current = {
        kind: 'drag',
        pointerId,
        clientX: point.clientX,
        clientY: point.clientY,
        crop: cropRef.current,
      };
      setDragging(true);
      return;
    }
    gestureRef.current = null;
    setDragging(false);
  };

  return (
    <div className="sim-picture-crop-workspace">
      <div className="sim-picture-crop-heading">
        <span className="sim-picture-crop-icon"><Crop size={17} /></span>
        <div>
          <h3>{t(`调整 ${face} ${zhFace}`, `Adjust ${face} ${enFace}`)}</h3>
        </div>
      </div>

      <div className="sim-picture-crop-body">
        <div className="sim-picture-crop-stage-wrap">
          <div className={'sim-picture-crop-stage' + (dragging ? ' is-dragging' : '')}>
            <canvas
              ref={canvasRef}
              width={PICTURE_CROP_SIZE}
              height={PICTURE_CROP_SIZE}
              tabIndex={0}
              aria-label={t('拖动图片调整取景,双指或滚轮缩放', 'Drag to reframe; pinch or scroll to zoom')}
              onPointerDown={(event) => {
                if (!geometry || (event.pointerType !== 'touch' && event.button !== 0)) return;
                pointersRef.current.set(event.pointerId, {
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
                event.currentTarget.setPointerCapture(event.pointerId);
                if (pointersRef.current.size >= 2) beginPinch();
                else {
                  gestureRef.current = {
                    kind: 'drag',
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    crop: cropRef.current,
                  };
                  setDragging(true);
                }
              }}
              onPointerMove={(event) => {
                if (!pointersRef.current.has(event.pointerId) || !geometry) return;
                pointersRef.current.set(event.pointerId, {
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
                const gesture = gestureRef.current;
                if (!gesture) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                if (gesture.kind === 'pinch') {
                  const first = pointersRef.current.get(gesture.pointerIds[0]);
                  const second = pointersRef.current.get(gesture.pointerIds[1]);
                  if (!first || !second) return;
                  const distance = Math.max(1, Math.hypot(
                    second.clientX - first.clientX,
                    second.clientY - first.clientY,
                  ));
                  const centerX = (first.clientX + second.clientX) / 2;
                  const centerY = (first.clientY + second.clientY) / 2;
                  const toCanvasX = (clientX: number) => (
                    (clientX - rect.left) / rect.width - 0.5
                  ) * PICTURE_CROP_SIZE;
                  const toCanvasY = (clientY: number) => (
                    (clientY - rect.top) / rect.height - 0.5
                  ) * PICTURE_CROP_SIZE;
                  commitCrop(zoomPictureCropAt(
                    dimensions.width,
                    dimensions.height,
                    PICTURE_CROP_SIZE,
                    gesture.crop,
                    gesture.crop.zoom * distance / gesture.distance,
                    toCanvasX(gesture.centerX),
                    toCanvasY(gesture.centerY),
                    toCanvasX(centerX),
                    toCanvasY(centerY),
                  ));
                  return;
                }
                if (gesture.pointerId !== event.pointerId) return;
                commitCrop(panPictureCropBy(
                  dimensions.width,
                  dimensions.height,
                  PICTURE_CROP_SIZE,
                  gesture.crop,
                  (event.clientX - gesture.clientX) / rect.width * PICTURE_CROP_SIZE,
                  (event.clientY - gesture.clientY) / rect.height * PICTURE_CROP_SIZE,
                ));
              }}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onLostPointerCapture={(event) => {
                if (!pointersRef.current.has(event.pointerId)) return;
                pointersRef.current.clear();
                gestureRef.current = null;
                setDragging(false);
              }}
              onKeyDown={(event) => {
                const nudge = event.shiftKey ? 40 : 12;
                if (event.key === 'ArrowLeft') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, -nudge, 0,
                ));
                else if (event.key === 'ArrowRight') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, nudge, 0,
                ));
                else if (event.key === 'ArrowUp') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, 0, -nudge,
                ));
                else if (event.key === 'ArrowDown') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, 0, nudge,
                ));
                else if (event.key === '+' || event.key === '=') commitCrop(zoomPictureCropAt(
                  dimensions.width,
                  dimensions.height,
                  PICTURE_CROP_SIZE,
                  cropRef.current,
                  cropRef.current.zoom * 1.15,
                  0,
                  0,
                ));
                else if (event.key === '-') commitCrop(zoomPictureCropAt(
                  dimensions.width,
                  dimensions.height,
                  PICTURE_CROP_SIZE,
                  cropRef.current,
                  cropRef.current.zoom / 1.15,
                  0,
                  0,
                ));
                else return;
                event.preventDefault();
                event.stopPropagation();
              }}
            />
            {gridCount > 0 && (
              <span
                className="sim-picture-crop-grid"
                style={{ backgroundSize: `${100 / gridCount}% ${100 / gridCount}%` }}
                aria-hidden
              />
            )}
            {!dimensions.width && !imageError && <Loader2 size={24} className="sim-picture-crop-loading sim-spin" />}
            {imageError && <span className="sim-picture-crop-load-error">{t('无法预览', 'Preview unavailable')}</span>}
          </div>
        </div>

        <div className="sim-picture-crop-controls">
          <label className="sim-picture-rotation">
            <span>{t('旋转', 'Rotate')}</span>
            <ValueField
              display={crop.rotation}
              decimals={2}
              min={-180}
              max={180}
              step={0.01}
              suffix="°"
              commit={(rotation) => {
                setRotation(rotation);
                return normalizePictureCrop({ ...cropRef.current, rotation }).rotation;
              }}
            />
            <input
              type="range"
              min={-180}
              max={180}
              step={0.1}
              value={crop.rotation}
              aria-label={t('旋转角度', 'Rotation angle')}
              onChange={(event) => setRotation(Number(event.target.value))}
            />
          </label>

          <div className="sim-picture-crop-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCrop({ ...DEFAULT_PICTURE_CROP, rotation: crop.rotation })}
            >
              {t('居中', 'Center')}
            </button>
            <button type="button" disabled={busy} onClick={onReplace}>
              <Upload size={14} />{t('换图', 'Change image')}
            </button>
            <button
              type="button"
              className="sim-picture-crop-apply"
              disabled={busy || !dimensions.width || imageError}
              onClick={() => onApply(crop)}
            >
              {busy && <Loader2 size={14} className="sim-spin" />}
              {t('应用', 'Apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PictureCubeEditor({
  open, initialFaces, initialBaseColors, order, onClose,
  onFacesChange, onBaseColorsChange, t,
}: {
  open: boolean;
  initialFaces: PictureFaces;
  initialBaseColors: boolean;
  order: number;
  onClose: () => void;
  onFacesChange: (faces: PictureFaces) => boolean;
  onBaseColorsChange: (baseColors: boolean) => void;
  t: (zh: string, en: string) => string;
}) {
  const backdropProps = useModalBackdrop(onClose);
  const [draft, setDraft] = useState<PictureFaces>(() => ({ ...initialFaces }));
  const [baseColors, setBaseColors] = useState(initialBaseColors);
  const [editSources, setEditSources] = useState<PictureFaces>(() => ({ ...initialFaces }));
  const [faceCrops, setFaceCrops] = useState<Record<PictureFace, PictureCrop>>(defaultPictureCrops);
  const [cropFace, setCropFace] = useState<PictureFace | null>(null);
  const [targetFace, setTargetFace] = useState<PictureFace>('U');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cropFaceRef = useRef<PictureFace | null>(null);
  const openingStateRef = useRef({ faces: initialFaces, baseColors: initialBaseColors });

  cropFaceRef.current = cropFace;

  useEffect(() => {
    if (!open) openingStateRef.current = { faces: initialFaces, baseColors: initialBaseColors };
  }, [initialBaseColors, initialFaces, open]);

  useEffect(() => {
    if (!open) return;
    const initial = openingStateRef.current;
    setDraft({ ...initial.faces });
    setBaseColors(initial.baseColors);
    setEditSources({ ...initial.faces });
    setFaceCrops(defaultPictureCrops());
    setCropFace(null);
    setError('');
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (cropFaceRef.current) {
          setCropFace(null);
          return;
        }
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const focusFrame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const messageForError = (reason: unknown) => {
    const code = reason instanceof Error ? reason.message : '';
    if (code === 'too-large') return t('单张图片请小于 15 MB', 'Keep each image under 15 MB');
    if (code === 'not-image') return t('请选择图片文件', 'Choose an image file');
    return t('这张图片无法读取,请换一张再试', 'This image could not be read. Try another file');
  };

  const autoSaveFaces = (faces: PictureFaces): boolean => {
    if (onFacesChange(faces)) {
      setError('');
      return true;
    }
    setError(t(
      '浏览器存储空间不足,图片尚未保存。请清理部分站点数据或减少图片后重试',
      'Browser storage is full, so the images were not saved. Free some site storage or use fewer images, then try again',
    ));
    return false;
  };

  const processFace = async (face: PictureFace, file: File) => {
    const source = await fileToPictureEditSourceDataUrl(file);
    const crop = { ...DEFAULT_PICTURE_CROP };
    const url = await pictureEditSourceToFaceDataUrl(source, crop);
    const next = { ...draft, [face]: url };
    if (!autoSaveFaces(next)) return;
    setEditSources((current) => ({ ...current, [face]: source }));
    setFaceCrops((current) => ({ ...current, [face]: crop }));
    setDraft(next);
    setCropFace(face);
  };

  const handleFaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await processFace(targetFace, file);
    } catch (reason) {
      setError(messageForError(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleBulkFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    event.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const imported: Array<{ face: PictureFace; source: string; url: string }> = [];
      for (let index = 0; index < files.length; index++) {
        const source = await fileToPictureEditSourceDataUrl(files[index]);
        imported.push({
          face: PICTURE_FACE_ORDER[index],
          source,
          url: await pictureEditSourceToFaceDataUrl(source, DEFAULT_PICTURE_CROP),
        });
      }
      const next = { ...draft };
      imported.forEach(({ face, url }) => { next[face] = url; });
      if (!autoSaveFaces(next)) return;
      setDraft(next);
      setEditSources((current) => {
        const next = { ...current };
        imported.forEach(({ face, source }) => { next[face] = source; });
        return next;
      });
      setFaceCrops((current) => {
        const next = { ...current };
        imported.forEach(({ face }) => { next[face] = { ...DEFAULT_PICTURE_CROP }; });
        return next;
      });
      setCropFace(null);
      if (files.length < 6) {
        setError(t(`已按顺序填入前 ${files.length} 面,其余可逐面补充`, `Filled the first ${files.length} faces in order; add the rest individually`));
      }
    } catch (reason) {
      setError(messageForError(reason));
    } finally {
      setBusy(false);
    }
  };

  const removeFace = (face: PictureFace) => {
    const next = { ...draft, [face]: '' };
    if (!autoSaveFaces(next)) return;
    setDraft(next);
    setEditSources((current) => ({ ...current, [face]: '' }));
    setFaceCrops((current) => ({ ...current, [face]: { ...DEFAULT_PICTURE_CROP } }));
    if (cropFace === face) setCropFace(null);
  };

  const clearAllFaces = () => {
    const next = emptyPictureFaces();
    if (!autoSaveFaces(next)) return;
    setDraft(next);
    setEditSources({ ...next });
    setFaceCrops(defaultPictureCrops());
    setCropFace(null);
  };

  const applyCrop = async (face: PictureFace, crop: PictureCrop) => {
    const source = editSources[face];
    if (!source) return;
    setBusy(true);
    setError('');
    try {
      const normalized = normalizePictureCrop(crop);
      const url = await pictureEditSourceToFaceDataUrl(source, normalized);
      const next = { ...draft, [face]: url };
      if (!autoSaveFaces(next)) return;
      setFaceCrops((current) => ({ ...current, [face]: normalized }));
      setDraft(next);
      setCropFace(null);
    } catch (reason) {
      setError(messageForError(reason));
    } finally {
      setBusy(false);
    }
  };

  const count = countPictureFaces(draft);
  const dialog = (
    <div
      className="sim-picture-backdrop"
      {...backdropProps}
    >
      <section
        ref={dialogRef}
        className="sim-picture-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-picture-title"
        tabIndex={-1}
      >
        <header className="sim-picture-head">
          <div>
            <h2 id="sim-picture-title">{t('制作图案魔方', 'Create a picture cube')}</h2>
          </div>
          <ClearButton
            variant="standalone"
            className="sim-picture-icon-btn"
            onClick={() => {
              if (cropFace) setCropFace(null);
              else onClose();
            }}
            ariaLabel={cropFace ? t('返回六面', 'Back to faces') : t('关闭', 'Close')}
          />
        </header>

        {cropFace && editSources[cropFace] ? (
          <PictureCropWorkspace
            key={cropFace}
            face={cropFace}
            source={editSources[cropFace]}
            initialCrop={faceCrops[cropFace]}
            order={order}
            busy={busy}
            onReplace={() => {
              setTargetFace(cropFace);
              faceInputRef.current?.click();
            }}
            onApply={(crop) => { void applyCrop(cropFace, crop); }}
            t={t}
          />
        ) : (
          <>
            <div className="sim-picture-toolbar">
              <button type="button" className="sim-picture-bulk" disabled={busy} onClick={() => bulkInputRef.current?.click()}>
                {busy ? <Loader2 size={16} className="sim-spin" /> : <Upload size={16} />}
                {t('一次选择 6 张', 'Choose 6 at once')}
              </button>
              <span>{t('顺序:U R F D L B', 'Order: U R F D L B')}</span>
              <BoolToggle
                value={baseColors}
                disabled={busy}
                onChange={(next) => {
                  setBaseColors(next);
                  onBaseColorsChange(next);
                  setError('');
                }}
                label={t('保留原色', 'Keep face colors')}
              />
              <button
                type="button"
                className="sim-picture-clear-all"
                disabled={busy || count === 0}
                onClick={clearAllFaces}
                aria-label={t('清空 6 张图片', 'Clear all 6 images')}
                title={t('清空 6 张图片', 'Clear all 6 images')}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="sim-picture-net" aria-label={t('六面图片', 'Six face images')}>
              {PICTURE_FACE_ORDER.map((face) => {
                const [zh, en] = PICTURE_FACE_LABELS[face];
                const hasImage = !!draft[face];
                return (
                  <div className="sim-picture-face" data-face={face} key={face}>
                    <button
                      type="button"
                      className="sim-picture-face-main"
                      onClick={() => {
                        if (hasImage) setCropFace(face);
                        else {
                          setTargetFace(face);
                          faceInputRef.current?.click();
                        }
                      }}
                      disabled={busy}
                      aria-label={hasImage ? t(`调整${zh}图片`, `Adjust ${en} image`) : t(`上传${zh}图片`, `Upload ${en} image`)}
                    >
                      {hasImage
                        ? <img src={draft[face]} alt="" />
                        : <ImagePlus size={22} />}
                      {hasImage && <em><Crop size={12} />{t('调整', 'Adjust')}</em>}
                      <span>{face}</span>
                    </button>
                    {hasImage && (
                      <button
                        type="button"
                        className="clear-btn clear-btn--standalone sim-picture-face-remove"
                        disabled={busy}
                        onClick={() => removeFace(face)}
                        aria-label={t(`删除${zh}图片`, `Remove ${en} image`)}
                        title={t(`删除${zh}图片`, `Remove ${en} image`)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sim-picture-notes">
              <span>{t(`已设置 ${count}/6 面`, `${count}/6 faces set`)}</span>
              <span>{t('更改会自动保存在当前浏览器,不会上传到服务器', 'Changes are saved automatically in this browser and are not uploaded to a server')}</span>
            </div>
          </>
        )}
        <input ref={bulkInputRef} type="file" accept="image/*" multiple hidden onChange={handleBulkFiles} />
        <input ref={faceInputRef} type="file" accept="image/*" hidden onChange={handleFaceFile} />
        {error && <p className="sim-picture-error" role="status">{error}</p>}
      </section>
    </div>
  );
  return createPortal(dialog, document.body);
}

