# NOTE: WCA Stats 无人值守测试脚本
# 逐个运行所有统计，记录成功/失败/耗时，某个失败不影响其他
# 最终生成 report.txt 汇总

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# NOTE: 全局增加 Node.js heap limit（wr_dominance 等 result_attempts 查询需要 > 4GB）
$env:NODE_OPTIONS = '--max-old-space-size=8192'

$statsDir = "d:\cube\ruiminyan.github.io\trainer\packages\stats-build"
$reportFile = Join-Path $statsDir "test_report.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# NOTE: 测试列表——从 REGISTRY 实际输出中提取的真实键名
$stats = @(
  # 阶段 A — 纯 SQL 统计
  'best_medal_collection_from_abroad_by_country',
  'best_medal_collection_from_abroad_by_person',
  'complete_competition_winners',
  'current_world_records_by_country',
  'fewest_competitors_contest',
  'most_4th_places',
  'most_attended_competitions_in_single_month',
  'most_competitions_abroad',
  'most_delegated_competitions',
  'most_finals',
  'most_podiums_at_single_competition',
  'most_visited_continents',
  'most_visited_countries',
  'potentially_seen_world_records',
  'world_championship_podiums_by_country',
  'world_championship_podiums_by_person',
  'world_records_by_country',
  'world_records_by_person',
  'dnf_rate_by_event',
  'name_parts_count',
  'competitions_count_by_week',
  'average_event_count_by_competition',
  'best_potential_fmc_mean',
  'competitions_per_year_by_country',
  'competitions_per_year_by_person',
  'delegated_competition_per_year',
  'first_r_is_wr',
  'longest_competitions_path',
  'longest_streak_of_competitions_in_own_country',
  'longest_streak_of_personal_records',
  'longest_streak_of_podiums',
  'longest_streak_of_world_records',
  'longest_time_to_sub_10',
  'most_attended_competitions_in_single_week',
  'most_distinct_dates_competed_on',
  'shortest_time_to_get_all_singles',
  'shortest_time_to_get_all_singles_and_averages',
  'wr_current',
  # 阶段 B — transform 统计
  'most_completed_solves',
  'worst_result_on_podium',
  'best_result_off_podium',
  'best_round',
  'competition_days_count_by_region',
  'longest_standing_records',
  'most_competitions_before_winning',
  'most_frequent_results',
  'most_podiums_together',
  'most_records_at_single_competition',
  'most_solves_before_bld_success',
  'moving_average',
  'records_in_most_events',
  'shortest_time_to_reach_milestone_in_comps_count',
  'smallest_diff_between_single_and_average',
  'winned_week_count',
  'world_championship_records',
  # 阶段 C — RoundMetric / AoRounds / AverageOfX
  'wr_bao5',
  'wr_wao5',
  'wr_mo5',
  'wr_bpa',
  'wr_wpa',
  'wr_median',
  'wr_variance',
  'wr_best_counting',
  'wr_worst_counting',
  'wr_worst',
  'wr_best_average_ratio',
  'wr_single_history',
  'wr_average_history',
  'wr_ao1r',
  'wr_ao2r',
  'wr_ao3r',
  'wr_ao4r',
  'average_of_3',
  'average_of_5',
  'average_of_12',
  'average_of_25',
  'average_of_50',
  'average_of_100',
  'average_of_1000',
  # 阶段 D — 新增统计
  'consecutive_sub_5_average',
  'mbf_average',
  'yearly_rankings',
  'wr_non_pr',
  'wr_dominance',
  'wr_newcomer',
  # 阶段 D-4 — 聚合页面（最慢，放最后）
  'wr_metric',
  'wr_aoxr',
  'average_of'
)

$total = $stats.Count
$pass = 0
$fail = 0
$results = @()

# NOTE: 写入报告头
$header = @"
========================================
WCA Stats Build Test Report
Started: $timestamp
Total: $total
========================================

"@
Set-Content -Path $reportFile -Value $header -Encoding UTF8

Write-Host "`n=== WCA Stats Test Runner ===" -ForegroundColor Cyan
Write-Host "Total: $total stats to test"
Write-Host "Report: $reportFile`n"

for ($i = 0; $i -lt $total; $i++)
{
  $stat = $stats[$i]
  $idx = $i + 1
  $pct = [math]::Round($idx / $total * 100)

  Write-Host "[$idx/$total] ($pct%) $stat ... " -NoNewline

  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  try
  {
    # NOTE: 用 Start-Process pwsh 隔离进程，防止一个崩溃影响整体
    # Windows 上 npx 是 .cmd 脚本，不能直接作为 Start-Process 的 FilePath
    # NOTE: 全局传递 NODE_OPTIONS 到子进程（wr_dominance 等需要 > 4GB heap）
    $cmd = "`$env:NODE_OPTIONS='--max-old-space-size=8192'; Set-Location -LiteralPath '$statsDir'; npx tsx src/bin/compute.ts $stat"
    $proc = Start-Process -FilePath "pwsh" `
      -ArgumentList "-NoProfile", "-Command", $cmd `
      -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput (Join-Path $env:TEMP "stats_out_$stat.txt") `
      -RedirectStandardError  (Join-Path $env:TEMP "stats_err_$stat.txt")

    $sw.Stop()
    $duration = $sw.Elapsed.TotalSeconds.ToString("F1")

    if ($proc.ExitCode -eq 0)
    {
      Write-Host "PASS (${duration}s)" -ForegroundColor Green
      $pass++
      $line = "[PASS] $stat (${duration}s)"
    }
    else
    {
      $errFile = Join-Path $env:TEMP "stats_err_$stat.txt"
      $outFile = Join-Path $env:TEMP "stats_out_$stat.txt"
      $errContent = if (Test-Path $errFile) { (Get-Content $errFile -Raw -ErrorAction SilentlyContinue) } else { '' }
      $outContent = if (Test-Path $outFile) { (Get-Content $outFile -Raw -ErrorAction SilentlyContinue) } else { '' }
      Write-Host "FAIL (${duration}s)" -ForegroundColor Red
      # NOTE: 打印最后 5 行 stderr + stdout，方便定位错误
      if ($errContent)
      {
        $lastLines = ($errContent -split "`n" | Select-Object -Last 5) -join "`n"
        Write-Host "    stderr: $lastLines" -ForegroundColor DarkRed
      }
      if ($outContent -and $outContent -match 'Error|错误')
      {
        $lastLines = ($outContent -split "`n" | Select-Object -Last 3) -join "`n"
        Write-Host "    stdout: $lastLines" -ForegroundColor DarkYellow
      }
      $fail++
      $errSnippet = if ($errContent) { $errContent.Trim().Substring(0, [Math]::Min(500, $errContent.Trim().Length)) } else { 'no stderr' }
      $line = "[FAIL] $stat (${duration}s)`n  Error: $errSnippet"
    }
  }
  catch
  {
    $sw.Stop()
    $duration = $sw.Elapsed.TotalSeconds.ToString("F1")
    Write-Host "ERROR (${duration}s)" -ForegroundColor Red
    $fail++
    $line = "[ERROR] $stat (${duration}s)`n  Exception: $_"
  }

  $results += $line
  Add-Content -Path $reportFile -Value $line -Encoding UTF8
}

# NOTE: 写入汇总
$endTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$summary = @"

========================================
SUMMARY
Ended: $endTime
Pass: $pass / $total
Fail: $fail / $total
========================================
"@
Add-Content -Path $reportFile -Value $summary -Encoding UTF8

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Pass: $pass / $total" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Yellow' })
if ($fail -gt 0)
{
  Write-Host "Fail: $fail / $total" -ForegroundColor Red
  Write-Host "`nFailed stats:"
  $results | Where-Object { $_ -match '^\[FAIL\]|^\[ERROR\]' } | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
}
Write-Host "`nFull report: $reportFile"
