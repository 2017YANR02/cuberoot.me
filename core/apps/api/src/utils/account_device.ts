import { query } from '../db/connection.js';
import { classifyUserAgent } from './user_agent.js';

/** Capture only coarse latest-device dimensions; never store IP, raw UA, or a persistent device identifier. */
export async function captureAccountDevice(userId: number, userAgent: string | undefined): Promise<void> {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !userAgent?.trim()) return;
  const dimensions = classifyUserAgent(userAgent);
  try {
    await query(
      `INSERT INTO account_last_devices (
         user_id, device_type, os_family, os_major, browser_family, browser_major, container, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         device_type = EXCLUDED.device_type,
         os_family = EXCLUDED.os_family,
         os_major = EXCLUDED.os_major,
         browser_family = EXCLUDED.browser_family,
         browser_major = EXCLUDED.browser_major,
         container = EXCLUDED.container,
         last_seen_at = NOW()`,
      [
        userId,
        dimensions.deviceType,
        dimensions.osFamily,
        dimensions.osMajor,
        dimensions.browserFamily,
        dimensions.browserMajor,
        dimensions.container,
      ],
    );
  } catch (error) {
    console.error('[auth] failed to capture account device:', error instanceof Error ? error.message : error);
  }
}
