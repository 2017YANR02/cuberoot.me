import { applyNativeAppearance } from '../../lib/appearance';
import { createContactView } from '../../lib/native-contact';
import { tr } from '../../lib/i18n';
import { miniProgramApi } from '../../lib/platform';
import { showPublicShareMenu } from '../../lib/share';

export function createContactPageOptions() {
  return {
    data: { appearanceStyle: '', contact: createContactView(), accountError: '' },
    onShow() {
      const contact = createContactView();
      contact.websiteLabel = tr({ zh: '复制网址', en: 'Copy website address' });
      this.setData({ contact });
      applyNativeAppearance();
      miniProgramApi().setNavigationBarTitle({ title: contact.title });
      showPublicShareMenu();
    },
    onShareAppMessage() {
      return { title: this.data.contact.title, path: '/pages/contact/index' };
    },
    onShareTimeline() { return { title: this.data.contact.title }; },
    openContactWebsite() {
      if (this.data.contact.platformFeedback) return;
      this.copyContactValue({ currentTarget: { dataset: { value: this.data.contact.websiteHref } } });
    },
    previewWechatQr() {
      if (this.data.contact.platformFeedback) return;
      const path = this.data.contact.qrPath;
      const fail = () => this.setData({ accountError: tr({ zh: '二维码暂时无法打开，请复制微信号。', en: 'Unable to open the QR code. Copy the WeChat ID instead.' }) });
      try { miniProgramApi().previewImage({ current: path, urls: [path], fail }); } catch { fail(); }
    },
    copyContactValue(event: { currentTarget: { dataset: { value?: unknown } } }) {
      if (this.data.contact.platformFeedback) return;
      const value = event.currentTarget.dataset.value;
      const contact = this.data.contact;
      const allowed = new Set([
        contact.websiteHref,
        ...contact.platforms.map(platform => platform.href),
        ...contact.details.map(detail => detail.actionValue),
      ]);
      if (typeof value !== 'string' || !value || !allowed.has(value)) return;
      this.setData({ accountError: '' });
      const fail = () => this.setData({ accountError: tr({ zh: '复制失败，请重试。', en: 'Unable to copy. Please retry.' }) });
      try { miniProgramApi().setClipboardData({ data: value, fail }); } catch { fail(); }
    },
  } satisfies WechatMiniprogram.Page.Options<{
    appearanceStyle: string; contact: ReturnType<typeof createContactView>; accountError: string;
  }, WechatMiniprogram.Page.CustomOption>;
}

Page(createContactPageOptions());
