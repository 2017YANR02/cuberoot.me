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
        // NOTE: 强制用服务端验证的 wcaId 写入 person_id，防止前端伪造
        $body['personId'] = $authUser['wcaId'];
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

        // NOTE: 查找目标复盘，验证删除权限
        $stmt = $db->prepare("SELECT person_id FROM recons WHERE id = ?");
        $stmt->execute([$id]);
        $targetRecon = $stmt->fetch();

        if (!$targetRecon) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            break;
        }

        // NOTE: 非管理员只能删自己的复盘
        if (!in_array($authUser['wcaId'], $ADMIN_WCA_IDS)) {
            if (($targetRecon['person_id'] ?? '') !== $authUser['wcaId']) {
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
        // NOTE: 更新复盘指定字段（管理员专用）
        header('Cache-Control: no-cache, no-store, must-revalidate');
        checkRateLimit();
        requireAdmin();
        $id = $_GET['id'] ?? '';
        $body = getPostBody();
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
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

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            break;
        }

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
        $stmt = $db->query("SELECT DISTINCT person, person_id FROM recons WHERE person_id IS NOT NULL AND person IS NOT NULL ORDER BY person");
        $persons = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($persons);
        break;

    // ==================== 临时迁移端点（完成后删除） ====================

    // ==================== 临时：查询缺 person_id 的选手 ====================
    case 'missingPersonIds':
        header('Cache-Control: no-cache');
        $stmt = $db->query("SELECT DISTINCT person FROM recons WHERE (person_id IS NULL OR person_id = '') AND person IS NOT NULL AND person != '' ORDER BY person");
        echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN));
        break;

    // ==================== 临时：批量更新 person_id ====================
    case 'fillPersonIds':
        header('Cache-Control: no-cache');
        requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true);
        // NOTE: 输入格式 [{ "person": "Name", "personId": "2019XXXX01" }, ...]
        if (!is_array($input)) {
            http_response_code(400);
            echo '{"error":"array expected"}';
            break;
        }
        $stmt = $db->prepare("UPDATE recons SET person_id = :pid WHERE person = :name AND (person_id IS NULL OR person_id = '')");
        $results = [];
        foreach ($input as $item) {
            $stmt->execute([':pid' => $item['personId'], ':name' => $item['person']]);
            $results[] = ['person' => $item['person'], 'personId' => $item['personId'], 'rows' => $stmt->rowCount()];
        }
        echo json_encode($results);
        break;

    // ==================== 临时：重命名选手 ====================
    case 'renamePerson':
        header('Cache-Control: no-cache');
        requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true);
        // NOTE: 输入格式 { "oldName": "耿暄一", "newName": "Xuanyi Geng (耿暄一)", "personId": "2023GENG02" }
        $stmt = $db->prepare("UPDATE recons SET person = :newName, person_id = :pid WHERE person = :oldName");
        $stmt->execute([':newName' => $input['newName'], ':pid' => $input['personId'], ':oldName' => $input['oldName']]);
        echo json_encode(['oldName' => $input['oldName'], 'newName' => $input['newName'], 'rows' => $stmt->rowCount()]);
        break;

    // ==================== 临时：批量重命名比赛（全称 → 简称） ====================
    case 'renameComps':
        header('Cache-Control: no-cache, no-store, must-revalidate');
        requireAdmin();
        // NOTE: WCA name → cell_name 映射（21 条 name ≠ cell_name 的 recon 记录）
        $renames = [
            'Bali Discovery Speedcubing Masters 2024' => 'Bali Discovery Masters 2024',
            "Bay Area Speedcubin' 63 - Atherton 2024" => "Bay Area Speedcubin' 63 2024",
            'Cube4fun in Warsaw 2022' => 'Cube4fun Warsaw 2022',
            'Cubing on the Plains at Auburn 2025' => 'Cubing on the Plains Auburn 2025',
            "Rubik's x TheCubicle CubingUSA All-Stars 2025" => 'CubingUSA All-Stars 2025',
            'CubingUSA Western Championship 2021' => 'Western Championship 2021',
            'CubingUSA Western Championship 2023' => 'Western Championship 2023',
            "Rubik's WCA European Championship 2022" => 'WCA European Championship 2022',
            "Gdańska Liga Speedcubingu III 2025" => 'GLS III 2025',
            'CubingUSA Great Lakes Championship 2023' => 'Great Lakes Championship 2023',
            "Honolulu Li\xCA\xBBili\xCA\xBBi a \xCA\xBBIke Maka 2024" => "Honolulu Li\xCA\xBBili\xCA\xBBi 2024",
            'Liberty Science Center Open B 2025' => 'Liberty Science Center B 2025',
            'CubingUSA New Jersey Championship 2018' => 'New Jersey Championship 2018',
            'CubingUSA Northwest Championship 2024' => 'Northwest Championship 2024',
            'NZ South Island Championship 2023' => 'NZ South Island Champs 2023',
            "Rubik's WCA Asian Championship 2024" => 'WCA Asian Championship 2024',
            'CubingUSA Southeast Championship 2025' => 'Southeast Championship 2025',
            'University Heights Cubing Winter 2024' => 'Uni Heights Cubing Winter 2024',
            "Rubik's WCA World Championship 2023" => 'WCA World Championship 2023',
            "Rubik's WCA World Championship 2025" => 'WCA World Championship 2025',
            'Yong Jun KL Speedcubing 2023' => 'YJ KL 2023',
        ];
        $stmt = $db->prepare("UPDATE recons SET comp = ? WHERE comp = ?");
        $results = [];
        foreach ($renames as $old => $new) {
            $stmt->execute([$new, $old]);
            $results[] = ['old' => $old, 'new' => $new, 'rows' => $stmt->rowCount()];
        }
        // NOTE: edits 表也可能有 comp 字段的覆盖，需同步更新
        $estmt = $db->prepare("SELECT solve_id, fields FROM edits WHERE fields LIKE ?");
        $ustmt = $db->prepare("UPDATE edits SET fields = ? WHERE solve_id = ?");
        foreach ($renames as $old => $new) {
            $estmt->execute(['%' . $old . '%']);
            while ($row = $estmt->fetch()) {
                $fields = json_decode($row['fields'], true);
                if (isset($fields['comp']) && $fields['comp'] === $old) {
                    $fields['comp'] = $new;
                    $ustmt->execute([json_encode($fields, JSON_UNESCAPED_UNICODE), $row['solve_id']]);
                }
            }
        }
        echo json_encode(['ok' => true, 'results' => $results]);
        break;

    case 'renameColumns2':
        header('Cache-Control: no-cache, no-store, must-revalidate');
        requireAdmin();

        $sqls = [
            'ALTER TABLE recons RENAME COLUMN solver TO person',
            'ALTER TABLE recons DROP COLUMN solver_zh',
            'ALTER TABLE recons RENAME COLUMN avg TO average',
            'ALTER TABLE recons DROP INDEX idx_solver',
            'ALTER TABLE recons ADD INDEX idx_person (person)',
            'ALTER TABLE recons RENAME COLUMN scramble TO optimal_scramble',
        ];
        $results = [];
        foreach ($sqls as $sql) {
            try {
                $db->exec($sql);
                $results[] = ['sql' => $sql, 'ok' => true];
            } catch (Exception $e) {
                $results[] = ['sql' => $sql, 'ok' => false, 'error' => $e->getMessage()];
            }
        }
        echo json_encode(['ok' => true, 'results' => $results]);
        break;

    // NOTE: 临时迁移——average 列精度从 DECIMAL(8,3) 降为 DECIMAL(8,2)
    case 'modifyAvgPrecision':
        header('Cache-Control: no-cache, no-store, must-revalidate');
        requireAdmin();
        try {
            $db->exec('ALTER TABLE recons MODIFY COLUMN average DECIMAL(8,2) DEFAULT NULL');
            echo json_encode(['ok' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
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

        // NOTE: 精简返回字段——只保留 name + iso2，减小响应体
        $results = [];
        foreach ($wcaResults as $person) {
            $results[] = [
                'name' => $person['name'] ?? '',
                'iso2' => strtolower($person['country_iso2'] ?? ''),
            ];
        }

        $resultJson = json_encode($results, JSON_UNESCAPED_UNICODE);
        // NOTE: 写入缓存文件
        file_put_contents($cacheFile, $resultJson);

        header('Cache-Control: public, max-age=3600');
        echo $resultJson;
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action: ' . $action]);
        break;
}
