#requires -Version 7.0

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [string] $SourceRoot = 'E:\Music',
    [string] $OutputRoot = 'Z:\cuberoot-music-staging\library',
    [string] $InventoryPath = 'Z:\cuberoot-music-staging\inventory\source-manifest.jsonl',
    [ValidateRange(1MB, 1GB)]
    [long] $BatchBytes = 1GB,
    [ValidateRange(1, 4)]
    [int] $Concurrency = 4,
    [switch] $Pilot,
    [switch] $RefreshInventory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$MediaExtensions = @('.mp3', '.m4a', '.flac', '.wav', '.ape', '.wma', '.mp4', '.mov', '.mkv')
$CoverExtensions = @('.jpg', '.jpeg', '.png', '.webp')
$LyricsExtensions = @('.lrc')
$PilotExtensions = @('.mp3', '.m4a', '.flac', '.wav', '.ape', '.wma', '.mp4', '.mov', '.mkv')
$Utf8NoBom = [Text.UTF8Encoding]::new($false)

function Get-FullPath([string] $Path) {
    return [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Assert-OutsideSource([string] $Source, [string] $Target, [string] $Label) {
    $sourcePath = Get-FullPath $Source
    $targetPath = Get-FullPath $Target
    if ($targetPath.Equals($sourcePath, [StringComparison]::OrdinalIgnoreCase) -or
        $targetPath.StartsWith("$sourcePath\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must not be inside the read-only source tree."
    }
}

function Get-PropertyValue($Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-NonEmptyString($Object, [string] $Name) {
    $value = Get-PropertyValue $Object $Name
    if ($null -eq $value) { return $null }
    $text = "$value".Trim()
    if ($text.Length -eq 0) { return $null }
    return $text
}

function Convert-ToDouble($Value) {
    if ($null -eq $Value) { return 0.0 }
    $parsed = 0.0
    if ([double]::TryParse("$Value", [Globalization.NumberStyles]::Float,
            [Globalization.CultureInfo]::InvariantCulture, [ref] $parsed)) {
        return $parsed
    }
    return 0.0
}

function Get-StableId([string] $RelativePath) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($RelativePath.Replace('\', '/').ToLowerInvariant())
    $hash = [Security.Cryptography.SHA256]::HashData($bytes)
    return [Convert]::ToHexString($hash).ToLowerInvariant().Substring(0, 24)
}

function Invoke-Probe([string] $Path) {
    $probeOutput = & $script:FfprobePath @(
        '-v', 'error',
        '-show_format',
        '-show_streams',
        '-of', 'json',
        $Path
    ) 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "ffprobe failed with exit code $LASTEXITCODE."
    }
    try {
        return ($probeOutput -join "`n") | ConvertFrom-Json
    } catch {
        throw 'ffprobe returned invalid JSON.'
    }
}

function Get-MediaAction([string] $Extension, [string] $Codec) {
    if ($Extension -in @('.mp3', '.m4a', '.flac', '.wav')) { return 'copy' }
    if ($Extension -in @('.ape', '.wma')) { return 'transcode-aac' }
    if ($Extension -in @('.mp4', '.mov')) {
        if ($Codec -eq 'aac') { return 'remux-audio' }
        return 'transcode-aac'
    }
    if ($Extension -eq '.mkv') {
        if ($Codec -eq 'aac') { return 'remux-audio' }
        return 'transcode-aac'
    }
    throw "Unsupported media extension: $Extension"
}

function Get-OutputExtension([string] $Extension, [string] $Action) {
    if ($Action -eq 'copy') { return $Extension }
    return '.m4a'
}

function Get-EstimatedOutputBytes([long] $SourceBytes, [double] $Duration,
    [double] $AudioBitRate, [string] $Action) {
    if ($Action -eq 'copy') { return $SourceBytes }
    $bitRate = if ($Action -eq 'transcode-aac') { 192000.0 }
        elseif ($AudioBitRate -gt 0) { $AudioBitRate }
        else { 256000.0 }
    return [long] [Math]::Ceiling(($Duration * $bitRate / 8.0) * 1.05 + 1MB)
}

function New-SourceInventory([string] $Root) {
    $rootPrefix = "$Root\"
    $records = [Collections.Generic.List[object]]::new()
    $files = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Sort-Object FullName)

    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($rootPrefix.Length)
        $extension = $file.Extension.ToLowerInvariant()
        $base = [ordered]@{
            schemaVersion = 1
            relativePath = $relativePath
            extension = $extension
            bytes = [long] $file.Length
            lastWriteTimeUtc = $file.LastWriteTimeUtc.ToString('O')
        }

        if ($extension -notin $MediaExtensions) {
            $base.kind = if ($extension -in $CoverExtensions) { 'cover' }
                elseif ($extension -in $LyricsExtensions) { 'lyrics' }
                else { 'other' }
            $records.Add([pscustomobject] $base)
            continue
        }

        $probe = Invoke-Probe $file.FullName
        $streams = @(Get-PropertyValue $probe 'streams')
        $audioStreams = @($streams | Where-Object { (Get-PropertyValue $_ 'codec_type') -eq 'audio' })
        if ($audioStreams.Count -ne 1) {
            throw "Inventory requires exactly one audio stream; failed source id $(Get-StableId $relativePath)."
        }

        $audio = $audioStreams[0]
        $format = Get-PropertyValue $probe 'format'
        $tags = Get-PropertyValue $format 'tags'
        $duration = Convert-ToDouble (Get-PropertyValue $format 'duration')
        if ($duration -le 0) {
            $duration = Convert-ToDouble (Get-PropertyValue $audio 'duration')
        }
        if ($duration -le 0) {
            throw "Inventory could not determine duration for source id $(Get-StableId $relativePath)."
        }

        $codec = ("$(Get-PropertyValue $audio 'codec_name')").ToLowerInvariant()
        $audioBitRate = Convert-ToDouble (Get-PropertyValue $audio 'bit_rate')
        $action = Get-MediaAction $extension $codec
        $attachedCover = @($streams | Where-Object {
            if ((Get-PropertyValue $_ 'codec_type') -ne 'video') { return $false }
            $disposition = Get-PropertyValue $_ 'disposition'
            return (Convert-ToDouble (Get-PropertyValue $disposition 'attached_pic')) -eq 1
        } | Select-Object -First 1)

        $base.kind = 'media'
        $base.id = Get-StableId $relativePath
        $base.duration = [Math]::Round($duration, 3)
        $base.audioCodec = $codec
        $base.audioBitRate = [long] $audioBitRate
        $base.action = $action
        $base.outputExtension = Get-OutputExtension $extension $action
        $base.estimatedOutputBytes = Get-EstimatedOutputBytes $file.Length $duration $audioBitRate $action
        $base.title = Get-NonEmptyString $tags 'title'
        $base.artist = Get-NonEmptyString $tags 'artist'
        $base.album = Get-NonEmptyString $tags 'album'
        $base.genre = Get-NonEmptyString $tags 'genre'
        if ($attachedCover.Count -eq 1) {
            $base.attachedCoverStreamIndex = [int] (Get-PropertyValue $attachedCover[0] 'index')
            $base.attachedCoverCodec = Get-NonEmptyString $attachedCover[0] 'codec_name'
        }
        $records.Add([pscustomobject] $base)
    }

    return $records.ToArray()
}

function Read-JsonLines([string] $Path) {
    $records = [Collections.Generic.List[object]]::new()
    foreach ($line in [IO.File]::ReadLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $records.Add(($line | ConvertFrom-Json))
    }
    return $records.ToArray()
}

function Write-JsonLinesAtomic([string] $Path, [object[]] $Records) {
    $directory = Split-Path -Parent $Path
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $part = Join-Path $directory ("source-manifest.part.$([guid]::NewGuid().ToString('N')).jsonl")
    $writer = [IO.StreamWriter]::new($part, $false, $Utf8NoBom)
    try {
        foreach ($record in $Records) {
            $writer.WriteLine(($record | ConvertTo-Json -Compress -Depth 8))
        }
        $writer.Flush()
        $writer.BaseStream.Flush($true)
    } finally {
        $writer.Dispose()
    }
    [IO.File]::Move($part, $Path, $true)
}

function Write-JsonAtomic([string] $Path, $Value) {
    $directory = Split-Path -Parent $Path
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $part = Join-Path $directory ("$([IO.Path]::GetFileNameWithoutExtension($Path)).part.$([guid]::NewGuid().ToString('N')).json")
    $json = $Value | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($part, "$json`n", $Utf8NoBom)
    [IO.File]::Move($part, $Path, $true)
}

function Get-SourcePath($Record) {
    $relative = "$(Get-PropertyValue $Record 'relativePath')"
    if ([IO.Path]::IsPathRooted($relative)) { throw 'Inventory contains an absolute relativePath.' }
    $path = Get-FullPath (Join-Path $script:ResolvedSourceRoot $relative)
    if (-not $path.StartsWith("$script:ResolvedSourceRoot\", [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Inventory path escapes the source root.'
    }
    return $path
}

function Get-TrackOutputPath($Record) {
    return Join-Path $script:TracksDirectory ("$(Get-PropertyValue $Record 'id')$(Get-PropertyValue $Record 'outputExtension')")
}

function Test-PreparedAudio([string] $Path, [double] $ExpectedDuration, [bool] $RequireAac) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Valid = $false; Reason = 'missing'; Duration = 0.0 }
    }
    try { $probe = Invoke-Probe $Path }
    catch { return [pscustomobject]@{ Valid = $false; Reason = 'ffprobe-failed'; Duration = 0.0 } }

    $streams = @(Get-PropertyValue $probe 'streams')
    $audioStreams = @($streams | Where-Object { (Get-PropertyValue $_ 'codec_type') -eq 'audio' })
    $videoStreams = @($streams | Where-Object { (Get-PropertyValue $_ 'codec_type') -eq 'video' })
    if ($audioStreams.Count -ne 1) {
        return [pscustomobject]@{ Valid = $false; Reason = 'audio-stream-count'; Duration = 0.0 }
    }
    if ($videoStreams.Count -ne 0) {
        return [pscustomobject]@{ Valid = $false; Reason = 'contains-video'; Duration = 0.0 }
    }
    if ($RequireAac -and (Get-PropertyValue $audioStreams[0] 'codec_name') -ne 'aac') {
        return [pscustomobject]@{ Valid = $false; Reason = 'not-aac'; Duration = 0.0 }
    }

    $format = Get-PropertyValue $probe 'format'
    $duration = Convert-ToDouble (Get-PropertyValue $format 'duration')
    if ($duration -le 0) {
        $duration = Convert-ToDouble (Get-PropertyValue $audioStreams[0] 'duration')
    }
    $tolerance = [Math]::Max(3.0, $ExpectedDuration * 0.03)
    if ($duration -le 0 -or [Math]::Abs($duration - $ExpectedDuration) -gt $tolerance) {
        return [pscustomobject]@{ Valid = $false; Reason = 'duration-mismatch'; Duration = $duration }
    }
    return [pscustomobject]@{ Valid = $true; Reason = ''; Duration = $duration }
}

function Get-CoverExtension($Record) {
    $codec = "$(Get-PropertyValue $Record 'attachedCoverCodec')".ToLowerInvariant()
    if ($codec -eq 'mjpeg') { return '.jpg' }
    if ($codec -eq 'png') { return '.png' }
    if ($codec -eq 'webp') { return '.webp' }
    return '.jpg'
}

function Move-ToQuarantine([string] $Path, [string] $Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    [IO.Directory]::CreateDirectory($script:QuarantineDirectory) | Out-Null
    $extension = [IO.Path]::GetExtension($Path)
    $name = "$Label-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff'))-$([guid]::NewGuid().ToString('N'))$extension"
    Move-Item -LiteralPath $Path -Destination (Join-Path $script:QuarantineDirectory $name)
}

function Ensure-EmbeddedCover($Record) {
    $indexValue = Get-PropertyValue $Record 'attachedCoverStreamIndex'
    if ($null -eq $indexValue) { return $null }
    $extension = Get-CoverExtension $Record
    $final = Join-Path $script:CoversDirectory ("$(Get-PropertyValue $Record 'id')$extension")
    if ((Test-Path -LiteralPath $final -PathType Leaf) -and (Get-Item -LiteralPath $final).Length -gt 0) {
        return $final
    }

    $part = Join-Path $script:CoversDirectory ("$(Get-PropertyValue $Record 'id').part.$([guid]::NewGuid().ToString('N'))$extension")
    $source = Get-SourcePath $Record
    $codec = "$(Get-PropertyValue $Record 'attachedCoverCodec')".ToLowerInvariant()
    $arguments = @('-nostdin', '-hide_banner', '-loglevel', 'error', '-i', $source,
        '-map', "0:$indexValue", '-frames:v', '1', '-threads', '2')
    if ($codec -in @('mjpeg', 'png', 'webp')) {
        $arguments += @('-c:v', 'copy')
    } else {
        $arguments += @('-c:v', 'mjpeg', '-q:v', '2')
    }
    $arguments += @('-f', $(if ($extension -eq '.png') { 'image2' } else { 'image2' }), $part)
    $ffmpegOutput = & $script:FfmpegPath $arguments 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $part) -or (Get-Item -LiteralPath $part).Length -le 0) {
        if (Test-Path -LiteralPath $part) { Move-ToQuarantine $part "$(Get-PropertyValue $Record 'id')-cover-failed" }
        return $null
    }
    [IO.File]::Move($part, $final)
    return $final
}

function Copy-AuxiliaryAtomic([string] $Source, [string] $Destination) {
    if ((Test-Path -LiteralPath $Destination -PathType Leaf) -and
        (Get-Item -LiteralPath $Destination).Length -eq (Get-Item -LiteralPath $Source).Length) {
        return $true
    }
    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        Move-ToQuarantine $Destination 'invalid-auxiliary'
    }
    $extension = [IO.Path]::GetExtension($Destination)
    $part = Join-Path (Split-Path -Parent $Destination) ("$([IO.Path]::GetFileNameWithoutExtension($Destination)).part.$([guid]::NewGuid().ToString('N'))$extension")
    Copy-Item -LiteralPath $Source -Destination $part
    if ((Get-Item -LiteralPath $part).Length -ne (Get-Item -LiteralPath $Source).Length) {
        Move-ToQuarantine $part 'auxiliary-copy-failed'
        return $false
    }
    [IO.File]::Move($part, $Destination)
    return $true
}

$script:ResolvedSourceRoot = Get-FullPath (Resolve-Path -LiteralPath $SourceRoot).Path
$script:ResolvedOutputRoot = Get-FullPath $OutputRoot
$resolvedInventoryPath = Get-FullPath $InventoryPath
Assert-OutsideSource $script:ResolvedSourceRoot $script:ResolvedOutputRoot 'OutputRoot'
Assert-OutsideSource $script:ResolvedSourceRoot $resolvedInventoryPath 'InventoryPath'

$script:FfmpegPath = (Get-Command ffmpeg -CommandType Application -ErrorAction Stop).Source
$script:FfprobePath = (Get-Command ffprobe -CommandType Application -ErrorAction Stop).Source
$script:TracksDirectory = Join-Path $script:ResolvedOutputRoot 'tracks'
$script:CoversDirectory = Join-Path $script:ResolvedOutputRoot 'covers'
$script:LyricsDirectory = Join-Path $script:ResolvedOutputRoot 'lyrics'
$stagingRoot = Split-Path -Parent $script:ResolvedOutputRoot
$script:QuarantineDirectory = Join-Path $stagingRoot '.work\quarantine'

$inventoryExists = Test-Path -LiteralPath $resolvedInventoryPath -PathType Leaf
if ($inventoryExists -and -not $RefreshInventory) {
    $sourceRecords = @(Read-JsonLines $resolvedInventoryPath)
} else {
    Write-Host 'Scanning source inventory (read-only)...'
    $sourceRecords = @(New-SourceInventory $script:ResolvedSourceRoot)
}

$mediaRecords = @($sourceRecords | Where-Object { (Get-PropertyValue $_ 'kind') -eq 'media' })
if ($mediaRecords.Count -eq 0) { throw 'Source inventory contains no supported media.' }

if ($Pilot) {
    $candidates = @(
        foreach ($extension in $PilotExtensions) {
            $mediaRecords |
                Where-Object { (Get-PropertyValue $_ 'extension') -eq $extension } |
                Sort-Object { [long] (Get-PropertyValue $_ 'bytes') }, { "$(Get-PropertyValue $_ 'relativePath')" } |
                Select-Object -First 1
        }
    )
    if ($candidates.Count -ne $PilotExtensions.Count) {
        throw "Pilot requires one source for each of $($PilotExtensions.Count) supported sample extensions."
    }
} else {
    $candidates = @($mediaRecords | Sort-Object { "$(Get-PropertyValue $_ 'relativePath')" })
}

$pending = [Collections.Generic.List[object]]::new()
foreach ($record in $candidates) {
    $expected = Get-TrackOutputPath $record
    $validation = Test-PreparedAudio $expected ([double] (Get-PropertyValue $record 'duration')) ((Get-PropertyValue $record 'action') -eq 'transcode-aac')
    if (-not $validation.Valid) { $pending.Add($record) }
}

if ($Pilot) {
    $selected = @($pending)
} else {
    $selectedList = [Collections.Generic.List[object]]::new()
    $plannedBytes = 0L
    foreach ($record in $pending) {
        $estimate = [long] (Get-PropertyValue $record 'estimatedOutputBytes')
        if ($estimate -gt $BatchBytes) {
            if ($selectedList.Count -eq 0) {
                throw "Track id $(Get-PropertyValue $record 'id') exceeds BatchBytes; raise the explicit limit for this one track."
            }
            break
        }
        if ($selectedList.Count -gt 0 -and ($plannedBytes + $estimate) -gt $BatchBytes) { break }
        $selectedList.Add($record)
        $plannedBytes += $estimate
    }
    $selected = @($selectedList)
}

$estimatedBytes = 0L
foreach ($record in $selected) {
    $estimatedBytes += [long] (Get-PropertyValue $record 'estimatedOutputBytes')
}
$actionSummary = @($selected | Group-Object action | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '
$mode = if ($Pilot) { 'pilot' } else { 'one batch' }
Write-Host ("Plan: mode={0}; tracks={1}; estimated={2:N1} MiB; concurrency={3}; {4}" -f
    $mode, $selected.Count, ($estimatedBytes / 1MB), $Concurrency, $actionSummary)

if ($WhatIfPreference) {
    $null = $PSCmdlet.ShouldProcess($script:ResolvedOutputRoot, "prepare $($selected.Count) music tracks")
    return
}

if (-not $PSCmdlet.ShouldProcess($script:ResolvedOutputRoot, "prepare $($selected.Count) music tracks")) { return }

[IO.Directory]::CreateDirectory($script:ResolvedOutputRoot) | Out-Null
[IO.Directory]::CreateDirectory($script:TracksDirectory) | Out-Null
[IO.Directory]::CreateDirectory($script:CoversDirectory) | Out-Null
[IO.Directory]::CreateDirectory($script:LyricsDirectory) | Out-Null
[IO.Directory]::CreateDirectory($script:QuarantineDirectory) | Out-Null

if (-not $inventoryExists -or $RefreshInventory) {
    Write-JsonLinesAtomic $resolvedInventoryPath $sourceRecords
}

$outputDriveName = [IO.Path]::GetPathRoot($script:ResolvedOutputRoot).TrimEnd('\').TrimEnd(':')
$freeBytes = [long] (Get-PSDrive -Name $outputDriveName).Free
$reserveBytes = 20GB
$requiredBatchBytes = [long] [Math]::Ceiling($estimatedBytes * 1.15)
if ($freeBytes -lt ($requiredBatchBytes + $reserveBytes)) {
    throw ("Insufficient free space: need 115% of the estimated batch and must retain 20 GiB; free={0:N1} GiB." -f ($freeBytes / 1GB))
}

$workerInputs = @($selected | ForEach-Object {
    [pscustomobject]@{
        id = "$(Get-PropertyValue $_ 'id')"
        sourcePath = Get-SourcePath $_
        finalPath = Get-TrackOutputPath $_
        action = "$(Get-PropertyValue $_ 'action')"
        duration = [double] (Get-PropertyValue $_ 'duration')
        stripAttachedCover = $null -ne (Get-PropertyValue $_ 'attachedCoverStreamIndex')
    }
})

$ffmpegForWorkers = $script:FfmpegPath
$ffprobeForWorkers = $script:FfprobePath
$quarantineForWorkers = $script:QuarantineDirectory
$results = @($workerInputs | ForEach-Object -Parallel {
    $item = $_
    $ffmpegPath = $using:ffmpegForWorkers
    $ffprobePath = $using:ffprobeForWorkers
    $quarantineDirectory = $using:quarantineForWorkers

    function Read-Value($Object, [string] $Name) {
        if ($null -eq $Object) { return $null }
        $property = $Object.PSObject.Properties[$Name]
        if ($null -eq $property) { return $null }
        return $property.Value
    }
    function Parse-Number($Value) {
        $parsed = 0.0
        if ($null -ne $Value -and [double]::TryParse("$Value", [Globalization.NumberStyles]::Float,
                [Globalization.CultureInfo]::InvariantCulture, [ref] $parsed)) { return $parsed }
        return 0.0
    }
    function Probe-Local([string] $Path) {
        $raw = & $ffprobePath @('-v', 'error', '-show_format', '-show_streams', '-of', 'json', $Path) 2>&1
        if ($LASTEXITCODE -ne 0) { throw 'ffprobe failed' }
        return ($raw -join "`n") | ConvertFrom-Json
    }
    function Validate-Local([string] $Path, [double] $ExpectedDuration, [bool] $RequireAac) {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
        try { $probe = Probe-Local $Path } catch { return $false }
        $streams = @(Read-Value $probe 'streams')
        $audio = @($streams | Where-Object { (Read-Value $_ 'codec_type') -eq 'audio' })
        $video = @($streams | Where-Object { (Read-Value $_ 'codec_type') -eq 'video' })
        if ($audio.Count -ne 1 -or $video.Count -ne 0) { return $false }
        if ($RequireAac -and (Read-Value $audio[0] 'codec_name') -ne 'aac') { return $false }
        $format = Read-Value $probe 'format'
        $duration = Parse-Number (Read-Value $format 'duration')
        if ($duration -le 0) { $duration = Parse-Number (Read-Value $audio[0] 'duration') }
        $tolerance = [Math]::Max(3.0, $ExpectedDuration * 0.03)
        return $duration -gt 0 -and [Math]::Abs($duration - $ExpectedDuration) -le $tolerance
    }
    function Quarantine-Local([string] $Path, [string] $Label) {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
        [IO.Directory]::CreateDirectory($quarantineDirectory) | Out-Null
        $extension = [IO.Path]::GetExtension($Path)
        $name = "$Label-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff'))-$([guid]::NewGuid().ToString('N'))$extension"
        Move-Item -LiteralPath $Path -Destination (Join-Path $quarantineDirectory $name)
    }

    $requiresAac = $item.action -eq 'transcode-aac'
    if (Validate-Local $item.finalPath $item.duration $requiresAac) {
        return [pscustomobject]@{ id = $item.id; status = 'skipped'; reason = '' }
    }
    if (Test-Path -LiteralPath $item.finalPath -PathType Leaf) {
        Quarantine-Local $item.finalPath "$($item.id)-invalid-final"
    }

    $extension = [IO.Path]::GetExtension($item.finalPath)
    $part = Join-Path (Split-Path -Parent $item.finalPath) ("$($item.id).part.$([guid]::NewGuid().ToString('N'))$extension")
    try {
        if ($item.action -eq 'copy' -and -not $item.stripAttachedCover) {
            Copy-Item -LiteralPath $item.sourcePath -Destination $part
        } else {
            $arguments = @('-nostdin', '-hide_banner', '-loglevel', 'error', '-i', $item.sourcePath,
                '-map', '0:a:0', '-vn', '-map_metadata', '0')
            if ($item.action -in @('copy', 'remux-audio')) {
                $arguments += @('-c:a', 'copy')
            } else {
                $arguments += @('-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '192k', '-ac', '2')
            }
            $arguments += @('-threads', '2')
            if ($extension -eq '.m4a') {
                $arguments += @('-movflags', '+faststart', '-f', 'ipod')
            } else {
                $container = switch ($extension) {
                    '.mp3' { 'mp3' }
                    '.flac' { 'flac' }
                    '.wav' { 'wav' }
                    default { throw "No safe stream-copy container for $extension" }
                }
                $arguments += @('-f', $container)
            }
            $arguments += $part
            $ffmpegOutput = & $ffmpegPath $arguments 2>&1
            if ($LASTEXITCODE -ne 0) { throw "ffmpeg exit $LASTEXITCODE" }
        }

        if (-not (Validate-Local $part $item.duration $requiresAac)) {
            throw 'output validation failed'
        }
        [IO.File]::Move($part, $item.finalPath)
        return [pscustomobject]@{ id = $item.id; status = 'prepared'; reason = '' }
    } catch {
        if (Test-Path -LiteralPath $part -PathType Leaf) {
            Quarantine-Local $part "$($item.id)-failed-part"
        }
        return [pscustomobject]@{ id = $item.id; status = 'failed'; reason = $_.Exception.Message }
    }
} -ThrottleLimit $Concurrency)

$completed = [Collections.Generic.List[object]]::new()
foreach ($record in $mediaRecords) {
    $path = Get-TrackOutputPath $record
    $validation = Test-PreparedAudio $path ([double] (Get-PropertyValue $record 'duration')) ((Get-PropertyValue $record 'action') -eq 'transcode-aac')
    if ($validation.Valid) { $completed.Add($record) }
}

$coverBindings = @{}
$lyricsBindings = @{}
foreach ($record in $completed) {
    $cover = Ensure-EmbeddedCover $record
    if ($null -ne $cover) {
        $coverBindings["$(Get-PropertyValue $record 'id')"] = "/music/library/covers/$([IO.Path]::GetFileName($cover))"
    }
}

$mediaByStem = @{}
foreach ($record in $mediaRecords) {
    $relative = "$(Get-PropertyValue $record 'relativePath')"
    $directory = Split-Path -Parent $relative
    $stem = [IO.Path]::GetFileNameWithoutExtension($relative)
    $key = "$directory|$stem".ToLowerInvariant()
    if (-not $mediaByStem.ContainsKey($key)) { $mediaByStem[$key] = [Collections.Generic.List[object]]::new() }
    $mediaByStem[$key].Add($record)
}

$auxiliary = @($sourceRecords | Where-Object { (Get-PropertyValue $_ 'kind') -in @('cover', 'lyrics') })
$auxiliaryByKindAndStem = @{}
foreach ($asset in $auxiliary) {
    $relative = "$(Get-PropertyValue $asset 'relativePath')"
    $directory = Split-Path -Parent $relative
    $stem = [IO.Path]::GetFileNameWithoutExtension($relative)
    $key = "$(Get-PropertyValue $asset 'kind')|$directory|$stem".ToLowerInvariant()
    if (-not $auxiliaryByKindAndStem.ContainsKey($key)) { $auxiliaryByKindAndStem[$key] = [Collections.Generic.List[object]]::new() }
    $auxiliaryByKindAndStem[$key].Add($asset)
}

$completedIds = @{}
foreach ($record in $completed) { $completedIds["$(Get-PropertyValue $record 'id')"] = $true }
$manualQueue = [Collections.Generic.List[object]]::new()

foreach ($asset in $auxiliary) {
    $relative = "$(Get-PropertyValue $asset 'relativePath')"
    $directory = Split-Path -Parent $relative
    $stem = [IO.Path]::GetFileNameWithoutExtension($relative)
    $stemKey = "$directory|$stem".ToLowerInvariant()
    $kind = "$(Get-PropertyValue $asset 'kind')"
    $assetKey = "$kind|$directory|$stem".ToLowerInvariant()
    $matches = @(if ($mediaByStem.ContainsKey($stemKey)) { $mediaByStem[$stemKey] })
    $sameAssets = @($auxiliaryByKindAndStem[$assetKey])

    if ($matches.Count -ne 1) {
        $manualQueue.Add([pscustomobject]@{
            kind = $kind
            source = $relative
            reason = if ($matches.Count -eq 0) { 'no-exact-stem-track' } else { 'multiple-exact-stem-tracks' }
        })
        continue
    }
    if ($sameAssets.Count -ne 1) {
        $manualQueue.Add([pscustomobject]@{ kind = $kind; source = $relative; reason = 'multiple-exact-stem-assets' })
        continue
    }

    $track = $matches[0]
    $trackId = "$(Get-PropertyValue $track 'id')"
    if (-not $completedIds.ContainsKey($trackId)) { continue }
    if ($kind -eq 'cover' -and $coverBindings.ContainsKey($trackId)) { continue }

    $source = Get-SourcePath $asset
    $extension = "$(Get-PropertyValue $asset 'extension')"
    $targetDirectory = if ($kind -eq 'cover') { $script:CoversDirectory } else { $script:LyricsDirectory }
    $destination = Join-Path $targetDirectory "$trackId$extension"
    if (Copy-AuxiliaryAtomic $source $destination) {
        $publicPath = "/music/library/$(if ($kind -eq 'cover') { 'covers' } else { 'lyrics' })/$([IO.Path]::GetFileName($destination))"
        if ($kind -eq 'cover') { $coverBindings[$trackId] = $publicPath }
        else { $lyricsBindings[$trackId] = $publicPath }
    } else {
        $manualQueue.Add([pscustomobject]@{ kind = $kind; source = $relative; reason = 'copy-failed' })
    }
}

$tracks = @($completed | Sort-Object { "$(Get-PropertyValue $_ 'relativePath')" } | ForEach-Object {
    $record = $_
    $id = "$(Get-PropertyValue $record 'id')"
    $relative = "$(Get-PropertyValue $record 'relativePath')"
    $title = Get-NonEmptyString $record 'title'
    if ($null -eq $title) { $title = [IO.Path]::GetFileNameWithoutExtension($relative) }
    $artist = Get-NonEmptyString $record 'artist'
    if ($null -eq $artist) { $artist = '' }
    $track = [ordered]@{
        id = $id
        title = $title
        artist = $artist
        duration = [Math]::Round([double] (Get-PropertyValue $record 'duration'), 3)
        src = "/music/library/tracks/$([IO.Path]::GetFileName((Get-TrackOutputPath $record)))"
    }
    $album = Get-NonEmptyString $record 'album'
    $genre = Get-NonEmptyString $record 'genre'
    if ($null -ne $album) { $track['album'] = $album }
    if ($null -ne $genre) { $track['genre'] = $genre }
    if ($coverBindings.ContainsKey($id)) { $track['cover'] = $coverBindings[$id] }
    if ($lyricsBindings.ContainsKey($id)) { $track['lyrics'] = $lyricsBindings[$id] }
    [pscustomobject] $track
})

Write-JsonAtomic (Join-Path $script:ResolvedOutputRoot 'manifest.v1.json') ([ordered]@{
    version = 1
    tracks = $tracks
})
Write-JsonAtomic (Join-Path $script:ResolvedOutputRoot 'manual-review.v1.json') ([ordered]@{
    version = 1
    items = @($manualQueue | Sort-Object kind, source)
})

$preparedCount = @($results | Where-Object status -eq 'prepared').Count
$skippedCount = @($results | Where-Object status -eq 'skipped').Count
$failedCount = @($results | Where-Object status -eq 'failed').Count
Write-Host "Result: prepared=$preparedCount; skipped=$skippedCount; failed=$failedCount; manifest tracks=$($tracks.Count); manual review=$($manualQueue.Count)."
if ($failedCount -gt 0) {
    $failureSummary = @($results | Where-Object status -eq 'failed' | Group-Object reason | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join '; '
    throw "Batch completed with failures: $failureSummary"
}
