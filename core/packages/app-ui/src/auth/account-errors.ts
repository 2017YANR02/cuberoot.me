import type { AccountTranslate } from './credential-forms';

/** 把后端英文错误串 / HTTP 码翻成给用户看的本地化文案;未识别的原样回退。 */
export function authErrorText(raw: string, t: AccountTranslate): string {
  if (raw === 'invalid account session') return t('登录响应无效，请重新登录。', 'The sign-in response was invalid. Sign in again.');
  if (raw === 'account changed; sign in again') return t('当前账号已更改，请重新登录并确认。', 'Your account changed. Sign in and confirm again.');
  if (raw === 'identity already linked to another account') return t('这个登录方式已绑定其他账号，请先检查账号状态。', 'This sign-in method is linked to another account. Check your account first.');
  if (raw === 'identity ticket expired or already used') return t('本次登录已过期或已完成，请先检查账号状态，再重新登录。', 'This sign-in request expired or was already completed. Check your account before signing in again.');
  if (raw === 'session storage failed' || raw.includes('account choice requires browser storage')) return t('无法保存登录状态，请允许浏览器使用存储后重试。', 'Could not save your session. Allow browser storage and retry.');
  if (raw === 'account not found') return t('未找到已有账号，请使用原来绑定的登录方式。', 'No existing account found. Use a sign-in method already linked to your account.');
  const m = raw.toLowerCase();
  if (m.includes('too frequent')) return t('操作太频繁,请 60 秒后再试', 'Too many requests — please wait a minute');
  if (m.includes('wrong or expired')) return t('验证码错误或已过期', 'Wrong or expired code');
  if (m.includes('wrong email or password')) return t('邮箱或密码错误,或该邮箱未设密码', 'Wrong email or password (or no password set)');
  if (m.includes('wrong current password')) return t('当前密码不正确', 'Current password is incorrect');
  if (m.includes('phone not linked to an account')) return t('该手机号未绑定账号', 'No account is linked to this phone number');
  if (m.includes('confirmation does not match')) return t('输入的内容与账号标识不一致', "That doesn't match your account identifier");
  if (m.includes('cancel automatic renewal before deleting account')) return t('请先取消自动续费，确认退订成功后再注销账号。注销账号不会代替微信解约。', 'Cancel automatic renewal and confirm it has ended before deleting your account. Account deletion does not revoke your WeChat payment authorization.');
  if (m.includes('invalid password')) return t('密码至少 8 位', 'Password must be at least 8 characters');
  if (m.includes('not configured')) return t('该登录方式暂未开放', "This sign-in method isn't available yet");
  if (m.includes('account already has an email')) return t('原账号已绑定其他邮箱，请在账号设置中更换。', 'Your account already has another email. Change it in account settings.');
  if (m.includes('account already has a phone')) return t('原账号已绑定其他手机号，请在账号设置中更换。', 'Your account already has another phone number. Change it in account settings.');
  if (m.includes('already linked')) return t('该方式已绑定到另一个账号', 'Already linked to another account');
  if (m.includes('credential_conflict')) return t('两个账号存在重复登录凭据,请先在其中一个账号解绑同类方式或移除密码', 'The accounts have duplicate sign-in credentials. Unlink the duplicate type or remove one password first');
  if (m.includes('wca_conflict')) return t('两个账号绑定了不同的 WCA ID,不能自动合并', 'The accounts have different WCA IDs and cannot be merged automatically');
  if (m.includes('linked_data')) return t('待合并账号含有需要人工确认归属的数据,请联系管理员', 'The account contains data that needs an administrator to review');
  if (m.includes('data_conflict')) return t('两个账号存在无法自动合并的重复数据,原账号均未改动', 'The accounts contain conflicting data; neither account was changed');
  if (m.includes('already_merged')) return t('其中一个账号已经合并过', 'One of these accounts has already been merged');
  if (m.includes('invalid merge code')) return t('合并码格式不正确', 'Invalid merge code');
  if (m.includes('invalid email')) return t('邮箱格式不正确', 'Invalid email address');
  // 只支持中国大陆号(sms.ts 走的是国内通道)。旧文案「手机号格式不正确」对一个合法的
  // 美国号码是句假话,人家会以为自己填错了。说清楚不支持,并指路还能用的方式。
  if (m.includes('invalid phone')) return t('请输入 11 位中国大陆手机号。国外号码暂不支持,可用邮箱 / WCA / Google 登录', 'Enter an 11-digit mainland China number. Other countries aren’t supported yet — use email, WCA or Google instead');
  if (m.includes('invalid input')) return t('输入有误,请检查', 'Invalid input');
  if (m.includes('send failed')) return t('发送失败,请稍后重试', 'Send failed — please try again');
  if (m.includes('popup_closed')) return t('登录窗口已关闭', 'Sign-in window closed');
  if (m.includes('popup_failed_to_open')) return t('无法打开登录窗口,请检查浏览器弹窗拦截', 'Could not open sign-in window — check your popup blocker');
  if (m.includes('apple sign-in requires browser storage')) return t('请允许浏览器存储后重试 Apple 登录', 'Allow browser storage and try Apple sign-in again');
  if (m.includes('apple authorization requires system browser')) return t('请更新 App 后在系统浏览器中完成 Apple 授权', 'Update the app and complete Apple authorization in the system browser');
  if (m.startsWith('apple linking requires canonical site: ')) return t('请先在以下网站登录已有账号，再绑定 Apple：', 'Sign in to your existing account on this site before linking Apple: ') + raw.slice('Apple linking requires canonical site: '.length);
  if (/invalid (wechat|qq|alipay|google|apple) (code|token|authorization|credential)/.test(m)) return t('第三方登录失败,请重试', 'Third-party sign-in failed — please try again');
  if (m.includes('apple service unavailable') || m.includes('account service unavailable') || m.includes('http 404') || /http 5\d\d/.test(m)) return t('服务暂时不可用,请稍后重试', 'Service temporarily unavailable — please try again');
  return raw;
}
