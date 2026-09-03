#requires -Version 7.0

<#
.SYNOPSIS
Validates and publishes the prepared music library to the static origin.

.DESCRIPTION
The default mode is local validation only. Pass -Publish to run the remote
capacity check, upload missing content-addressed assets through non-public
staging, atomically switch manifest.v1.json, and verify the HTTP contract.

The publisher never removes old assets. A failed post-publish HTTP check
restores the previous manifest (or moves a first-release manifest back into
non-public staging).
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [string] $LibraryRoot = 'Z:\cuberoot-music-staging\library',
    [string] $RemoteHost = 'root@cuberoot',
    [string] $RemoteDocumentRoot = '/www/wwwroot/toolkit',
    [string] $RemoteStagingRoot = '/www/wwwroot/.cuberoot-music-staging',
    [uri] $PublicBaseUri = 'https://static.cuberoot.me/music/library/',
    [ValidateRange(1, 1024)]
    [int] $ReserveGiB = 10,
    [ValidateRange(5, 300)]
    [int] $ConnectTimeoutSeconds = 15,
    [switch] $Publish
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$PublicPrefix = '/music/library/'
$AllowedExtensions = @{
    tracks = @('.mp3', '.m4a', '.flac', '.wav')
    covers = @('.jpg', '.jpeg', '.png', '.webp')
    lyrics = @('.lrc')
}

function Get-PropertyValue($Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-FileSha256([string] $Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()
    } finally {
        $stream.Dispose()
    }
}

function Assert-SafeRemotePath([string] $Path, [string] $Label) {
    if ($Path -notmatch '^/[A-Za-z0-9._/-]+$' -or $Path.Contains('//')) {
        throw "$Label must be an absolute remote path containing only safe ASCII path characters."
    }
    $segments = @($Path.Split('/', [StringSplitOptions]::RemoveEmptyEntries))
    if ($segments -contains '.' -or $segments -contains '..') {
        throw "$Label must not contain dot segments."
    }
}

function Join-RemotePath([string] $Base, [string] $Child) {
    return "$($Base.TrimEnd('/'))/$($Child.TrimStart('/'))"
}

function Get-ResponseHeader([Net.Http.HttpResponseMessage] $Response, [string] $Name) {
    $values = $null
    if ($Response.Headers.TryGetValues($Name, [ref] $values) -or
        $Response.Content.Headers.TryGetValues($Name, [ref] $values)) {
        return @($values) -join ', '
    }
    return ''
}

function Invoke-Ssh([string] $Command) {
    $output = @(& $script:SshPath @script:SshOptions $RemoteHost $Command 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        $detail = ($output | Select-Object -Last 12) -join "`n"
        throw "Remote command failed with exit code $exitCode.`n$detail"
    }
    return @($output | ForEach-Object { "$_" })
}

function Invoke-Scp([string] $LocalPath, [string] $RemotePath) {
    & $script:ScpPath @script:ScpOptions $LocalPath "${RemoteHost}:$RemotePath"
    if ($LASTEXITCODE -ne 0) {
        throw "Asset transfer failed for $([IO.Path]::GetFileName($LocalPath))."
    }
}

function Convert-ToAssetRecord(
    [string] $PublicPath,
    [string] $Kind,
    [string] $ResolvedLibraryRoot
) {
    $expectedPrefix = "$PublicPrefix$Kind/"
    if (-not $PublicPath.StartsWith($expectedPrefix, [StringComparison]::Ordinal)) {
        throw "$Kind reference must start with $expectedPrefix"
    }

    $fileName = $PublicPath.Substring($expectedPrefix.Length)
    if ($fileName.Length -eq 0 -or $fileName.Contains('/') -or $fileName.Contains('\') -or
        $fileName.Contains('?') -or $fileName.Contains('#')) {
        throw "Invalid $Kind asset reference: $PublicPath"
    }
    $extension = [IO.Path]::GetExtension($fileName).ToLowerInvariant()
    $sha256 = [IO.Path]::GetFileNameWithoutExtension($fileName).ToLowerInvariant()
    if ($sha256 -notmatch '^[0-9a-f]{64}$' -or $extension -notin $AllowedExtensions[$Kind]) {
        throw "$Kind asset must use a SHA-256 filename and a supported extension: $PublicPath"
    }

    $relativePath = "$Kind/$fileName"
    $fullPath = [IO.Path]::GetFullPath((Join-Path $ResolvedLibraryRoot ($relativePath.Replace('/', [IO.Path]::DirectorySeparatorChar))))
    $rootPrefix = "$ResolvedLibraryRoot$([IO.Path]::DirectorySeparatorChar)"
    if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Asset escapes LibraryRoot: $PublicPath"
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Manifest references a missing local asset: $PublicPath"
    }

    $file = Get-Item -LiteralPath $fullPath
    if ($file.Length -le 0) { throw "Manifest references an empty asset: $PublicPath" }
    $actualSha256 = Get-FileSha256 $fullPath
    if ($actualSha256 -ne $sha256) {
        throw "Local asset SHA-256 does not match its filename: $PublicPath"
    }

    return [pscustomobject]@{
        Kind = $Kind
        PublicPath = $PublicPath
        RelativePath = $relativePath
        FullPath = $fullPath
        Sha256 = $sha256
        Bytes = [long] $file.Length
    }
}

function Read-ValidatedLibrary([string] $Root) {
    $resolvedRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Root).Path).TrimEnd('\', '/')
    $manifestPath = Join-Path $resolvedRoot 'manifest.v1.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Missing manifest: $manifestPath"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        throw "manifest.v1.json is not valid JSON: $($_.Exception.Message)"
    }
    if ((Get-PropertyValue $manifest 'version') -ne 1) {
        throw 'manifest.v1.json must have version 1.'
    }
    $tracks = @(Get-PropertyValue $manifest 'tracks')
    if ($tracks.Count -eq 0 -or ($tracks.Count -eq 1 -and $null -eq $tracks[0])) {
        throw 'manifest.v1.json must contain at least one track.'
    }

    $trackIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $assetsByPath = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    foreach ($track in $tracks) {
        $id = "$(Get-PropertyValue $track 'id')".Trim()
        $title = "$(Get-PropertyValue $track 'title')".Trim()
        $src = "$(Get-PropertyValue $track 'src')".Trim()
        $duration = Get-PropertyValue $track 'duration'
        if ($id -notmatch '^[0-9a-f]{64}$') { throw 'Every track id must be a lowercase SHA-256 value.' }
        if (-not $trackIds.Add($id)) { throw "Duplicate track id: $id" }
        if ($title.Length -eq 0) { throw "Track $id has no title." }
        if ($null -eq $duration -or $duration -isnot [ValueType] -or
            [double]::IsNaN([double] $duration) -or [double]::IsInfinity([double] $duration) -or
            [double] $duration -le 0) {
            throw "Track $id has an invalid duration."
        }

        $references = @(
            [pscustomobject]@{ Kind = 'tracks'; Path = $src; Required = $true },
            [pscustomobject]@{ Kind = 'covers'; Path = "$(Get-PropertyValue $track 'cover')".Trim(); Required = $false },
            [pscustomobject]@{ Kind = 'lyrics'; Path = "$(Get-PropertyValue $track 'lyrics')".Trim(); Required = $false }
        )
        foreach ($reference in $references) {
            if ($reference.Path.Length -eq 0) {
                if ($reference.Required) { throw "Track $id has no audio source." }
                continue
            }
            if (-not $assetsByPath.ContainsKey($reference.Path)) {
                $asset = Convert-ToAssetRecord $reference.Path $reference.Kind $resolvedRoot
                $assetsByPath.Add($reference.Path, $asset)
            } elseif ($assetsByPath[$reference.Path].Kind -ne $reference.Kind) {
                throw "Asset is referenced with conflicting kinds: $($reference.Path)"
            }
        }
    }

    $manifestFile = Get-Item -LiteralPath $manifestPath
    return [pscustomobject]@{
        Root = $resolvedRoot
        ManifestPath = $manifestPath
        ManifestBytes = [long] $manifestFile.Length
        ManifestSha256 = Get-FileSha256 $manifestPath
        Manifest = $manifest
        Tracks = $tracks
        Assets = @($assetsByPath.Values | Sort-Object RelativePath)
    }
}

function Invoke-RemoteAudit([object[]] $Assets, [string] $StageRoot) {
    $inventory = ($Assets | ForEach-Object {
        "$($_.Sha256)`t$($_.Bytes)`t$($_.RelativePath)"
    }) -join "`n"
    $inventory += "`n"
    $remoteInventory = Join-RemotePath $StageRoot 'inventory.v1.tsv'

    $writeCommand = "umask 022; mkdir -p '$StageRoot'; tr -d '\r' > '$remoteInventory'"
    $writeOutput = @($inventory | & $script:SshPath @script:SshOptions $RemoteHost $writeCommand 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not stage the remote inventory.`n$(($writeOutput | Select-Object -Last 12) -join "`n")"
    }

    $auditTemplate = @'
set -eu
live='__LIVE__'
stage='__STAGE__'
inventory="$stage/inventory.v1.tsv"
missing="$stage/missing.v1.tsv"
mkdir -p "$live/tracks" "$live/covers" "$live/lyrics" "$stage/files/tracks" "$stage/files/covers" "$stage/files/lyrics"
live_device="$(stat -c '%d' "$live")"
stage_device="$(stat -c '%d' "$stage")"
if [ "$live_device" != "$stage_device" ]; then
    echo 'staging and live library are on different filesystems' >&2
    exit 31
fi
: > "$missing"
needed=0
while IFS="$(printf '\t')" read -r expected_hash expected_bytes relative_path; do
    [ -n "$expected_hash" ] || continue
    case "$relative_path" in
        tracks/*|covers/*|lyrics/*) ;;
        *) echo 'unsafe inventory path' >&2; exit 32 ;;
    esac
    case "$relative_path" in *'..'*|*//*|*\\*) echo 'unsafe inventory path' >&2; exit 32 ;; esac
    target="$live/$relative_path"
    if [ -e "$target" ]; then
        [ -f "$target" ] || { echo 'asset target is not a regular file' >&2; exit 33; }
        actual_bytes="$(stat -c '%s' "$target")"
        [ "$actual_bytes" = "$expected_bytes" ] || { echo 'existing asset size conflict' >&2; exit 34; }
        actual_hash="$(sha256sum "$target" | awk '{print $1}')"
        [ "$actual_hash" = "$expected_hash" ] || { echo 'existing asset hash conflict' >&2; exit 35; }
    else
        printf 'MISSING\t%s\t%s\t%s\n' "$expected_hash" "$expected_bytes" "$relative_path"
        printf '%s\t%s\t%s\n' "$expected_hash" "$expected_bytes" "$relative_path" >> "$missing"
        needed=$((needed + expected_bytes))
    fi
done < "$inventory"
available="$(df -B1 --output=avail "$live" | tail -n 1 | tr -d ' ')"
current_manifest_bytes=0
if [ -e "$live/manifest.v1.json" ]; then
    [ -f "$live/manifest.v1.json" ] || { echo 'live manifest is not a regular file' >&2; exit 36; }
    current_manifest_bytes="$(stat -c '%s' "$live/manifest.v1.json")"
fi
printf 'SUMMARY\t%s\t%s\t%s\t%s\n' "$needed" "$available" "$live_device" "$current_manifest_bytes"
'@
    $auditCommand = $auditTemplate.Replace('__LIVE__', $script:RemoteLibraryRoot).Replace('__STAGE__', $StageRoot)
    $lines = Invoke-Ssh $auditCommand
    $missing = [Collections.Generic.List[object]]::new()
    $summary = $null
    foreach ($line in $lines) {
        $columns = "$line" -split "`t"
        if ($columns[0] -eq 'MISSING' -and $columns.Count -eq 4) {
            $missing.Add([pscustomobject]@{
                Sha256 = $columns[1]
                Bytes = [long] $columns[2]
                RelativePath = $columns[3]
            })
        } elseif ($columns[0] -eq 'SUMMARY' -and $columns.Count -eq 5) {
            $summary = [pscustomobject]@{
                NeededBytes = [long] $columns[1]
                AvailableBytes = [long] $columns[2]
                Device = $columns[3]
                CurrentManifestBytes = [long] $columns[4]
            }
        }
    }
    if ($null -eq $summary) { throw 'Remote audit returned no capacity summary.' }
    return [pscustomobject]@{ Missing = @($missing); Summary = $summary }
}

function Publish-Asset($Asset, [string] $StageRoot) {
    $remotePart = Join-RemotePath $StageRoot "files/$($Asset.RelativePath).part"
    $remoteFinal = Join-RemotePath $script:RemoteLibraryRoot $Asset.RelativePath
    Write-Host "Uploading $($Asset.RelativePath) ($([Math]::Round($Asset.Bytes / 1MB, 1)) MiB)..."
    Invoke-Scp $Asset.FullPath $remotePart

    $promoteTemplate = @'
set -eu
part='__PART__'
final='__FINAL__'
expected_hash='__HASH__'
expected_bytes='__BYTES__'
[ -f "$part" ] || { echo 'staged asset is missing' >&2; exit 41; }
[ "$(stat -c '%s' "$part")" = "$expected_bytes" ] || { echo 'staged asset size mismatch' >&2; exit 42; }
[ "$(sha256sum "$part" | awk '{print $1}')" = "$expected_hash" ] || { echo 'staged asset hash mismatch' >&2; exit 43; }
chmod 0644 "$part"
if [ -e "$final" ]; then
    [ -f "$final" ] || { echo 'asset target is not a regular file' >&2; exit 44; }
    [ "$(stat -c '%s' "$final")" = "$expected_bytes" ] || { echo 'concurrent asset size conflict' >&2; exit 45; }
    [ "$(sha256sum "$final" | awk '{print $1}')" = "$expected_hash" ] || { echo 'concurrent asset hash conflict' >&2; exit 46; }
else
    mv "$part" "$final"
fi
'@
    $command = $promoteTemplate.Replace('__PART__', $remotePart).
        Replace('__FINAL__', $remoteFinal).
        Replace('__HASH__', $Asset.Sha256).
        Replace('__BYTES__', "$($Asset.Bytes)")
    $null = Invoke-Ssh $command
}

function Publish-Manifest($Library, [string] $StageRoot) {
    $candidate = Join-RemotePath $StageRoot 'manifest.v1.json.part'
    Invoke-Scp $Library.ManifestPath $candidate
    $publishTemplate = @'
set -eu
live='__LIVE__'
stage='__STAGE__'
candidate="$stage/manifest.v1.json.part"
current="$live/manifest.v1.json"
previous="$stage/manifest.v1.previous.json"
previous_part="$stage/manifest.v1.previous.json.part"
[ -f "$candidate" ] || { echo 'manifest candidate is missing' >&2; exit 51; }
[ "$(stat -c '%s' "$candidate")" = '__BYTES__' ] || { echo 'manifest candidate size mismatch' >&2; exit 52; }
[ "$(sha256sum "$candidate" | awk '{print $1}')" = '__HASH__' ] || { echo 'manifest candidate hash mismatch' >&2; exit 53; }
chmod 0644 "$candidate"
if [ -f "$current" ]; then
    cp -p "$current" "$previous_part"
    chmod 0644 "$previous_part"
    mv -f "$previous_part" "$previous"
fi
mv -f "$candidate" "$current"
'@
    $command = $publishTemplate.Replace('__LIVE__', $script:RemoteLibraryRoot).
        Replace('__STAGE__', $StageRoot).
        Replace('__BYTES__', "$($Library.ManifestBytes)").
        Replace('__HASH__', $Library.ManifestSha256)
    $null = Invoke-Ssh $command
}

function Restore-PreviousManifest([string] $StageRoot) {
    $rollbackTemplate = @'
set -eu
live='__LIVE__'
stage='__STAGE__'
current="$live/manifest.v1.json"
previous="$stage/manifest.v1.previous.json"
failed="$stage/manifest.v1.failed.json"
rollback="$stage/manifest.v1.rollback.json.part"
if [ -f "$current" ]; then cp -p "$current" "$failed"; fi
if [ -f "$previous" ]; then
    cp -p "$previous" "$rollback"
    chmod 0644 "$rollback"
    mv -f "$rollback" "$current"
elif [ -f "$current" ]; then
    mv "$current" "$stage/manifest.v1.first-release-failed.json"
fi
'@
    $command = $rollbackTemplate.Replace('__LIVE__', $script:RemoteLibraryRoot).Replace('__STAGE__', $StageRoot)
    $null = Invoke-Ssh $command
}

function Test-PublicContract($Library) {
    $origin = [uri]::new($PublicBaseUri.GetLeftPart([UriPartial]::Authority))
    $manifestUri = [uri]::new($origin, "${PublicPrefix}manifest.v1.json")
    $handler = [Net.Http.HttpClientHandler]::new()
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    try {
        $manifestRequest = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $manifestUri)
        $manifestRequest.Headers.TryAddWithoutValidation('Origin', 'https://cuberoot.me') | Out-Null
        $manifestResponse = $client.Send($manifestRequest)
        try {
            if ([int] $manifestResponse.StatusCode -ne 200) {
                throw "Manifest HTTP status was $([int] $manifestResponse.StatusCode), expected 200."
            }
            $manifestBytes = $manifestResponse.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
            $publicHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($manifestBytes)).ToLowerInvariant()
            if ($publicHash -ne $Library.ManifestSha256) { throw 'Public manifest bytes do not match the release candidate.' }
            if ((Get-ResponseHeader $manifestResponse 'Access-Control-Allow-Origin') -ne '*') {
                throw 'Manifest CORS header is missing or incorrect.'
            }
            if ((Get-ResponseHeader $manifestResponse 'Cache-Control') -notmatch '(^|,\s*)no-cache(,|$)') {
                throw 'Manifest must be served with Cache-Control: no-cache.'
            }
        } finally {
            $manifestResponse.Dispose()
            $manifestRequest.Dispose()
        }

        $firstAudio = @($Library.Assets | Where-Object Kind -eq 'tracks' | Select-Object -First 1)[0]
        $audioUri = [uri]::new($origin, $firstAudio.PublicPath)
        $rangeRequest = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $audioUri)
        $rangeRequest.Headers.TryAddWithoutValidation('Origin', 'https://cuberoot.me') | Out-Null
        $rangeRequest.Headers.Range = [Net.Http.Headers.RangeHeaderValue]::new(0, 1)
        $rangeResponse = $client.Send($rangeRequest)
        try {
            if ([int] $rangeResponse.StatusCode -ne 206) {
                throw "Range HTTP status was $([int] $rangeResponse.StatusCode), expected 206."
            }
            $rangeBytes = $rangeResponse.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
            if ($rangeBytes.Length -ne 2) { throw 'Range response did not contain exactly two bytes.' }
            if ((Get-ResponseHeader $rangeResponse 'Content-Range') -notmatch '^bytes 0-1/\d+$') {
                throw 'Range response has an invalid Content-Range header.'
            }
            if ((Get-ResponseHeader $rangeResponse 'Accept-Ranges') -notmatch '(^|,\s*)bytes(,|$)') {
                throw 'Range response does not advertise byte ranges.'
            }
            if ((Get-ResponseHeader $rangeResponse 'Access-Control-Allow-Origin') -ne '*') {
                throw 'Asset CORS header is missing or incorrect.'
            }
            $cacheControl = Get-ResponseHeader $rangeResponse 'Cache-Control'
            if ($cacheControl -notmatch 'max-age=31536000' -or $cacheControl -notmatch 'immutable') {
                throw 'Content-addressed assets must be served with immutable one-year caching.'
            }
            $exposed = Get-ResponseHeader $rangeResponse 'Access-Control-Expose-Headers'
            foreach ($requiredHeader in @('Accept-Ranges', 'Content-Range', 'ETag', 'Last-Modified')) {
                if ($exposed -notmatch "(?i)(^|,\s*)$([regex]::Escape($requiredHeader))(,|$)") {
                    throw "CORS does not expose $requiredHeader."
                }
            }
        } finally {
            $rangeResponse.Dispose()
            $rangeRequest.Dispose()
        }
    } finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

if ($RemoteHost -notmatch '^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9._-]+$') {
    throw 'RemoteHost must be an SSH host alias, optionally prefixed by a user.'
}
Assert-SafeRemotePath $RemoteDocumentRoot 'RemoteDocumentRoot'
Assert-SafeRemotePath $RemoteStagingRoot 'RemoteStagingRoot'
$script:RemoteLibraryRoot = Join-RemotePath $RemoteDocumentRoot 'music/library'
$documentPrefix = "$($RemoteDocumentRoot.TrimEnd('/'))/"
if ($RemoteStagingRoot -eq $RemoteDocumentRoot -or $RemoteStagingRoot.StartsWith($documentPrefix, [StringComparison]::Ordinal)) {
    throw 'RemoteStagingRoot must be outside the public document root.'
}
if (-not $PublicBaseUri.IsAbsoluteUri -or $PublicBaseUri.Scheme -ne 'https') {
    throw 'PublicBaseUri must be an absolute HTTPS URI.'
}

$library = Read-ValidatedLibrary $LibraryRoot
$assetBytes = [long] 0
foreach ($asset in $library.Assets) { $assetBytes += $asset.Bytes }
Write-Host ("Validated {0} tracks and {1} unique assets ({2:N2} GiB); manifest SHA-256 {3}." -f
    $library.Tracks.Count, $library.Assets.Count, ($assetBytes / 1GB), $library.ManifestSha256)

if (-not $Publish) {
    Write-Host 'Validation-only mode: no remote connection or upload was attempted. Pass -Publish for release.'
    return
}
if (-not $PSCmdlet.ShouldProcess($RemoteHost, "publish music manifest $($library.ManifestSha256)")) { return }

$script:SshPath = (Get-Command ssh -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$script:ScpPath = (Get-Command scp -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$script:SshOptions = @(
    '-o', 'BatchMode=yes',
    '-o', "ConnectTimeout=$ConnectTimeoutSeconds",
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4'
)
$script:ScpOptions = @($script:SshOptions)

$releaseId = $library.ManifestSha256
$stageRoot = Join-RemotePath $RemoteStagingRoot "releases/$releaseId"
$assetsByRelativePath = @{}
foreach ($asset in $library.Assets) { $assetsByRelativePath[$asset.RelativePath] = $asset }

Write-Host 'Auditing existing remote content and available capacity...'
$audit = Invoke-RemoteAudit $library.Assets $stageRoot
$missingBytes = [long] $audit.Summary.NeededBytes
$reserveBytes = [long] $ReserveGiB * 1GB
$manifestCutoverBytes = $library.ManifestBytes + $audit.Summary.CurrentManifestBytes
$requiredBytes = $missingBytes + $manifestCutoverBytes + $reserveBytes
if ($audit.Summary.AvailableBytes -lt $requiredBytes) {
    throw ("Insufficient remote space: missing assets need {0:N2} GiB and {1} GiB must remain; available {2:N2} GiB." -f
        ($missingBytes / 1GB), $ReserveGiB, ($audit.Summary.AvailableBytes / 1GB))
}

foreach ($missing in $audit.Missing) {
    if (-not $assetsByRelativePath.ContainsKey($missing.RelativePath)) {
        throw "Remote audit returned an unknown asset: $($missing.RelativePath)"
    }
    $asset = $assetsByRelativePath[$missing.RelativePath]
    if ($asset.Sha256 -ne $missing.Sha256 -or $asset.Bytes -ne $missing.Bytes) {
        throw "Remote audit returned inconsistent metadata for $($missing.RelativePath)"
    }
    Publish-Asset $asset $stageRoot
}

Write-Host 'Revalidating every remote asset before manifest cutover...'
$finalAudit = Invoke-RemoteAudit $library.Assets $stageRoot
if ($finalAudit.Missing.Count -ne 0 -or $finalAudit.Summary.NeededBytes -ne 0) {
    throw 'Remote library is still incomplete; manifest was not changed.'
}
if ($finalAudit.Summary.AvailableBytes -lt ($reserveBytes + $library.ManifestBytes + $finalAudit.Summary.CurrentManifestBytes)) {
    throw 'Remote free-space reserve was consumed during upload; manifest was not changed.'
}

Write-Host 'All assets verified. Atomically switching the manifest...'
Publish-Manifest $library $stageRoot
try {
    Test-PublicContract $library
} catch {
    $verificationError = $_
    Write-Warning 'HTTP verification failed; restoring the previous manifest.'
    try { Restore-PreviousManifest $stageRoot } catch {
        throw "HTTP verification failed and automatic manifest rollback also failed. Verification: $verificationError Rollback: $_"
    }
    throw $verificationError
}

Write-Host ("Published {0} tracks; uploaded {1} new assets; previous manifest retained." -f
    $library.Tracks.Count, $audit.Missing.Count)
