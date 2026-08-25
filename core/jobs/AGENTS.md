# jobs

这里只放离线生成和同步任务，`package.json.cuberoot.kind` 必须为 `job`。

Job 只能依赖公开 package 出口，禁止读取 app 私有源码。

正式输入、输出和 owner 以 `docs/generated-artifacts.json` 为准，验证不得覆盖正式生成物。
