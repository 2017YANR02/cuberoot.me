// 虎皮椒(xunhupay)聚合支付签名 —— 纯函数,md5 由调用方注入。
//
// WHY 注入 md5:本模块同时被 server(node:crypto)和 client-next vitest 引用;
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
