param(
    [ValidateSet('all', 'original', 'variants', 'city')][string]$Mode = 'all',
    [string]$Asset,
    [string]$PreviewCamera,
    [string]$Blender = 'E:/Apps/Blender/blender.exe'
)
$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path "$PSScriptRoot/../../..").Path
$styles = 'modern','minimal','cyberpunk','vintage','italian','penthouse','japanese','company'
$allKeys = @('shanghai') + @(foreach ($style in $styles) { "$style-original"; "$style-island"; "$style-shanghai" })
if ($PreviewCamera -and !$Asset) { throw 'PreviewCamera requires a single -Asset' }
$keys = if ($Asset) {
    if ($Asset -cnotin $allKeys) { throw "Unknown Space asset: $Asset" }
    @($Asset)
} elseif ($Mode -eq 'original') { $allKeys | Where-Object { $_ -like '*-original' } }
elseif ($Mode -eq 'variants') { $allKeys | Where-Object { $_ -like '*-island' -or $_ -like '*-shanghai' } }
elseif ($Mode -eq 'city') { @('shanghai') } else { $allKeys }
$logs = "$repository/.tmp/png/space-blender"
New-Item -ItemType Directory -Path $logs -Force | Out-Null
foreach ($key in $keys) {
    $blendPath = "$repository/design/space/scenes/$key.blend"
    if (!(Test-Path -LiteralPath $blendPath)) { throw "Missing authored source: $blendPath. Restore its asset backup; batch export never regenerates authored models." }
    $script = if ($PreviewCamera) { 'preview_scene.py' } else { 'export_scene.py' }
    $arguments = @('--background', ('"{0}"' -f $blendPath), '--threads', '14', '--python-exit-code', '1', '--python', ('"{0}/{1}"' -f $PSScriptRoot, $script))
    if ($PreviewCamera) {
        if ($PreviewCamera -notmatch '^[A-Za-z ]+$') { throw 'PreviewCamera must be a camera name, for example Overview or Living room' }
        $arguments += @('--', '--camera', ('"{0}"' -f $PreviewCamera))
    }
    $logKey = if ($PreviewCamera) { "$key-preview" } else { $key }
    Write-Output "START $key"
    $process = Start-Process -FilePath $Blender -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput "$logs/$logKey-process.log" -RedirectStandardError "$logs/$logKey-error.log"
    if (!$process.HasExited) { $process.PriorityClass = 'BelowNormal' }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Blender failed for $key; inspect $logs/$logKey-process.log and $logs/$logKey-error.log" }
    Write-Output "DONE $key"
}
