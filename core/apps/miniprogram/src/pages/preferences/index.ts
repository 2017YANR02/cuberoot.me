import { receiveNativePreferences } from '../../lib/preferences';
import { applyNativeAppearance } from '../../lib/appearance';
import { miniProgramApi } from '../../lib/platform';
import { tr } from '../../lib/i18n';

Page({
  data: { appearanceStyle: '', label: '' },
  onLoad(options: Record<string, string | undefined>) {
    const pages = getCurrentPages();
    try {
      let value: unknown;
      try { value = JSON.parse(options.value ?? ''); }
      catch { value = JSON.parse(decodeURIComponent(options.value ?? '')); }
      receiveNativePreferences(value, pages[pages.length - 2]);
    } catch { /* Invalid payloads cannot change saved settings. */ }
    this.setData({ label: tr({ en: 'Return', zh: '返回' }) });
    applyNativeAppearance();
  },
  onReady() { this.returnToPage(); },
  returnToPage() { miniProgramApi().navigateBack({ delta: 1 }); },
});
