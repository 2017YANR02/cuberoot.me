[CmdletBinding()]
param(
    [ValidateRange(1, 14)]
    [int]$Threads = 14,

    [ValidateRange(1, 64)]
    [int]$CheckpointEvery = 1,

    [string]$CheckpointDir = (Join-Path $PSScriptRoot 'checkpoints/first-layer-god'),

    [switch]$SkipBuild,

    [switch]$DryRunOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw '请使用 PowerShell 7（pwsh）运行此脚本。'
}

$solverRoot = $PSScriptRoot
$checkpointFull = [IO.Path]::GetFullPath($CheckpointDir)
$exe = Join-Path $solverRoot 'target/release/first_layer_gods_number.exe'
$plannedCheckpointBytes = [int64]12933051392
$minimumFreeMemoryBytes = 8GB
$diskSafetyBytes = 2GB

Push-Location $solverRoot
try {
    if (-not $SkipBuild) {
        Write-Host '[1/4] Building optimized proof binary...'
        & cargo build --release --bin first_layer_gods_number -j 8
        if ($LASTEXITCODE -ne 0) {
            throw "cargo build failed with exit code $LASTEXITCODE"
        }
    } elseif (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
        throw "Binary not found: $exe"
    }

    Write-Host '[2/4] Verifying the 25 GB memory plan...'
    & $exe --dry-run --threads $Threads --checkpoint-dir $checkpointFull `
        --checkpoint-every $CheckpointEvery
    if ($LASTEXITCODE -ne 0) {
        throw "dry-run failed with exit code $LASTEXITCODE"
    }
    New-Item -ItemType Directory -Path $checkpointFull -Force | Out-Null
    $os = Get-CimInstance Win32_OperatingSystem
    $freeMemoryBytes = [int64]$os.FreePhysicalMemory * 1KB
    if ($freeMemoryBytes -lt $minimumFreeMemoryBytes) {
        throw ('可用内存只有 {0:N2} GiB；至少释放到 8 GiB 后再运行。' -f ($freeMemoryBytes / 1GB))
    }

    $existingCheckpointBytes = 0L
    foreach ($name in @('checkpoint-a.bin', 'checkpoint-b.bin')) {
        $slot = Join-Path $checkpointFull $name
        if (Test-Path -LiteralPath $slot -PathType Leaf) {
            $existingCheckpointBytes += (Get-Item -LiteralPath $slot).Length
        }
    }
    $driveRoot = [IO.Path]::GetPathRoot($checkpointFull)
    $drive = [IO.DriveInfo]::new($driveRoot)
    $additionalCheckpointBytes = [Math]::Max(
        $diskSafetyBytes,
        $plannedCheckpointBytes - $existingCheckpointBytes + $diskSafetyBytes
    )
    if ($drive.AvailableFreeSpace -lt $additionalCheckpointBytes) {
        throw ('检查点磁盘空间不足：可用 {0:N2} GiB，当前至少还需 {1:N2} GiB。' -f `
            ($drive.AvailableFreeSpace / 1GB), ($additionalCheckpointBytes / 1GB))
    }

    Write-Host ('[3/4] RAM available: {0:N2} GiB; disk available: {1:N2} GiB' -f `
        ($freeMemoryBytes / 1GB), ($drive.AvailableFreeSpace / 1GB))
    Write-Host "Checkpoint directory: $checkpointFull"
    if ($DryRunOnly) {
        Write-Host 'All resource gates passed; the full BFS was not started.'
        return
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $log = Join-Path $checkpointFull "first-layer-god-$stamp.log"
    Write-Host "Live log: $log"
    Write-Host 'Existing valid checkpoint will be selected automatically.'
    Write-Host '[4/4] Running. Re-run this same script after interruption to resume.'

    $oldAllowHuge = [Environment]::GetEnvironmentVariable('CUBE_ALLOW_HUGE_TABLES', 'Process')
    $oldRayonThreads = [Environment]::GetEnvironmentVariable('RAYON_NUM_THREADS', 'Process')
    $currentProcess = [Diagnostics.Process]::GetCurrentProcess()
    $oldPriority = $currentProcess.PriorityClass
    try {
        $env:CUBE_ALLOW_HUGE_TABLES = '1'
        $env:RAYON_NUM_THREADS = [string]$Threads
        $currentProcess.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal
        & $exe --threads $Threads --checkpoint-dir $checkpointFull `
            --checkpoint-every $CheckpointEvery 2>&1 |
            Tee-Object -FilePath $log
        $proofExitCode = $LASTEXITCODE
    } finally {
        $currentProcess.PriorityClass = $oldPriority
        [Environment]::SetEnvironmentVariable(
            'CUBE_ALLOW_HUGE_TABLES', $oldAllowHuge, 'Process'
        )
        [Environment]::SetEnvironmentVariable(
            'RAYON_NUM_THREADS', $oldRayonThreads, 'Process'
        )
    }

    if ($proofExitCode -ne 0) {
        throw "proof process failed with exit code $proofExitCode; inspect $log"
    }
    Write-Host "Completed successfully. Final proof is in $log"
} finally {
    Pop-Location
}
