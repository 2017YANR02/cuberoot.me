# PreToolUse fast guard for dependency edges visible in the newly written fragment.
# The full-file CI ratchet is authoritative and uses the same TypeScript AST detector.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

$payload = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($payload)) { exit 0 }

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
$scanner = Join-Path $repoRoot 'core/scripts/check-architecture-boundaries.mjs'
if (-not (Test-Path -LiteralPath $scanner)) { exit 0 }

$payload | & node $scanner --hook
exit 0
