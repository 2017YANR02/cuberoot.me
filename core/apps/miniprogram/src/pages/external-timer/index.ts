import { startExternalTimer, disconnectExternalTimer, type NativeTimerKind } from '../../lib/external-timer/session';
import { getStoredSessionSnapshot } from '../../lib/auth';
import { openRequiredSessionLogin } from '../../lib/required-session';
import { miniProgramApi } from '../../lib/platform';
import { tr } from '../../lib/i18n';

Page({
  data: {
    mode: '', token: '', busy: false, error: '', connected: false,
    copy: {
      title: tr({ en: 'Connect timer', zh: '连接计时器' }),
      gan: 'GAN', qiyi: tr({ en: 'QiYi timer / adapter', zh: '奇艺计时器／适配器' }),
      stackmat: tr({ en: 'Start Stackmat audio input', zh: '启动 Stackmat 音频输入' }),
      audioHint: tr({ en: 'Connect the timer to the headset microphone input. Audio is decoded on this device and is not uploaded. Recording ends after 10 minutes or an interruption; reconnect to continue.', zh: '请将计时器接到有线耳麦输入。音频仅在本机解码，不上传；录音满 10 分钟或被中断后，需要重新连接。' }),
      busy: tr({ en: 'Connecting…', zh: '正在连接…' }),
      disconnect: tr({ en: 'Disconnect', zh: '断开连接' }),
    },
  },
  returning: false,
  active: false,
  onLoad(options: Record<string, string | undefined>) {
    this.active = true;
    const mode = options.mode === 'stackmat' ? 'stackmat' : 'bluetooth-timer';
    const token = options.token ?? '';
    if (!getStoredSessionSnapshot().session) {
      openRequiredSessionLogin({ tab: false, url: `/pages/external-timer/index?mode=${mode}&token=${encodeURIComponent(token)}` });
      return;
    }
    this.setData({ mode, token });
    miniProgramApi().setNavigationBarTitle({ title: this.data.copy.title });
  },
  onUnload() { this.active = false; if (!this.returning) void disconnectExternalTimer(); },
  async connect(event: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || !this.data.token) return;
    const kind = event.currentTarget.dataset.kind as NativeTimerKind;
    if (!['gan-timer', 'qiyi-timer', 'stackmat-mic'].includes(kind)) return;
    this.setData({ busy: true, error: '' });
    try {
      await startExternalTimer(this.data.token, kind);
      if (!this.active) { await disconnectExternalTimer(); return; }
      this.setData({ connected: true });
      this.returning = true;
      miniProgramApi().switchTab({ url: '/pages/timer/index', fail: () => { this.returning = false; void disconnectExternalTimer(); } });
    } catch (error) {
      if (this.active) this.setData({ error: error instanceof Error ? error.message : tr({ en: 'Connection failed', zh: '连接失败' }) });
    } finally { if (this.active) this.setData({ busy: false }); }
  },
  disconnect() { void disconnectExternalTimer(); this.setData({ connected: false }); },
});
