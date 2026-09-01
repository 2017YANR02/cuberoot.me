import { Want } from '@kit.AbilityKit';

const CALLBACK_URL = 'me.cuberoot.app://auth/callback';

export type DeepLinkListener = (url: string) => void;

export class DeepLinkInbox {
  private static singleton: DeepLinkInbox = new DeepLinkInbox();
  private listener: DeepLinkListener | undefined = undefined;
  private urls: string[] = [];

  static shared(): DeepLinkInbox {
    return DeepLinkInbox.singleton;
  }

  acceptWant(want: Want): void {
    const url = want.uri;
    if (!url || (url !== CALLBACK_URL && !url.startsWith(`${CALLBACK_URL}?`))) return;
    this.urls.push(url);
    this.listener?.(url);
  }

  takeAll(): string[] {
    const result = this.urls;
    this.urls = [];
    return result;
  }

  setListener(listener: DeepLinkListener | undefined): void {
    this.listener = listener;
  }
}
