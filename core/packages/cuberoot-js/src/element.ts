import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPlayer, type Player, type PlayerOptions, type PlayerState } from './index.js';
import { ReplayControls, type ReplayControlLabels } from './replay-controls.js';
import styles from './element.css?inline';

const TAG_NAME = 'cuberoot-player';

const copy = {
  en: {
    cube: 'Twisty puzzle', controls: 'Replay controls',
    skipStart: 'Skip to start', stepBack: 'Step back', play: 'Play', pause: 'Pause',
    stepForward: 'Step forward', skipEnd: 'Skip to end', scrub: 'Scrub playback',
    speed: 'Turns per second', speedPresets: 'Speed presets', settings: 'Playback settings',
    step: (current: number, total: number) => `Move ${current} of ${total}`,
    loading: 'Loading puzzle…',
    error: 'The replay could not be loaded.',
  },
  zh: {
    cube: '拼图', controls: '复盘控制',
    skipStart: '回到起点', stepBack: '上一步', play: '播放', pause: '暂停',
    stepForward: '下一步', skipEnd: '跳到末尾', scrub: '拖动播放进度',
    speed: '每秒转动步数', speedPresets: '速度预设', settings: '播放设置',
    step: (current: number, total: number) => `第 ${current} 步，共 ${total} 步`,
    loading: '正在加载拼图…',
    error: '无法加载复盘。',
  },
} satisfies Record<'en' | 'zh', ReplayControlLabels & {
  cube: string; controls: string; loading: string; error: string;
}>;

interface Configuration extends PlayerOptions {
  setupAlg: string;
  alg: string;
  playbackRate: number;
  interactive: boolean;
  autoplay: boolean;
}

export function registerCuberootPlayer(): void {
  if (typeof HTMLElement === 'undefined' || typeof customElements === 'undefined') return;
  if (customElements.get(TAG_NAME)) return;

  class CuberootPlayerElement extends HTMLElement {
    static readonly observedAttributes = [
      'puzzle', 'order', 'puzzle-description', 'setup-alg', 'alg', 'playback-rate', 'no-interaction', 'autoplay', 'lang',
    ];

    readonly #viewport = this.ownerDocument.createElement('div');
    readonly #controls = this.ownerDocument.createElement('div');
    readonly #error = this.ownerDocument.createElement('p');
    readonly #loading = this.ownerDocument.createElement('div');

    #controlsRoot: Root | undefined;
    #player: Player | undefined;
    #unsubscribe: (() => void) | undefined;
    #configuration: Configuration | undefined;
    #connected = false;
    #queued = false;

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      const stylesheet = this.ownerDocument.createElement('style');
      stylesheet.textContent = styles;

      this.#viewport.className = 'viewport';
      this.#viewport.setAttribute('part', 'viewport');
      this.#viewport.setAttribute('role', 'img');
      this.#controls.className = 'replay-transport';
      this.#controls.setAttribute('role', 'group');
      this.#error.className = 'error';
      this.#error.setAttribute('role', 'alert');
      this.#error.hidden = true;
      this.#loading.setAttribute('role', 'status');
      this.#loading.hidden = true;
      root.append(stylesheet, this.#viewport, this.#controls, this.#loading, this.#error);
    }

    connectedCallback(): void {
      this.#connected = true;
      this.#controlsRoot = createRoot(this.#controls);
      this.#renderLabels();
      this.#syncConfiguration();
    }

    disconnectedCallback(): void {
      this.#connected = false;
      this.#unmount();
      this.#controlsRoot?.unmount();
      this.#controlsRoot = undefined;
    }

    attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
      if (previous === next || !this.#connected) return;
      if (name === 'lang') {
        this.#renderLabels();
        if (!this.#error.hidden) this.#error.textContent = this.#labels.error;
        return;
      }
      if (this.#queued) return;
      this.#queued = true;
      queueMicrotask(() => {
        this.#queued = false;
        if (this.#connected) this.#syncConfiguration();
      });
    }

    get #labels() {
      return this.matches(':lang(zh)') ? copy.zh : copy.en;
    }

    #renderLabels(): void {
      const labels = this.#labels;
      this.#viewport.setAttribute('aria-label', labels.cube);
      this.#controls.setAttribute('aria-label', labels.controls);
      this.#loading.textContent = labels.loading;
      this.#renderControls();
    }

    #renderControls(state: PlayerState | undefined = this.#player?.state): void {
      this.#controlsRoot?.render(createElement(ReplayControls, {
        player: this.#player, state, labels: this.#labels,
      }));
    }

    #syncConfiguration(): void {
      const order = this.getAttribute('order');
      const configuration: Configuration = {
        puzzle: this.getAttribute('puzzle') ?? undefined,
        order: order === null ? undefined : Number(order),
        puzzleDescription: this.getAttribute('puzzle-description') ?? undefined,
        setupAlg: this.getAttribute('setup-alg') ?? '',
        alg: this.getAttribute('alg') ?? '',
        playbackRate: Number(this.getAttribute('playback-rate') ?? '1'),
        interactive: !this.hasAttribute('no-interaction'),
        autoplay: this.hasAttribute('autoplay'),
      };
      const previous = this.#configuration;
      const current = this.#player;
      const sequenceChanged = previous?.setupAlg !== configuration.setupAlg || previous.alg !== configuration.alg;
      const remount = !current || !previous || previous.interactive !== configuration.interactive
        || previous.puzzle !== configuration.puzzle || previous.order !== configuration.order
        || previous.puzzleDescription !== configuration.puzzleDescription;

      try {
        if (!Number.isFinite(configuration.playbackRate) || configuration.playbackRate <= 0) {
          throw new RangeError('playback-rate must be a positive, finite number.');
        }
        if (remount) {
          this.#unmount();
          const player = createPlayer(this.#viewport, configuration);
          this.#player = player;
          this.#unsubscribe = player.subscribe(state => this.#renderControls(state));
          this.#configuration = configuration;
          this.#loading.hidden = player.state.ready;
          this.#error.hidden = true;
          if (!player.state.ready) {
            void player.ready.then(() => {
              if (this.#player !== player || !this.#connected) return;
              this.#loading.hidden = true;
              this.#syncConfiguration();
              if (this.#player === player && this.#configuration?.autoplay) player.play();
            }, error => {
              if (this.#player !== player || !this.#connected) return;
              this.#unmount();
              this.#showError(error);
            });
            return;
          }
        } else {
          if (!current.state.ready) return;
          if (sequenceChanged) current.setAlgorithm(configuration);
          if (previous?.playbackRate !== configuration.playbackRate) {
            current.setPlaybackRate(configuration.playbackRate);
          }
        }
        this.#configuration = configuration;
        this.#error.hidden = true;
        if (configuration.autoplay && (remount || sequenceChanged || !previous?.autoplay)) this.#player?.play();
        if (!configuration.autoplay && previous?.autoplay) this.#player?.pause();
      } catch (error) {
        this.#showError(error);
      }
    }

    #showError(error: unknown): void {
      this.#loading.hidden = true;
      this.#error.textContent = this.#labels.error;
      this.#error.hidden = false;
      this.dispatchEvent(new CustomEvent('cuberoot-error', { detail: error, bubbles: true, composed: true }));
      this.#renderControls();
    }

    #unmount(): void {
      this.#unsubscribe?.();
      this.#unsubscribe = undefined;
      this.#player?.dispose();
      this.#player = undefined;
      this.#configuration = undefined;
    }
  }

  customElements.define(TAG_NAME, CuberootPlayerElement);
}

registerCuberootPlayer();
