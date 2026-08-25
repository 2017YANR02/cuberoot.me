/**
 * Bark 推送 —— 移植自 Python /opt/wca-monitor/monitor_utils.py 的 send_bark,
 * 加一道 MONITOR_PUSH_ENABLED 安全门。
 *
 * 双跑期(dual-run)安全门:!ENABLED || !KEY 时不真发,只打一行 DRY 日志并返回 true。
 * 返回 true 让调用方照常把 uid 标记为「已推送」—— 这样灰度期持续把新纪录当「已知」吸收
 * 但不发推,等翻 flag 后只发真正新增的那批(对齐 Python 首跑静默吸收的行为)。
 */

const KEY = process.env.BARK_DEVICE_KEY || '';
const SERVER = (process.env.BARK_SERVER || 'https://api.day.app').replace(/\/$/, '');
const ENABLED = process.env.MONITOR_PUSH_ENABLED === '1';

export interface BarkOpts {
  title: string;
  body: string;
  url: string;
  group: string;
  sound?: string;
  level?: string;
}

/** Bark 推送。门关 / 无 key 时静默吸收(返 true);真发失败返 false 让调用方下轮重试。 */
export async function sendBark(o: BarkOpts): Promise<boolean> {
  if (!ENABLED || !KEY) {
    console.log('[monitor] DRY (push disabled) would push:', JSON.stringify({
      title: o.title, body: o.body, url: o.url, group: o.group,
    }));
    return true;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${SERVER}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_key: KEY,
        title: o.title,
        body: o.body,
        url: o.url,
        group: o.group,
        level: o.level || 'timeSensitive',
        isArchive: '1',
        ...(o.sound ? { sound: o.sound } : {}),
      }),
      signal: ctrl.signal,
    });
    const result = (await res.json()) as { code?: number };
    if (result.code !== 200) {
      console.warn('[monitor] Bark push abnormal:', JSON.stringify(result));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[monitor] Bark push error:', (e as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
