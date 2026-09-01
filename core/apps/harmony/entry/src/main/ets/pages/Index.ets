import { common } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { connection } from '@kit.NetworkKit';

import { DeepLinkInbox } from '../bridge/DeepLinkInbox';
import { HarmonyBridge } from '../bridge/HarmonyBridge';
import { RawfileResponder } from '../web/RawfileResponder';

const LOCAL_ENTRY = 'https://localhost/app/index.html';
const LOCAL_PREFIX = 'https://localhost/app/';

interface UrlPermission {
  scheme: string;
  host: string;
  port: string;
  path: string;
}

interface JavaScriptProxyPermission {
  urlPermissionList: UrlPermission[];
}

interface JsBridgePermission {
  javascriptProxyPermission: JavaScriptProxyPermission;
}

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly bridge: HarmonyBridge = new HarmonyBridge();
  private netConnection: connection.NetConnection | undefined = undefined;
  private rawfiles: RawfileResponder | undefined = undefined;
  private webReady: boolean = false;
  private readonly bridgePermission: JsBridgePermission = {
    javascriptProxyPermission: {
      urlPermissionList: [{
        scheme: 'https',
        host: 'localhost',
        port: '',
        path: '/app/'
      }]
    }
  };

  aboutToAppear(): void {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.rawfiles = new RawfileResponder(context);
    this.bridge.bind(context, () => this.hasInternet(), (name: string, detail: Object) => this.dispatch(name, detail));
    DeepLinkInbox.shared().setListener((url: string) => this.dispatch('cuberoot:launch-url', url));
    this.startNetworkListener();
  }

  aboutToDisappear(): void {
    DeepLinkInbox.shared().setListener(undefined);
    try {
      this.netConnection?.unregister(() => undefined);
    } catch (_) {
    }
    this.netConnection = undefined;
    void this.bridge.release();
  }

  onBackPress(): boolean {
    if (!this.bridge.backHandlerReady) return false;
    this.dispatch('cuberoot:back', true);
    return true;
  }

  private hasInternet(): boolean {
    try {
      const handle = connection.getDefaultNetSync();
      if (!handle || handle.netId < 100) return false;
      const capabilities = connection.getNetCapabilitiesSync(handle).networkCap;
      if (!capabilities) return false;
      return capabilities.includes(connection.NetCap.NET_CAPABILITY_VALIDATED);
    } catch (_) {
      return false;
    }
  }

  private startNetworkListener(): void {
    const netConnection = connection.createNetConnection();
    this.netConnection = netConnection;
    netConnection.on('netAvailable', () => this.emitNetwork());
    netConnection.on('netUnavailable', () => this.emitNetwork());
    netConnection.on('netCapabilitiesChange', () => this.emitNetwork());
    netConnection.on('netConnectionPropertiesChange', () => this.emitNetwork());
    netConnection.on('netLost', () => this.emitNetwork());
    netConnection.register(() => this.emitNetwork());
  }

  private emitNetwork(): void {
    this.dispatch('cuberoot:network', this.hasInternet());
  }

  private dispatch(name: string, detail: Object): void {
    if (!this.webReady) return;
    const script = `window.dispatchEvent(new CustomEvent(${JSON.stringify(name)},` +
      `{detail:${JSON.stringify(detail)}}));`;
    this.controller.runJavaScript(script).catch(() => undefined);
  }

  build() {
    Column() {
      Web({ src: LOCAL_ENTRY, controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .imageAccess(true)
        .onlineImageAccess(true)
        .javaScriptProxy({
          object: this.bridge,
          name: 'cubeRootHarmony',
          methodList: [],
          asyncMethodList: [
            'secureGet',
            'secureSet',
            'secureRemove',
            'takeLaunchUrls',
            'openExternal',
            'exitApp',
            'getNetworkStatus',
            'setBackHandlerReady',
            'setKeepScreenOn',
            'bleInitialize',
            'bleRequestDevice',
            'bleConnect',
            'bleDisconnect',
            'bleGetMtu',
            'bleRead',
            'bleWrite',
            'bleSubscribe',
            'bleUnsubscribe'
          ],
          controller: this.controller,
          permission: JSON.stringify(this.bridgePermission)
        })
        .onLoadIntercept((event) => {
          if (!event.data.isMainFrame()) return false;
          const url = event.data.getRequestUrl();
          if (url.startsWith(LOCAL_PREFIX)) return false;
          void this.bridge.openExternal(url);
          return true;
        })
        .onInterceptRequest((event) => {
          if (!event || !this.rawfiles) return null;
          return this.rawfiles.intercept(event.request.getRequestUrl());
        })
        .onPageEnd(() => {
          this.webReady = true;
          this.emitNetwork();
        })
    }
    .width('100%')
    .height('100%')
  }
}
