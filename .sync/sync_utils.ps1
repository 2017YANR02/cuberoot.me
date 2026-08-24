<#
.SYNOPSIS
    同步脚本公共工具函数
.DESCRIPTION
    提供文件/目录同步、GA 代码生成、UTF-8 字节级读写等工具函数，
    供上游同步脚本共用。
#>

function Resolve-CubeRootRepoRoot
{
    <#
    .SYNOPSIS
        将显式 RepoRoot（或旧参数的仓库路径）解析为经校验的绝对路径。
    #>
    param(
        [string]$RepoRoot,
        [string]$LegacyRoot,
        [string]$ScriptRoot
    )

    $candidate = if ($RepoRoot) { $RepoRoot } elseif ($LegacyRoot) { $LegacyRoot } else { $ScriptRoot }
    if (-not $candidate)
    {
        throw 'RepoRoot 不能为空。'
    }

    $absolute = [System.IO.Path]::GetFullPath($candidate)
    $required = @(
        '.git'
        'core/pnpm-workspace.yaml'
        'tools'
        'ops'
        '.sync'
    )
    $missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $absolute $_)) })
    if ($missing.Count -gt 0)
    {
        throw "RepoRoot 不是完整的 cuberoot.me 仓库：$absolute；缺少 $($missing -join ', ')"
    }

    return $absolute.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
}

function Assert-SyncInternalFiles
{
    <#
    .SYNOPSIS
        只读校验同步脚本图和必需的仓库内依赖。
    #>
    param(
        [string]$RepoRoot,
        [string[]]$RelativePaths,
        [string[]]$PowerShellScripts = @()
    )

    $missing = @($RelativePaths | Where-Object { -not (Test-Path -LiteralPath (Join-Path $RepoRoot $_)) })
    if ($missing.Count -gt 0)
    {
        throw "同步脚本的仓库内依赖不完整：$($missing -join ', ')"
    }

    foreach ($relativePath in $PowerShellScripts)
    {
        $scriptPath = Join-Path $RepoRoot $relativePath
        $tokens = $null
        $parseErrors = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile(
            $scriptPath,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0)
        {
            $details = $parseErrors | ForEach-Object { "$($_.Extent.StartLineNumber): $($_.Message)" }
            throw "PowerShell 脚本语法错误：$relativePath`n$($details -join "`n")"
        }
    }
}

function Invoke-CheckedNativeCommand
{
    <#
    .SYNOPSIS
        执行原生命令，任何非零退出码都立即抛错。
    #>
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$FailureMessage
    )

    & $FilePath @ArgumentList
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0)
    {
        $message = if ($FailureMessage) { $FailureMessage } else { "$FilePath $($ArgumentList -join ' ') 失败" }
        throw "$message（退出码 $exitCode）"
    }
}

function Get-CheckedNativeText
{
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$FailureMessage
    )

    $output = Invoke-CheckedNativeCommand -FilePath $FilePath -ArgumentList $ArgumentList -FailureMessage $FailureMessage
    return (($output | ForEach-Object { "$_" }) -join "`n").Trim()
}

function Test-CheckedGitAncestor
{
    <#
    .SYNOPSIS
        git merge-base --is-ancestor 的 0/1 是 true/false，>1 是命令错误。
    #>
    param(
        [string]$WorkingDirectory,
        [string]$Ancestor,
        [string]$Descendant
    )

    $output = & git -C $WorkingDirectory merge-base --is-ancestor $Ancestor $Descendant 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) { return $true }
    if ($exitCode -eq 1) { return $false }

    $details = ($output | ForEach-Object { "$_" }) -join "`n"
    throw "git merge-base --is-ancestor $Ancestor $Descendant 失败（退出码 $exitCode）：`n$details"
}

function Push-SyncWorkingTreeStash
{
    <#
    .SYNOPSIS
        暂存 tracked 与 untracked 改动，并返回本次新建 stash 的 commit。
    #>
    param(
        [Parameter(Mandatory)]
        [string]$WorkingDirectory,
        [string]$Message = 'upstream sync: local changes'
    )

    $status = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
        '-C', $WorkingDirectory, 'status', '--porcelain'
    )
    if ([string]::IsNullOrWhiteSpace($status)) { return $null }

    $previousStash = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
        '-C', $WorkingDirectory, 'stash', 'list', '-1', '--format=%H'
    )
    [void](Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
        '-C', $WorkingDirectory, 'stash', 'push', '--include-untracked', '-q', '-m', $Message
    ))
    $createdStash = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
        '-C', $WorkingDirectory, 'stash', 'list', '-1', '--format=%H'
    )
    if ([string]::IsNullOrWhiteSpace($createdStash) -or $createdStash -eq $previousStash)
    {
        throw '工作区有改动，但 git stash 没有创建新条目；已停止以避免误恢复历史 stash。'
    }

    return $createdStash
}

function Restore-SyncWorkingTreeStash
{
    <#
    .SYNOPSIS
        仅在目标仍为栈顶时恢复本轮创建的 stash，避免误弹出其他条目。
    #>
    param(
        [Parameter(Mandatory)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory)]
        [string]$StashCommit
    )

    $latestStash = Get-CheckedNativeText -FilePath 'git' -ArgumentList @(
        '-C', $WorkingDirectory, 'stash', 'list', '-1', '--format=%H'
    )
    if ($latestStash -ne $StashCommit)
    {
        throw "stash 栈在同步期间发生变化；本轮改动仍保留在 stash $StashCommit。"
    }
    [void](Invoke-CheckedNativeCommand -FilePath 'git' -ArgumentList @(
        '-C', $WorkingDirectory, 'stash', 'pop'
    ))
}

function Invoke-WithFileRetry
{
    <#
    .SYNOPSIS
        重试包装：Windows 上索引器/杀软/dev server 会短暂锁住刚写的文件
        （"being used by another process" / "user-mapped section open"），退避重试即可。
    #>
    param(
        [scriptblock]$Action,
        [int]$Attempts = 5
    )

    for ($i = 1; $i -le $Attempts; $i++)
    {
        try
        {
            & $Action
            return
        }
        catch
        {
            if ($i -eq $Attempts) { throw }
            Start-Sleep -Milliseconds (200 * [Math]::Pow(2, $i - 1))
        }
    }
}

function Sync-FileIfChanged
{
    <#
    .SYNOPSIS
        MD5 对比后按需复制单个文件（自动创建目标目录）
    .OUTPUTS
        [bool] 是否发生了复制（或需要复制）
    #>
    param(
        [string]$Src,
        [string]$Dest,
        [bool]$DryRun = $false
    )

    $needCopy = $true
    if (Test-Path $Dest)
    {
        $needCopy = (Get-FileHash $Src -Algorithm MD5).Hash -ne (Get-FileHash $Dest -Algorithm MD5).Hash
    }

    if ($needCopy)
    {
        if (-not $DryRun)
        {
            $destDir = Split-Path $Dest -Parent
            if (-not (Test-Path $destDir))
            {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Invoke-WithFileRetry { Copy-Item $Src $Dest -Force }
        }
        return $true
    }
    return $false
}

function Sync-Directory
{
    <#
    .SYNOPSIS
        删除目标目录后整体复制源目录（确保与上游完全一致）
    #>
    param(
        [string]$Src,
        [string]$Dest,
        [bool]$DryRun = $false
    )

    if (-not $DryRun)
    {
        Invoke-WithFileRetry { if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force } }
        Invoke-WithFileRetry { Copy-Item $Src $Dest -Recurse -Force }
    }
}

function Get-GaInlineCode
{
    <#
    .SYNOPSIS
        生成 Google Analytics 内联 <script> 代码
    .OUTPUTS
        [string] GA 内联代码块
    #>
    param(
        [string]$TrackingId
    )

    return @"
	<script async src="https://www.googletagmanager.com/gtag/js?id=$TrackingId"></script>
	<script>
		window.dataLayer = window.dataLayer || [];
		function gtag() { dataLayer.push(arguments); }
		gtag('js', new Date());
		gtag('config', '$TrackingId');
	</script>
"@
}

function Read-Utf8File
{
    <#
    .SYNOPSIS
        字节级读取文件，返回 UTF-8 字符串（避免 PowerShell 编码陷阱）
    .OUTPUTS
        [string] 文件内容
    #>
    param(
        [string]$Path
    )

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-Utf8File
{
    <#
    .SYNOPSIS
        字符串写入文件为 UTF-8 字节（无 BOM）
    #>
    param(
        [string]$Path,
        [string]$Content
    )

    $outBytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
    Invoke-WithFileRetry { [System.IO.File]::WriteAllBytes($Path, $outBytes) }
}
