import { Capacitor, registerPlugin } from '@capacitor/core';

const nativeDistribution = registerPlugin<{ get(): Promise<{ channel: string }> }>('Distribution');
let distribution: 'play' | 'direct' = 'play';

export async function initializeDistribution(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  // Fail closed for older shells or a broken bridge: never expose external checkout.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      nativeDistribution.get(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('distribution unavailable')), 5_000); }),
    ]);
    distribution = result.channel === 'direct' ? 'direct' : 'play';
  } catch { distribution = 'play'; }
  finally { clearTimeout(timeout); }
}

export const usesDirectPayments = () => Capacitor.getPlatform() === 'android' && distribution === 'direct';
export const usesGooglePayments = () => Capacitor.getPlatform() === 'android' && distribution === 'play';
