# PreToolUse hook: block the site's banned words in AI-written content.
# Word list (the ONLY place to edit): <repo>/.codex/banned-words.json
# Registered by .codex/hooks.json PreToolUse;stdin = {tool_name, tool_input}.
# Deny via stdout JSON permissionDecision=deny + exit 0 (exit 2 is silently ignored in auto mode).
# Quick gate: payload with no CJK -> allow immediately.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($payload)) { exit 0 }
# No CJK at all -> no banned word possible (they are all Chinese). Cheapest exit.
if ($payload -notmatch '[㐀-䶿一-鿿]') { exit 0 }

try { $j = $payload | ConvertFrom-Json } catch { exit 0 }   # fail open

# The word list and this hook necessarily contain the words themselves; so does any
# doc under .codex/. Never police our own machinery.
$fp = "$($j.tool_input.file_path)" -replace '\\', '/'
if ($fp -match '/\.codex/') { exit 0 }

# Only the newly added apply_patch text is judged,never the old content being replaced.
$content = "$($j.tool_input.content)$($j.tool_input.new_string)"
foreach ($e in $j.tool_input.edits) { $content += "`n$($e.new_string)" }
if ([string]::IsNullOrWhiteSpace($content)) { exit 0 }

# Deliberate exception, eslint-disable style.
if ($content -match 'allow-banned-word') { exit 0 }

$listPath = Join-Path $PSScriptRoot '../banned-words.json'
if (-not (Test-Path $listPath)) { exit 0 }                  # fail open
try { $list = Get-Content -Raw -Encoding UTF8 $listPath | ConvertFrom-Json } catch { exit 0 }

$hits = @()
foreach ($w in $list.words) {
  if ([string]::IsNullOrEmpty($w.word)) { continue }
  if ($content.Contains($w.word)) {
    $hits += "「$($w.word)」→ 改用「$($w.use)」($($w.why))"
  }
}
if ($hits.Count -eq 0) { exit 0 }

$reason = "写入内容命中站内违禁词:`n" + ($hits -join "`n") `
  + "`n改掉后重写。确有必要保留原词:该行加注释 allow-banned-word。" `
  + "`n词表在 .codex/banned-words.json(用户说「添加违禁词:xx」就是加到那里)。"

(@{ hookSpecificOutput = @{
      hookEventName          = 'PreToolUse'
      permissionDecision     = 'deny'
      permissionDecisionReason = $reason
    } } | ConvertTo-Json -Compress -Depth 5)
exit 0
