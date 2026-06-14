---
name: pretooluse-hook
description: "写 / 改 Claude Code 拦截钩子(PreToolUse guard hook)时用 —— 写入或命令执行那一刻拦违规(裸 history、button 当导航、手写繁体、危险命令、自启浏览器等)。给出 JSON-deny 模板(pwsh + node)、scope/豁免/fail-open 约定、以及必须真触发验证的方法。本环境 auto 权限模式会静默忽略 exit 2,务必照此写。Triggers: \"写 hook\", \"加 hook\", \"改 hook\", \"PreToolUse\", \"拦截钩子\", \"写入即拦\", \"guard hook\", \"block-button-navigation\", \"block-raw-history\", \"block-handwritten-trad\", \"block-next-build\", \"guard-browser-launch\", \"permissionDecision\", \"hook 不生效\", \"hook 没拦住\", \"settings.json hooks\", \"write a hook\", \"pretooluse hook\"."
---

# 写 Claude Code 拦截钩子(PreToolUse）

要在**写入 / 命令执行那一刻**拦住违规(裸 `history.*`、`onClick` 当导航、手写繁体、危险命令、自启浏览器…),写一个 PreToolUse 钩子。

钩子在两处:全局 `~/.claude/hooks/`(跨项目)+ 项目 `<repo>/.claude/hooks/`;**注册在 `~/.claude/settings.json` 的 `hooks.PreToolUse`**(matcher `Edit|Write|MultiEdit` 拦写入,`Bash|PowerShell` 拦命令)。改完直接生效(每次工具调用从磁盘读)。

## 铁律 1:拦截用 JSON deny,**禁 `exit 2`**

本环境跑 **auto 权限模式**(`~/.claude/settings.json` 的 `permissions.defaultMode:"auto"` + `skipAutoPermissionPrompt`)。此模式下 **`exit 2` 拦截被静默忽略** —— 钩子照样 fire、也确实返回 2,但工具照常执行(文件照写)。2026-06-14 实测确认。官方 docs 没写这层模式交互。

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

改完**必须用真的 Edit/Write/Bash 工具调用触发一次**,确认被拒。**禁**只 `echo $json | pwsh hook.ps1` 看 exit code —— 那只验脚本逻辑,**不验 harness 是否采纳决定**(本会话两次栽在这:脚本对、harness 不拦)。

- 测写入违规:文件**被拒 = 没创建**即成功。
- 测命令违规:注意你的**测试命令本身可能含触发串而自拦**(曾用 `chrome --headless` 测,自己的 PowerShell 调用被拦了 —— 恰好是端到端证明)。
- 测完删测试文件(被拒的本就没建)。

## 其它约定(照现有钩子)

- **scope 过滤**:只扫该管的文件 / 命令(`.tsx/.ts`、跳 `node_modules/.next/dist/test`)。
- **豁免两途**:违规处行内注释 `allow-xxx`(eslint-disable 风格)+ 项目 `.claude/<rule>-allowlist.txt`(范例见 `block-raw-history-url-state.ps1`)。
- **fail-open**:解析失败 / 工具缺失一律 `exit 0`,别把正常编辑卡死;**CI 是最终兜底**。
- **分层**:写入即拦(本钩子)+ CI vitest 守卫两层都铺(全局 CLAUDE.md「立约束要分层」)。
- 路径用 `$PSScriptRoot` 自解析,别依赖 `$env:CLAUDE_PROJECT_DIR`(会话根可能在 repo 根或 core/,拼错会 fail-open)。

## 现成范例

- 纯 pwsh,Edit/Write:`~/.claude/hooks/block-raw-history-url-state.ps1`、`block-button-navigation.ps1`
- pwsh→node 委托(两规则):`<repo>/.claude/hooks/block-handwritten-trad.ps1` → `core/packages/client-next/scripts/hook-detect-handwritten-trad.mjs`(裸 isZh 三目 + 手写繁体)
- 纯 node,Bash/PowerShell:`~/.claude/hooks/guard-browser-launch.mjs`

背景见 memory `reference_pretooluse_hook_auto_mode_deny`。
