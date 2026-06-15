'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMosaicStore } from '../state/store';

function stripExt(name: string) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export default function UploadStage() {
  const { t } = useTranslation();
  const setImage = useMosaicStore(s => s.setImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      setError(t('mosaic.upload.errNotImage'));
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError(t('mosaic.upload.errTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setImage(reader.result as string, stripExt(f.name));
    };
    reader.onerror = () => setError(t('mosaic.upload.errRead'));
    reader.readAsDataURL(f);
  }, [setImage, t]);

  return (
    <>
      <div
        className={`mosaic-dropzone ${drag ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <div className="mosaic-dropzone-icon">📷</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{t('mosaic.upload.title')}</div>
        <div className="mosaic-dropzone-hint">{t('mosaic.upload.hint')}</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {error && <div style={{ color: 'var(--danger)', marginTop: 12, textAlign: 'center' }}>{error}</div>}

      <div className="mosaic-faq">
        <h3>{t('mosaic.faq.q1')}</h3>
        <p>{t('mosaic.faq.a1')}</p>
        <h3>{t('mosaic.faq.q2')}</h3>
        <p>{t('mosaic.faq.a2')}</p>
        <h3>{t('mosaic.faq.q3')}</h3>
        <p>{t('mosaic.faq.a3')}</p>
        <h3>{t('mosaic.faq.q4')}</h3>
        <p>{t('mosaic.faq.a4')}</p>
      </div>
    </>
  );
}
