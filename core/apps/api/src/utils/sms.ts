/**
 * Standard Aliyun Dysmsapi submission only, not provider-generated/verified PNVS codes.
 * SMS is transport only; auth_codes owns issuance, cooldown and consumption.
 * This provider path still needs real-credential and handset acceptance before release.
 */
import { createAliyunSmsSender } from '@app-foundation/sms';

const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID || '';
const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '';
const signName = process.env.ALIYUN_SMS_SIGN_NAME || '';
const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || '';

export function smsConfigured(): boolean {
  return Boolean(accessKeyId && accessKeySecret && signName && templateCode);
}

/** Preserve the route contract. Provider acceptance is not handset delivery. */
export async function sendSmsCode(phone: string, code: string): Promise<void> {
  if (!smsConfigured()) throw new Error('sms not configured');
  const sender = createAliyunSmsSender({ accessKeyId, accessKeySecret, signName, templateCode });
  await sender.sendCode({ phone, code });
}
