import type { Options } from 'docx-preview';

const paperStyles = `
  @font-face {
    font-family: "宋体";
    src: local("SimSun"), local("Songti SC Regular"), local("STSongti-SC-Regular"), local("Noto Serif CJK SC");
  }
  html { color-scheme: light; }
  body { margin: 0; }
  .docx-wrapper { container-type: inline-size; align-items: safe center; background: transparent; padding: 0 0 12px; gap: 12px; }
  .docx-wrapper > section.docx { margin: 0; }
  @supports (zoom: calc(1px / 1px)) {
    .docx-wrapper > section.docx { zoom: min(1, calc(100cqw / var(--docx-paper-width, 1px))); }
  }
`;

/** Render archived bytes for a sandboxed, script-free iframe. */
export async function renderDocxPreview(file: Blob, layout: 'flow' | 'paper' = 'flow') {
  const { renderAsync } = await import('docx-preview');
  const container = document.createElement('div');
  const styles = document.createElement('div');
  const preservePageLayout = layout === 'paper';
  const options: Partial<Options> = {
    useBase64URL: true,
    renderAltChunks: false,
    ignoreWidth: !preservePageLayout,
    ignoreLastRenderedPageBreak: !preservePageLayout,
  };
  await renderAsync(await file.arrayBuffer(), container, styles, options);

  if (preservePageLayout) {
    for (const page of container.querySelectorAll<HTMLElement>('section.docx')) {
      page.style.setProperty('--docx-paper-width', page.style.width);
    }
    for (const link of container.querySelectorAll('a[href]')) link.removeAttribute('href');
  }
  // Keep document-supplied style values inside their original style element on reparse.
  for (const style of styles.querySelectorAll('style')) {
    style.textContent = style.textContent?.replace(/<\//g, '<\\/') ?? '';
  }
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}">${styles.innerHTML}${preservePageLayout ? `<style>${paperStyles}</style>` : ''}</head><body>${container.innerHTML}</body></html>`;
}
