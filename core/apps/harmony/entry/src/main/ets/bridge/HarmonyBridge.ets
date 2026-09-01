import { abilityAccessCtrl, common, type Permissions } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

import { DeepLinkInbox } from './DeepLinkInbox';
import { HarmonyBle, type BleEventSink } from './HarmonyBle';
import { SecureAuthStore } from './SecureAuthStore';

function success(): string {
  return '{"ok":true}';
}

function successValue(value: Object | null): string {
  return `{"ok":true,"value":${JSON.stringify(value)}}`;
}

function failure(): string {
  return '{"ok":false}';
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

export class HarmonyBridge {
  backHandlerReady: boolean = false;
  private context: common.UIAbilityContext | undefined = undefined;
  private getNetworkStatusValue: (() => boolean) | undefined = undefined;
  private readonly bluetooth: HarmonyBle = new HarmonyBle();
  private readonly storage: SecureAuthStore = new SecureAuthStore();

  bind(context: common.UIAbilityContext, getNetworkStatus: () => boolean, eventSink: BleEventSink): void {
    this.context = context;
    this.getNetworkStatusValue = getNetworkStatus;
    this.bluetooth.setEventSink(eventSink);
  }

  async release(): Promise<void> {
    await this.bluetooth.release();
    await this.setKeepScreenOn('false');
  }

  async secureGet(key: string): Promise<string> {
    try {
      return successValue(await this.storage.getItem(key));
    } catch (_) {
      return failure();
    }
  }

  async secureSet(key: string, value: string): Promise<string> {
    try {
      await this.storage.setItem(key, value);
      return success();
    } catch (_) {
      return failure();
    }
  }

  async secureRemove(key: string): Promise<string> {
    try {
      await this.storage.removeItem(key);
      return success();
    } catch (_) {
      return failure();
    }
  }

  async takeLaunchUrls(): Promise<string> {
    return successValue(DeepLinkInbox.shared().takeAll());
  }

  async openExternal(url: string): Promise<string> {
    if (!this.context || !isExternalUrl(url)) return failure();
    try {
      await this.context.openLink(url, { appLinkingOnly: false });
      return success();
    } catch (_) {
      return failure();
    }
  }

  async exitApp(): Promise<string> {
    if (!this.context) return failure();
    try {
      await this.context.terminateSelf();
      return success();
    } catch (_) {
      return failure();
    }
  }

  async getNetworkStatus(): Promise<string> {
    return successValue(this.getNetworkStatusValue?.() ?? false);
  }

  async setBackHandlerReady(ready: string): Promise<string> {
    if (ready !== 'true' && ready !== 'false') return failure();
    this.backHandlerReady = ready === 'true';
    return success();
  }

  async setKeepScreenOn(enabled: string): Promise<string> {
    if (!this.context || (enabled !== 'true' && enabled !== 'false')) return failure();
    try {
      const mainWindow = await window.getLastWindow(this.context);
      await mainWindow.setWindowKeepScreenOn(enabled === 'true');
      return success();
    } catch (_) {
      return failure();
    }
  }

  async bleInitialize(): Promise<string> {
    if (!this.context) return failure();
    try {
      const permission: Permissions = 'ohos.permission.ACCESS_BLUETOOTH';
      const result = await abilityAccessCtrl.createAtManager()
        .requestPermissionsFromUser(this.context, [permission]);
      if (result.authResults[0] !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) return failure();
      await this.bluetooth.initialize();
      return success();
    } catch (_) {
      return failure();
    }
  }

  async bleRequestDevice(namePrefix: string): Promise<string> {
    if (namePrefix !== 'GAN') return failure();
    try {
      return successValue(await this.bluetooth.requestDevice(namePrefix));
    } catch (_) {
      return failure();
    }
  }

  async bleConnect(deviceId: string): Promise<string> {
    try {
      await this.bluetooth.connect(deviceId);
      return success();
    } catch (_) {
      return failure();
    }
  }

  async bleDisconnect(deviceId: string): Promise<string> {
    try {
      await this.bluetooth.disconnect(deviceId);
      return success();
    } catch (_) {
      return failure();
    }
  }

  async bleGetMtu(deviceId: string): Promise<string> {
    try {
      return successValue(this.bluetooth.getMtu(deviceId));
    } catch (_) {
      return failure();
    }
  }

  async bleRead(deviceId: string, service: string, characteristic: string): Promise<string> {
    try {
      return successValue(await this.bluetooth.read(deviceId, service, characteristic));
    } catch (_) {
      return failure();
    }
  }

  async bleWrite(deviceId: string, service: string, characteristic: string, value: string): Promise<string> {
    try {
      const parsedValue = JSON.parse(value) as Object;
      if (!Array.isArray(parsedValue)) return failure();
      const parsed = parsedValue as number[];
      for (let index = 0; index < parsed.length; index++) {
        const byte: number = parsed[index];
        if (!Number.isInteger(byte) || byte < 0 || byte > 255) return failure();
      }
      await this.bluetooth.write(deviceId, service, characteristic, parsed);
      return success();
    } catch (_) {
      return failure();
    }
  }

  async bleSubscribe(deviceId: string, service: string, characteristic: string): Promise<string> {
    try {
      await this.bluetooth.setNotification(deviceId, service, characteristic, true);
      return success();
    } catch (_) {
      return failure();
    }
  }

  async bleUnsubscribe(deviceId: string, service: string, characteristic: string): Promise<string> {
    try {
      await this.bluetooth.setNotification(deviceId, service, characteristic, false);
      return success();
    } catch (_) {
      return failure();
    }
  }
}
