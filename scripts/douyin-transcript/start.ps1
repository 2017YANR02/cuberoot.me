param([string]$Url)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
    if (-not $Url) { $Url = Read-Host '粘贴抖音直播复盘链接' }
    if (-not $Url) { throw '没有输入链接。' }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '未安装 Node.js 22 或更新版本。' }
    $entry = Join-Path $PSScriptRoot 'cli.mjs'
    $json = & node $entry $Url --login
    if ($LASTEXITCODE -ne 0) { throw '导出未完成，请查看上方原因。' }
    $result = $json | ConvertFrom-Json
    Write-Host "`n已导出 $($result.count) 条文字记录："
    Write-Host $result.path
    Start-Process -FilePath notepad.exe -ArgumentList ('"' + $result.path + '"')
} catch { Write-Host $_.Exception.Message }
$null = Read-Host '按回车关闭'
