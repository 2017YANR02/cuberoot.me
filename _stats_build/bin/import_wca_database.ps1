# NOTE: WCA Developer Export 高效导入脚本
# 优化 InnoDB 参数 + 禁用 redo log + stdin 重定向导入 + 实时进度监控
# 用法: .\import_wca_database.ps1 [-DumpFile <path>]

param(
    [string]$DumpFile = "D:\cube\wca-developer-database\wca-developer-database-dump.sql"
)

# NOTE: 从 database.yml 读取连接凭据
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "..\database.yml"
$config = @{}
Get-Content $configPath | ForEach-Object {
    if ($_ -match '^\s*(\w+):\s*"?([^"#]+)"?\s*$') {
        $config[$Matches[1]] = $Matches[2].Trim()
    }
}
$user  = $config["username"]
$pass  = $config["password"]
$db    = $config["database"]
$host_ = $config["host"]
$mysqlArgs = @("-u", $user, "-p$pass", "-h", $host_, "--default-character-set=utf8mb4")

if (-not (Test-Path $DumpFile)) {
    Write-Host "Error: Dump file not found: $DumpFile" -ForegroundColor Red
    exit 1
}

# NOTE: 封装 MySQL 执行，失败时立即退出并恢复安全参数
function Invoke-Sql {
    param([string]$Sql, [string]$Step)
    mysql @mysqlArgs -e $Sql 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED at: $Step" -ForegroundColor Red
        Restore-Defaults
        exit 1
    }
}

function Restore-Defaults {
    Write-Host "Restoring MySQL defaults..." -ForegroundColor Cyan
    mysql @mysqlArgs -e @"
ALTER INSTANCE ENABLE INNODB REDO_LOG;
SET GLOBAL innodb_flush_log_at_trx_commit = 1;
SET GLOBAL innodb_buffer_pool_size = 134217728;
SET GLOBAL innodb_log_buffer_size = 16777216;
SET GLOBAL innodb_io_capacity = 200;
SET GLOBAL innodb_io_capacity_max = 2000;
"@ 2>$null
    Write-Host "  Done: redo log ON, buffer_pool=128MB, flush_log=1" -ForegroundColor Green
}

$fileSizeMB = [math]::Round((Get-Item $DumpFile).Length / 1MB, 0)
Write-Host "=== WCA Database Import ($fileSizeMB MB) ===" -ForegroundColor Cyan

# 1. 优化 MySQL 全局参数
# NOTE: 先确保 redo log 已启用，防止上次脚本中断后残留 DISABLED 状态
# （redo log 禁用时某些参数如 innodb_doublewrite 无法修改）
Write-Host "[1/5] Setting MySQL performance parameters..." -ForegroundColor Cyan
mysql @mysqlArgs -e "ALTER INSTANCE ENABLE INNODB REDO_LOG;" 2>$null
Invoke-Sql @"
SET GLOBAL innodb_flush_log_at_trx_commit = 0;
SET GLOBAL innodb_buffer_pool_size = 8589934592;
SET GLOBAL innodb_log_buffer_size = 268435456;
SET GLOBAL innodb_io_capacity = 10000;
SET GLOBAL innodb_io_capacity_max = 20000;
SET GLOBAL max_allowed_packet = 1073741824;
SET GLOBAL innodb_io_capacity_max = 20000;
SET GLOBAL max_allowed_packet = 1073741824;
"@ "Setting performance parameters"
Write-Host "  Done" -ForegroundColor Green

# 2. 禁用 redo log（MySQL 8.0.21+）
Write-Host "[2/5] Disabling InnoDB redo log..." -ForegroundColor Cyan
Invoke-Sql "ALTER INSTANCE DISABLE INNODB REDO_LOG;" "Disabling redo log"
Write-Host "  Done (crash during import = must re-import)" -ForegroundColor Yellow

# 3. 杀掉所有连接 + 重建数据库
# NOTE: DROP DATABASE 会被 metadata lock 阻塞，必须先杀掉所有使用该数据库的连接
Write-Host "[3/5] Killing existing connections & recreating database..." -ForegroundColor Cyan
$killSql = @"
SELECT GROUP_CONCAT('KILL ', id SEPARATOR '; ')
INTO @kills
FROM information_schema.processlist
WHERE db = '$db' AND id != CONNECTION_ID();
SET @kills = IFNULL(@kills, 'SELECT 1');
PREPARE stmt FROM @kills;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
DROP DATABASE IF EXISTS $db;
CREATE DATABASE $db;
"@
Invoke-Sql $killSql "Recreating database"
Write-Host "  Done" -ForegroundColor Green

# 4. 导入 + 进度监控
Write-Host "[4/5] Importing..." -ForegroundColor Cyan

# NOTE: WCA dump 文件自带 SET foreign_key_checks=0 等，无需额外 --init-command
# NOTE: 用 -RedirectStandardInput 替代 cmd /c <，纯 PowerShell 实现
$importArgs = @(
    "-u", $user, "-p$pass", "-h", $host_,
    "--default-character-set=utf8mb4",
    "--max-allowed-packet=1073741824",
    $db
)
$importProcess = Start-Process -FilePath "mysql" -ArgumentList $importArgs `
    -RedirectStandardInput $DumpFile -PassThru -NoNewWindow

$sw = [System.Diagnostics.Stopwatch]::StartNew()

while (-not $importProcess.HasExited) {
    Start-Sleep 5
    try {
        $info = mysql @mysqlArgs -N -e "SELECT COUNT(*), COALESCE(SUM(table_rows),0) FROM information_schema.tables WHERE table_schema='$db'" 2>$null
        if ($info) {
            $parts = $info.Trim() -split '\s+'
            $elapsed = $sw.Elapsed.ToString("mm\:ss")
            Write-Host "`r  [$elapsed] Tables: $($parts[0])  |  Rows: $($parts[1])      " -NoNewline -ForegroundColor Yellow
        }
    } catch {}
}
Write-Host ""

if ($importProcess.ExitCode -eq 0) {
    Write-Host "  Completed in $($sw.Elapsed.ToString('mm\:ss'))!" -ForegroundColor Green
} else {
    Write-Host "  FAILED with exit code $($importProcess.ExitCode)" -ForegroundColor Red
}

# 5. 恢复默认参数（无论成功失败都执行）
Write-Host "[5/5] Restoring MySQL defaults..." -ForegroundColor Cyan
Restore-Defaults

# 最终统计
$info = mysql @mysqlArgs -N -e "SELECT COUNT(*), COALESCE(SUM(table_rows),0) FROM information_schema.tables WHERE table_schema='$db'" 2>$null
if ($info) {
    $parts = $info.Trim() -split '\s+'
    Write-Host "`n=== Summary ===" -ForegroundColor Cyan
    Write-Host "  Tables: $($parts[0])  |  Total rows: $($parts[1])  |  Time: $($sw.Elapsed.ToString('mm\:ss'))" -ForegroundColor White
}
