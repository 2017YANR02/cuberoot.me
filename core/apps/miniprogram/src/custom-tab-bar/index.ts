import { tabBarAppearance } from '../lib/appearance';
import { getMiniProgramLocale } from '../lib/i18n';
import { miniProgramApi } from '../lib/platform';

const tabs = [
  { route: 'pages/timer/index', icon: 'clock-3', zh: '计时', en: 'Timer' },
  { route: 'pages/tools/index', icon: 'grid-2x2', zh: '工具', en: 'Tools' },
  { route: 'pages/account/index', icon: 'user-round', zh: '我的', en: 'Me' },
];

const duration = 220;
type Motion = { from: number; to: number; started: number };
let motion: Motion | undefined;
let switching = false;

function currentSlot() {
  const pages = getCurrentPages();
  return tabs.findIndex(tab => tab.route === pages[pages.length - 1]?.route);
}

const frames = new WeakMap<object, { timer?: ReturnType<typeof setTimeout> }>();

Component({
  data: { tabs, selected: -1, position: 0, locale: 'zh', ...tabBarAppearance() },
  lifetimes: {
    attached() { this.refresh(); },
    detached() { this.stopMotion(); },
  },
  pageLifetimes: {
    show() { this.refresh(); },
    hide() { this.stopMotion(); },
  },
  methods: {
    stopMotion() {
      clearTimeout(frames.get(this)?.timer);
      frames.delete(this);
    },
    refresh() {
      const selected = currentSlot();
      if (selected < 0) return;
      this.stopMotion();
      const frame: { timer?: ReturnType<typeof setTimeout> } = {};
      frames.set(this, frame);
      const transition = motion;
      this.setData({ selected, locale: getMiniProgramLocale(), ...tabBarAppearance() });
      const draw = () => {
        if (frames.get(this) !== frame) return;
        const progress = transition?.to === selected
          ? Math.min(1, (Date.now() - transition.started) / duration) : 1;
        if (!transition || progress >= 1) {
          this.setData({ position: selected });
          return;
        }
        const eased = progress * progress * (3 - 2 * progress);
        this.setData({ position: transition.from + (selected - transition.from) * eased }, () => {
          if (frames.get(this) === frame) frame.timer = setTimeout(draw, 16);
        });
      };
      draw();
    },
    selectTab(event: WechatMiniprogram.TouchEvent) {
      const to = Number(event.currentTarget.dataset.index);
      const from = currentSlot();
      if (!tabs[to] || from < 0 || from === to || switching) return;
      const transition = motion = { from: this.data.position, to, started: Date.now() };
      switching = true;
      miniProgramApi().switchTab({
        url: '/' + tabs[to].route,
        fail: () => {
          if (motion === transition) motion = undefined;
          this.refresh();
        },
        complete: () => { switching = false; },
      });
    },
  },
});
