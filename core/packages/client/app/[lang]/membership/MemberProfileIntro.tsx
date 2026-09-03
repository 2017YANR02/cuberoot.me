'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { prepareImageUpload, uploadedImageUrl, uploadImageBlob } from '@/lib/image-upload';
import { setMyProfileIntro, type Membership } from '@/lib/membership-api';

const MAX_LENGTH = 1000;
const MAX_IMAGES = 8;

export default function MemberProfileIntro({ membership, onSaved }: {
  membership: Membership;
  onSaved: (intro: string | undefined, imageIds: number[]) => void;
}) {
  const initial = membership.profileIntro ?? '';
  const initialImageIds = membership.profileImageIds ?? [];
  const [intro, setIntro] = useState(initial);
  const [imageIds, setImageIds] = useState(initialImageIds);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const slots = MAX_IMAGES - imageIds.length;
    if (files.length === 0) return;
    if (slots <= 0) return setError(tr({ zh: '最多上传 8 张图片。', en: 'You can upload up to 8 images.' }));
    setUploading(true);
    setSaved(false);
    setError(null);
    try {
      for (const file of files.slice(0, slots)) {
        const prepared = await prepareImageUpload(file, 1920);
        const image = await uploadImageBlob(prepared.dataB64, prepared.mime);
        setImageIds((current) => [...current, image.id].slice(0, MAX_IMAGES));
      }
      if (files.length > slots) setError(tr({ zh: '只上传了剩余可用的图片，最多保存 8 张。', en: 'Only the remaining image slots were uploaded; a profile can keep 8 images.' }));
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'unsupported_image_type'
        ? tr({ zh: '仅支持 PNG、JPEG 和 WebP 图片。', en: 'Only PNG, JPEG, and WebP images are supported.' })
        : tr({ zh: '图片上传失败，请稍后重试。', en: 'The image upload failed. Try again.' }));
    } finally {
      setUploading(false);
    }
  };

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await setMyProfileIntro(intro, imageIds);
      const next = result.profileIntro ?? undefined;
      setIntro(next ?? '');
      setImageIds(result.profileImageIds);
      onSaved(next, result.profileImageIds);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mem-profile">
      <h3 className="mem-contact-title">{tr({ zh: '个人介绍', en: 'Personal profile' })}</h3>
      <p className="mem-contact-hint">
        {tr({
          zh: '选填文字和图片。保存后会显示在你的 WCA 人物页，会员到期后自动隐藏。',
          en: 'Add optional text and images. Once saved, they appear on your WCA person page and are hidden automatically if your membership expires.',
        })}
      </p>
      <textarea
        className="mem-profile-input"
        value={intro}
        onChange={(event) => { setIntro(event.target.value); setSaved(false); }}
        placeholder={tr({ zh: '介绍一下自己', en: 'Introduce yourself' })}
        maxLength={MAX_LENGTH}
        rows={5}
      />
      <input
        ref={fileRef}
        className="mem-profile-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(event) => void addImages(event)}
      />
      <button
        type="button"
        className="mem-profile-upload"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || imageIds.length >= MAX_IMAGES}
      >
        <ImagePlus size={16} aria-hidden="true" />
        {uploading ? tr({ zh: '正在上传…', en: 'Uploading…' }) : tr({ zh: '选择图片', en: 'Choose images' })}
        <span>{imageIds.length}/{MAX_IMAGES}</span>
      </button>
      {imageIds.length > 0 && (
        <div className="mem-profile-images">
          {imageIds.map((id) => (
            <div className="mem-profile-image" key={id}>
              <img src={uploadedImageUrl(id)} alt="" />
              <button
                type="button"
                className="mem-profile-image-remove"
                onClick={() => { setImageIds((current) => current.filter((imageId) => imageId !== id)); setSaved(false); }}
                disabled={uploading}
                aria-label={tr({ zh: '移除图片', en: 'Remove image' })}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mem-profile-actions">
        <span className="mem-profile-count">{intro.length}/{MAX_LENGTH}</span>
        <button
          type="button"
          className="mem-contact-save"
          onClick={() => void save()}
          aria-label={tr({ zh: '保存个人资料', en: 'Save personal profile' })}
          disabled={saving || uploading || (
            intro.trim() === initial.trim()
            && imageIds.join(',') === initialImageIds.join(',')
          )}
        >
          {saved ? <Check size={14} aria-hidden="true" /> : saving ? '…' : tr({ zh: '保存', en: 'Save' })}
        </button>
      </div>
      {error && <div className="mem-pay-err" role="alert">{error}</div>}
    </section>
  );
}
