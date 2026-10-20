import { PRIVACY_DOCUMENT, type PrivacyNode } from '@cuberoot/shared/privacy';
import { applyNativeAppearance } from '../../lib/appearance';
import { getMiniProgramLocale, tr } from '../../lib/i18n';
import { miniProgramApi } from '../../lib/platform';

function text(node: PrivacyNode, locale: 'zh' | 'en'): string {
  return 'zh' in node ? node[locale] : node.children.map(child => text(child, locale)).join('');
}

Page({
  data: { appearanceStyle: '', blocks: [] as Array<{ kind: string; text: string }>, links: [] as Array<{ label: string; value: string }>, copyLabel: '' },
  onShow() {
    const locale = getMiniProgramLocale();
    const blocks: Array<{ kind: string; text: string }> = [];
    const links: Array<{ label: string; value: string }> = [];
    function collect(node: PrivacyNode) {
      if ('zh' in node) return;
      if (node.tag === 'ul') node.children.forEach(collect);
      else blocks.push({ kind: node.tag, text: text(node, locale) });
      function collectLinks(child: PrivacyNode) {
        if ('zh' in child) return;
        if (child.tag === 'a' && child.href) {
          links.push({ label: text(child, locale), value: child.href.replace(/^mailto:/, '') });
        }
        child.children.forEach(collectLinks);
      }
      if (node.tag !== 'ul') collectLinks(node);
    }
    PRIVACY_DOCUMENT.forEach(collect);
    this.setData({ blocks, links, copyLabel: tr({ zh: '复制', en: 'Copy' }) });
    miniProgramApi().setNavigationBarTitle({ title: tr({ zh: '协议与隐私', en: 'Agreement and privacy' }) });
    applyNativeAppearance();
  },
  copyLink(event: { currentTarget: { dataset: { index?: number | string } } }) {
    const link = this.data.links[Number(event.currentTarget.dataset.index)];
    if (!link) return;
    miniProgramApi().setClipboardData({ data: link.value });
  },
});
