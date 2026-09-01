'use client';

import { RoomQrModal as SharedRoomQrModal } from '@cuberoot/timer-ui/room-qr-modal';
import { browserClipboardTransport } from '@cuberoot/timer-ui';
import { tr } from '@/i18n/tr';

export function RoomQrModal({ url, code, onClose }: { url: string; code: string; onClose: () => void }) {
  return (
    <SharedRoomQrModal
      code={code}
      labels={{
        close: tr({ zh: '关闭', en: 'Close' }),
        copied: tr({ zh: '已复制', en: 'Copied' }),
        copyFailed: tr({ zh: '复制失败，请重试', en: 'Copy failed. Try again.' }),
        copyInvite: tr({ zh: '复制邀请链接', en: 'Copy invite link' }),
        scanToJoin: tr({ zh: '扫码加入', en: 'Scan to join' }),
      }}
      onClose={onClose}
      url={url}
      writeClipboardText={browserClipboardTransport}
    />
  );
}
