// client-only 交互装配(PLAN-sr-retirement Phase 1 headless 抽包边界):
// World 核心不再值依赖指针 Controller(engine/world.ts 只 `import type` + 注入槽),
// 每个要交互的 client 实例化点在 new World() 后调这里补上。headless(Node/服务端)
// 场景不调 —— 层转逻辑照常走 twister/tweener,只是没有指针拖动。
import World from './engine/world';
import Controller from './engine/nxn/controller';

/** new World() 之后立刻调:装上指针拖动控制器(行为与原 World ctor 内联时一致)。 */
export function attachInteraction(world: World): World {
  world.controller = new Controller(world);
  return world;
}
