# packages

这里只放有稳定职责和公开出口的共享库，现役 workspace 的 `package.json.cuberoot.kind` 必须为 `library`。

禁止 package 反向依赖 app，也禁止跨 package 相对引用或私有 deep import。

`platform/` 是 workspace 外退役归档，不移动、不构建、不引入新功能。
