/**
 * csTimer 打乱引擎(scramble_module.js)的加载器 —— 全站唯一入口。
 *
 * 该脚本是 csTimer 的打包产物,只能以 <script> 注入,加载后把 `scrMgr` / `image`
 * 挂到 window 上;在此之前任何 `scrMgr.xxx` 都会抛 ReferenceError。以前「有没有加载好」
 * 靠各调用点自己 `typeof window.scrMgr !== 'undefined'` 判断,漏判的那条路径(设置签名
 * 变化 → loadNewScramble)就会在首帧炸一条 ReferenceError。这里把加载收成一个带缓存的
 * Promise:谁需要引擎就 await 它,不再各自轮询、各自判空。
 *
 * 注:/timer 单人模式走 _lib/scramble/cstimer_worker.ts(worker 里另加载一份),
 * 与本模块互不影响 —— 这里只服务对战模式。
 */

let loading: Promise<void> | null = null;

/** 引擎是否已经可用(同步判断,给「能省则省」的分支用)。 */
export function isScrambleEngineReady(): boolean {
  return typeof window !== 'undefined' && typeof window.scrMgr !== 'undefined';
}

/**
 * 确保引擎已加载。重复调用共享同一个 Promise;脚本已在页面上时立即 resolve。
 * 加载失败(离线 / 404)时同样 resolve —— 调用方拿到的是「引擎不可用」的既成事实,
 * 由 generateScramble 的 try/catch 兜底,不因此挂掉整个对战界面。
 */
export function loadScrambleEngine(): Promise<void> {
  if (isScrambleEngineReady()) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve) => {
    // scramble_module.js 内部用到 jQuery 的 $.isArray / $.now / $.noop / $.map / $.fn,
    // 给最小 shim 而不是引入整个 jQuery(上游 battle/index.html 的做法)。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.$) {
      const jqShim: Record<string, unknown> = {
        isArray: Array.isArray,
        now: Date.now,
        noop: () => {},
        map: (arr: unknown[], fn: (item: unknown, i: number) => unknown) =>
          Array.prototype.map.call(arr, fn),
        fn: {},
      };
      w.$ = jqShim;
    }
    // kernel.getProp 给 image.js 提供 WCA 标准配色(默认值),不读 localStorage。
    if (!w.kernel) {
      w.kernel = {
        getProp: (key: string): string | null => {
          const defaults: Record<string, string> = {
            'colcube': '#ff0#fa0#00f#fff#f00#0d0',
            'colclk': '#f00#37b#5cf#ff0#850',
            'colsq1': '#ff0#f80#0f0#fff#f00#00f',
            'colpyr': '#0f0#f00#00f#ff0',
            'colskb': '#ff0#fa0#00f#fff#f00#0d0',
            'colmgm': '#fff#d00#060#81f#fc0#00b#ffb#8df#f83#7e0#f9f#999',
            'colfto': '#fff#808#0d0#f00#00f#bbb#ff0#fa0',
            'colico': '#fff#084#b36#a85#088#811#e71#b9b#05a#ed1#888#6a3#e8b#a52#6cb#c10#fa0#536#49c#ec9',
            'col15p': '#f00#fa0#ff0#0d0#00f#fff#888#000',
            'col-font': '#fff',
            'col-board': '#000',
          };
          return defaults[key] !== undefined ? defaults[key] : null;
        },
      };
    }

    const script = document.createElement('script');
    script.src = '/scramble_module.js';
    script.async = true;
    // 脚本留在 <head> 里不移除 —— 全局一旦注入就长期有效。
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return loading;
}
