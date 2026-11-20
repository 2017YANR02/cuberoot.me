import { PRIVACY_DOCUMENT, type PrivacyNode } from '@cuberoot/shared/privacy';
import { applyNativeAppearance } from '../../lib/appearance';
import { getMiniProgramLocale, tr } from '../../lib/i18n';
import { isDouyinMiniProgram, miniProgramApi } from '../../lib/platform';

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
    if (isDouyinMiniProgram()) blocks.push(
      { kind: 'h2', text: tr({ zh: '抖音小程序 Stackmat 音频输入', en: 'Stackmat audio input in the Douyin mini program' }) },
      { kind: 'p', text: tr({
        zh: '打开 Stackmat 计时器或开始监听时，小程序会申请麦克风权限。设备在本机实时解码计时器信号，录音文件由系统临时保存，小程序不上传音频。停止监听或离开计时页时会结束采集。拒绝权限不影响普通计时。',
        en: 'Opening the Stackmat timer or starting listening requests microphone access. Timer signals are decoded on the device. The host creates temporary audio files and the mini program does not upload audio. Stopping listening or leaving the timer page ends capture. Declining access does not affect ordinary timing.',
      }) },
    );
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
