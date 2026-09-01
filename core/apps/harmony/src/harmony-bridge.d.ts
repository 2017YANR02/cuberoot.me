interface CubeRootHarmonyBridge {
  bleConnect(deviceId: string): Promise<string>;
  bleDisconnect(deviceId: string): Promise<string>;
  bleGetMtu(deviceId: string): Promise<string>;
  bleInitialize(): Promise<string>;
  bleRead(deviceId: string, service: string, characteristic: string): Promise<string>;
  bleRequestDevice(namePrefix: string): Promise<string>;
  bleSubscribe(deviceId: string, service: string, characteristic: string): Promise<string>;
  bleUnsubscribe(deviceId: string, service: string, characteristic: string): Promise<string>;
  bleWrite(deviceId: string, service: string, characteristic: string, value: string): Promise<string>;
  exitApp(): Promise<string>;
  getNetworkStatus(): Promise<string>;
  openExternal(url: string): Promise<string>;
  secureGet(key: string): Promise<string>;
  secureRemove(key: string): Promise<string>;
  secureSet(key: string, value: string): Promise<string>;
  setBackHandlerReady(ready: string): Promise<string>;
  setKeepScreenOn(enabled: string): Promise<string>;
  takeLaunchUrls(): Promise<string>;
}

interface Window {
  cubeRootHarmony?: CubeRootHarmonyBridge;
}
