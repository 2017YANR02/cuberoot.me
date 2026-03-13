<#
.SYNOPSIS
    同步脚本公共工具函数
.DESCRIPTION
    提供文件/目录同步、GA 代码生成、UTF-8 字节级读写等工具函数，
    供 sync_upstream.ps1 和 sync_alg_trainers.ps1 共用。
#>

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
            Copy-Item $Src $Dest -Force
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
        if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
        Copy-Item $Src $Dest -Recurse -Force
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
    [System.IO.File]::WriteAllBytes($Path, $outBytes)
}
