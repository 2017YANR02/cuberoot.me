<?php
/**
 * Recon API 后端
 * 功能：社区复盘的 CRUD，替代 Firebase Firestore
 * 存储：JSON 文件（data/ 目录）
 * 部署：阿里云 ECS，通过 rsync 同步 PHP 文件，data/ 目录由 rsync 排除
 */

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
    header('Access-Control-Allow-Headers: Content-Type');
}

// NOTE: 预检请求直接返回
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// ==================== 数据目录 ====================

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$reconsFile = $dataDir . '/recons.json';
$editsFile = $dataDir . '/edits.json';
$historyFile = $dataDir . '/history.json';

// ==================== 工具函数 ====================

/** 读取 JSON 文件（文件不存在则返回空数组/对象） */
function readJson(string $path, bool $assoc = true)
{
    if (!file_exists($path))
        return $assoc ? [] : new stdClass();
    $content = file_get_contents($path);
    return json_decode($content, $assoc) ?: ($assoc ? [] : new stdClass());
}

/** 写入 JSON 文件（带文件锁防并发冲突） */
function writeJson(string $path, $data): void
{
    $fp = fopen($path, 'c');
    if (!$fp) {
        http_response_code(500);
        echo json_encode(['error' => 'Cannot open file']);
        exit;
    }
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

/** 生成唯一 ID */
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

// ==================== 路由 ====================

$action = $_GET['action'] ?? '';

switch ($action) {

    // ==================== recons 集合 ====================

    case 'list':
        // NOTE: 加载全部社区复盘（按创建时间降序）
        $wcaId = $_GET['wcaId'] ?? '';
        $recons = readJson($reconsFile);

        if ($wcaId) {
            $recons = array_values(array_filter($recons, fn($r) => ($r['wcaId'] ?? '') === $wcaId));
        }

        // NOTE: 按创建时间降序排列
        usort($recons, fn($a, $b) => ($b['createdAt'] ?? 0) <=> ($a['createdAt'] ?? 0));

        // NOTE: 标记为社区复盘
        foreach ($recons as &$r) {
            $r['_community'] = true;
        }

        echo json_encode($recons);
        break;

    case 'add':
        // NOTE: 添加社区复盘
        checkRateLimit();
        $body = getPostBody();
        if (empty($body['wcaId'])) {
            http_response_code(400);
            echo json_encode(['error' => 'wcaId is required']);
            break;
        }

        $body['id'] = genId();
        $body['createdAt'] = time();

        $recons = readJson($reconsFile);
        array_unshift($recons, $body);
        writeJson($reconsFile, $recons);

        echo json_encode($body);
        break;

    case 'delete':
        // NOTE: 删除社区复盘
        checkRateLimit();
        $id = $_GET['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }

        $recons = readJson($reconsFile);
        $recons = array_values(array_filter($recons, fn($r) => ($r['id'] ?? '') !== $id));
        writeJson($reconsFile, $recons);

        echo json_encode(['ok' => true]);
        break;

    case 'update':
        // NOTE: 更新社区复盘指定字段
        checkRateLimit();
        $id = $_GET['id'] ?? '';
        $body = getPostBody();
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }

        $recons = readJson($reconsFile);
        $found = false;
        foreach ($recons as &$r) {
            if (($r['id'] ?? '') === $id) {
                foreach ($body as $k => $v) {
                    $r[$k] = $v;
                }
                $found = true;
                break;
            }
        }

        if (!$found) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            break;
        }

        writeJson($reconsFile, $recons);
        echo json_encode(['ok' => true]);
        break;

    // ==================== edits 集合 ====================

    case 'edits':
        // NOTE: 加载所有编辑覆盖
        $edits = readJson($editsFile);
        echo json_encode($edits);
        break;

    case 'saveEdit':
        // NOTE: 保存编辑覆盖（merge 模式）
        checkRateLimit();
        $body = getPostBody();
        $solveId = $body['solveId'] ?? '';
        $fields = $body['fields'] ?? [];
        if (!$solveId) {
            http_response_code(400);
            echo json_encode(['error' => 'solveId is required']);
            break;
        }

        $fields['_editedAt'] = time();

        $edits = readJson($editsFile);
        // NOTE: merge 模式——已有则合并，没有则新建
        if (isset($edits[$solveId])) {
            $edits[$solveId] = array_merge($edits[$solveId], $fields);
        } else {
            $edits[$solveId] = $fields;
        }
        writeJson($editsFile, $edits);

        echo json_encode(['ok' => true]);
        break;

    case 'deleteEdit':
        // NOTE: 删除编辑覆盖
        checkRateLimit();
        $id = $_GET['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            break;
        }

        $edits = readJson($editsFile);
        unset($edits[$id]);
        writeJson($editsFile, $edits);

        echo json_encode(['ok' => true]);
        break;

    // ==================== edit_history 集合 ====================

    case 'saveHistory':
        // NOTE: 记录编辑历史
        checkRateLimit();
        $body = getPostBody();
        $body['id'] = genId();
        $body['editedAt'] = time();

        $history = readJson($historyFile);
        array_unshift($history, $body);
        writeJson($historyFile, $history);

        echo json_encode(['ok' => true]);
        break;

    case 'getHistory':
        // NOTE: 获取指定 solve 的编辑历史（最多 20 条，按时间降序）
        $solveId = $_GET['id'] ?? '';
        $history = readJson($historyFile);

        $filtered = array_filter($history, fn($h) => ($h['solveId'] ?? '') === (string) $solveId);
        // NOTE: 按时间降序
        usort($filtered, fn($a, $b) => ($b['editedAt'] ?? 0) <=> ($a['editedAt'] ?? 0));
        $filtered = array_slice(array_values($filtered), 0, 20);

        echo json_encode($filtered);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action: ' . $action]);
        break;
}
