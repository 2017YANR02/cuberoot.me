/**
 * 短信发送 —— 阿里云短信服务 (Dysmsapi) RPC 风格,手写 HMAC-SHA1 签名(无 SDK)。
 *
 * 设计:验证码的生成/校验由本站统一持有(auth_codes 表,与邮箱同一套逻辑,可单测),
 *       短信服务在这里只当「传输」—— 把一段文本(含 code)投递到手机号。
 *
 * ⚠️ 资质提醒(个人主体):阿里云标准短信「自用资质」2025-06 起对个人认证关闭。个人可用的
 *   免资质通道是阿里云「号码认证服务(PNVS)/短信认证」——它由阿里云生成并校验验证码
 *   (SendSmsVerifyCode / CheckSmsVerifyCode),那种模式下验证码不落本站表、校验改调阿里云。
 *   本模块实现的是标准 Dysmsapi SendSms(需 SignName+TemplateCode,适合企业/个体工商户主体)。
 *   若最终走 PNVS,把 verifyCode 的手机分支改为调阿里云 CheckSmsVerifyCode 即可(传输/校验二选一)。
 *   —— 本传输层未经真实凭据联调,上线前需配 key 后做一次真机 smoke test。
 *
 * env 未配全 4 个变量时 smsConfigured() 返 false,路由返回 503,不尝试发送、不崩溃。
 */
import crypto from 'node:crypto';

const AK_ID = process.env.ALIYUN_SMS_ACCESS_KEY_ID || '';
const AK_SECRET = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '';
const SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || '';
const TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || '';
const ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

export function smsConfigured(): boolean {
  return Boolean(AK_ID && AK_SECRET && SIGN_NAME && TEMPLATE_CODE);
}

// 阿里云 RPC 专用百分号编码(encodeURIComponent 基础上再修正 + * ~)。
function pctEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

/** 发送一条验证码短信。失败抛异常,由调用方决定给用户的响应。 */
export async function sendSmsCode(phone: string, code: string): Promise<void> {
  // phone 传进来是 E.164(+8613...),阿里云国内短信只认不带国家码的 11 位号,去掉 +86。
  const domestic = phone.replace(/^\+?86/, '');

  const params: Record<string, string> = {
    AccessKeyId: AK_ID,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: domestic,
    RegionId: 'cn-hangzhou',
    SignName: SIGN_NAME,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(params[k])}`)
    .join('&');
  const stringToSign = `GET&${pctEncode('/')}&${pctEncode(canonical)}`;
  const signature = crypto
    .createHmac('sha1', `${AK_SECRET}&`)
    .update(stringToSign)
    .digest('base64');

  const url = `${ENDPOINT}?Signature=${pctEncode(signature)}&${canonical}`;
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
  const data = (await res.json().catch(() => ({}))) as { Code?: string; Message?: string };
  if (!res.ok || data.Code !== 'OK') {
    throw new Error(`sms send failed: ${data.Code ?? res.status} ${data.Message ?? ''}`.slice(0, 200));
  }
}
