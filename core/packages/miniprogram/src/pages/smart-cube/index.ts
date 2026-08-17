import {
  smartCubeSession,
  type SmartCubeDriverKind,
  type SmartCubeSessionSnapshot,
} from '../../lib/smart-cube/session';

const SIMULATOR_MOVES = ['U', "U'", 'R', "R'", 'F', "F'", 'D', "D'", 'L', "L'", 'B', "B'"];

interface SmartCubePageData extends SmartCubeSessionSnapshot {
  busy: boolean;
  simulator: boolean;
  simulatorMoves: string[];
}

interface SmartCubePageInstance {
  unsubscribe?: () => void;
  setData(data: Partial<SmartCubePageData>): void;
}

Page<SmartCubePageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    phase: 'idle',
    brand: '',
    deviceName: '',
    battery: null,
    error: '',
    lastMove: '',
    busy: false,
    simulator: false,
    simulatorMoves: SIMULATOR_MOVES,
  },

  onLoad(options) {
    const page = this as unknown as SmartCubePageInstance;
    page.unsubscribe = smartCubeSession.subscribe((snapshot) => {
      page.setData({
        ...snapshot,
        busy: snapshot.phase === 'scanning' || snapshot.phase === 'connecting',
      });
    });
    try {
      page.setData({ simulator: wx.getDeviceInfo().platform === 'devtools' });
    } catch {
      page.setData({ simulator: false });
    }
    void smartCubeSession.start(options.token ?? '').catch((error: unknown) => {
      page.setData({
        phase: 'error',
        error: error instanceof Error ? error.message : '连接初始化失败，请返回计时器重试',
      });
    });
  },

  onUnload() {
    const page = this as unknown as SmartCubePageInstance;
    page.unsubscribe?.();
    page.unsubscribe = undefined;
  },

  connectCube(event: WechatMiniprogram.TouchEvent) {
    const driver = event.currentTarget.dataset.driver as SmartCubeDriverKind | undefined;
    if (!driver) return;
    void smartCubeSession.connect(driver).catch(() => {});
  },

  simulateMove(event: WechatMiniprogram.TouchEvent) {
    const move = event.currentTarget.dataset.move;
    if (typeof move === 'string') smartCubeSession.simulateMove(move);
  },

  disconnectCube() {
    void smartCubeSession.disconnect();
  },

  returnToTimer() {
    wx.navigateBack();
  },
});
