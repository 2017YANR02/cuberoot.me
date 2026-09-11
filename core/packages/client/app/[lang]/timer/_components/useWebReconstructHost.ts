import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { useSettings, updateSettings } from '../_lib/settings';
import { encodeReplayUrl } from '../_lib/share/encode';

/** Website-only host capabilities for both full details and the inline recap. */
export function useWebReconstructHost(): ReconstructHost {
  const settings = useSettings();
  return {
    localize: tr,
    writeClipboardText: (text) => navigator.clipboard.writeText(text),
    replayUrl: encodeReplayUrl,
    recordGyro: settings.recordGyro,
    onEnableGyro: () => updateSettings({ recordGyro: true }),
    BoolToggle,
  };
}
