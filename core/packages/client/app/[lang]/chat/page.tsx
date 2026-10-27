'use client';

import { ClientLoadStatus } from '@/components/StartupStatus';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** The persistent root host renders the shared workspace on this route, keeping
 * in-flight conversations alive when opening a result or returning with Back. */
export default function ChatPage() {
  useDocumentTitle('聊天', 'Chat');
  return <main className="chat-route-placeholder"><ClientLoadStatus /></main>;
}
