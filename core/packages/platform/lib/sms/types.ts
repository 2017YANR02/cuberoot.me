import "server-only";

export type SmsResult = { ok: true } | { ok: false; error: string };

export interface SmsProvider {
  id: string;
  name: string;
  sendOtp(phone: string, code: string): Promise<SmsResult>;
}
