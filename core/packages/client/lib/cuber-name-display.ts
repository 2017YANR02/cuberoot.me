import { isDeletedOwner } from '@cuberoot/shared/account';
import {
  displayCuberName,
  extractChineseName,
  stripChineseParens,
} from '@cuberoot/shared/cuber-name-display';

export { displayCuberName, extractChineseName, stripChineseParens };

/**
 * 站内作者位的显示名。ownerId 是归属键(shared/account.ts):账号注销后,公开内容的作者键被
 * 换成墓碑 `deleted:<uid>`、姓名快照清空,这里把那个空位补成「已注销用户」。
 *
 * 为什么不在存的时候就写死「已注销用户」四个字:那是一句中文,英文界面会照原样吐出来。
 * 名字的语言归渲染层管,库里只留一个不带任何身份的键。
 */
export function ownerDisplayName(
  ownerId: string | null | undefined,
  rawName: string | null | undefined,
  isZh: boolean,
): string {
  if (isDeletedOwner(ownerId)) return isZh ? '已注销用户' : 'Deleted user';
  return displayCuberName(rawName || '', isZh);
}
