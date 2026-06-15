// 虎皮椒(xunhupay)聚合支付签名 —— 纯函数,md5 由调用方注入。
//
// WHY 注入 md5:本模块同时被 server(node:crypto)和 client vitest 引用;
//   不在此 import 'crypto',避免任何浏览器 bundle 误打进 node 内置模块。
//
// 签名算法(xunhupay 官方文档):
//   1. 取所有「非空」参数(排除 hash 自身),按 key 的 ASCII 升序排序;
//   2. 拼成 k1=v1&k2=v2&...(原样值,不做 url-encode);
//   3. 末尾直接追加 APPSECRET(无分隔符);
//   4. md5,32 位小写。
// 下单请求签名与异步 notify 验签共用同一套算法。

export type SignParams = Record<string, string | number | boolean | null | undefined>;

/** 排序 + 拼接出待签名串(不含 APPSECRET)。导出供测试单独验证拼接逻辑。 */
export function buildSignBase(params: SignParams): string {
  return Object.keys(params)
    .filter((k) => k !== 'hash')
    .filter((k) => {
      const v = params[k];
      return v !== undefined && v !== null && String(v) !== '';
    })
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
}

/** 计算签名。md5(s) 必须返回 32 位十六进制串。 */
export function signXunhupay(
  params: SignParams,
  appSecret: string,
  md5: (s: string) => string,
): string {
  return md5(buildSignBase(params) + appSecret).toLowerCase();
}

/** 校验回调/响应签名(大小写不敏感)。缺 hash 或不匹配返回 false。 */
export function verifyXunhupaySign(
  params: SignParams & { hash?: string },
  appSecret: string,
  md5: (s: string) => string,
): boolean {
  const given = params.hash;
  if (typeof given !== 'string' || given.length === 0) return false;
  return signXunhupay(params, appSecret, md5) === given.toLowerCase();
}

// ─────────────────────────── 官方支付宝(RSA2 / SHA256withRSA)───────────────────────────
//
// 待签名串规则(支付宝开放平台):取所有「非空」请求参数(默认仅排除 sign),按 key 的
// ASCII 升序排序,拼成 k1=v1&k2=v2&...(原样值,不 url-encode),再用商户应用私钥
// RSA-SHA256 签名、base64。注意 biz_content 整个 JSON 串作为一个 value 参与签名。
//
// 异步通知(notify)验签:排除 sign 与 sign_type 两个参数(其余皆参与),其余规则同上,
// 用「支付宝公钥」验 SHA256withRSA。本 builder 用 exclude 参数区分两种场景。
//
// 这里只产「待签/待验串」(纯函数,可在浏览器/测试里跑);真正的 RSA sign/verify
// 走调用方的 node:crypto(server 侧),不在 shared 引 crypto。

/** 支付宝待签名/待验签串。默认排除 sign(请求签名用);验签传 exclude=['sign','sign_type']。 */
export function buildAlipaySignContent(
  params: SignParams,
  exclude: string[] = ['sign'],
): string {
  const skip = new Set(exclude);
  return Object.keys(params)
    .filter((k) => !skip.has(k))
    .filter((k) => {
      const v = params[k];
      return v !== undefined && v !== null && String(v) !== '';
    })
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
}

// ─────────────────────────── 官方微信支付 APIv3(SHA256-RSA2048)───────────────────────────
//
// 请求签名串(放进 Authorization 头):
//   {HTTP_METHOD}\n{URL_PATH(含 query)}\n{timestamp}\n{nonce_str}\n{body}\n
//   GET 无 body 时 body 为空串,但末尾的 \n 仍保留。用商户 API 私钥 SHA256-RSA2048 签名 base64。
// 应答 / 回调验签串:
//   {timestamp}\n{nonce}\n{body}\n
//   用「微信支付平台证书/公钥」验 SHA256-RSA2048。
// 回调报文体是 AEAD_AES_256_GCM 密文,解密走 node:crypto(server 侧),不在此处。

/** 微信 APIv3 请求签名消息体(用于 Authorization 头签名)。 */
export function buildWechatV3Message(parts: {
  method: string;
  urlPath: string;
  timestamp: string | number;
  nonce: string;
  body: string;
}): string {
  return `${parts.method}\n${parts.urlPath}\n${parts.timestamp}\n${parts.nonce}\n${parts.body}\n`;
}

/** 微信 APIv3 应答 / 回调验签消息体。 */
export function buildWechatV3VerifyMessage(parts: {
  timestamp: string | number;
  nonce: string;
  body: string;
}): string {
  return `${parts.timestamp}\n${parts.nonce}\n${parts.body}\n`;
}
