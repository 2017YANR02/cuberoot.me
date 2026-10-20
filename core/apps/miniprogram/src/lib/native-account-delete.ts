import { primaryHandle } from '@cuberoot/shared/account';
import { ApiError, clearStoredSession, fetchNativeAccountIdentities, getStoredSession, requestJson, type SessionData } from './auth';
import { applyNativeAppearance } from './appearance';
import { tr } from './i18n';
import { miniProgramApi } from './platform';
import { hidePublicShareMenu } from './share';

function copy() { return {
  title: tr({ zh: '注销账号', en: 'Delete account' }),
  warning: tr({ zh: '注销立即生效，无法撤销，也没有恢复期。', en: 'Deletion is immediate and irreversible, with no recovery period.' }),
  deleted: tr({ zh: '将删除登录方式、好友聊天及提醒、计时云备份、训练与公式进度、关注比赛、打乱标记、画板作品、反馈会话及私享和不公开列出的复盘。对方已复制的聊天内容不受影响。', en: 'Sign-in methods, friend conversations and notifications, timer backups, training and algorithm progress, followed competitions, scramble marks, drawings, feedback threads, and private or unlisted reconstructions will be deleted. Copies of conversations made by others are unaffected.' }),
  retained: tr({ zh: '公开复盘、论坛内容、评论和公式提交保留，作者不再关联你的账号；交易记录作为对账凭证保留。', en: 'Public reconstructions, forum content, comments and algorithm submissions remain without being linked to your account. Transaction records are retained for accounting.' }),
  subscription: tr({ zh: '注销不会取消 Apple 或 Google Play 自动续费，请先在对应商店取消订阅；注销后的购买记录不能恢复到新账号。', en: 'Deletion does not cancel Apple or Google Play auto-renewal. Cancel store subscriptions first; purchases cannot be restored to a new account after deletion.' }),
  confirm: tr({ zh: '输入下方账号标识确认', en: 'Type the account identifier below to confirm' }),
  password: tr({ zh: '当前密码', en: 'Current password' }),
  showPassword: tr({ zh: '显示密码', en: 'Show password' }),
  hidePassword: tr({ zh: '隐藏密码', en: 'Hide password' }),
  clear: tr({ zh: '清除', en: 'Clear' }),
  submit: tr({ zh: '永久注销账号', en: 'Permanently delete account' }),
  retry: tr({ zh: '重新读取账号', en: 'Reload account' }),
  done: tr({ zh: '账号已注销', en: 'Account deleted' }),
}; }
interface DeleteData {
  appearanceStyle: string; copy: ReturnType<typeof copy>; handle: string;
  confirm: string; password: string; showPassword: boolean; hasPassword: boolean;
  busy: boolean; error: string; done: boolean;
}
interface DeletePage { data: DeleteData; setData(value: Partial<DeleteData>): void }
const sessions = new WeakMap<object, SessionData>();
const attempts = new WeakMap<object, object>();
function invalidate(page: DeletePage) {
  attempts.delete(page); sessions.delete(page);
  page.setData({ confirm: '', password: '', showPassword: false, handle: '', busy: false });
}
export function createNativeAccountDeletePageOptions() {
  return {
    data: { appearanceStyle: '', copy: copy(), handle: '', confirm: '', password: '', showPassword: false, hasPassword: false, busy: false, error: '', done: false } as DeleteData,
    onShow() {
      this.setData({ copy: copy() }); applyNativeAppearance(); hidePublicShareMenu();
      miniProgramApi().setNavigationBarTitle({ title: copy().title });
      if (!this.data.done) void this.loadAccount();
    },
    onHide() { invalidate(this); },
    onUnload() { invalidate(this); },
    async loadAccount() {
      if (this.data.busy || this.data.done) return;
      const session = getStoredSession();
      if (!session?.user.uid) {
        this.setData({ error: tr({ zh: '请先在「我的」登录账号。', en: 'Sign in from Me first.' }) }); return;
      }
      const attempt = {}; attempts.set(this, attempt);
      this.setData({ busy: true, error: '', handle: '', confirm: '', password: '' });
      try {
        const result = await fetchNativeAccountIdentities(session, () => attempts.get(this) === attempt);
        if (attempts.get(this) !== attempt) return;
        sessions.set(this, session);
        this.setData({ handle: primaryHandle(result.identities, session.user.uid), hasPassword: result.hasPassword });
      } catch {
        if (attempts.get(this) === attempt) this.setData({ error: tr({ zh: '无法读取账号信息，请重新登录或重试。', en: 'Cannot load account details. Sign in again or retry.' }) });
      } finally { if (attempts.get(this) === attempt) this.setData({ busy: false }); }
    },
    inputConfirm(event: WechatMiniprogram.Input) { if (!this.data.busy) this.setData({ confirm: event.detail.value }); },
    inputPassword(event: WechatMiniprogram.Input) { if (!this.data.busy) this.setData({ password: event.detail.value }); },
    clearConfirm() { if (!this.data.busy) this.setData({ confirm: '' }); },
    togglePassword() { this.setData({ showPassword: !this.data.showPassword }); },
    deleteAccount() {
      const session = sessions.get(this);
      if (this.data.busy || this.data.done || !session || !this.data.handle) return;
      if (this.data.confirm.trim().toLowerCase() !== this.data.handle.toLowerCase() || (this.data.hasPassword && !this.data.password)) {
        this.setData({ error: tr({ zh: '请正确填写账号标识和所需密码。', en: 'Enter the matching identifier and required password.' }) }); return;
      }
      const attempt = {}; attempts.set(this, attempt);
      const current = () => attempts.get(this) === attempt && getStoredSession()?.token === session.token;
      this.setData({ busy: true, error: '' });
      const release = () => { if (attempts.get(this) === attempt) this.setData({ busy: false }); };
      let handled = false;
      try { miniProgramApi().showModal({
        title: copy().title, content: copy().warning,
        confirmText: tr({ zh: '注销', en: 'Delete' }), cancelText: tr({ zh: '取消', en: 'Cancel' }),
        success: async result => {
          if (handled || attempts.get(this) !== attempt) return;
          handled = true;
          if (!result.confirm) { release(); return; }
          if (!current()) { invalidate(this); this.setData({ error: tr({ zh: '账号已变化，请重新读取。', en: 'The account changed. Reload it.' }) }); return; }
          try {
            const response = await requestJson<{ ok?: boolean }>('/auth/account/delete', {
              method: 'POST', token: session.token, body: { confirm: this.data.confirm.trim(), ...(this.data.hasPassword ? { password: this.data.password } : {}) },
            });
            if (response?.ok !== true) throw new Error('invalid deletion response');
            // The confirmed account is deleted even if this page was hidden.
            // Never clear a different account that signed in during the request.
            const cleared = getStoredSession()?.token !== session.token || clearStoredSession();
            if (attempts.get(this) !== attempt) return;
            this.setData({ done: true, password: '', confirm: '', handle: '', error: cleared ? '' : tr({ zh: '账号已注销，但本机登录缓存清除失败，请在「我的」重试退出。', en: 'Account deleted, but local session cleanup failed. Retry signing out from Me.' }) });
            sessions.delete(this);
          } catch (error) {
            if (attempts.get(this) === attempt) this.setData({ password: '', error: error instanceof ApiError && error.status === 409
              ? tr({ zh: '账号存在未处理的组织或会员合约，请先完成处理后再注销。', en: 'Resolve outstanding organization ownership or membership contracts before deleting the account.' })
              : tr({ zh: '未能确认注销结果，请核对账号状态和密码；不会自动重试注销。', en: 'Could not confirm deletion. Check account status and password; deletion will not be retried automatically.' }) });
          } finally { release(); }
        }, fail: release,
      }); } catch { release(); }
    },
  } satisfies WechatMiniprogram.Page.Options<DeleteData, WechatMiniprogram.Page.CustomOption>;
}
