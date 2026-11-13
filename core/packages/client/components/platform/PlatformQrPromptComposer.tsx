'use client';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { assembleQrArtPrompt, composeQrArtPrompt, FALLBACK_QR_PROMPT_LIBRARY, getQrPromptLibrary, QR_PROMPT_DIMENSIONS, type QrPromptDimension, type QrPromptLibrary } from '@/lib/platform-qr-prompt';
import styles from './PlatformQrCardStudio.module.css';

export function PromptComposer({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [library, setLibrary] = useState<QrPromptLibrary>(FALLBACK_QR_PROMPT_LIBRARY);
  const [libraryError, setLibraryError] = useState('');
  const [selected, setSelected] = useState<Partial<Record<QrPromptDimension, string>>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getQrPromptLibrary(controller.signal).then(setLibrary).catch((error: Error) => { if (!controller.signal.aborted) setLibraryError(error.message); });
    return () => controller.abort();
  }, []);

  const pickBlock = (dimension: QrPromptDimension, id: string) => {
    const next = { ...selected, [dimension]: selected[dimension] === id ? undefined : id };
    setSelected(next);
    onChange(composeQrArtPrompt(next, library.blocks));
  };

  const usePreset = (body: string) => {
    setSelected({});
    onChange(assembleQrArtPrompt(body));
  };

  const copyPrompt = async () => {
    const prompt = value.trim();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const area = document.createElement('textarea');
      area.value = prompt;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className={styles.promptComposer} aria-labelledby="qr-prompt-title">
      {libraryError ? <p role="alert">{libraryError}</p> : null}
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>{t('AI 艺术辅助', 'AI artwork helper')}</span>
          <h3 id="qr-prompt-title">{t('背景图提示词组合器', 'Artwork prompt composer')}</h3>
        </div>
        <AppLink className={styles.detailLink} href="/platform/admin/qr/prompts" target="_blank" rel="noreferrer" prefetch={false}>
          {t('管理提示词', 'Manage prompts')}<ExternalLink aria-hidden />
        </AppLink>
      </div>
      <p className={styles.promptIntro}>{t(
        '按维度各选一项，或直接套用整套模板；生成后仍可手动修改。复制到生图工具，下载竖版无水印原图，再上传到卡片。语录与品牌名由卡片单独叠加。',
        'Choose one block from each dimension or use a complete preset, then edit freely. Copy it into an image generator, download a vertical unwatermarked image, and upload it to the card. Copy and brand are overlaid separately.',
      )}</p>
      <div className={styles.promptWorkbench}>
        <div className={styles.promptBlocks}>
          {QR_PROMPT_DIMENSIONS.map((dimension) => {
            const options = library.blocks.filter((block) => block.dimension === dimension.key);
            if (!options.length) return null;
            return (
              <div key={dimension.key} className={styles.promptDimension}>
                <div><strong>{t(dimension.zh, dimension.en)}</strong><span>{t(dimension.hintZh, dimension.hintEn)}</span></div>
                <div className={styles.promptChoices}>
                  {options.map((block) => (
                    <button
                      className={styles.promptChoice}
                      key={block.id}
                      type="button"
                      aria-pressed={selected[dimension.key] === block.id}
                      title={block.body}
                      onClick={() => pickBlock(dimension.key, block.id)}
                    >{t(block.nameZh, block.nameEn)}</button>
                  ))}
                </div>
              </div>
            );
          })}
          <details className={styles.promptPresets}>
            <MoreToggle as="summary">{t('整套现成模板', 'Complete presets')}</MoreToggle>
            <div className={styles.promptChoices}>
              {library.presets.map((preset) => (
                <button className={styles.promptChoice} key={preset.id} type="button" title={preset.body} onClick={() => usePreset(preset.body)}>{t(preset.nameZh, preset.nameEn)}</button>
              ))}
            </div>
          </details>
        </div>
        <div className={styles.promptEditor}>
          <label>
            <span>{t('可编辑提示词', 'Editable prompt')}</span>
            <textarea
              className={styles.promptTextarea}
              value={value}
              maxLength={4000}
              rows={12}
              placeholder={t('从左边选择积木或模板，也可以直接在这里编写。', 'Choose blocks or a preset on the left, or write directly here.')}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          <div className={styles.promptActions}>
            <button type="button" className="platform-button platform-button-primary" disabled={!value.trim()} onClick={() => { void copyPrompt(); }}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? t('已复制', 'Copied') : t('复制提示词', 'Copy prompt')}
            </button>
            {value.trim() ? <button type="button" className={styles.textButton} onClick={() => { setSelected({}); onChange(''); }}>{t('清空', 'Clear')}</button> : null}
          </div>
          <p>{t('提示词会随“保存全部”写入当前二维码，方便下次复刻或微调。', 'The prompt is stored with this QR code when you save all changes, so it can be reproduced or refined later.')}</p>
        </div>
      </div>
    </section>
  );
}
