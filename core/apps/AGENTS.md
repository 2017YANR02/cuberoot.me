# apps

这里只放独立运行和部署的产品应用，`package.json.cuberoot.kind` 必须为 `app`。

应用只能通过公开 package 出口复用代码，禁止读取另一个 app 的私有源码。

从 `core/` 用 `pnpm --filter <package-name> <script>` 运行命令。
