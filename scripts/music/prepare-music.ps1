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
    [switch] $RefreshInventory,
    [switch] $ReplayLastBatch
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

function Get-FileSha256([string] $Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        $hash = [Security.Cryptography.SHA256]::HashData($stream)
        return [Convert]::ToHexString($hash).ToLowerInvariant()
    } finally {
        $stream.Dispose()
    }
}

function Get-FirstTagValue([object[]] $TagObjects, [string[]] $Names) {
    foreach ($tags in $TagObjects) {
        foreach ($name in $Names) {
            $value = Get-NonEmptyString $tags $name
            if ($null -ne $value) { return $value }
        }
    }
    return $null
}

function Get-ConservativeYear([object[]] $TagObjects) {
    $value = Get-FirstTagValue $TagObjects @('year', 'date')
    if ($null -eq $value -or $value -notmatch '^(?<year>\d{4})(?:\D|$)') { return $null }
    $year = [int] $Matches.year
    if ($year -lt 1900 -or $year -gt ([DateTime]::UtcNow.Year + 1)) { return $null }
    return $year
}

function Get-ConservativeLanguage([object[]] $TagObjects) {
    $value = Get-FirstTagValue $TagObjects @('language')
    if ($null -eq $value -or $value -notmatch '^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$') { return $null }
    return $value.ToLowerInvariant()
}

function Get-ConservativeArtist($Record) {
    $artist = Get-NonEmptyString $Record 'artist'
    if ($null -eq $artist) { return $null }
    if ($artist.Trim().ToLowerInvariant() -in @('unknown', 'unknown artist', '<unknown>', '未知艺术家', '未知歌手')) {
        return $null
    }
    return $artist
}

function Normalize-ExactMatchText([string] $Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    $normalized = $Value.Normalize([Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant()
    return [regex]::Replace($normalized, '\s+', ' ')
}

function Remove-TrackNumberPrefix([string] $Value) {
    return [regex]::Replace($Value, '^\s*\d{1,3}\s*(?:[-._、．]\s*|\s+)', '')
}

function Remove-KnownArtistPrefix([string] $Value, [string] $Artist) {
    $artistKey = Normalize-ExactMatchText $Artist
    if ($artistKey.Length -eq 0) { return $Value }
    return [regex]::Replace($Value, "^$([regex]::Escape($artistKey))\s*(?:-|–|—|_|－)\s*", '')
}

function Test-ExactLyricsTitleMatch($LyricsRecord, $MediaRecord) {
    $lyricsStem = [IO.Path]::GetFileNameWithoutExtension("$(Get-PropertyValue $LyricsRecord 'relativePath')")
    $artist = Get-ConservativeArtist $MediaRecord
    $lyricsKey = Normalize-ExactMatchText (Remove-TrackNumberPrefix $lyricsStem)
    $lyricsKey = Remove-KnownArtistPrefix $lyricsKey $artist
    if ($lyricsKey.Length -eq 0) { return $false }

    $mediaStem = [IO.Path]::GetFileNameWithoutExtension("$(Get-PropertyValue $MediaRecord 'relativePath')")
    $candidates = @((Get-NonEmptyString $MediaRecord 'title'), $mediaStem)
    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        $candidateKey = Normalize-ExactMatchText (Remove-TrackNumberPrefix $candidate)
        $candidateKey = Remove-KnownArtistPrefix $candidateKey $artist
        if ($candidateKey -eq $lyricsKey) { return $true }
    }
    return $false
}

function Get-ConservativeCategory($Record) {
    $genre = Get-NonEmptyString $Record 'genre'
    if ($null -ne $genre) {
        $normalizedGenre = $genre.Trim().ToLowerInvariant()
        if ($normalizedGenre -match 'soundtrack|original\s+score|film\s+score|影视原声|电影原声|原声') {
            return [pscustomobject]@{ Id = 'film-tv-soundtrack'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match 'sound\s*effects?|\bsfx\b|音效') {
            return [pscustomobject]@{ Id = 'sound-effects'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match 'jazz|爵士') {
            return [pscustomobject]@{ Id = 'jazz'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match 'classical|piano|nocturne|古典|钢琴') {
            return [pscustomobject]@{ Id = 'piano-classical'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match 'electronic|electronica|\bedm\b|trance|\bdance\b|house|dubstep|电音|电子') {
            return [pscustomobject]@{ Id = 'electronic'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match 'new\s+age|ambient|instrumental|轻音乐|纯音乐|舒缓') {
            return [pscustomobject]@{ Id = 'ambient-instrumental'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match '\bpop\b|\brock\b|\bblues\b|流行|摇滚') {
            return [pscustomobject]@{ Id = 'pop-rock'; Source = 'embedded-genre' }
        }
        if ($normalizedGenre -match '\bbgm\b|background\s+music|cinematic|\bepic\b|royalty\s+free|音乐素材|素材') {
            return [pscustomobject]@{ Id = 'bgm-assets'; Source = 'embedded-genre' }
        }
    }

    $relativePath = "$(Get-PropertyValue $Record 'relativePath')"
    $parts = @($relativePath -split '[\\/]')
    $topDirectory = if ($parts.Count -gt 1) { $parts[0].Trim() } else { '' }
    if ($topDirectory -eq 'Kenny G') {
        return [pscustomobject]@{ Id = 'jazz'; Source = 'explicit-top-directory' }
    }
    if ($topDirectory -eq 'piano') {
        return [pscustomobject]@{ Id = 'piano-classical'; Source = 'explicit-top-directory' }
    }
    if ($topDirectory -match '^周杰伦.*钢琴伴奏$') {
        return [pscustomobject]@{ Id = 'pop-rock'; Source = 'explicit-top-directory' }
    }
    if ($topDirectory -match '不能说的秘密.*原声') {
        return [pscustomobject]@{ Id = 'film-tv-soundtrack'; Source = 'explicit-top-directory' }
    }
    if ($topDirectory -in @('BGM', 'Savfk', 'epic', 'No Copyright Music', 'Royalty Free Music', '音乐素材', 'NCS')) {
        return [pscustomobject]@{ Id = 'bgm-assets'; Source = 'explicit-top-directory' }
    }
    if ($topDirectory -in @('电音', 'Alan Walker', 'MitiS', 'ILLENIUM', 'Avicii')) {
        return [pscustomobject]@{ Id = 'electronic'; Source = 'explicit-top-directory' }
    }
    if ($topDirectory -eq '音效') {
        return [pscustomobject]@{ Id = 'sound-effects'; Source = 'explicit-top-directory' }
    }

    $keywordText = Normalize-ExactMatchText (@(
        (Get-NonEmptyString $Record 'title'),
        (Get-ConservativeArtist $Record),
        (Get-NonEmptyString $Record 'album'),
        $relativePath
    ) -join ' ')
    $artistKey = Normalize-ExactMatchText "$(Get-ConservativeArtist $Record)"
    if ($keywordText -match 'soundtrack|original\s+score|film\s+score|movie\s+score|影视原声|电影原声|原声带|配乐|hans\s+zimmer|汉斯.?季默|饥饿游戏.*插曲|just blue.*动物世界|fate stay night|always with me.*宫崎骏|my heart will go on.*titanic|世界杯主题曲|cctv.*动物世界片尾曲|霍比特人3.*插曲|henry jackman|金手指.*007|中国合伙人.*主题曲|he''s a pirate|for your eyes only|the crave.*ennio morricone|la valse.*am[eé]lie|星球大战|风之甬道|久石让|超级马里奥|哪吒之魔童闹海.*电影角色曲') {
        return [pscustomobject]@{ Id = 'film-tv-soundtrack'; Source = 'metadata-keywords' }
    }
    if ($keywordText -match 'classical|piano|symphony|concerto|sonata|nocturne|etude|prelude|chopin|mozart|beethoven|bach|debussy|liszt|rachmaninoff|vivaldi|tchaikovsky|古典|钢琴|交响|协奏曲|奏鸣曲|夜曲|练习曲|前奏曲|肖邦|莫扎特|贝多芬|巴赫|德彪西|李斯特|拉赫玛尼诺夫|维瓦尔第|柴可夫斯基|郎朗|理查德.?克莱德曼|richard\s+clayderman|李闰珉|tarrega|recuerdos de la alhambra|四小天鹅舞曲|马斯涅|maksim|schubert|josef hofmann|约翰施特劳斯|悲怆|robert schumann|李云迪|管风琴|王羽佳|stravinsky|simple gifts.*choirboys|wiener johann strauss|行星组曲|勃拉姆斯|hungarian dances|曼托瓦尼') {
        return [pscustomobject]@{ Id = 'piano-classical'; Source = 'metadata-keywords' }
    }
    if ($keywordText -match 'electronic|electronica|\bedm\b|deep\s+house|house\s+music|trance|dubstep|synthwave|techno|remix|电音|电子|shogun taira|advent - last mistake|bionic souls|david guetta|embody - lost & found|gabry ponte|hotel saint george|jim yosef|john de sohn|kamro|karkaz|klaas|lizot|tom swoon|groove coverage|loreen|\baqua\b|vinai|william black.*fairlane|cascada|universe in my head') {
        return [pscustomobject]@{ Id = 'electronic'; Source = 'metadata-keywords' }
    }
    if ($keywordText -match 'ambient|instrumental|new\s+age|relax(?:ing|ation)?|轻音乐|纯音乐|舒缓|calm music.*sappheiros|secret garden|茉莉花.*萨克斯|flower dance.*dj.?okawari') {
        return [pscustomobject]@{ Id = 'ambient-instrumental'; Source = 'metadata-keywords' }
    }
    if ($artistKey -in @(
        'talor swift', 'talyor swift', 'taylor swift', 'blue', 'carpenters', 'emilia', 'timbaland', 'coldplay',
        'maria arredondo', 'tamas wells', 'sarah connor', '水木年华', 'jason mraz', 'birdy', 'helene', 'rihanna',
        'sting', 'amy diamond', 'jason donovan', '费翔', 'atomic kitten', '林肯公园', 'trademark', 't.i',
        'whitney houston', 'bastille', 'the workday release', 'gareth gates', 'michael learns to rock', 'g.e.m.邓紫棋',
        'simple plan', 'robbie williams', 'muse', 'a-ha', 'leo sayer', 'eagles', 'simon & garfunkel',
        'michael bolton', 'avril lavigne', 'bryan adams', 'shayne ward', 'fools garden', 'shirley bassey', '许嵩',
        '黄晓明&邓超&佟大为', 'eric clapton', "blackmore's night", '屠洪刚', 'the cranberries', 'beyond',
        'jesse mccartney', 'britney spears', 'mariah carey', 'deutschland sucht den superstar'
    ) -or $keywordText -match '周杰伦|jay\s+chou|linkin\s+park|michael\s+jackson|迈克尔.?杰克逊|green\s+day|richard\s+marx|张韶涵|leona\s+lewis|\bm2m\b|汪峰|the\s+beatles|backstreet\s+boys|westlife|bon\s+jovi|\busher\b|charlotte lawrence|ed sheeran|bruno mars|ycccc|苟一一') {
        return [pscustomobject]@{ Id = 'pop-rock'; Source = 'metadata-keywords' }
    }
    if ($keywordText -match 'carlos estella|epic happy inspiring orchestral|sergepavkinmusic|two steps from hell|thomas bergersen') {
        return [pscustomobject]@{ Id = 'bgm-assets'; Source = 'metadata-keywords' }
    }
    return [pscustomobject]@{ Id = 'unclassified'; Source = 'none' }
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

    $fileIndex = 0
    foreach ($file in $files) {
        $fileIndex++
        if ($fileIndex -eq 1 -or $fileIndex % 50 -eq 0 -or $fileIndex -eq $files.Count) {
            Write-Host "Inventory progress: $fileIndex/$($files.Count)"
        }
        $relativePath = $file.FullName.Substring($rootPrefix.Length)
        $extension = $file.Extension.ToLowerInvariant()
        $contentSha256 = Get-FileSha256 $file.FullName
        $base = [ordered]@{
            schemaVersion = 1
            relativePath = $relativePath
            extension = $extension
            bytes = [long] $file.Length
            lastWriteTimeUtc = $file.LastWriteTimeUtc.ToString('O')
            contentSha256 = $contentSha256
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
            throw "Inventory requires exactly one audio stream; failed source content $contentSha256."
        }

        $audio = $audioStreams[0]
        $format = Get-PropertyValue $probe 'format'
        $formatTags = Get-PropertyValue $format 'tags'
        $audioTags = Get-PropertyValue $audio 'tags'
        $tagObjects = @($formatTags, $audioTags)
        $duration = Convert-ToDouble (Get-PropertyValue $format 'duration')
        if ($duration -le 0) {
            $duration = Convert-ToDouble (Get-PropertyValue $audio 'duration')
        }
        if ($duration -le 0) {
            throw "Inventory could not determine duration for source content $contentSha256."
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
        $base.id = $contentSha256
        $base.duration = [Math]::Round($duration, 3)
        $base.audioCodec = $codec
        $base.audioBitRate = [long] $audioBitRate
        $base.action = $action
        $base.outputExtension = Get-OutputExtension $extension $action
        $base.estimatedOutputBytes = Get-EstimatedOutputBytes $file.Length $duration $audioBitRate $action
        $base.title = Get-FirstTagValue $tagObjects @('title')
        $base.artist = Get-FirstTagValue $tagObjects @('artist', 'album_artist')
        $base.album = Get-FirstTagValue $tagObjects @('album')
        $base.genre = Get-FirstTagValue $tagObjects @('genre')
        $year = Get-ConservativeYear $tagObjects
        $language = Get-ConservativeLanguage $tagObjects
        if ($null -ne $year) { $base.year = $year }
        if ($null -ne $language) { $base.language = $language }
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
    $id = "$(Get-PropertyValue $Record 'id')"
    if (-not $script:PreparedBindings.ContainsKey($id)) { return $null }
    $binding = $script:PreparedBindings[$id]
    return Join-Path $script:TracksDirectory ("$(Get-PropertyValue $binding 'outputSha256')$(Get-PropertyValue $binding 'extension')")
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
    $trackId = "$(Get-PropertyValue $Record 'id')"
    if ($script:AssetBindings.ContainsKey($trackId)) {
        $existingName = "$(Get-PropertyValue $script:AssetBindings[$trackId] 'cover')"
        if ($existingName.Length -gt 0) {
            $existing = Join-Path $script:CoversDirectory $existingName
            $expectedHash = [IO.Path]::GetFileNameWithoutExtension($existingName)
            if ((Test-Path -LiteralPath $existing -PathType Leaf) -and
                $expectedHash -match '^[0-9a-f]{64}$' -and (Get-FileSha256 $existing) -eq $expectedHash) {
                return $existing
            }
        }
    }
    $extension = Get-CoverExtension $Record
    $part = Join-Path $script:CoversDirectory ("$trackId.part.$([guid]::NewGuid().ToString('N'))$extension")
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
        if (Test-Path -LiteralPath $part) { Move-ToQuarantine $part "$trackId-cover-failed" }
        return $null
    }
    $outputHash = Get-FileSha256 $part
    $final = Join-Path $script:CoversDirectory "$outputHash$extension"
    if (Test-Path -LiteralPath $final -PathType Leaf) {
        if ((Get-FileSha256 $final) -ne $outputHash) {
            Move-ToQuarantine $final "$trackId-invalid-cover-hash"
            [IO.File]::Move($part, $final)
        } else {
            Move-ToQuarantine $part "$trackId-duplicate-cover-part"
        }
    } else {
        [IO.File]::Move($part, $final)
    }
    return $final
}

function Copy-AuxiliaryAtomic([string] $Source, [string] $Destination, [string] $ExpectedSha256) {
    if ((Test-Path -LiteralPath $Destination -PathType Leaf) -and
        (Get-Item -LiteralPath $Destination -Force).Length -eq (Get-Item -LiteralPath $Source -Force).Length -and
        (Get-FileSha256 $Destination) -eq $ExpectedSha256) {
        return $true
    }
    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        Move-ToQuarantine $Destination 'invalid-auxiliary'
    }
    $extension = [IO.Path]::GetExtension($Destination)
    $part = Join-Path (Split-Path -Parent $Destination) ("$([IO.Path]::GetFileNameWithoutExtension($Destination)).part.$([guid]::NewGuid().ToString('N'))$extension")
    [IO.File]::Copy($Source, $part, $false)
    [IO.File]::SetAttributes($part, [IO.FileAttributes]::Normal)
    if (-not (Test-Path -LiteralPath $part -PathType Leaf) -or
        (Get-Item -LiteralPath $part -Force).Length -ne (Get-Item -LiteralPath $Source -Force).Length -or
        (Get-FileSha256 $part) -ne $ExpectedSha256) {
        if (Test-Path -LiteralPath $part -PathType Leaf) {
            Move-ToQuarantine $part 'auxiliary-copy-failed'
        }
        return $false
    }
    [IO.File]::Move($part, $Destination)
    return $true
}

function Set-AssetBinding([string] $TrackId, [string] $Kind, [string] $FileName) {
    $entry = [ordered]@{ id = $TrackId }
    if ($script:AssetBindings.ContainsKey($TrackId)) {
        $existingCover = Get-NonEmptyString $script:AssetBindings[$TrackId] 'cover'
        $existingLyrics = Get-NonEmptyString $script:AssetBindings[$TrackId] 'lyrics'
        if ($null -ne $existingCover) { $entry.cover = $existingCover }
        if ($null -ne $existingLyrics) { $entry.lyrics = $existingLyrics }
    }
    $entry[$Kind] = $FileName
    $script:AssetBindings[$TrackId] = [pscustomobject] $entry
}

$script:ResolvedSourceRoot = Get-FullPath (Resolve-Path -LiteralPath $SourceRoot).Path
$script:ResolvedOutputRoot = Get-FullPath $OutputRoot
$resolvedInventoryPath = Get-FullPath $InventoryPath
Assert-OutsideSource $script:ResolvedSourceRoot $script:ResolvedOutputRoot 'OutputRoot'
Assert-OutsideSource $script:ResolvedSourceRoot $resolvedInventoryPath 'InventoryPath'
if ($Pilot -and $ReplayLastBatch) { throw 'Pilot and ReplayLastBatch cannot be used together.' }
if ($ReplayLastBatch -and $RefreshInventory) { throw 'ReplayLastBatch requires the unchanged inventory used by the original batch.' }

$script:FfmpegPath = (Get-Command ffmpeg -CommandType Application -ErrorAction Stop).Source
$script:FfprobePath = (Get-Command ffprobe -CommandType Application -ErrorAction Stop).Source
$script:TracksDirectory = Join-Path $script:ResolvedOutputRoot 'tracks'
$script:CoversDirectory = Join-Path $script:ResolvedOutputRoot 'covers'
$script:LyricsDirectory = Join-Path $script:ResolvedOutputRoot 'lyrics'
$stagingRoot = Split-Path -Parent $script:ResolvedOutputRoot
$script:QuarantineDirectory = Join-Path $stagingRoot '.work\quarantine'
$inventoryDirectory = Split-Path -Parent $resolvedInventoryPath
$lastBatchPath = Join-Path $inventoryDirectory 'last-batch.v1.json'
$batchHistoryDirectory = Join-Path $inventoryDirectory 'batches'
$manualReviewPath = Join-Path $inventoryDirectory 'manual-review.v1.json'
$preparedIndexPath = Join-Path $inventoryDirectory 'prepared-index.v1.json'
$assetIndexPath = Join-Path $inventoryDirectory 'asset-bindings.v1.json'
$classificationPath = Join-Path $script:ResolvedOutputRoot 'classification.v1.json'

$script:PreparedBindings = @{}
if (Test-Path -LiteralPath $preparedIndexPath -PathType Leaf) {
    $preparedIndex = Get-Content -LiteralPath $preparedIndexPath -Raw | ConvertFrom-Json
    if ((Get-PropertyValue $preparedIndex 'version') -ne 1) { throw 'Unsupported prepared-index version.' }
    foreach ($binding in @(Get-PropertyValue $preparedIndex 'tracks')) {
        $bindingId = "$(Get-PropertyValue $binding 'id')"
        $bindingHash = "$(Get-PropertyValue $binding 'outputSha256')"
        $bindingExtension = "$(Get-PropertyValue $binding 'extension')"
        if ($bindingId -match '^[0-9a-f]{64}$' -and $bindingHash -match '^[0-9a-f]{64}$' -and
            $bindingExtension -in @('.mp3', '.m4a', '.flac', '.wav')) {
            $script:PreparedBindings[$bindingId] = $binding
        }
    }
}

$script:AssetBindings = @{}
if (Test-Path -LiteralPath $assetIndexPath -PathType Leaf) {
    $assetIndex = Get-Content -LiteralPath $assetIndexPath -Raw | ConvertFrom-Json
    if ((Get-PropertyValue $assetIndex 'version') -ne 1) { throw 'Unsupported asset-bindings version.' }
    foreach ($binding in @(Get-PropertyValue $assetIndex 'tracks')) {
        $bindingId = "$(Get-PropertyValue $binding 'id')"
        if ($bindingId -match '^[0-9a-f]{64}$') { $script:AssetBindings[$bindingId] = $binding }
    }
}

$inventoryExists = Test-Path -LiteralPath $resolvedInventoryPath -PathType Leaf
$inventoryWasRegenerated = $false
if ($inventoryExists -and -not $RefreshInventory) {
    $sourceRecords = @(Read-JsonLines $resolvedInventoryPath)
    $inventoryHasContentIds = @($sourceRecords | Where-Object {
        $hash = "$(Get-PropertyValue $_ 'contentSha256')"
        $hash -notmatch '^[0-9a-f]{64}$' -or
            ((Get-PropertyValue $_ 'kind') -eq 'media' -and "$(Get-PropertyValue $_ 'id')" -ne $hash)
    }).Count -eq 0
    if (-not $inventoryHasContentIds) {
        Write-Host 'Existing inventory predates content hashes; rebuilding it from the read-only source...'
        $sourceRecords = @(New-SourceInventory $script:ResolvedSourceRoot)
        $inventoryWasRegenerated = $true
    }
} else {
    Write-Host 'Scanning source inventory (read-only)...'
    $sourceRecords = @(New-SourceInventory $script:ResolvedSourceRoot)
    $inventoryWasRegenerated = $true
}

$mediaRecords = @($sourceRecords | Where-Object { (Get-PropertyValue $_ 'kind') -eq 'media' })
if ($mediaRecords.Count -eq 0) { throw 'Source inventory contains no supported media.' }
$contentGroups = @($mediaRecords | Group-Object { "$(Get-PropertyValue $_ 'contentSha256')" })
$canonicalMediaRecords = @($contentGroups | ForEach-Object {
    $_.Group | Sort-Object { "$(Get-PropertyValue $_ 'relativePath')" } | Select-Object -First 1
} | Sort-Object { "$(Get-PropertyValue $_ 'relativePath')" })
$exactDuplicateSourceCount = $mediaRecords.Count - $canonicalMediaRecords.Count
Write-Host "Content index: source media=$($mediaRecords.Count); unique content=$($canonicalMediaRecords.Count); exact duplicate sources=$exactDuplicateSourceCount."

$expectedOutputHashes = @{}
$lastBatch = $null
if ($ReplayLastBatch) {
    if (-not (Test-Path -LiteralPath $lastBatchPath -PathType Leaf)) {
        throw "ReplayLastBatch requires $lastBatchPath."
    }
    $lastBatch = Get-Content -LiteralPath $lastBatchPath -Raw | ConvertFrom-Json
    if ((Get-PropertyValue $lastBatch 'version') -ne 1) { throw 'Unsupported last-batch receipt version.' }
    foreach ($output in @(Get-PropertyValue $lastBatch 'outputs')) {
        $outputId = "$(Get-PropertyValue $output 'id')"
        $outputHash = "$(Get-PropertyValue $output 'sha256')"
        if ($outputId -match '^[0-9a-f]{64}$' -and $outputHash -match '^[0-9a-f]{64}$') {
            $expectedOutputHashes[$outputId] = $outputHash
        }
    }
}

if ($Pilot) {
    $candidates = @(
        foreach ($extension in $PilotExtensions) {
            $canonicalMediaRecords |
                Where-Object { (Get-PropertyValue $_ 'extension') -eq $extension } |
                Sort-Object { [long] (Get-PropertyValue $_ 'bytes') }, { "$(Get-PropertyValue $_ 'relativePath')" } |
                Select-Object -First 1
        }
    )
    if ($candidates.Count -ne $PilotExtensions.Count) {
        throw "Pilot requires one source for each of $($PilotExtensions.Count) supported sample extensions."
    }
} elseif ($ReplayLastBatch) {
    $trackIds = @((Get-PropertyValue $lastBatch 'trackIds') | ForEach-Object { "$_" })
    if ($trackIds.Count -eq 0) { throw 'The last-batch receipt contains no track IDs.' }
    $recordById = @{}
    foreach ($record in $canonicalMediaRecords) { $recordById["$(Get-PropertyValue $record 'id')"] = $record }
    $missingIds = @($trackIds | Where-Object { -not $recordById.ContainsKey($_) })
    if ($missingIds.Count -gt 0) { throw 'The last-batch receipt no longer matches the current source inventory.' }
    $candidates = @($trackIds | ForEach-Object { $recordById[$_] })
} else {
    $candidates = @($canonicalMediaRecords)
}

$pending = [Collections.Generic.List[object]]::new()
foreach ($record in $candidates) {
    $expected = Get-TrackOutputPath $record
    $valid = $false
    if ($null -ne $expected) {
        $validation = Test-PreparedAudio $expected ([double] (Get-PropertyValue $record 'duration')) ((Get-PropertyValue $record 'action') -eq 'transcode-aac')
        $valid = $validation.Valid
    }
    $recordId = "$(Get-PropertyValue $record 'id')"
    if ($valid) {
        $boundHash = "$(Get-PropertyValue $script:PreparedBindings[$recordId] 'outputSha256')"
        $valid = (Get-FileSha256 $expected) -eq $boundHash
    }
    if ($valid -and $ReplayLastBatch -and $expectedOutputHashes.ContainsKey($recordId)) {
        $valid = $boundHash -eq $expectedOutputHashes[$recordId]
    }
    if (-not $valid) { $pending.Add($record) }
}

if ($Pilot -or $ReplayLastBatch) {
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
$batchRecords = if ($ReplayLastBatch) { @($candidates) } else { @($selected) }

$estimatedBytes = 0L
foreach ($record in $selected) {
    $estimatedBytes += [long] (Get-PropertyValue $record 'estimatedOutputBytes')
}
$actionSummary = @($selected | Group-Object action | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '
$mode = if ($Pilot) { 'pilot' } elseif ($ReplayLastBatch) { 'replay last batch' } else { 'one batch' }
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

$legacyManualReviewPath = Join-Path $script:ResolvedOutputRoot 'manual-review.v1.json'
if (Test-Path -LiteralPath $legacyManualReviewPath -PathType Leaf) {
    Move-ToQuarantine $legacyManualReviewPath 'legacy-public-manual-review'
}

if (-not $inventoryExists -or $RefreshInventory -or $inventoryWasRegenerated) {
    Write-JsonLinesAtomic $resolvedInventoryPath $sourceRecords
}

$outputDriveName = [IO.Path]::GetPathRoot($script:ResolvedOutputRoot).TrimEnd('\').TrimEnd(':')
$freeBytes = [long] (Get-PSDrive -Name $outputDriveName).Free
$reserveBytes = 20GB
$requiredBatchBytes = [long] [Math]::Ceiling($estimatedBytes * 1.15)
if ($freeBytes -lt ($requiredBatchBytes + $reserveBytes)) {
    throw ("Insufficient free space: need 115% of the estimated batch and must retain 20 GiB; free={0:N1} GiB." -f ($freeBytes / 1GB))
}

$batchCreatedAtUtc = if ($null -ne $lastBatch) {
    "$(Get-PropertyValue $lastBatch 'createdAtUtc')"
} else {
    [DateTime]::UtcNow.ToString('O')
}
if (-not $Pilot -and -not $ReplayLastBatch) {
    Write-JsonAtomic $lastBatchPath ([ordered]@{
        version = 1
        createdAtUtc = $batchCreatedAtUtc
        trackIds = @($batchRecords | ForEach-Object { "$(Get-PropertyValue $_ 'id')" })
        estimatedOutputBytes = $estimatedBytes
        outputs = @()
    })
}

$workerInputs = @($selected | ForEach-Object {
    $workerId = "$(Get-PropertyValue $_ 'id')"
    [pscustomobject]@{
        id = $workerId
        sourcePath = Get-SourcePath $_
        boundFinalPath = $(if ($script:PreparedBindings.ContainsKey($workerId)) { Get-TrackOutputPath $_ } else { '' })
        tracksDirectory = $script:TracksDirectory
        outputExtension = "$(Get-PropertyValue $_ 'outputExtension')"
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
    function Hash-Local([string] $Path) {
        $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        try {
            return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()
        } finally {
            $stream.Dispose()
        }
    }

    $requiresAac = $item.action -eq 'transcode-aac'
    if ($item.boundFinalPath -and (Validate-Local $item.boundFinalPath $item.duration $requiresAac)) {
        $boundHash = [IO.Path]::GetFileNameWithoutExtension($item.boundFinalPath)
        if ($boundHash -match '^[0-9a-f]{64}$' -and (Hash-Local $item.boundFinalPath) -eq $boundHash) {
            return [pscustomobject]@{
                id = $item.id
                status = 'skipped'
                reason = ''
                outputSha256 = $boundHash
                extension = $item.outputExtension
            }
        }
    }
    if ($item.boundFinalPath -and (Test-Path -LiteralPath $item.boundFinalPath -PathType Leaf)) {
        Quarantine-Local $item.boundFinalPath "$($item.id)-invalid-final"
    }

    $extension = $item.outputExtension
    $part = Join-Path $item.tracksDirectory ("$($item.id).part.$([guid]::NewGuid().ToString('N'))$extension")
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
        $outputSha256 = Hash-Local $part
        $finalPath = Join-Path $item.tracksDirectory "$outputSha256$extension"
        if (Test-Path -LiteralPath $finalPath -PathType Leaf) {
            if ((Hash-Local $finalPath) -ne $outputSha256 -or
                -not (Validate-Local $finalPath $item.duration $requiresAac)) {
                Quarantine-Local $finalPath "$($item.id)-invalid-content-addressed-final"
                [IO.File]::Move($part, $finalPath)
            } else {
                Quarantine-Local $part "$($item.id)-duplicate-output-part"
            }
        } else {
            [IO.File]::Move($part, $finalPath)
        }
        return [pscustomobject]@{
            id = $item.id
            status = 'prepared'
            reason = ''
            outputSha256 = $outputSha256
            extension = $extension
        }
    } catch {
        if (Test-Path -LiteralPath $part -PathType Leaf) {
            Quarantine-Local $part "$($item.id)-failed-part"
        }
        return [pscustomobject]@{ id = $item.id; status = 'failed'; reason = $_.Exception.Message }
    }
} -ThrottleLimit $Concurrency)

foreach ($result in $results) {
    if ((Get-PropertyValue $result 'status') -eq 'failed') { continue }
    $resultId = "$(Get-PropertyValue $result 'id')"
    $script:PreparedBindings[$resultId] = [pscustomobject][ordered]@{
        id = $resultId
        outputSha256 = "$(Get-PropertyValue $result 'outputSha256')"
        extension = "$(Get-PropertyValue $result 'extension')"
    }
}
Write-JsonAtomic $preparedIndexPath ([ordered]@{
    version = 1
    tracks = @($script:PreparedBindings.Values | Sort-Object id)
})

$completed = [Collections.Generic.List[object]]::new()
foreach ($record in $canonicalMediaRecords) {
    $path = Get-TrackOutputPath $record
    if ($null -eq $path) { continue }
    $validation = Test-PreparedAudio $path ([double] (Get-PropertyValue $record 'duration')) ((Get-PropertyValue $record 'action') -eq 'transcode-aac')
    $recordId = "$(Get-PropertyValue $record 'id')"
    $boundHash = "$(Get-PropertyValue $script:PreparedBindings[$recordId] 'outputSha256')"
    if ($validation.Valid -and (Get-FileSha256 $path) -eq $boundHash) { $completed.Add($record) }
}

$coverBindings = @{}
$lyricsBindings = @{}
foreach ($record in $completed) {
    $cover = Ensure-EmbeddedCover $record
    if ($null -ne $cover) {
        $trackId = "$(Get-PropertyValue $record 'id')"
        $coverName = [IO.Path]::GetFileName($cover)
        Set-AssetBinding $trackId 'cover' $coverName
        $coverBindings[$trackId] = "/music/library/covers/$coverName"
    }
}

$mediaByStem = @{}
foreach ($record in $canonicalMediaRecords) {
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
$handledAuxiliary = @{}

$completedByDirectory = @{}
foreach ($record in $completed) {
    $directoryKey = (Split-Path -Parent "$(Get-PropertyValue $record 'relativePath')").ToLowerInvariant()
    if (-not $completedByDirectory.ContainsKey($directoryKey)) {
        $completedByDirectory[$directoryKey] = [Collections.Generic.List[object]]::new()
    }
    $completedByDirectory[$directoryKey].Add($record)
}

$albumCoverCandidates = @($auxiliary | Where-Object {
    if ((Get-PropertyValue $_ 'kind') -ne 'cover') { return $false }
    $fileName = [IO.Path]::GetFileName("$(Get-PropertyValue $_ 'relativePath')")
    return $fileName.Equals('Cover.jpg', [StringComparison]::OrdinalIgnoreCase) -or
        $fileName.Equals('Folder.jpg', [StringComparison]::OrdinalIgnoreCase)
})
foreach ($group in @($albumCoverCandidates | Group-Object {
    (Split-Path -Parent "$(Get-PropertyValue $_ 'relativePath')").ToLowerInvariant()
})) {
    $coverCandidates = @($group.Group | Where-Object {
        [IO.Path]::GetFileName("$(Get-PropertyValue $_ 'relativePath')").Equals('Cover.jpg', [StringComparison]::OrdinalIgnoreCase)
    })
    $folderCandidates = @($group.Group | Where-Object {
        [IO.Path]::GetFileName("$(Get-PropertyValue $_ 'relativePath')").Equals('Folder.jpg', [StringComparison]::OrdinalIgnoreCase)
    })
    $chosen = if ($coverCandidates.Count -eq 1) {
        $coverCandidates[0]
    } elseif ($coverCandidates.Count -eq 0 -and $folderCandidates.Count -eq 1) {
        $folderCandidates[0]
    } else {
        $null
    }
    if ($null -eq $chosen) { continue }

    foreach ($candidate in $group.Group) {
        $handledAuxiliary["$(Get-PropertyValue $candidate 'relativePath')".ToLowerInvariant()] = $true
    }
    $relative = "$(Get-PropertyValue $chosen 'relativePath')"
    $assetHash = "$(Get-PropertyValue $chosen 'contentSha256')"
    $extension = "$(Get-PropertyValue $chosen 'extension')"
    $destination = Join-Path $script:CoversDirectory "$assetHash$extension"
    if (Copy-AuxiliaryAtomic (Get-SourcePath $chosen) $destination $assetHash) {
        $coverName = [IO.Path]::GetFileName($destination)
        $publicPath = "/music/library/covers/$coverName"
        foreach ($track in @($completedByDirectory[$group.Name])) {
            $trackId = "$(Get-PropertyValue $track 'id')"
            if ($coverBindings.ContainsKey($trackId)) { continue }
            Set-AssetBinding $trackId 'cover' $coverName
            $coverBindings[$trackId] = $publicPath
        }
    } else {
        $manualQueue.Add([pscustomobject]@{ kind = 'cover'; source = $relative; reason = 'copy-failed' })
    }
}

$lyricsMatchesByAsset = @{}
$lyricsAssetsByTrack = @{}
foreach ($asset in @($auxiliary | Where-Object { (Get-PropertyValue $_ 'kind') -eq 'lyrics' })) {
    $relative = "$(Get-PropertyValue $asset 'relativePath')"
    $directoryKey = (Split-Path -Parent $relative).ToLowerInvariant()
    $matches = @()
    if ($completedByDirectory.ContainsKey($directoryKey)) {
        $matches = @($completedByDirectory[$directoryKey] | Where-Object { Test-ExactLyricsTitleMatch $asset $_ })
    }
    $assetKey = $relative.ToLowerInvariant()
    $lyricsMatchesByAsset[$assetKey] = $matches
    foreach ($track in $matches) {
        $trackId = "$(Get-PropertyValue $track 'id')"
        if (-not $lyricsAssetsByTrack.ContainsKey($trackId)) {
            $lyricsAssetsByTrack[$trackId] = [Collections.Generic.List[object]]::new()
        }
        $lyricsAssetsByTrack[$trackId].Add($asset)
    }
}

foreach ($asset in $auxiliary) {
    $relative = "$(Get-PropertyValue $asset 'relativePath')"
    $relativeKey = $relative.ToLowerInvariant()
    if ($handledAuxiliary.ContainsKey($relativeKey)) { continue }
    $directory = Split-Path -Parent $relative
    $stem = [IO.Path]::GetFileNameWithoutExtension($relative)
    $stemKey = "$directory|$stem".ToLowerInvariant()
    $kind = "$(Get-PropertyValue $asset 'kind')"

    if ($kind -eq 'lyrics') {
        $matches = @($lyricsMatchesByAsset[$relativeKey])
        if ($matches.Count -eq 0) {
            $manualQueue.Add([pscustomobject]@{ kind = $kind; source = $relative; reason = 'no-normalized-title-match' })
            continue
        }
        $unambiguousMatches = @($matches | Where-Object {
            $trackId = "$(Get-PropertyValue $_ 'id')"
            $lyricsAssetsByTrack[$trackId].Count -eq 1
        })
        if ($unambiguousMatches.Count -eq 0) {
            $manualQueue.Add([pscustomobject]@{ kind = $kind; source = $relative; reason = 'multiple-normalized-title-assets' })
            continue
        }

        $assetHash = "$(Get-PropertyValue $asset 'contentSha256')"
        $extension = "$(Get-PropertyValue $asset 'extension')"
        $destination = Join-Path $script:LyricsDirectory "$assetHash$extension"
        if (Copy-AuxiliaryAtomic (Get-SourcePath $asset) $destination $assetHash) {
            $lyricsName = [IO.Path]::GetFileName($destination)
            $publicPath = "/music/library/lyrics/$lyricsName"
            foreach ($track in $unambiguousMatches) {
                $trackId = "$(Get-PropertyValue $track 'id')"
                Set-AssetBinding $trackId 'lyrics' $lyricsName
                $lyricsBindings[$trackId] = $publicPath
            }
            if ($unambiguousMatches.Count -ne $matches.Count) {
                $manualQueue.Add([pscustomobject]@{ kind = $kind; source = $relative; reason = 'partially-ambiguous-normalized-title-match' })
            }
        } else {
            $manualQueue.Add([pscustomobject]@{ kind = $kind; source = $relative; reason = 'copy-failed' })
        }
        continue
    }

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
    $assetHash = "$(Get-PropertyValue $asset 'contentSha256')"
    $destination = Join-Path $targetDirectory "$assetHash$extension"
    if (Copy-AuxiliaryAtomic $source $destination $assetHash) {
        $publicPath = "/music/library/$(if ($kind -eq 'cover') { 'covers' } else { 'lyrics' })/$([IO.Path]::GetFileName($destination))"
        Set-AssetBinding $trackId $kind ([IO.Path]::GetFileName($destination))
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
    $artist = Get-ConservativeArtist $record
    if ($null -eq $artist) { $artist = '' }
    $track = [ordered]@{
        id = $id
        title = $title
        artist = $artist
        duration = [Math]::Round([double] (Get-PropertyValue $record 'duration'), 3)
        src = "/music/library/tracks/$([IO.Path]::GetFileName((Get-TrackOutputPath $record)))"
    }
    $album = Get-NonEmptyString $record 'album'
    $category = Get-ConservativeCategory $record
    if ($null -ne $album) { $track['album'] = $album }
    $track['genre'] = $category.Id
    if ($coverBindings.ContainsKey($id)) { $track['cover'] = $coverBindings[$id] }
    if ($lyricsBindings.ContainsKey($id)) { $track['lyrics'] = $lyricsBindings[$id] }
    [pscustomobject] $track
})

Write-JsonAtomic (Join-Path $script:ResolvedOutputRoot 'manifest.v1.json') ([ordered]@{
    version = 1
    tracks = $tracks
})

$classificationTracks = @($completed | Sort-Object { "$(Get-PropertyValue $_ 'id')" } | ForEach-Object {
    $record = $_
    $id = "$(Get-PropertyValue $record 'id')"
    $category = Get-ConservativeCategory $record
    $needsReview = [Collections.Generic.List[string]]::new()
    $artist = Get-ConservativeArtist $record
    $album = Get-NonEmptyString $record 'album'
    $year = Get-PropertyValue $record 'year'
    $language = Get-NonEmptyString $record 'language'
    if ($null -eq $artist) { $needsReview.Add('artist'); $artist = '' }
    if ($null -eq $album) { $needsReview.Add('album') }
    if ($category.Id -eq 'unclassified') { $needsReview.Add('category') }
    if ($null -eq $year) { $needsReview.Add('year') }
    if ($null -eq $language) { $needsReview.Add('language') }
    $classification = [ordered]@{
        id = $id
        outputSha256 = "$(Get-PropertyValue $script:PreparedBindings[$id] 'outputSha256')"
        sourceType = $(if ((Get-PropertyValue $record 'extension') -in @('.mp4', '.mov', '.mkv')) { 'video' } else { 'audio' })
        artist = $artist
        categories = @($category.Id)
        categorySource = $category.Source
        needsReview = @($needsReview)
    }
    if ($null -ne $album) { $classification.album = $album }
    if ($null -ne $year) { $classification.year = [int] $year }
    if ($null -ne $language) { $classification.language = $language }
    $rawGenre = Get-NonEmptyString $record 'genre'
    if ($null -ne $rawGenre) { $classification.rawGenre = $rawGenre }
    [pscustomobject] $classification
})
$categorySummary = @($classificationTracks | ForEach-Object { $_.categories } | Group-Object | Sort-Object Name | ForEach-Object {
    [pscustomobject]@{ id = $_.Name; tracks = $_.Count }
})
Write-JsonAtomic $classificationPath ([ordered]@{
    version = 1
    taxonomy = @(
        [pscustomobject]@{ id = 'piano-classical'; labelZh = '钢琴与古典' }
        [pscustomobject]@{ id = 'jazz'; labelZh = '爵士' }
        [pscustomobject]@{ id = 'film-tv-soundtrack'; labelZh = '影视原声' }
        [pscustomobject]@{ id = 'electronic'; labelZh = '电子' }
        [pscustomobject]@{ id = 'pop-rock'; labelZh = '流行与摇滚' }
        [pscustomobject]@{ id = 'bgm-assets'; labelZh = 'BGM与素材' }
        [pscustomobject]@{ id = 'sound-effects'; labelZh = '音效' }
        [pscustomobject]@{ id = 'ambient-instrumental'; labelZh = '轻音乐与纯音乐' }
        [pscustomobject]@{ id = 'unclassified'; labelZh = '未分类' }
    )
    summary = $categorySummary
    tracks = $classificationTracks
})
Write-JsonAtomic $manualReviewPath ([ordered]@{
    version = 1
    items = @($manualQueue | Sort-Object kind, source)
})
Write-JsonAtomic $assetIndexPath ([ordered]@{
    version = 1
    tracks = @($script:AssetBindings.Values | Sort-Object id)
})

if (-not $Pilot) {
    $batchOutputs = @($batchRecords | ForEach-Object {
        $batchId = "$(Get-PropertyValue $_ 'id')"
        if ($script:PreparedBindings.ContainsKey($batchId)) {
            [pscustomobject]@{
                id = $batchId
                sha256 = "$(Get-PropertyValue $script:PreparedBindings[$batchId] 'outputSha256')"
                extension = "$(Get-PropertyValue $script:PreparedBindings[$batchId] 'extension')"
            }
        }
    })
    $batchTrackIds = @($batchRecords | ForEach-Object { "$(Get-PropertyValue $_ 'id')" })
    $batchInputBytes = [long] 0
    foreach ($record in $batchRecords) { $batchInputBytes += [long] (Get-PropertyValue $record 'bytes') }
    $batchOutputBytes = [long] 0
    foreach ($output in $batchOutputs) {
        $outputPath = Join-Path $script:TracksDirectory ("$(Get-PropertyValue $output 'sha256')$(Get-PropertyValue $output 'extension')")
        if (Test-Path -LiteralPath $outputPath -PathType Leaf) {
            $batchOutputBytes += (Get-Item -LiteralPath $outputPath).Length
        }
    }
    $batchActions = @($batchRecords | Group-Object action | Sort-Object Name | ForEach-Object {
        [pscustomobject]@{ action = $_.Name; tracks = $_.Count }
    })
    $batchReceipt = [ordered]@{
        version = 1
        mode = 'batch'
        verifiedBy = $(if ($ReplayLastBatch) { 'replay' } else { 'initial-run' })
        createdAtUtc = $batchCreatedAtUtc
        verifiedAtUtc = [DateTime]::UtcNow.ToString('O')
        trackIds = $batchTrackIds
        estimatedOutputBytes = $(if ($null -ne $lastBatch) { [long] (Get-PropertyValue $lastBatch 'estimatedOutputBytes') } else { $estimatedBytes })
        inputBytes = $batchInputBytes
        outputBytes = $batchOutputBytes
        freeBeforeBytes = $freeBytes
        freeAfterBytes = [long] (Get-PSDrive -Name $outputDriveName).Free
        reserveBytes = $reserveBytes
        concurrency = $Concurrency
        ffmpegThreadsPerProcess = 2
        actions = $batchActions
        outputs = $batchOutputs
    }
    Write-JsonAtomic $lastBatchPath $batchReceipt
    [IO.Directory]::CreateDirectory($batchHistoryDirectory) | Out-Null
    $batchKeyBytes = [Text.Encoding]::UTF8.GetBytes(($batchTrackIds -join "`n"))
    $batchKey = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($batchKeyBytes)).ToLowerInvariant()
    Write-JsonAtomic (Join-Path $batchHistoryDirectory "$batchKey.v1.json") $batchReceipt
}

$preparedCount = @($results | Where-Object status -eq 'prepared').Count
$skippedCount = @($results | Where-Object status -eq 'skipped').Count
$failedCount = @($results | Where-Object status -eq 'failed').Count
Write-Host "Result: prepared=$preparedCount; skipped=$skippedCount; failed=$failedCount; manifest tracks=$($tracks.Count); manual review=$($manualQueue.Count); exact duplicate sources=$exactDuplicateSourceCount."
if ($failedCount -gt 0) {
    $failureSummary = @($results | Where-Object status -eq 'failed' | Group-Object reason | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join '; '
    throw "Batch completed with failures: $failureSummary"
}
