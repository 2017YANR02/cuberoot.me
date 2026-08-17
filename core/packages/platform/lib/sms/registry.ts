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
  const provider = PROVIDERS[id];
  if (process.env.NODE_ENV === "production" && (!provider || id === "console")) {
    throw new Error("Production SMS_PROVIDER must be configured as aliyun or tencent");
  }
  return provider ?? consoleProvider;
}

export function isConsoleFallback(): boolean {
  const id = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
  return process.env.NODE_ENV !== "production" &&
    (!id || !(id in PROVIDERS) || id === "console");
}
