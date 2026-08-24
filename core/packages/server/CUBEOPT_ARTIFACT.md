# CubeOpt API artifact store

CubeOpt 云端最优解只接受一个 `CUBEOPT_ARTIFACT_DIR`，它指向 API 自有 artifact store。当前可执行事实是 `opt5` wrapper、同名 WASM 与 `h48prun31h5.dat`，不是旧注释声称的 opt6。三个文件必须由同一份 `manifest.json` 锁定；API 不再从 Web `public`、solver 本机目录或三个独立环境变量拼装运行资产。

## Bundle 契约

store 目录必须包含一个原子切换的 current 指针和不可变 bundle：

```text
<artifact-store>/
  current.json
  bundles/
    cubeopt-opt5-<id>/
      manifest.json
      cube48opt5.mjs
      cube48opt5.wasm
      h48prun31h5.dat
```

`current.json` 的 schema 是 `cuberoot.cubeopt-current/v1`，只登记当前 bundle ID。manifest 的单一 schema 是 `cuberoot.cubeopt-artifact/v1`，并包含：

- `bundle`：以 `cubeopt-opt5-` 开头的不可变 bundle ID；
- `variant: "opt5"` 与 `protocol: 1`；
- `source.url`、`source.revision`、`source.buildCommand`：实际来源和构建证据；
- `files.{module,wasm,table}` 的固定相对 `path`、`bytes` 和小写 SHA-256。

启动 daemon 前会校验 schema、variant、protocol、固定文件名、h5 表字节数、每个文件大小与 SHA-256，以及 wrapper 内的 opt5 WASM/worker 引用。任一项不符都不会输出 `READY`，因此不会把不同 opt level 的 module、WASM 与 table 静默混用。

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

`h48prun31h5.dat` 接近 1 GB，普通 clone、普通 CI 和 Git 都不携带它。普通测试只用小 fixture 锁 manifest、缺文件、错误 hash、错误 variant、错误 wrapper 引用、原子 current 切换和无 Web 路径回退。

## 构建、部署与真实 smoke

`pnpm --filter @cuberoot/server build:bundle` 同时生成：

```text
packages/server/dist/server.bundle.js
packages/server/dist/cubeopt/solve-daemon.mjs
packages/server/dist/cubeopt/smoke.mjs
```

部署单元必须同时带上这三个文件，并把预先验证的 artifact store 放在 API 管理的持久位置。发布环境只配置：

```text
CUBEOPT_SOLVE_ENABLED=1
CUBEOPT_ARTIFACT_DIR=<absolute artifact store>
```

迁移期间若旧 `CUBEOPT_DAEMON_SCRIPT`、`CUBEOPT_MODULE` 或 `CUBEOPT_TABLE` 仍存在，只要 `CUBEOPT_ARTIFACT_DIR` 已配置就会显式 warning 并忽略旧值；未配置 store 则 hard-fail，不会进入 legacy fallback。这样可以先 provision store 并上线新代码，确认后再清旧环境变量。部署 artifact 后执行真实 daemon smoke；它加载并校验真实大表，再用单步打乱验证协议和求解结果：

```powershell
pnpm --filter @cuberoot/server cubeopt:smoke -- --store $ArtifactStore
```

真实大表 smoke 属发布/制品验收，不进普通 Test workflow。`smoke.mjs` 直接调用生产 `solveOptimal` 管理器，不复制 daemon 的 stdio 协议。部署 workflow 是否复制两个 CubeOpt 入口、提供 artifact store 并在 reload 前完成 prepare、promote、verify 必须在 workflow 切片中单独验收；仅 server build 成功不代表生产资产已就绪。
