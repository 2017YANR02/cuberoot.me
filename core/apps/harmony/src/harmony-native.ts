interface BridgeEnvelope<T = undefined> {
  ok: boolean;
  value?: T;
}

export function nativeBridge(): CubeRootHarmonyBridge {
  const bridge = window.cubeRootHarmony;
  if (!bridge) throw new Error('Harmony native bridge unavailable');
  return bridge;
}

export async function bridgeCall<T>(operation: Promise<string>): Promise<T> {
  const response = JSON.parse(await operation) as BridgeEnvelope<T>;
  if (!response.ok) throw new Error('Harmony native operation failed');
  return response.value as T;
}

export const harmonySecureStorage = {
  getItem: (key: string): Promise<string | null> =>
    bridgeCall<string | null>(nativeBridge().secureGet(key)),
  setItem: (key: string, value: string): Promise<void> =>
    bridgeCall<void>(nativeBridge().secureSet(key, value)),
  removeItem: (key: string): Promise<void> =>
    bridgeCall<void>(nativeBridge().secureRemove(key)),
};
