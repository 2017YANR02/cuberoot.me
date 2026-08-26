# apps

这里只放独立运行和部署的产品应用；pnpm app 的 `package.json.cuberoot.kind` 必须为 `app`，Cargo app 以 `Cargo.toml` 为入口且不伪造 `package.json`。

应用只能通过公开 package 出口复用代码，禁止读取另一个 app 的私有源码。

pnpm app 从 `core/` 用 `pnpm --filter <package-name> <script>`；Cargo app 进入自身目录运行 `cargo`。
