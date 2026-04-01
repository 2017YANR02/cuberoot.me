<?php
/**
 * Recon 数据迁移脚本：JSON 文件 → MariaDB
 * 用法：在 ECS 终端执行 `php migrate_json_to_db.php`
 * NOTE: 仅限 CLI 执行，防止通过 web 意外触发
 */

// NOTE: 安全保护——只允许命令行执行
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only']);
    exit;
}

require_once __DIR__ . '/db.php';

echo "========================================\n";
echo "  Recon 数据迁移：JSON → MariaDB\n";
echo "========================================\n\n";

$dataDir = __DIR__ . '/data';

// ==================== Step 1: 建表 ====================

echo "[Step 1] 创建数据库表...\n";
$db = getDb();

// NOTE: 分别执行每条 CREATE TABLE 语句（PDO 不支持多语句）
$sqlStatements = explode(";\n", getCreateTablesSql());
foreach ($sqlStatements as $sql) {
    $sql = trim($sql);
    if (!empty($sql)) {
        $db->exec($sql);
    }
}
echo "  ✓ 表 recons, edits, edit_history 创建成功\n\n";

// ==================== Step 2: 迁移 recons ====================

echo "[Step 2] 迁移 recons 数据...\n";
$reconsFile = $dataDir . '/recons.json';
if (!file_exists($reconsFile)) {
    echo "  ✗ 文件不存在: $reconsFile\n";
    exit(1);
}

$recons = json_decode(file_get_contents($reconsFile), true);
if (!is_array($recons)) {
    echo "  ✗ JSON 解析失败\n";
    exit(1);
}

echo "  JSON 中共 " . count($recons) . " 条记录\n";

// NOTE: 获取 recons 表所有列名和类型，用于过滤有效字段和类型转换
$columns = [];
$columnTypes = [];
$stmt = $db->query("SHOW COLUMNS FROM recons");
while ($row = $stmt->fetch()) {
    $columns[] = $row['Field'];
    $columnTypes[$row['Field']] = $row['Type'];
}

// NOTE: 清理上次失败残留的数据（支持重复运行）
$existingCount = $db->query("SELECT COUNT(*) FROM recons")->fetchColumn();
if ((int) $existingCount > 0) {
    echo "  ⚠ 检测到已有 $existingCount 条数据，清理后重新导入...\n";
    $db->exec("TRUNCATE TABLE recons");
}

$inserted = 0;
$skipped = 0;
$db->beginTransaction();

try {
    foreach ($recons as $recon) {
        // NOTE: JSON → SQL 列名转换
        $row = [];
        foreach ($recon as $key => $val) {
            $col = FIELD_MAP_JSON_TO_SQL[$key] ?? $key;
            // NOTE: 只插入表中实际存在的列
            if (in_array($col, $columns)) {
                // NOTE: 空字符串转 NULL——DATE/DECIMAL/TINYINT/SMALLINT 不接受空字符串
                if ($val === '' || $val === null) {
                    $row[$col] = null;
                } else {
                    $row[$col] = $val;
                }
            }
        }

        if (empty($row)) {
            $skipped++;
            continue;
        }

        // NOTE: 布尔值转换
        if (isset($row['official'])) {
            $row['official'] = $row['official'] ? 1 : 0;
        }

        $cols = implode(', ', array_keys($row));
        $placeholders = implode(', ', array_fill(0, count($row), '?'));
        $sql = "INSERT INTO recons ($cols) VALUES ($placeholders)";
        $db->prepare($sql)->execute(array_values($row));
        $inserted++;
    }

    $db->commit();
    echo "  ✓ 插入 $inserted 条，跳过 $skipped 条\n";

    // NOTE: 重置 AUTO_INCREMENT 为 MAX(id) + 1
    $maxId = $db->query("SELECT MAX(id) FROM recons")->fetchColumn();
    if ($maxId) {
        $nextId = $maxId + 1;
        $db->exec("ALTER TABLE recons AUTO_INCREMENT = $nextId");
        echo "  ✓ AUTO_INCREMENT 设置为 $nextId\n";
    }
} catch (Exception $e) {
    $db->rollBack();
    echo "  ✗ 迁移失败: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n";

// ==================== Step 3: 迁移 edits ====================

echo "[Step 3] 迁移 edits 数据...\n";
$editsFile = $dataDir . '/edits.json';
if (file_exists($editsFile)) {
    $edits = json_decode(file_get_contents($editsFile), true);
    if (is_array($edits) && !empty($edits)) {
        $editCount = 0;
        $stmt = $db->prepare("INSERT INTO edits (solve_id, fields, edited_at) VALUES (?, ?, ?)");
        foreach ($edits as $solveId => $fields) {
            $editedAt = $fields['_editedAt'] ?? null;
            $stmt->execute([$solveId, json_encode($fields, JSON_UNESCAPED_UNICODE), $editedAt]);
            $editCount++;
        }
        echo "  ✓ 插入 $editCount 条编辑覆盖\n";
    } else {
        echo "  ✓ 无编辑数据（空 JSON 或为空对象）\n";
    }
} else {
    echo "  ✓ edits.json 不存在，跳过\n";
}

echo "\n";

// ==================== Step 4: 迁移 edit_history ====================

echo "[Step 4] 迁移 edit_history 数据...\n";
$historyFile = $dataDir . '/history.json';
if (file_exists($historyFile)) {
    $history = json_decode(file_get_contents($historyFile), true);
    if (is_array($history) && !empty($history)) {
        $histCount = 0;
        $stmt = $db->prepare(
            "INSERT INTO edit_history (id, solve_id, before_snapshot, after_fields, edited_by, edited_at) VALUES (?, ?, ?, ?, ?, ?)"
        );
        foreach ($history as $h) {
            $stmt->execute([
                $h['id'] ?? uniqid('', true),
                $h['solveId'] ?? '',
                isset($h['before']) ? json_encode($h['before'], JSON_UNESCAPED_UNICODE) : null,
                isset($h['after']) ? json_encode($h['after'], JSON_UNESCAPED_UNICODE) : null,
                $h['editedBy'] ?? null,
                $h['editedAt'] ?? null,
            ]);
            $histCount++;
        }
        echo "  ✓ 插入 $histCount 条编辑历史\n";
    } else {
        echo "  ✓ 无编辑历史数据\n";
    }
} else {
    echo "  ✓ history.json 不存在，跳过\n";
}

echo "\n";

// ==================== Step 5: 验证 ====================

echo "[Step 5] 验证数据完整性...\n";
$dbCount = $db->query("SELECT COUNT(*) FROM recons")->fetchColumn();
$jsonCount = count($recons);
echo "  JSON:  $jsonCount 条\n";
echo "  MySQL: $dbCount 条\n";

if ((int) $dbCount === $jsonCount) {
    echo "  ✓ 数据条数一致，迁移成功！\n";
} else {
    echo "  ✗ 数据条数不一致！请检查\n";
    exit(1);
}

// NOTE: 抽查第一条和最后一条记录
$first = $db->query("SELECT id, solver, single FROM recons ORDER BY id ASC LIMIT 1")->fetch();
$last = $db->query("SELECT id, solver, single FROM recons ORDER BY id DESC LIMIT 1")->fetch();
echo "  抽查: 最早 id={$first['id']} solver={$first['solver']} single={$first['single']}\n";
echo "  抽查: 最新 id={$last['id']} solver={$last['solver']} single={$last['single']}\n";

echo "\n========================================\n";
echo "  迁移完成！JSON 文件已保留（未删除）\n";
echo "========================================\n";
