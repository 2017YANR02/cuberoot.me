import { sessionFetch } from '@/lib/session-fetch';
import { createChatClient } from '@cuberoot/shared/chat';
import { apiUrl } from './api-base';
import { authHeaders } from './admin-api';

/** Capture one session; an old request must never acquire another account's token. */
export function createWebChatClient() {
  const headers = authHeaders(false);
  return createChatClient({ fetch: (url, init) => sessionFetch(url, init), url: apiUrl, headers: () => headers });
}
