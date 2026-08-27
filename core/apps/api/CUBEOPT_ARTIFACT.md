# CubeOpt API artifact store

CubeOpt 云端最优解只接受一个 `CUBEOPT_ARTIFACT_DIR`，它指向 API 自有 artifact store。每个 bundle 严格选择 `opt5`、`opt6` 或 `opt8`：wrapper、同名 WASM 与对应 h5/h6/h8 table 必须是同一 variant，并由一份 `manifest.json` 锁定。API 不再从 Web `public`、solver 本机目录或三个独立环境变量拼装运行资产。

## Bundle 契约

store 目录必须包含一个原子切换的 current 指针和不可变 bundle：

```text
<artifact-store>/
  current.json
  bundles/
    cubeopt-opt5-<id>/、cubeopt-opt6-<id>/ 或 cubeopt-opt8-<id>/
      manifest.json
      cube48opt{5|6|8}.mjs
      cube48opt{5|6|8}.wasm
      h48prun31h{5|6|8}.dat
```

`current.json` 的 schema 是 `cuberoot.cubeopt-current/v1`，只登记当前 bundle ID。manifest 的单一 schema 是 `cuberoot.cubeopt-artifact/v1`，并包含：

- `bundle`：以 `cubeopt-opt5-`、`cubeopt-opt6-` 或 `cubeopt-opt8-` 开头的不可变 bundle ID，且前缀必须等于 manifest variant；
- `variant: "opt5" | "opt6" | "opt8"` 与 `protocol: 1`；
- `source.url`、`source.revision`、`source.buildCommand`：实际来源和构建证据；
- `files.{module,wasm,table}` 的固定相对 `path`、`bytes` 和小写 SHA-256。

启动 daemon 前会校验 schema、variant、protocol、variant 对应的固定文件名、精确表字节数、每个文件大小与 SHA-256、wrapper 内的同 variant WASM/worker 引用，以及 WASM 内嵌的同 variant WASM/table 标记。`opt5`、`opt6`、`opt8` 表必须分别是 972,840,960、1,945,681,920、7,782,727,680 bytes。任一项不符都不会输出 `READY`，因此即使文件被改名并重新计算哈希，也不会把不同 opt level 的 module、WASM 与 table 静默混用。

## 准备与验证

从 `core/` 运行。准备命令要求输入真实来源、revision 和原始 build command；同名 bundle 已存在时直接失败，不会覆盖：

```powershell
pnpm --filter @cuberoot/server cubeopt:prepare -- `
  --store $ArtifactStore `
  --bundle $BundleId `
  --module $ModulePath `
  --wasm $WasmPath `
  --table $TablePath `
  --source-url $SourceUrl `
  --source-revision $SourceRevision `
  --source-build-command $SourceBuildCommand

pnpm --filter @cuberoot/server cubeopt:promote -- `
  --store $ArtifactStore `
  --bundle $BundleId

pnpm --filter @cuberoot/server cubeopt:verify -- $ArtifactStore
```

prepare 先复制到 store 同文件系统的 staging 目录，完整校验后 rename 成不可变 bundle。promote 会重新校验目标 bundle，把已 flush 的临时 pointer 在 store 根目录 rename 为 `current.json`。失败的 bundle 不会改变 current；旧 bundle 保留，可通过再次 promote 回滚。运行中的 daemon 只在启动时解析 current，切换或回滚后应 reload API/daemon。

三种表分别接近 1 GB、2 GB 和 8 GB，普通 clone、普通 CI 和 Git 都不携带它们。普通测试用小 fixture 同时锁定 opt5/opt6/opt8 的 manifest、缺文件、错误 hash、variant 混配、错误 wrapper 引用、原子 current 切换和无 Web 路径回退。opt8 应只部署在总内存至少 16 GB 的主机，并显式保留至少 2 GB 的 `CUBEOPT_MEM_FLOOR_MB`。

## 构建、部署与真实 smoke

`pnpm --filter @cuberoot/server build:bundle` 同时生成：

```text
apps/api/dist/server.bundle.js
apps/api/dist/cubeopt/solve-daemon.mjs
apps/api/dist/cubeopt/prepare.mjs
apps/api/dist/cubeopt/provision.mjs
apps/api/dist/cubeopt/verify.mjs
apps/api/dist/cubeopt/promote.mjs
apps/api/dist/cubeopt/smoke.mjs
```

部署单元必须同时带上这些文件，并把已验证的 artifact store 放在 API 管理的持久位置。发布环境只配置：

```text
CUBEOPT_SOLVE_ENABLED=1
CUBEOPT_ARTIFACT_DIR=<absolute artifact store>
```

若机器要让已选大表从 API 启动后持续驻留内存，可另外设置：

```text
CUBEOPT_WARM_ON_BOOT=1
CUBEOPT_IDLE_MS=0
```

`CUBEOPT_IDLE_MS=0` 只关闭空闲卸载；低内存看门狗和 OOM 优先牺牲 CubeOpt 子进程的保护仍然生效。若保护层因真实内存压力卸载表，后续请求会在冷却期结束后重新加载。

首次发布会在切换 release 前运行 `provision.mjs`。若 store 已有有效 `current.json`，它只做校验；若 store 尚不存在，它才从旧部署环境的 `CUBEOPT_MODULE` 和 `CUBEOPT_TABLE` 读取现有真实字节，从 module 文件名识别 opt5/opt6/opt8，派生同目录同 variant wasm，并拒绝任何 module、WASM、table 混配。随后调用同一套 prepare/promote 实现建立逻辑不可变 bundle，并原子写入 `CUBEOPT_ARTIFACT_DIR`。固定 suffix 让工具按真实 variant 派生稳定 bundle ID；prepare 成功而后续步骤失败的重跑可以复用已校验 bundle，不重复复制大表。复用前还会核对旧部署源的三份真实字节未变化。env 仅在 current 完整校验后原子更新。

这条路径只存在于部署工具，不在 Server runtime 内。运行时若旧 `CUBEOPT_DAEMON_SCRIPT`、`CUBEOPT_MODULE` 或 `CUBEOPT_TABLE` 仍存在，只要 `CUBEOPT_ARTIFACT_DIR` 已配置就会显式 warning 并忽略旧值；未配置 store 则 hard-fail，不会进入 legacy fallback。部署 artifact 后执行真实 daemon smoke；它加载并校验真实大表，再用单步打乱验证协议和求解结果：

```powershell
pnpm --filter @cuberoot/server cubeopt:smoke -- --store $ArtifactStore
```

真实大表 smoke 属发布/制品验收，不进普通 Test workflow。`smoke.mjs` 直接调用生产 `solveOptimal` 管理器，不复制 daemon 的 stdio 协议。部署 workflow 是否复制全部 CubeOpt 入口、提供持久 store，并在 reload 前完成幂等 provision 与独立 verify，必须在 workflow 契约测试中单独验收；仅 server build 成功不代表生产资产已就绪。
