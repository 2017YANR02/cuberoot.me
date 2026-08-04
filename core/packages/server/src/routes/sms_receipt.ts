/**
 * 短信送达回执 —— 阿里云 SmsReport「HTTP 批量推送」的落点。
 *
 * 为什么要有它:SendSms 同步返回的 `Code: OK` 只代表阿里云收下了,不代表短信送达。真正的
 * 结果是运营商几秒到几分钟后回的异步回执,阿里云攥在手里,不推给我们就永远看不见。
 * 2026-07-30 踩的就是这个:同步 OK、照常扣费、前端显示「已发送」,而回执是
 * PORT_NOT_REGISTERED(签名未完成运营商报备),用户一条都没收到,日志里干干净净 ——
 * 排查只能靠人肉去调 QuerySendDetails。account_auth 那几处 catch 补的是「同步失败」这半边,
 * 这个路由补的是「异步失败」那半边,合起来才闭环。
 *
 *   POST /v1/sms/receipt/:token    body 为 JSON 数组(一次可能推多条)
 *
 * 鉴权:控制台只能填一个 URL、加不了请求头,所以密钥只能放路径里(SMS_RECEIPT_TOKEN)。
 * 没配 token 就整个路由 404 —— 未启用的端点不该给出「存在但没权限」这种信息。
 *
 * 必须回 {"code":0,"msg":"接收成功"};否则阿里云按 1/5/10/30/60… 分钟重推,10 次后放弃。
 * 所以除了鉴权失败,一律回 200:我们只落日志、不落库,重推一遍也变不出新结果,让它一直
 * 重试反而把同一条噪音放大十倍。
 *
 * 回执不保证幂等(同一条可能推多次)。这里只打日志,重复无害,故不做去重。
 */
import { Hono } from 'hono';

export const smsReceiptRoutes = new Hono();

const RECEIPT_TOKEN = process.env.SMS_RECEIPT_TOKEN || '';

/** 连续失败到这个条数就打一条醒目的告警行(单条失败可能只是空号/关机,不值得喊)。 */
const ALERT_AFTER_CONSECUTIVE = 3;
let consecutiveFailures = 0;

interface Receipt {
  phone_number?: string;
  send_time?: string;
  report_time?: string;
  success?: boolean | string;
  err_code?: string;
  err_msg?: string;
  biz_id?: string;
}

/** 日志里不留完整号码(回执会长期躺在 pm2 日志里)。保留前 3 后 4 够定位到人。 */
function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  return d.length >= 7 ? `${d.slice(0, 3)}****${d.slice(-4)}` : '***';
}

function delivered(r: Receipt): boolean {
  // success 在不同版本里出现过布尔和字符串两种,都认。
  return r.success === true || r.success === 'true';
}

smsReceiptRoutes.post('/sms/receipt/:token', async (c) => {
  c.header('Cache-Control', 'no-store');
  // 未配置 = 未启用,和 token 不对给同样的 404,不泄露端点是否存在。
  if (!RECEIPT_TOKEN || c.req.param('token') !== RECEIPT_TOKEN) return c.notFound();

  const body = await c.req.json().catch(() => null);
  // 解析不了就别让它重推 —— 重推的还是同一份烂 body。
  if (body == null) {
    console.error('[sms] receipt: unparseable body');
    return c.json({ code: 0, msg: '接收成功' });
  }

  const list: Receipt[] = Array.isArray(body) ? body : [body as Receipt];
  for (const r of list) {
    const phone = maskPhone(r.phone_number ?? '');
    if (delivered(r)) {
      consecutiveFailures = 0;
      continue;
    }
    consecutiveFailures += 1;
    // 失败才打:成功是绝大多数,全打等于把日志淹掉,真出事反而找不到。
    console.error(
      `[sms] delivery failed: ${phone} ${r.err_code ?? '?'} ${r.err_msg ?? ''} biz=${r.biz_id ?? '?'}`.slice(0, 300),
    );
    if (consecutiveFailures >= ALERT_AFTER_CONSECUTIVE) {
      // 连续失败通常是通道级问题(余额耗尽 / 签名被打回 / 模板停用),不是某个号的问题。
      console.error(
        `[sms] ALERT: ${consecutiveFailures} consecutive delivery failures — check balance, signature and template`,
      );
    }
  }

  return c.json({ code: 0, msg: '接收成功' });
});
