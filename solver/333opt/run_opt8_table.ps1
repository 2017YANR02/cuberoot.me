[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw '请使用 pwsh 7 运行此脚本。'
}

$threads = 14
$memoryFloorGiB = 1.25
$expectedBytes = 7_782_727_680L
$pollSeconds = 5
$reportSeconds = 30
$scriptDir = $PSScriptRoot
$repoRoot = [IO.Path]::GetFullPath((Join-Path $scriptDir '..\..'))
$modulePath = Join-Path $repoRoot 'core\packages\client\public\cubeopt\cube48opt8.mjs'
$wasmPath = Join-Path $repoRoot 'core\packages\client\public\cubeopt\cube48opt8.wasm'
$generatorPath = Join-Path $scriptDir 'gen-table.mjs'
$outputDir = Join-Path $repoRoot 'solver\tables\h48'
$tablePath = Join-Path $outputDir 'h48prun31h8.dat'

function Format-Duration {
    param([TimeSpan]$Duration)

    if ($Duration.TotalHours -ge 1) {
        return '{0}:{1:00}:{2:00}' -f [Math]::Floor($Duration.TotalHours), $Duration.Minutes, $Duration.Seconds
    }
    return '{0}:{1:00}' -f [Math]::Floor($Duration.TotalMinutes), $Duration.Seconds
}

function Read-SharedText {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ''
    }

    $stream = $null
    $reader = $null
    try {
        $stream = [IO.FileStream]::new(
            $Path,
            [IO.FileMode]::Open,
            [IO.FileAccess]::Read,
            [IO.FileShare]::ReadWrite
        )
        $reader = [IO.StreamReader]::new($stream)
        return $reader.ReadToEnd()
    }
    catch [IO.IOException] {
        return ''
    }
    finally {
        if ($null -ne $reader) {
            $reader.Dispose()
        }
        elseif ($null -ne $stream) {
            $stream.Dispose()
        }
    }
}

function Get-LatestPercent {
    param(
        [string]$Text,
        [string]$Pattern
    )

    $matches = [regex]::Matches($Text, $Pattern)
    if ($matches.Count -eq 0) {
        return $null
    }
    return [double]::Parse(
        $matches[$matches.Count - 1].Groups['percent'].Value,
        [Globalization.CultureInfo]::InvariantCulture
    )
}

foreach ($requiredPath in @($modulePath, $wasmPath, $generatorPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "缺少必需文件: $requiredPath"
    }
}

if (Test-Path -LiteralPath $tablePath -PathType Leaf) {
    $existingBytes = (Get-Item -LiteralPath $tablePath).Length
    if ($existingBytes -eq $expectedBytes) {
        Write-Host "opt8 表已存在且大小正确: $tablePath"
        exit 0
    }
    Write-Warning "现有表大小不正确($existingBytes bytes)，生成成功后会覆盖它。"
}

$nodePath = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$freeGiB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
$minimumStartGiB = ($expectedBytes / 1GB) + $memoryFloorGiB
Write-Host ('可用内存: {0:N2} GiB；启动下限: {1:N2} GiB；运行中止线: {2:N2} GiB' -f $freeGiB, $minimumStartGiB, $memoryFloorGiB)
if ($freeGiB -lt $minimumStartGiB) {
    throw '当前可用内存不足。请关闭占用内存的程序后重试。'
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$logDir = Join-Path $outputDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutLogPath = Join-Path $logDir "opt8-$runStamp.log"
$stderrLogPath = Join-Path $logDir "opt8-$runStamp.err.log"

$oldThreads = [Environment]::GetEnvironmentVariable('THREADS', 'Process')
$oldModule = [Environment]::GetEnvironmentVariable('MODULE', 'Process')
$oldOut = [Environment]::GetEnvironmentVariable('OUT', 'Process')
$generatorProcess = $null

try {
    $env:THREADS = [string]$threads
    $env:MODULE = $modulePath
    $env:OUT = $outputDir

    $generatorProcess = Start-Process `
        -FilePath $nodePath `
        -ArgumentList $generatorPath `
        -WorkingDirectory $repoRoot `
        -PassThru `
        -NoNewWindow `
        -RedirectStandardOutput $stdoutLogPath `
        -RedirectStandardError $stderrLogPath
    $generatorProcess.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal

    Write-Host "opt8 建表已启动：PID $($generatorProcess.Id)，$threads 线程，低优先级。"
    Write-Host "实时日志：$stdoutLogPath"
    $lastReport = [DateTime]::MinValue
    $phase = 'generation'
    $phaseStartedAt = $generatorProcess.StartTime

    while (-not $generatorProcess.HasExited) {
        Start-Sleep -Seconds $pollSeconds
        $generatorProcess.Refresh()

        $freeGiB = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
        if ($freeGiB -lt $memoryFloorGiB) {
            Stop-Process -Id $generatorProcess.Id -Force -ErrorAction SilentlyContinue
            throw ('可用内存降到 {0:N2} GiB，低于 {1:N2} GiB 自动中止线，已停止建表。' -f $freeGiB, $memoryFloorGiB)
        }

        $now = Get-Date
        $elapsed = $now - $generatorProcess.StartTime
        $rssGiB = if ($generatorProcess.HasExited) { 0 } else { $generatorProcess.WorkingSet64 / 1GB }
        $stdoutText = Read-SharedText -Path $stdoutLogPath
        $writingPercent = Get-LatestPercent -Text $stdoutText -Pattern 'writing\s+(?<percent>\d+(?:\.\d+)?)%'

        if ($null -ne $writingPercent) {
            if ($phase -ne 'writing') {
                $phase = 'writing'
                $phaseStartedAt = $now
            }
            $activity = '写入 opt8 表文件'
            $percent = $writingPercent
        }
        else {
            $activity = '生成 opt8 剪枝表'
            $percent = Get-LatestPercent -Text $stdoutText -Pattern 'handled\s+(?<percent>\d+(?:\.\d+)?)%'
            if ($null -eq $percent) {
                $percent = 0.0
            }
        }

        $phaseElapsed = $now - $phaseStartedAt
        $etaText = '等待首个进度点'
        $secondsRemaining = $null
        if ($percent -gt 0) {
            $remainingSeconds = $phaseElapsed.TotalSeconds * ((100.0 - $percent) / $percent)
            $secondsRemaining = [Math]::Max(0, [Math]::Ceiling($remainingSeconds))
            $etaText = Format-Duration -Duration ([TimeSpan]::FromSeconds($secondsRemaining))
        }

        $status = '{0:N1}%  已用 {1}  ETA {2}' -f $percent, (Format-Duration -Duration $elapsed), $etaText
        $progressArgs = @{
            Id = 1
            Activity = $activity
            Status = $status
            CurrentOperation = ('可用 {0:N2} GiB  RSS {1:N2} GiB' -f $freeGiB, $rssGiB)
            PercentComplete = [Math]::Min(100, [Math]::Floor($percent))
        }
        if ($null -ne $secondsRemaining) {
            $progressArgs.SecondsRemaining = $secondsRemaining
        }
        Write-Progress @progressArgs

        if (($now - $lastReport).TotalSeconds -ge $reportSeconds) {
            Write-Host ('进度：{0} {1:N1}%  已用 {2}  ETA {3}  可用 {4:N2} GiB  RSS {5:N2} GiB' -f $activity, $percent, (Format-Duration -Duration $elapsed), $etaText, $freeGiB, $rssGiB)
            $lastReport = $now
        }
    }

    $generatorProcess.WaitForExit()
    Write-Progress -Id 1 -Activity '生成 opt8 剪枝表' -Completed
    if ($generatorProcess.ExitCode -ne 0) {
        $stderrText = Read-SharedText -Path $stderrLogPath
        if (-not [string]::IsNullOrWhiteSpace($stderrText)) {
            Write-Error ($stderrText.Trim())
        }
        throw "建表进程退出码: $($generatorProcess.ExitCode)"
    }

    $finalBytes = (Get-Item -LiteralPath $tablePath).Length
    if ($finalBytes -ne $expectedBytes) {
        throw "表大小不正确: $finalBytes bytes；预期 $expectedBytes bytes。"
    }

    Write-Host "opt8 表生成完成: $tablePath"
    Write-Host "大小: $finalBytes bytes"
}
finally {
    Write-Progress -Id 1 -Activity '生成 opt8 剪枝表' -Completed
    if ($null -ne $generatorProcess -and -not $generatorProcess.HasExited) {
        Stop-Process -Id $generatorProcess.Id -Force -ErrorAction SilentlyContinue
    }
    [Environment]::SetEnvironmentVariable('THREADS', $oldThreads, 'Process')
    [Environment]::SetEnvironmentVariable('MODULE', $oldModule, 'Process')
    [Environment]::SetEnvironmentVariable('OUT', $oldOut, 'Process')
}
