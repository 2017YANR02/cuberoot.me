---
name: pretooluse-hook
description: "写 / 改 Codex 拦截钩子(PreToolUse guard hook)时用 —— 写入或命令执行那一刻拦违规(裸 history、button 当导航、手写繁体、危险命令、自启浏览器等)。给出 JSON-deny 模板(pwsh + node)、scope/豁免/fail-open 约定、以及必须真触发验证的方法。本环境 auto 权限模式会静默忽略 exit 2,务必照此写。Triggers: \"写 hook\", \"加 hook\", \"改 hook\", \"PreToolUse\", \"拦截钩子\", \"写入即拦\", \"guard hook\", \"block-button-navigation\", \"block-raw-history\", \"block-handwritten-trad\", \"block-next-build\", \"guard-browser-launch\", \"permissionDecision\", \"hook 不生效\", \"hook 没拦住\", \"settings.json hooks\", \"write a hook\", \"pretooluse hook\"."
---

# 写 Codex 拦截钩子(PreToolUse）

要在**写入 / 命令执行那一刻**拦住违规(裸 `history.*`、`onClick` 当导航、手写繁体、危险命令、自启浏览器…),写一个 PreToolUse 钩子。

项目钩子放 `<repo>/.codex/hooks/`,注册在 `<repo>/.codex/hooks.json`。写入匹配 `apply_patch`,命令必须匹配 Codex hook 的规范名 `Bash`(不是工具 API 名 `shell_command`)。修改配置后新开 Codex 会话,再用 `/hooks` 信任当前定义哈希。

当前 Codex 的 `apply_patch` 原始补丁位于 `tool_input.command`,命令同样位于 `tool_input.command`;复用旧结构化写入检测器时先经项目 `adapt-codex-write-payload.mjs` 转成 `{file_path,content}`。

## 铁律 1:拦截用 JSON deny,**禁 `exit 2`**

本环境的自动权限模式会静默忽略 `exit 2`:钩子会运行,工具仍可能执行。统一输出 JSON deny 并 `exit 0`。

**只有往 stdout 打 JSON `permissionDecision:"deny"` + `exit 0` 各模式都生效。** 命中违规就输出这段:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"为什么拦 + 怎么改"}}
```

`permissionDecision` 取值 `allow|deny|ask|defer`;放行 = 无输出 + `exit 0`(= defer,走正常权限流)。

### pwsh 模板

```powershell
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # 出 CJK reason 必设,否则乱码
$raw = [Console]::In.ReadToEnd()
try { $j = $raw | ConvertFrom-Json } catch { exit 0 }      # 解析失败 fail-open

$fp = "$($j.tool_input.file_path)" -replace '\\','/'
if ($fp -notmatch '\.(tsx|ts)$') { exit 0 }               # scope:只管该管的
# 收新增内容(Edit:new_string / Write:content / MultiEdit:edits[].new_string)
$content = "$($j.tool_input.content)$($j.tool_input.new_string)"
foreach ($e in $j.tool_input.edits) { $content += "`n$($e.new_string)" }

if ($content -notmatch '违规正则') { exit 0 }              # 不违规放行
if ($content -match 'allow-xxx') { exit 0 }                # 豁免:行内注释

$reason = '为什么拦 + 怎么改 + 豁免方式'
(@{ hookSpecificOutput = @{ hookEventName='PreToolUse'; permissionDecision='deny'; permissionDecisionReason=$reason } } | ConvertTo-Json -Compress)
exit 0
```

### node 模板

```js
let raw=''; process.stdin.setEncoding('utf8');
process.stdin.on('data',c=>raw+=c);
process.stdin.on('end',()=>{
  let ti; try { ti = JSON.parse(raw||'{}').tool_input||{}; } catch { process.exit(0); }
  const cmd = ti.command || '';                 // 或按 tool 取 content/new_string
  if (!/违规正则/.test(cmd)) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput:{
    hookEventName:'PreToolUse', permissionDecision:'deny', permissionDecisionReason:'为什么拦 + 怎么改' }}));
  process.exit(0);
});
```

### pwsh wrapper 委托 node(快速门 + 精判,省 node 开销)

```powershell
if ($payload -notmatch '[㐀-䶿一-鿿豈-﫿]') { exit 0 }   # 无关内容快速放行
$payload | & node $detector                              # node 命中→打 deny JSON→exit 0
exit $LASTEXITCODE                                       # wrapper 原样透传 stdout
```

## 铁律 2:**必须真触发验证**(别只喂管道)

改完**必须新开会话并在 `/hooks` 信任当前哈希,再用真的 `apply_patch` / shell 工具调用触发一次**,确认被拒。**禁**只 `echo $json | pwsh hook.ps1` 看 exit code —— 那只验脚本逻辑,不验 harness 是否采纳决定。

- 测写入违规:文件**被拒 = 没创建**即成功。
- 测命令违规:注意你的**测试命令本身可能含触发串而自拦**(曾用 `chrome --headless` 测,自己的 PowerShell 调用被拦了 —— 恰好是端到端证明)。
- 测完删测试文件(被拒的本就没建)。

## 其它约定(照现有钩子)

- **scope 过滤**:只扫该管的文件 / 命令(`.tsx/.ts`、跳 `node_modules/.next/dist/test`)。
- **豁免两途**:违规处行内注释 `allow-xxx`(eslint-disable 风格)+ 项目 `.codex/<rule>-allowlist.txt`(范例见 `block-raw-history-url-state.ps1`)。
- **fail-open**:解析失败 / 工具缺失一律 `exit 0`,别把正常编辑卡死;**CI 是最终兜底**。
- **分层**:写入即拦(本钩子)+ CI vitest 守卫两层都铺(全局 AGENTS.md「立约束要分层」)。
- 路径用 `$PSScriptRoot` 自解析,别依赖会话 cwd(可能在 repo 根或 core/,拼错会 fail-open)。

## 现成范例

- Codex `apply_patch` 多文件补丁解析:`core/packages/client/scripts/hook-detect-nested-links.mjs`
- pwsh→node 委托:`<repo>/.codex/hooks/block-component-reimplementation.ps1`
- 命令守卫:`<repo>/.codex/hooks/recon-ground-truth-gate.ps1`

规范名、输入结构与信任流程以 `https://learn.chatgpt.com/docs/hooks` 为准。
