import { useEffect, useState, useSyncExternalStore } from 'react';
import { createChatController, type ChatController, type ChatControllerOptions } from '@cuberoot/shared/chat';

const noopSubscribe = () => () => {};
const emptySnapshot = () => null;
/** Recreate the account-scoped store during effect setup, including StrictMode replay. */
export function useChat(options: ChatControllerOptions) {
  const [binding, setBinding] = useState<{ options: ChatControllerOptions; controller: ChatController } | null>(null);
  useEffect(() => {
    const controller = createChatController(options);
    setBinding({ options, controller });
    return () => controller.dispose();
  }, [options]);
  const controller = binding?.options === options ? binding.controller : null;
  const state = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, controller?.getSnapshot ?? emptySnapshot, emptySnapshot);
  return { controller, state };
}
