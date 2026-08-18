import {
  smartCubeSession,
  type SmartCubeSessionSnapshot,
} from '../../lib/smart-cube/session';

const SIMULATOR_MOVES = ['U', "U'", 'R', "R'", 'F', "F'", 'D', "D'", 'L', "L'", 'B', "B'"];
const RETURN_UNLOCK_MS = 1200;

interface SmartCubePageData extends SmartCubeSessionSnapshot {
  busy: boolean;
  simulator: boolean;
  simulatorMoves: string[];
}

interface SmartCubePageInstance {
  active?: boolean;
  autoReturnAttempted?: boolean;
  connectionAttempt?: number;
  latestPhase?: SmartCubeSessionSnapshot['phase'];
  returnUnlockTimer?: ReturnType<typeof setTimeout>;
  returningToTimer?: boolean;
  simulator?: boolean;
  token?: string;
  unsubscribe?: () => void;
  setData(data: Partial<SmartCubePageData>): void;
}

function clearReturnUnlockTimer(page: SmartCubePageInstance): void {
  if (page.returnUnlockTimer === undefined) return;
  clearTimeout(page.returnUnlockTimer);
  page.returnUnlockTimer = undefined;
}

function navigateBackToTimer(page: SmartCubePageInstance, force = false): void {
  if (!page.active || (page.returningToTimer && !force)) return;

  clearReturnUnlockTimer(page);
  page.returningToTimer = true;

  const unlock = () => {
    clearReturnUnlockTimer(page);
    if (page.active) page.returningToTimer = false;
  };

  page.returnUnlockTimer = setTimeout(unlock, RETURN_UNLOCK_MS);
  try {
    wx.navigateBack({ fail: unlock });
  } catch {
    unlock();
  }
}

async function startConnection(page: SmartCubePageInstance): Promise<void> {
  const attempt = (page.connectionAttempt ?? 0) + 1;
  page.connectionAttempt = attempt;
  try {
    await smartCubeSession.start(page.token ?? '');
    if (page.simulator) await smartCubeSession.connect('simulator');
    else await smartCubeSession.connectAutomatically();
    if (
      page.active
      && page.connectionAttempt === attempt
      && page.token
      && page.latestPhase === 'connected'
      && !page.autoReturnAttempted
    ) {
      page.autoReturnAttempted = true;
      navigateBackToTimer(page);
    }
  } catch (error) {
    if (!page.active || page.connectionAttempt !== attempt) return;
    page.setData({
      phase: 'error',
      error: error instanceof Error ? error.message : '连接失败，请重试',
    });
  }
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
    page.active = true;
    page.autoReturnAttempted = false;
    page.connectionAttempt = 0;
    page.latestPhase = 'idle';
    page.returningToTimer = false;
    page.token = options.token ?? '';
    page.unsubscribe = smartCubeSession.subscribe((snapshot) => {
      page.latestPhase = snapshot.phase;
      page.setData({
        ...snapshot,
        busy: snapshot.phase === 'scanning' || snapshot.phase === 'connecting',
      });
    });
    try {
      page.simulator = wx.getDeviceInfo().platform === 'devtools';
    } catch {
      page.simulator = false;
    }
    page.setData({ simulator: page.simulator });
    void startConnection(page);
  },

  onUnload() {
    const page = this as unknown as SmartCubePageInstance;
    page.active = false;
    page.connectionAttempt = (page.connectionAttempt ?? 0) + 1;
    clearReturnUnlockTimer(page);
    page.unsubscribe?.();
    page.unsubscribe = undefined;
  },

  retryConnection() {
    const page = this as unknown as SmartCubePageInstance;
    page.autoReturnAttempted = false;
    void startConnection(page);
  },

  simulateMove(event: WechatMiniprogram.TouchEvent) {
    const move = event.currentTarget.dataset.move;
    if (typeof move === 'string') smartCubeSession.simulateMove(move);
  },

  disconnectCube() {
    void smartCubeSession.disconnect();
  },

  returnToTimer() {
    navigateBackToTimer(this as unknown as SmartCubePageInstance, true);
  },
});
