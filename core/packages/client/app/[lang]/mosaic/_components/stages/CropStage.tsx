'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { useMosaicStore } from '../state/store';

export default function CropStage() {
  const { t } = useTranslation();
  const origImgSrc = useMosaicStore(s => s.origImgSrc);
  const cropConfig = useMosaicStore(s => s.cropConfig);
  const setCropConfig = useMosaicStore(s => s.setCropConfig);
  const setBaseImage = useMosaicStore(s => s.setBaseImage);

  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!imgRef.current || !origImgSrc) return;
    const c = new Cropper(imgRef.current, {
      aspectRatio: cropConfig.cubeWidth / cropConfig.cubeHeight,
      dragMode: 'move',
      center: false,
      autoCropArea: 0.999,
      viewMode: 1,
      minCropBoxWidth: 25,
      minCropBoxHeight: 25,
    });
    cropperRef.current = c;
    return () => { c.destroy(); cropperRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origImgSrc]);

  // Sync aspect ratio when W/H changes
  useEffect(() => {
    if (!cropperRef.current) return;
    if (cropConfig.cubeWidth * cropConfig.cubeHeight > 1) {
      cropperRef.current.setAspectRatio(cropConfig.cubeWidth / cropConfig.cubeHeight);
    }
  }, [cropConfig.cubeWidth, cropConfig.cubeHeight]);

  const onNext = () => {
    if (!cropperRef.current) return;
    setWorking(true);
    // Give the UI a tick to show "working" state
    setTimeout(() => {
      const { cubeDimen, cubeWidth, cubeHeight } = cropConfig;
      const pixelW = cubeWidth * cubeDimen;
      const pixelH = cubeHeight * cubeDimen;
      const cropped = cropperRef.current!.getCroppedCanvas({ fillColor: '#fff' });
      const work = document.createElement('canvas');
      work.width = pixelW;
      work.height = pixelH;
      const ctx = work.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cropped, 0, 0, pixelW, pixelH);
      setBaseImage(ctx.getImageData(0, 0, pixelW, pixelH));
      setWorking(false);
    }, 10);
  };

  const total = cropConfig.cubeWidth * cropConfig.cubeHeight;

  return (
    <>
      <div className="mosaic-crop-controls">
        <label>{t('mosaic.crop.width')}</label>
        <input
          type="number"
          min={2}
          max={999}
          value={cropConfig.cubeWidth}
          onChange={e => setCropConfig({ cubeWidth: Math.max(2, Math.min(999, Number(e.target.value) || 2)) })}
        />
        <span>×</span>
        <label>{t('mosaic.crop.height')}</label>
        <input
          type="number"
          min={2}
          max={999}
          value={cropConfig.cubeHeight}
          onChange={e => setCropConfig({ cubeHeight: Math.max(2, Math.min(999, Number(e.target.value) || 2)) })}
        />
        <span>= <strong>{total}</strong> {cropConfig.cubeDimen === 1 ? t('mosaic.crop.pixels') : t('mosaic.crop.cubes')}</span>

        <label style={{ marginLeft: 12 }}>{t('mosaic.crop.cubeSize')}</label>
        <select
          className="mosaic-crop-select"
          value={cropConfig.cubeDimen}
          onChange={e => setCropConfig({ cubeDimen: Number(e.target.value) })}
        >
          <option value={1}>{t('mosaic.crop.pixelArt')}</option>
          <option value={2}>2×2×2</option>
          <option value={3}>3×3×3</option>
          <option value={4}>4×4×4</option>
          <option value={5}>5×5×5</option>
          <option value={6}>6×6×6</option>
          <option value={7}>7×7×7</option>
        </select>

        <div style={{ marginLeft: 'auto' }}>
          <button className="mosaic-btn mosaic-btn-primary" onClick={onNext} disabled={working}>
            {working ? t('mosaic.crop.working') : t('mosaic.crop.next') + ' →'}
          </button>
        </div>
      </div>
      <div className="mosaic-crop-wrap">
        {origImgSrc && <img ref={imgRef} src={origImgSrc} alt="" />}
      </div>
      <div className="mosaic-cropper-note">{t('mosaic.crop.hint')}</div>
    </>
  );
}
