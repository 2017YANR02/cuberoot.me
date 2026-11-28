import { ACCOUNT_PROVIDER_LABELS } from '@cuberoot/shared/account';
import type { PendingIdentity } from '@cuberoot/shared/auth/web-session';
import type { AccountTranslate } from './credential-forms';

export function accountChoiceCopy(provider: PendingIdentity['provider'], t: AccountTranslate) {
  const label = ACCOUNT_PROVIDER_LABELS[provider];
  const name = t(label.zh, label.en);
  return {
    keepAccount: t('保留原账号的会员和资料。', 'Keep your existing membership and profile.'),
    verify: t(`请用原来的登录方式验证账号，再绑定${name}。不会创建新账号。`,
      `Sign in with a method already linked to your account, then link ${name}. No new account will be created.`),
    title: t(`绑定 ${name}`, `Link ${name}`),
  };
}

export function accountLinkTarget(name: string | undefined, uid: number) {
  return name ? `${name} · ID ${uid}` : `ID ${uid}`;
}
