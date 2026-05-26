import "server-only";
import type { SmsProvider } from "../types";

// Console provider: dev / fallback only. Prints the code to server stdout so
// developers can complete OTP flows without hitting a real gateway.
export const consoleProvider: SmsProvider = {
  id: "console",
  name: "console",
  async sendOtp(phone, code) {
    // eslint-disable-next-line no-console
    console.log(`[sms:console] phone=${phone} code=${code}`);
    return { ok: true };
  },
};
