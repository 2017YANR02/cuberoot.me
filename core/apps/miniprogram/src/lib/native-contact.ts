import {
  CONTACT_DIRECT_DETAILS,
  CONTACT_GROUP_SECTIONS,
  CONTACT_JOIN_INSTRUCTION,
  CONTACT_SOCIAL_PLATFORMS,
  CONTACT_WEBSITE,
  CONTACT_WECHAT_ID,
  type ContactDirectDetailId,
  type ContactPlatformId,
} from '@cuberoot/shared/contact';
import { getMiniProgramLocale, tr } from './i18n';
import { isDouyinMiniProgram } from './platform';

const CONTACT_PLATFORM_ICON_PATHS: Record<ContactPlatformId, string> = {
  youtube: '/assets/contact/youtube.png',
  tiktok: '/assets/contact/tiktok.png',
  instagram: '/assets/contact/instagram.png',
  bilibili: '/assets/contact/bilibili.png',
  douyin: '/assets/contact/douyin.png',
  xiaohongshu: '/assets/contact/xiaohongshu.png',
  kuaishou: '/assets/contact/kuaishou.png',
  'wechat-official': '/assets/contact/wechat.png',
};
const CONTACT_DETAIL_ICON_PATHS: Record<ContactDirectDetailId, string> = {
  author: '/assets/contact/author.png',
  wechat: '/assets/contact/wechat.png',
  qq: '/assets/contact/qq.png',
  email: '/assets/contact/email.png',
  discord: '/assets/contact/discord.png',
};
export function createContactView() {
  const contactLocale = getMiniProgramLocale();
  if (isDouyinMiniProgram()) return {
    platformFeedback: true,
    feedbackInstruction: tr({ zh: '打开右上角菜单，选择「反馈」，提交问题描述和截图。', en: 'Open the top-right menu and choose Feedback to send a description and screenshots.' }, contactLocale),
    feedbackPrivacy: tr({ zh: '请勿提交密码、验证码或其他敏感信息。', en: 'Do not include passwords, verification codes or other sensitive information.' }, contactLocale),
    eyebrow: tr({ zh: '支持', en: 'SUPPORT' }, contactLocale),
    title: tr({ zh: '问题反馈', en: 'Feedback' }, contactLocale),
    joinInstructionAfter: '', joinInstructionBefore: '', joinInstructionValue: '', joinTitle: '',
    qrAria: '', qrPath: '', websiteLabel: '', website: '', websiteHref: '',
    platforms: [], details: [], sections: [],
  };
  const joinInstruction = tr(CONTACT_JOIN_INSTRUCTION, contactLocale);
  const [joinInstructionBefore, joinInstructionAfter = ''] = joinInstruction.split(CONTACT_WECHAT_ID);
  return {
    platformFeedback: false, feedbackInstruction: '', feedbackPrivacy: '',
    eyebrow: tr({ en: 'CONTACT & COMMUNITY', zh: '联系与社群' }, contactLocale),
    joinInstructionAfter,
    joinInstructionBefore,
    joinInstructionValue: CONTACT_WECHAT_ID,
    joinTitle: tr({ en: 'How to join', zh: '进群方法' }, contactLocale),
    qrAria: tr({ en: 'View WeChat QR code', zh: '查看微信二维码' }, contactLocale),
    qrPath: '/assets/contact/ruimin-wechat-qr.jpg',
    title: tr({ en: 'Contact', zh: '联系方式' }, contactLocale),
    websiteLabel: tr({ en: 'Website', zh: '网站' }, contactLocale),
    website: CONTACT_WEBSITE,
    websiteHref: `https://${CONTACT_WEBSITE}`,
    platforms: [...CONTACT_SOCIAL_PLATFORMS]
      .sort((a, b) => Number(b.language === contactLocale) - Number(a.language === contactLocale))
      .map((platform) => ({
        account: platform.account,
        count: platform.count ? tr(platform.count, contactLocale) : '',
        href: platform.href ?? '',
        icon: CONTACT_PLATFORM_ICON_PATHS[platform.id],
        id: platform.id,
        label: tr(platform.label, contactLocale),
      })),
    details: CONTACT_DIRECT_DETAILS.map((detail) => {
      const value = detail.value ? tr(detail.value, contactLocale) : '';
      return {
        action: detail.action,
        actionValue: detail.action === 'link' ? detail.href ?? '' : value,
        icon: CONTACT_DETAIL_ICON_PATHS[detail.id],
        id: detail.id,
        label: tr(detail.label, contactLocale),
        showQr: detail.showQr,
        value,
      };
    }),
    sections: CONTACT_GROUP_SECTIONS.map((section, sectionIndex) => ({
      blocks: section.blocks.map((block) => ({
        groups: block.groups.map((group) => ({
          name: tr(group, contactLocale),
          secondaryName: contactLocale === 'en' ? group.zh : '',
        })),
        title: tr(block.title, contactLocale),
      })),
      description: tr(section.description, contactLocale),
      id: section.id,
      index: String(sectionIndex + 1).padStart(2, '0'),
      title: tr(section.title, contactLocale),
    })),
  };

}
