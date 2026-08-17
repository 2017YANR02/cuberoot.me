import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // wechatpay-node-v3 -> superagent -> formidable 用 dynamic require,
  // Turbopack 无法静态分析,强制走 Node 原生 require。
  // alipay-sdk 走 urllib,本身没问题,但同样列入避免类似坑。
  serverExternalPackages: ["wechatpay-node-v3", "alipay-sdk"],
};

export default nextConfig;
