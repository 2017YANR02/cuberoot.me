---
name: pretooluse-hook
description: "用户说写 hook、改 hook、PreToolUse、拦截钩子、写入即拦、permissionDecision，或 hook 不生效/没拦住时使用。覆盖跨平台 Node/TypeScript JSON deny、scope 与豁免、fail-open、exit 0，以及真实工具调用验证。"
---

# 写 Codex 拦截钩子（PreToolUse）

项目钩子放 `<repo>/.codex/hooks/`，注册在 `<repo>/.codex/hooks.json`。仓库使用 `.node-version` 指定的 Node 24，hook 源码写 TypeScript `.mts`，由 Node 直接运行；不引入 PowerShell 包装层。写入匹配 `apply_patch`，命令匹配 Codex 规范名 `Bash`。新增约束时同步 CI 守卫和 `/dev/guards` 索引。

当前 Codex 的 `apply_patch` 补丁在 `tool_input.command`。项目的 `adapt-codex-write-payload.mts` 将补丁拆为 `{file_path,content}`，`adapt-codex-command-payload.mts` 规范化命令。复用它们，不再手写第二套解析。

## 拦截契约

违规时向 stdout 输出 JSON deny，退出码为 0：

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"为什么拦 + 怎么改"}}
```

`exit 2` 在本环境自动权限模式下可能被静默忽略，不能用于拦截。放行时无输出并退出 0。无效 JSON、缺文件或运行条件不满足应 fail-open；CI 是完整文件的最终兜底。

```ts
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let request: { tool_input?: { command?: string } };
try { request = JSON.parse(raw || '{}'); } catch { process.exit(0); }
const command = request.tool_input?.command ?? '';
if (!/违规条件/.test(command)) process.exit(0);
process.stdout.write(JSON.stringify({ hookSpecificOutput: {
  hookEventName: 'PreToolUse',
  permissionDecision: 'deny',
  permissionDecisionReason: '为什么拦 + 怎么改',
} }));
```

只检查应管的路径和新增内容，跳过 `node_modules`、`.next`、`dist`、测试 fixture 等不相关输入。需要豁免时用行内 `allow-xxx` 注释或 `.codex/<rule>-allowlist.txt`，并说明理由。路径从 `import.meta.url` 解析，不能依赖会话 CWD。

## 验证

修改配置后新开 Codex 会话，用 `/hooks` 信任定义哈希，再用真实 `apply_patch` 或 Bash 工具调用触发一次：违规写入应被拒且文件不存在，合法输入应放行。单独向 `.mts` 送 JSON 只能验证脚本逻辑，不能证明 Codex harness 采纳决定。若当前会话不能重载配置，应明确记录尚待新会话验证。

- 多文件补丁范例：`core/packages/client/scripts/hook-detect-nested-links.mjs`
- 写入适配：`.codex/hooks/adapt-codex-write-payload.mts`
- 命令守卫：`.codex/hooks/recon-ground-truth-gate.mts`

规范名、输入结构与信任流程以 `https://learn.chatgpt.com/docs/hooks` 为准。
