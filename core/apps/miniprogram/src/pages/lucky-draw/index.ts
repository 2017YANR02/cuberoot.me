import {
  createDrawController,
  labels,
  type DrawView,
} from "@cuberoot/shared/draw/controller";
import {
  DRAW_STORAGE_KEY,
  resultsText,
  drawStageCards,
} from "@cuberoot/shared/draw";
import { miniProgramApi } from "../../lib/platform";
import {
  nativeAppearanceStyle,
  applyNativeAppearance,
} from "../../lib/appearance";
import { requestJson } from "../../lib/auth";
import { tr } from "../../lib/i18n";
type Controller = ReturnType<typeof createDrawController>;
Page({
  data: {
    copy: labels(tr),
    view: null as DrawView | null,
    appearanceStyle: "",
    cards: [] as { id: string; name: string; number?: string; style: string }[],
    history: [] as {
      name: string;
      number?: string;
      rating: string;
      order: number;
    }[],
  },
  controller: null as Controller | null,
  onLoad() {
    const api = miniProgramApi();
    this.controller = createDrawController({
      read: () => api.getStorageSync(DRAW_STORAGE_KEY),
      write: (v) => api.setStorageSync(DRAW_STORAGE_KEY, v),
      random: Math.random,
      confirm: (message) =>
        new Promise((resolve) =>
          api.showModal({
            title: tr({ zh: "抽奖", en: "Lucky Draw" }),
            content: message,
            success: (r) => resolve(r.confirm),
            fail: () => resolve(false),
          }),
        ),
      copy: (text) =>
        new Promise((resolve, reject) =>
          api.setClipboardData({
            data: text,
            success: () => resolve(),
            fail: reject,
          }),
        ),
      request: requestJson,
      translate: tr,
      update: (v) =>
        this.setData({
          view: v,
          copy: v.copy,
          cards: drawStageCards(v.session, v.last, v.busy).map((t) => ({
            ...t,
            style: Object.entries(t.pose)
              .map(([key, value]) => `${key}:${value}`)
              .join(";"),
          })),
          history: v.session.history
            .slice(0, v.busy ? -v.last.length : undefined)
            .reverse()
            .map((r, i) => ({
              ...r.ticket,
              rating:
                r.known === undefined
                  ? ""
                  : r.known
                    ? v.copy.known
                    : v.copy.unknown,
              order: v.session.history.length - i,
            })),
        }),
    });
    this.controller.start();
  },
  onShow() {
    applyNativeAppearance();
    this.setData({ appearanceStyle: nativeAppearanceStyle() });
    miniProgramApi().setNavigationBarTitle({
      title: tr({ zh: "抽奖", en: "Lucky Draw" }),
    });
  },
  onUnload() {
    this.controller?.dispose();
  },
  input(e: WechatMiniprogram.Input) {
    this.controller?.input(e.currentTarget.dataset.key, e.detail.value);
  },
  setting(e: WechatMiniprogram.SwitchChange) {
    this.controller?.setting(e.currentTarget.dataset.key, e.detail.value);
  },
  count(e: WechatMiniprogram.Input) {
    this.controller?.setting(
      "count",
      Math.min(100, Math.max(1, Number(e.detail.value) || 1)),
    );
  },
  act(e: WechatMiniprogram.TouchEvent) {
    void this.controller?.act(
      e.currentTarget.dataset.action,
      Number(e.currentTarget.dataset.index) || 0,
    );
  },
  export() {
    const api = miniProgramApi();
    if (!this.data.view) return;
    if (typeof api.shareFileMessage !== "function") {
      void this.controller?.act("copy");
      return;
    }
    const path = `${api.env.USER_DATA_PATH}/cuberoot-draw.txt`;
    api.getFileSystemManager().writeFile({
      filePath: path,
      data: resultsText(this.data.view.session),
      encoding: "utf8",
      success: () => {
        api.shareFileMessage({
          filePath: path,
          fileName: "cuberoot-draw.txt",
          fail: () => void this.controller?.act("copy"),
        });
      },
      fail: () => void this.controller?.act("copy"),
    });
  },
  onShareAppMessage() {
    return { title: this.data.copy.title, path: "/pages/lucky-draw/index" };
  },
});
