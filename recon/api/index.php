<?php
/**
 * Recon API 后端
 * 功能：复盘数据的 CRUD（统一管理 CSV 迁移数据 + 社区提交）
 * 存储：MariaDB 数据库（recon_db）
 * 部署：阿里云 ECS，通过 rsync 同步 PHP 文件
 */

// NOTE: gzip 压缩——2.3MB JSON 压缩后约 300KB，大幅减少传输时间
ob_start('ob_gzhandler');

// NOTE: CORS 白名单——只允许已知域名跨域访问
$allowedOrigins = [
    'https://ruiminyan.github.io',
    'https://toolkit.cuberoot.me',
    'http://localhost:4000',
    'http://127.0.0.1:4000'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

// NOTE: 预检请求直接返回
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// ==================== 数据库连接 ====================

require_once __DIR__ . '/db.php';

// NOTE: 一次性自动迁移——新增 person_country 列
// 标记文件放在 data/ 目录（PHP 可写，且不被 rsync --delete 清除）
$migrationFlag = __DIR__ . '/data/.migration_person_country';
if (!file_exists($migrationFlag)) {
    try {
        $cols = getDb()->query("SHOW COLUMNS FROM recons LIKE 'person_country'")->fetchAll();
        if (empty($cols)) {
            getDb()->exec("ALTER TABLE recons ADD COLUMN person_country VARCHAR(10) DEFAULT NULL AFTER person_id");
        }
        @file_put_contents($migrationFlag, date('Y-m-d H:i:s'));
    } catch (Exception $e) {
        // NOTE: 权限不足等错误不应阻断正常 API 功能，静默跳过
        @error_log('Migration person_country failed: ' . $e->getMessage());
    }
}

// ==================== 速率限制（仍用文件，简单有效） ====================

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// ==================== 工具函数 ====================

/** 生成唯一字符串 ID（仅用于 edit_history 等内部记录） */
function genId(): string
{
    return uniqid('', true);
}

/** 获取 POST JSON body */
function getPostBody(): array
{
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

/** 简易速率限制（每 IP 每分钟 30 次写操作） */
function checkRateLimit(): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rateDir = __DIR__ . '/data/.rate';
    if (!is_dir($rateDir))
        mkdir($rateDir, 0755, true);

    $rateFile = $rateDir . '/' . md5($ip) . '.json';
    $now = time();
    $window = 60; // NOTE: 60 秒窗口
    $maxReqs = 30;

    $data = file_exists($rateFile) ? json_decode(file_get_contents($rateFile), true) : [];
    // NOTE: 清理过期记录
    $data = array_filter($data, fn($t) => $t > $now - $window);

    if (count($data) >= $maxReqs) {
        http_response_code(429);
        echo json_encode(['error' => 'Rate limit exceeded']);
        exit;
    }

    $data[] = $now;
    file_put_contents($rateFile, json_encode($data));
}

// ==================== 认证鉴权 ====================

// NOTE: 管理员 WCA ID 列表（后端硬编码，前端的仅控制 UI 显示）
$ADMIN_WCA_IDS = ['2017YANR02'];

/**
 * 验证 WCA access_token 并返回用户信息
 * NOTE: 带文件缓存（TTL 5 分钟），避免每次都调 WCA API
 * @return array|null 成功返回 ['wcaId' => '...', 'name' => '...']，失败返回 null
 */
function authenticateUser(): ?array
{
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        return null;
    }
    $token = $matches[1];

    // NOTE: 文件缓存——用 token 的 hash 作为文件名
    $cacheDir = __DIR__ . '/data/.token_cache';
    if (!is_dir($cacheDir))
        mkdir($cacheDir, 0755, true);
    $cacheFile = $cacheDir . '/' . md5($token) . '.json';
    $cacheTTL = 300; // 5 分钟

    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if ($cached && ($cached['_cachedAt'] ?? 0) > time() - $cacheTTL) {
            return $cached;
        }
    }

    // NOTE: 调用 WCA /me API 验证 token
    $ch = curl_init('https://www.worldcubeassociation.org/api/v0/me');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    $data = json_decode($response, true);
    $me = $data['me'] ?? null;
    if (!$me || empty($me['wca_id'])) {
        return null;
    }

    $user = [
        'wcaId' => $me['wca_id'],
        'name' => $me['name'] ?? '',
        '_cachedAt' => time(),
    ];

    // NOTE: 写入缓存
    file_put_contents($cacheFile, json_encode($user));

    return $user;
}

/** 要求登录，失败返回 401 并终止 */
function requireAuth(): array
{
    $user = authenticateUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    return $user;
}

/** 要求管理员权限，失败返回 403 并终止 */
function requireAdmin(): array
{
    global $ADMIN_WCA_IDS;
    $user = requireAuth();
    if (!in_array($user['wcaId'], $ADMIN_WCA_IDS)) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        exit;
    }
    return $user;
}

// ==================== 路由 ====================

$action = $_GET['action'] ?? '';
$db = getDb();

switch ($action) {

    // ==================== recons 集合 ====================

    case 'list':
        // NOTE: 不缓存——写操作后需要立即看到最新数据
        header('Cache-Control: no-cache, no-store, must-revalidate');
        $wcaId = $_GET['wcaId'] ?? '';

        if ($wcaId) {
            $stmt = $db->prepare("SELECT * FROM recons WHERE person_id = ? ORDER BY id DESC");
            $stmt->execute([$wcaId]);
        } else {
            $stmt = $db->query("SELECT * FROM recons ORDER BY id DESC");
        }

        $results = [];
        while ($row = $stmt->fetch()) {
            $results[] = rowToJson($row);
        }

        echo json_encode($results);
        break;

    case 'get':
        // NOTE: 单条查询——详情页专用，服务端合并编辑覆盖层
        $id = $_GET['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }
        $stmt = $db->prepare("SELECT * FROM recons WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            break;
        }
        $result = rowToJson($row);
        // NOTE: 合并编辑覆盖层（避免前端再调 edits 接口）
        $estmt = $db->prepare("SELECT fields FROM edits WHERE solve_id = ?");
        $estmt->execute([$id]);
        $edit = $estmt->fetch();
        if ($edit) {
            $fields = json_decode($edit['fields'], true);
            foreach ($fields as $k => $v) {
                if ($k[0] !== '_')
                    $result[$k] = $v;
            }
            $result['_edited'] = true;
        }
        echo json_encode($result);
        break;

    case 'add':
        // NOTE: 添加复盘（数据库 AUTO_INCREMENT 自动分配 ID）
        header('Cache-Control: no-cache, no-store, must-revalidate');
        checkRateLimit();
        $authUser = requireAuth();
        $body = getPostBody();
        // NOTE: 记录添加者身份（由服务端从 token 获取，不信任前端传值）
        $body['addedBy'] = $authUser['name'];
        $body['addedById'] = $authUser['wcaId'];
        $body['createdAt'] = time();

        // NOTE: 移除前端可能传入的 id（由数据库自增）
        unset($body['id']);

        $row = jsonToRow($body, true);
        // NOTE: 布尔值转换
        if (isset($row['official'])) {
            $row['official'] = $row['official'] ? 1 : 0;
        }
        // NOTE: 空字符串转 NULL
        foreach ($row as $k => $v) {
            if ($v === '')
                $row[$k] = null;
        }

        // NOTE: 校验字段类型/范围/长度（安全防线，防止非法输入导致 SQL 报错）
        $errors = validateRow($row);
        if (!empty($errors)) {
            http_response_code(400);
            echo json_encode(['error' => 'Validation failed', 'fields' => $errors]);
            break;
        }

        // NOTE: 反引号包裹列名（防止 date/round 等 SQL 保留字冲突）
        $cols = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
        $placeholders = implode(', ', array_fill(0, count($row), '?'));
        $stmt = $db->prepare("INSERT INTO recons ($cols) VALUES ($placeholders)");
        $stmt->execute(array_values($row));

        $body['id'] = (int) $db->lastInsertId();
        echo json_encode($body);
        break;

    case 'delete':
        // NOTE: 删除复盘（本人或管理员）
        header('Cache-Control: no-cache, no-store, must-revalidate');
        checkRateLimit();
        $authUser = requireAuth();
        $id = $_GET['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }

        // NOTE: 查找目标复盘，验证删除权限（基于添加者身份）
        $stmt = $db->prepare("SELECT added_by_id FROM recons WHERE id = ?");
        $stmt->execute([$id]);
        $targetRecon = $stmt->fetch();

        if (!$targetRecon) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            break;
        }

        // NOTE: 非管理员只能删自己的复盘
        if (!in_array($authUser['wcaId'], $ADMIN_WCA_IDS)) {
            if (($targetRecon['added_by_id'] ?? '') !== $authUser['wcaId']) {
                http_response_code(403);
                echo json_encode(['error' => 'Cannot delete others recon']);
                break;
            }
        }

        $stmt = $db->prepare("DELETE FROM recons WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['ok' => true]);
        break;

    case 'update':
        // NOTE: 更新复盘指定字段（本人或管理员）
        header('Cache-Control: no-cache, no-store, must-revalidate');
        checkRateLimit();
        $authUser = requireAuth();
        $id = $_GET['id'] ?? '';
        $body = getPostBody();
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }

        // NOTE: 先查记录是否存在（管理员和非管理员都需要确认记录存在）
        $checkStmt = $db->prepare("SELECT added_by_id FROM recons WHERE id = ?");
        $checkStmt->execute([$id]);
        $targetRecon = $checkStmt->fetch();
        if (!$targetRecon) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            break;
        }
        // NOTE: 非管理员只能更新自己的复盘（检查 added_by_id）
        if (!in_array($authUser['wcaId'], $ADMIN_WCA_IDS)) {
            if (($targetRecon['added_by_id'] ?? '') !== $authUser['wcaId']) {
                http_response_code(403);
                echo json_encode(['error' => 'Cannot edit others recon']);
                break;
            }
        }

        // NOTE: 通过白名单过滤可更新字段（防 SQL 注入）
        $row = jsonToRow($body, true);
        if (empty($row)) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields to update']);
            break;
        }

        // NOTE: 布尔值和空字符串转换
        if (isset($row['official'])) {
            $row['official'] = $row['official'] ? 1 : 0;
        }
        foreach ($row as $k => $v) {
            if ($v === '')
                $row[$k] = null;
        }

        // NOTE: 校验字段类型/范围/长度
        $errors = validateRow($row);
        if (!empty($errors)) {
            http_response_code(400);
            echo json_encode(['error' => 'Validation failed', 'fields' => $errors]);
            break;
        }

        // NOTE: 动态构建 UPDATE SET 子句（列名来自白名单 + 反引号包裹）
        $setParts = [];
        $values = [];
        foreach ($row as $col => $val) {
            $setParts[] = "`$col` = ?";
            $values[] = $val;
        }
        $values[] = $id;

        $sql = "UPDATE recons SET " . implode(', ', $setParts) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($values);
        // NOTE: 不用 rowCount() 判断——MySQL/MariaDB 在数据未变时 rowCount() 返回 0，
        // 会被误判为记录不存在。记录存在性已在上方 checkStmt 中确认。

        echo json_encode(['ok' => true]);
        break;

    // ==================== edits 集合 ====================

    case 'edits':
        // NOTE: 加载所有编辑覆盖——必须返回 {solveId: fields} 的 map 格式
        $stmt = $db->query("SELECT solve_id, fields FROM edits");
        $edits = new stdClass(); // NOTE: 空对象而非空数组，确保 JSON 输出 {} 而非 []
        while ($row = $stmt->fetch()) {
            $edits->{$row['solve_id']} = json_decode($row['fields'], true);
        }
        echo json_encode($edits);
        break;

    case 'saveEdit':
        // NOTE: 保存编辑覆盖（merge 模式，管理员专用）
        // 同时同步更新 recons 主表，使主表成为 source of truth
        checkRateLimit();
        requireAdmin();
        $body = getPostBody();
        $solveId = $body['solveId'] ?? '';
        $fields = $body['fields'] ?? [];
        if (!$solveId) {
            http_response_code(400);
            echo json_encode(['error' => 'solveId is required']);
            break;
        }

        $fields['_editedAt'] = time();
        $fieldsJson = json_encode($fields, JSON_UNESCAPED_UNICODE);

        // NOTE: 使用 JSON_MERGE_PATCH 实现字段级合并（MariaDB 10.5+ 原生支持）
        $stmt = $db->prepare(
            "INSERT INTO edits (solve_id, fields, edited_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE fields = JSON_MERGE_PATCH(fields, VALUES(fields)), edited_at = VALUES(edited_at)"
        );
        $stmt->execute([$solveId, $fieldsJson, time()]);

        // NOTE: 同步更新 recons 主表——只写非内部字段（过滤 _ 开头的元数据）
        $publicFields = [];
        foreach ($fields as $k => $v) {
            if ($k[0] !== '_') $publicFields[$k] = $v;
        }
        if (!empty($publicFields)) {
            $row = jsonToRow($publicFields, true);
            if (!empty($row)) {
                // NOTE: 布尔值和空字符串转换（与 update action 保持一致）
                if (isset($row['official'])) {
                    $row['official'] = $row['official'] ? 1 : 0;
                }
                foreach ($row as $k => $v) {
                    if ($v === '') $row[$k] = null;
                }
                $setParts = [];
                $values = [];
                foreach ($row as $col => $val) {
                    $setParts[] = "`$col` = ?";
                    $values[] = $val;
                }
                $values[] = $solveId;
                $sql = "UPDATE recons SET " . implode(', ', $setParts) . " WHERE id = ?";
                $updateStmt = $db->prepare($sql);
                $updateStmt->execute($values);
            }
        }

        echo json_encode(['ok' => true]);
        break;

    case 'deleteEdit':
        // NOTE: 删除编辑覆盖（管理员专用）
        checkRateLimit();
        requireAdmin();
        $id = $_GET['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }

        $stmt = $db->prepare("DELETE FROM edits WHERE solve_id = ?");
        $stmt->execute([$id]);

        echo json_encode(['ok' => true]);
        break;

    case 'wcaAttempts':
        // NOTE: 实时获取 WCA 比赛成绩——前端静态文件 miss 时 fallback 到此端点
        // 按需请求 WCA API 并缓存 7 天，实现提交复盘后立刻能看到同轮次 5 把成绩
        $compId = $_GET['compId'] ?? '';
        $personId = $_GET['personId'] ?? '';
        if (!$compId || !$personId) {
            http_response_code(400);
            echo json_encode(['error' => 'compId and personId are required']);
            break;
        }

        // NOTE: 文件缓存——每个比赛一个 JSON 文件，TTL 7 天
        $cacheDir = __DIR__ . '/data/.wca_cache';
        if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);
        $cacheFile = $cacheDir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $compId) . '.json';
        $cacheTTL = 7 * 86400;

        $compResults = null;
        if (file_exists($cacheFile) && filemtime($cacheFile) > time() - $cacheTTL) {
            // NOTE: 缓存命中——直接读文件
            $compResults = json_decode(file_get_contents($cacheFile), true);
        }

        if ($compResults === null) {
            // NOTE: 缓存 miss——调 WCA API 获取整个比赛的成绩
            $wcaUrl = 'https://www.worldcubeassociation.org/api/v0/competitions/'
                . urlencode($compId) . '/results';
            $ch = curl_init($wcaUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTPHEADER => ['User-Agent: CubeRoot-Recon/1.0'],
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200 || !$response) {
                http_response_code(502);
                echo json_encode(['error' => 'WCA API unavailable']);
                break;
            }

            // NOTE: 解析成按 wca_id 分组的结构，与静态文件格式对齐
            $rawResults = json_decode($response, true);
            $compResults = [];
            if (is_array($rawResults)) {
                foreach ($rawResults as $entry) {
                    $wcaId = $entry['wca_id'] ?? '';
                    $eventId = $entry['event_id'] ?? '';
                    $roundTypeId = $entry['round_type_id'] ?? '';
                    $attempts = $entry['attempts'] ?? [];
                    if (!$wcaId || !$eventId || !$roundTypeId || empty($attempts)) continue;

                    $key = $eventId . '_' . $roundTypeId;
                    $compResults[$wcaId][$key] = ['a' => $attempts];
                }
            }

            // NOTE: 写入缓存（含空结果，防止重复请求不存在的比赛）
            file_put_contents($cacheFile, json_encode($compResults, JSON_UNESCAPED_UNICODE));
        }

        // NOTE: 提取目标选手的数据
        $personData = $compResults[$personId] ?? null;
        if (!$personData) {
            echo json_encode(new stdClass()); // NOTE: 空对象 {}
            break;
        }

        header('Cache-Control: public, max-age=3600');
        echo json_encode($personData, JSON_UNESCAPED_UNICODE);
        break;

    // ==================== edit_history 集合 ====================

    case 'saveHistory':
        // NOTE: 记录编辑历史（管理员专用）
        checkRateLimit();
        requireAdmin();
        $body = getPostBody();
        $body['id'] = genId();
        $body['editedAt'] = time();

        $stmt = $db->prepare(
            "INSERT INTO edit_history (id, solve_id, before_snapshot, after_fields, edited_by, edited_at) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $body['id'],
            $body['solveId'] ?? '',
            isset($body['before']) ? json_encode($body['before'], JSON_UNESCAPED_UNICODE) : null,
            isset($body['after']) ? json_encode($body['after'], JSON_UNESCAPED_UNICODE) : null,
            $body['editedBy'] ?? '',
            $body['editedAt'],
        ]);

        echo json_encode(['ok' => true]);
        break;

    case 'getHistory':
        // NOTE: 获取指定 solve 的编辑历史（最多 20 条，按时间降序）
        $solveId = $_GET['id'] ?? '';
        $stmt = $db->prepare(
            "SELECT * FROM edit_history WHERE solve_id = ? ORDER BY edited_at DESC LIMIT 20"
        );
        $stmt->execute([$solveId]);

        $results = [];
        while ($row = $stmt->fetch()) {
            // NOTE: JSON 字段需要解码回对象
            $item = [
                'id' => $row['id'],
                'solveId' => $row['solve_id'],
                'before' => $row['before_snapshot'] ? json_decode($row['before_snapshot'], true) : null,
                'after' => $row['after_fields'] ? json_decode($row['after_fields'], true) : null,
                'editedBy' => $row['edited_by'],
                'editedAt' => (int) $row['edited_at'],
            ];
            $results[] = $item;
        }

        echo json_encode($results);
        break;

    case 'import':
        // NOTE: 批量导入（一次性迁移用，管理员专用）
        header('Cache-Control: no-cache, no-store, must-revalidate');
        checkRateLimit();
        requireAdmin();
        $body = getPostBody();
        $solves = $body['solves'] ?? [];
        if (empty($solves)) {
            http_response_code(400);
            echo json_encode(['error' => 'solves array is required']);
            break;
        }

        $db->beginTransaction();
        try {
            $maxId = 0;
            foreach ($solves as $s) {
                $row = jsonToRow($s, true);
                if (isset($row['official'])) {
                    $row['official'] = $row['official'] ? 1 : 0;
                }
                foreach ($row as $k => $v) {
                    if ($v === '')
                        $row[$k] = null;
                }

                // NOTE: 校验字段（import 中 throw 触发事务回滚）
                $errors = validateRow($row);
                if (!empty($errors)) {
                    throw new Exception('Validation failed for item: ' . implode('; ', $errors));
                }

                $cols = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
                $placeholders = implode(', ', array_fill(0, count($row), '?'));
                $stmt = $db->prepare("INSERT INTO recons ($cols) VALUES ($placeholders)");
                $stmt->execute(array_values($row));

                if (is_int($s['id'] ?? null) && $s['id'] > $maxId) {
                    $maxId = $s['id'];
                }
            }

            // NOTE: 更新 AUTO_INCREMENT 为 maxId + 1
            if ($maxId > 0) {
                $db->exec("ALTER TABLE recons AUTO_INCREMENT = " . ($maxId + 1));
            }

            $db->commit();
            echo json_encode(['ok' => true, 'imported' => count($solves), 'nextId' => $maxId + 1]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Import failed: ' . $e->getMessage()]);
        }
        break;

    // ==================== 已有选手列表（复盘数据库中有 WCA ID 的选手） ====================

    case 'listPersons':
        // NOTE: GROUP BY 而非 DISTINCT——同一选手可能有 NULL 和非 NULL 的 person_country，MAX() 优先取非 NULL
        $stmt = $db->query("SELECT person, person_id, MAX(person_country) AS person_country FROM recons WHERE person_id IS NOT NULL AND person IS NOT NULL GROUP BY person, person_id ORDER BY person");
        $persons = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($persons);
        break;


    // ==================== 选手搜索（代理 WCA API） ====================

    case 'searchSolvers':
        // NOTE: 公开只读端点，无需认证
        $q = trim($_GET['q'] ?? '');
        if (mb_strlen($q) < 2) {
            echo json_encode([]);
            break;
        }

        // NOTE: 文件缓存——同一 query 24h 内复用，避免频繁调 WCA API
        $cacheDir = __DIR__ . '/data/.solver_cache';
        if (!is_dir($cacheDir))
            mkdir($cacheDir, 0755, true);
        $cacheFile = $cacheDir . '/' . md5(mb_strtolower($q)) . '.json';
        $cacheTTL = 86400; // 24 小时

        if (file_exists($cacheFile) && filemtime($cacheFile) > time() - $cacheTTL) {
            // NOTE: 缓存命中，直接返回
            header('Cache-Control: public, max-age=3600');
            echo file_get_contents($cacheFile);
            break;
        }

        // NOTE: 调用 WCA 搜索 API
        $wcaUrl = 'https://www.worldcubeassociation.org/api/v0/search/users?'
            . http_build_query(['q' => $q, 'persons_table' => 'true']);
        $ch = curl_init($wcaUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            http_response_code(502);
            echo json_encode(['error' => 'WCA API unavailable']);
            break;
        }

        $data = json_decode($response, true);
        $wcaResults = $data['result'] ?? [];

        // NOTE: 精简返回字段——保留 name + iso2 + wcaId，用于前端富显示
        $results = [];
        foreach ($wcaResults as $person) {
            $results[] = [
                'name' => $person['name'] ?? '',
                'iso2' => strtolower($person['country_iso2'] ?? ''),
                'wcaId' => $person['wca_id'] ?? '',
            ];
        }

        $resultJson = json_encode($results, JSON_UNESCAPED_UNICODE);
        // NOTE: 只有非空结果才写入缓存——WCA API 偶尔超时/无结果，
        // 空结果不缓存可避免 24h 内持续返回"无匹配"
        if (!empty($results)) {
            file_put_contents($cacheFile, $resultJson);
        }

        header('Cache-Control: public, max-age=3600');
        echo $resultJson;
        break;

    // ==================== 临时迁移端点 ====================

    case 'extractSolution':
        // NOTE: 从 recon 列提取纯解法到 solution 列（管理员专用，一次性迁移）
        // 仅处理含 STM 统计行且 solution 为空的记录
        requireAdmin();
        $stmt = $db->query(
            "SELECT id, recon FROM recons WHERE recon REGEXP '^[0-9]+STM ' AND solution IS NULL"
        );
        $rows = $stmt->fetchAll();
        $updateStmt = $db->prepare("UPDATE recons SET solution = ? WHERE id = ?");

        $processed = 0;
        $samples = [];
        foreach ($rows as $row) {
            $lines = explode("\n", $row['recon']);
            // NOTE: 第 1 行是统计行（如 "26STM /3.69=7.05TPS"），第 2 行是打乱，第 3 行起是解法
            if (count($lines) >= 3) {
                $solution = implode("\n", array_slice($lines, 2));
                $updateStmt->execute([$solution, $row['id']]);
                $processed++;
                if (count($samples) < 3) {
                    $samples[] = [
                        'id' => (int) $row['id'],
                        'solutionPreview' => mb_substr($solution, 0, 80)
                    ];
                }
            }
        }

        echo json_encode([
            'ok' => true,
            'total' => count($rows),
            'processed' => $processed,
            'samples' => $samples
        ]);
        break;

    case 'extractScramble':
        // NOTE: 从 recon 第 2 行提取打乱覆盖写入 optimal_scramble（管理员专用，一次性迁移）
        // 仅处理 event='3x3' 且含 STM 统计行的记录
        requireAdmin();
        $stmt = $db->query(
            "SELECT id, recon FROM recons WHERE event = '3x3' AND recon REGEXP '^[0-9]+STM '"
        );
        $rows = $stmt->fetchAll();
        $updateStmt = $db->prepare("UPDATE recons SET optimal_scramble = ? WHERE id = ?");

        $processed = 0;
        $samples = [];
        foreach ($rows as $row) {
            $lines = explode("\n", $row['recon']);
            // NOTE: 第 1 行是统计行，第 2 行是打乱
            if (count($lines) >= 2) {
                $scramble = trim($lines[1]);
                if ($scramble !== '') {
                    $updateStmt->execute([$scramble, $row['id']]);
                    $processed++;
                    if (count($samples) < 3) {
                        $samples[] = [
                            'id' => (int) $row['id'],
                            'scramble' => $scramble
                        ];
                    }
                }
            }
        }

        echo json_encode([
            'ok' => true,
            'total' => count($rows),
            'processed' => $processed,
            'samples' => $samples
        ]);
        break;

    case 'backfillPersonCountry':
        // NOTE: 一次性迁移——回填 person_country（Expand-Contract 的 Backfill 步骤）
        requireAdmin();

        // Step 1: SQL 自回填——从同一 person_id 的其他记录中取已有的 country
        $selfFill = $db->exec(
            "UPDATE recons r1
             SET person_country = (
                 SELECT r2.person_country FROM recons r2
                 WHERE r2.person_id = r1.person_id
                   AND r2.person_country IS NOT NULL
                 LIMIT 1
             )
             WHERE r1.person_country IS NULL
               AND r1.person_id IS NOT NULL"
        );

        // Step 2: WCA API 补填——仍为 NULL 的 distinct person_id
        $stmt = $db->query(
            "SELECT DISTINCT person_id FROM recons
             WHERE person_country IS NULL AND person_id IS NOT NULL"
        );
        $missing = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $apiFixed = 0;
        $apiFailed = [];
        $updateStmt = $db->prepare(
            "UPDATE recons SET person_country = ? WHERE person_id = ?"
        );

        foreach ($missing as $wcaId) {
            // NOTE: 调用 WCA Persons API 获取国籍
            $ch = curl_init('https://www.worldcubeassociation.org/api/v0/persons/' . urlencode($wcaId));
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
            ]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && $resp) {
                $data = json_decode($resp, true);
                $iso2 = strtolower($data['person']['country_iso2'] ?? '');
                if ($iso2) {
                    $updateStmt->execute([$iso2, $wcaId]);
                    $apiFixed++;
                } else {
                    $apiFailed[] = $wcaId;
                }
            } else {
                $apiFailed[] = $wcaId;
            }
        }

        echo json_encode([
            'ok' => true,
            'selfFilled' => $selfFill,
            'apiQueried' => count($missing),
            'apiFixed' => $apiFixed,
            'apiFailed' => $apiFailed,
        ]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action: ' . $action]);
        break;
}
