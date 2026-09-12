# 终端原地显示进度；输出到文件时每五分钟留一条。
$script:statsProgressTick = [datetime]::MinValue
function Write-Prog {
  param([string]$Text)
  if (-not [Console]::IsOutputRedirected) {
    Write-Progress -Id 1 -Activity '更新统计' -Status $Text
  } elseif (((Get-Date) - $script:statsProgressTick).TotalMinutes -ge 5) {
    Write-Host $Text
    $script:statsProgressTick = Get-Date
  }
}
function Write-ProgEnd {
  Write-Progress -Id 1 -Activity '更新统计' -Completed
  $script:statsProgressTick = [datetime]::MinValue
}

function Invoke-StatsAnalyzer {
  param([string]$Executable, [string]$InputText, [string]$LogPath, [string]$Label = '正在计算 SQ1')
  $writer = [IO.StreamWriter]::new($LogPath, $false, [Text.UTF8Encoding]::new($false))
  $writer.AutoFlush = $true
  $progressPath = $env:ANALYZER_PROGRESS_FILE
  $progressWriter = $null
  # 非零退出交给调用方处理，已完成的结果仍可保存。
  $PSNativeCommandUseErrorActionPreference = $false
  try {
    if ($progressPath) {
      $progressWriter = [IO.StreamWriter]::new($progressPath, $true, [Text.UTF8Encoding]::new($false))
      $progressWriter.AutoFlush = $true
      # 求解器设了进度文件就不发到屏幕；由这里接收并同时保存。
      $env:ANALYZER_PROGRESS_FILE = $null
    }
    Write-Prog "$Label，正在准备"
    $InputText | & $Executable 2>&1 | ForEach-Object {
      $line = "$_"
      $writer.WriteLine($line)
      if ($progressWriter -and $line -match '\[(PROG|DONE|STUCK|MONSTER)\]') { $progressWriter.WriteLine($line) }
      if ($line -match '\[PROG\]\s+(\d+)\s*/\s*(\d+)') {
        Write-Prog "$Label $($Matches[1])/$($Matches[2])"
      }
    }
    return $LASTEXITCODE
  } finally {
    $env:ANALYZER_PROGRESS_FILE = $progressPath
    if ($progressWriter) { $progressWriter.Dispose() }
    $writer.Dispose()
    Write-ProgEnd
  }
}
