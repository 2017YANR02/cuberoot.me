import "server-only";
import type { SmsProvider } from "./types";
import { consoleProvider } from "./providers/console";
import { aliyunProvider } from "./providers/aliyun";
import { tencentProvider } from "./providers/tencent";

const PROVIDERS: Record<string, SmsProvider> = {
  console: consoleProvider,
  aliyun: aliyunProvider,
  tencent: tencentProvider,
};

export function getActive(): SmsProvider {
  const id = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
  if (!id) return consoleProvider;
  return PROVIDERS[id] ?? consoleProvider;
}

export function isConsoleFallback(): boolean {
  const id = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
  return !id || !(id in PROVIDERS) || id === "console";
}
