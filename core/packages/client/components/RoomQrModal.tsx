'use client';

import { RoomQrModal as SharedRoomQrModal } from '@cuberoot/timer-ui/room-qr-modal';
import { browserClipboardTransport } from '@cuberoot/timer-ui';
import { tr, useLang } from '@/i18n/tr';

export function RoomQrModal({ url, code, onClose }: { url: string; code: string; onClose: () => void }) {
  const language = useLang();
  return (
    <SharedRoomQrModal
      code={code}
      language={language}
      labels={{
        copiedCode: tr({ zh: '已复制房间码', en: 'Room code copied' }),
        copiedInvite: tr({ zh: '已复制邀请链接', en: 'Invite link copied' }),
        copyCode: tr({ zh: '复制房间码', en: 'Copy room code' }),
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
