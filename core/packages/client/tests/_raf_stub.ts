/**
 * Node 无 requestAnimationFrame,而引擎的 tweener.ts 在模块加载期就起 rAF 循环。
 * 测试要 import 任何经由 tweener 的模块(nxn/cube、Sq1Cube 等)时,先 import 本
 * stub(必须放在文件第一条 import —— ESM 按声明顺序执行)。stub 不排队不回调,
 * 循环挂起在第一拍,测试进程不会被拖住。
 */
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (): number => 0;
  (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = (): void => {};
}

export {};
