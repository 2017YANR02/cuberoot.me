export type ReconImageStyle = 'black' | 'white' | 'white-outline';
export type ReconImageFont = 'original' | 'roboto-condensed';

/** Capture the displayed reconstruction using the site's existing DOM image exporter. */
export async function exportReconImages(source: HTMLElement, styles: readonly ReconImageStyle[] = ['black', 'white'], font: ReconImageFont = 'original'): Promise<{ color: ReconImageStyle; blob: Blob }[]> {
  const { toBlob, getFontEmbedCSS } = await import('html-to-image');
  if (font === 'roboto-condensed') {
    const faces = await document.fonts.load('400 16px "Roboto Condensed"');
    if (!faces.length) throw new Error('Roboto Condensed font unavailable');
  }
  await document.fonts.ready;
  // F2L annotations load asynchronously; don't capture a partially loaded row.
  const deadline = Date.now() + 20000;
  while (source.querySelector('[aria-busy="true"]')) {
    if (!source.isConnected || Date.now() >= deadline) throw new Error('Reconstruction diagrams are not ready');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  // Keep the same CSS/colour context without changing the live player or selection.
  const snapshot = source.cloneNode(true) as HTMLElement;
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.inert = true;
  Object.assign(snapshot.style, {
    position: 'fixed', left: '-100000px', top: '0', width: 'max-content',
    maxWidth: 'none', margin: '0', padding: '12px', background: 'transparent',
  });
  snapshot.querySelectorAll('.recon-cross-toggle, .detail-cursor, .normalized-cross-copy').forEach(node => node.remove());
  snapshot.querySelectorAll('.recon-move-current').forEach(node => node.classList.remove('recon-move-current'));
  snapshot.querySelectorAll<HTMLElement>('.detail-scramble-line, .detail-solution-text').forEach(node => {
    Object.assign(node.style, { whiteSpace: 'pre', wordBreak: 'normal', overflow: 'visible', maxWidth: 'none' });
  });
  if (font === 'roboto-condensed') {
    snapshot.querySelectorAll<HTMLElement>('.detail-caption-header, .detail-scramble-line, .detail-solution-text, .recon-step-label, .recon-comment-link').forEach(node => {
      node.style.setProperty('font-family', '"Roboto Condensed", sans-serif', 'important');
      node.style.setProperty('font-weight', '400', 'important');
    });
  }
  source.parentElement!.append(snapshot);
  try {
    const fontEmbedCSS = await getFontEmbedCSS(snapshot);
    const images: { color: ReconImageStyle; blob: Blob }[] = [];
    for (const color of styles) {
      // Fixed export ink requested by the user, independent of the site's theme.
      // Only text changes; cube stickers and colour-chip borders keep their colours.
      snapshot.querySelectorAll<HTMLElement>('.detail-caption-header, .detail-scramble-line, .detail-solution-text, .recon-step-label, .recon-comment-link').forEach(node => {
        node.style.color = color === 'black' ? 'black' : 'white';
        node.style.webkitTextStroke = color === 'white-outline' ? '1.5px black' : '0px';
        // Stroke underneath the fill keeps the white letter interiors intact.
        node.style.paintOrder = 'stroke fill';
      });
      const blob = await toBlob(snapshot, {
        pixelRatio: 3, fontEmbedCSS,
        style: { position: 'static', left: 'auto', top: 'auto' },
      });
      if (!blob) throw new Error('Reconstruction PNG export failed');
      images.push({ color, blob });
    }
    return images;
  } finally {
    snapshot.remove();
  }
}
