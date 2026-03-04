<?php
/**
 * 数据库连接层
 * 功能：PDO 连接管理 + JSON↔SQL 字段名双向映射
 * NOTE: 所有数据库操作通过此模块统一访问
 */

/**
 * 获取 PDO 数据库连接（单例模式）
 * NOTE: 配置文件 db_config.php 不进 git，需在 ECS 上手动创建
 */
function getDb(): PDO
{
    static $pdo = null;
    if ($pdo)
        return $pdo;

    $config = require __DIR__ . '/db_config.php';
    $dsn = "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

// NOTE: JSON camelCase ↔ SQL snake_case 映射
// 只列出名称不同的字段，同名字段（如 id, event, method 等）无需映射
const FIELD_MAP_JSON_TO_SQL = [
    'solveNum' => 'solve_num',
    'solverZh' => 'solver_zh',
    'wcaId' => 'wca_id',
    'displaySingle' => 'display_single',
    'rSingle' => 'r_single',
    'rAvg' => 'r_avg',
    'aoType' => 'ao_type',
    'rAoXR' => 'r_ao_xr',
    'wcaScramble' => 'wca_scramble',
    'ollShort' => 'oll_short',
    'pllShort' => 'pll_short',
    'freePair' => 'free_pair',
    'yRot' => 'y_rot',
    'crossType' => 'cross_type',
    'crossStm' => 'cross_stm',
    'sMove' => 's_move',
    'crossColor' => 'cross_color',
    'createdAt' => 'created_at',
];

// NOTE: 反向映射（SQL → JSON），运行时自动生成
const FIELD_MAP_SQL_TO_JSON = [
    'solve_num' => 'solveNum',
    'solver_zh' => 'solverZh',
    'wca_id' => 'wcaId',
    'display_single' => 'displaySingle',
    'r_single' => 'rSingle',
    'r_avg' => 'rAvg',
    'ao_type' => 'aoType',
    'r_ao_xr' => 'rAoXR',
    'wca_scramble' => 'wcaScramble',
    'oll_short' => 'ollShort',
    'pll_short' => 'pllShort',
    'free_pair' => 'freePair',
    'y_rot' => 'yRot',
    'cross_type' => 'crossType',
    'cross_stm' => 'crossStm',
    's_move' => 'sMove',
    'cross_color' => 'crossColor',
    'created_at' => 'createdAt',
];

// NOTE: 允许通过 INSERT/UPDATE 操作的列白名单（防止前端传入非数据库字段）
const ALLOWED_COLUMNS = [
    'official',
    'event',
    'method',
    'date',
    'comp',
    'country',
    'round',
    'solve_num',
    'solver',
    'solver_zh',
    'wca_id',
    'single',
    'avg',
    'display_single',
    'r_single',
    'r_avg',
    'ao_type',
    'r_ao_xr',
    'recon',
    'scramble',
    'wca_scramble',
    'caption',
    'note',
    'stm',
    'tps',
    'oll',
    'pll',
    'oll_short',
    'pll_short',
    'free_pair',
    'y_rot',
    'regrip',
    'lockup',
    'cross_type',
    'cross_stm',
    'f2l',
    'll',
    's_move',
    'cross_color',
    'created_at',
];

/**
 * SQL 行 → 前端 JSON 对象
 * NOTE: snake_case 列名转回 camelCase，null 值的字段保留（前端需要）
 */
function rowToJson(array $row): array
{
    $json = [];
    foreach ($row as $col => $val) {
        $key = FIELD_MAP_SQL_TO_JSON[$col] ?? $col;
        $json[$key] = $val;
    }

    // NOTE: 类型修正——数据库返回的是字符串，前端期望数值类型
    if (isset($json['id']))
        $json['id'] = (int) $json['id'];
    if (isset($json['official']))
        $json['official'] = (bool) $json['official'];
    if (isset($json['single']) && $json['single'] !== null)
        $json['single'] = (float) $json['single'];
    if (isset($json['avg']) && $json['avg'] !== null)
        $json['avg'] = (float) $json['avg'];
    if (isset($json['stm']) && $json['stm'] !== null)
        $json['stm'] = (int) $json['stm'];
    if (isset($json['tps']) && $json['tps'] !== null)
        $json['tps'] = (float) $json['tps'];
    if (isset($json['solveNum']) && $json['solveNum'] !== null)
        $json['solveNum'] = (int) $json['solveNum'];
    if (isset($json['freePair']) && $json['freePair'] !== null)
        $json['freePair'] = (int) $json['freePair'];
    if (isset($json['yRot']) && $json['yRot'] !== null)
        $json['yRot'] = (int) $json['yRot'];
    if (isset($json['regrip']) && $json['regrip'] !== null)
        $json['regrip'] = (int) $json['regrip'];
    if (isset($json['lockup']) && $json['lockup'] !== null)
        $json['lockup'] = (int) $json['lockup'];
    if (isset($json['crossType']) && $json['crossType'] !== null)
        $json['crossType'] = (int) $json['crossType'];
    if (isset($json['crossStm']) && $json['crossStm'] !== null)
        $json['crossStm'] = (int) $json['crossStm'];
    if (isset($json['f2l']) && $json['f2l'] !== null)
        $json['f2l'] = (int) $json['f2l'];
    if (isset($json['ll']) && $json['ll'] !== null)
        $json['ll'] = (int) $json['ll'];
    if (isset($json['sMove']) && $json['sMove'] !== null)
        $json['sMove'] = (int) $json['sMove'];
    if (isset($json['createdAt']) && $json['createdAt'] !== null)
        $json['createdAt'] = (int) $json['createdAt'];

    // NOTE: 移除值为 null 的键——与原 JSON 行为一致（JSON 中缺失字段=不存在）
    return array_filter($json, fn($v) => $v !== null);
}

/**
 * 前端 JSON 对象 → SQL 列名+值（用于 INSERT/UPDATE）
 * NOTE: camelCase → snake_case，只保留白名单内的列
 */
function jsonToRow(array $json, bool $filterByWhitelist = true): array
{
    $row = [];
    foreach ($json as $key => $val) {
        $col = FIELD_MAP_JSON_TO_SQL[$key] ?? $key;
        if ($filterByWhitelist && !in_array($col, ALLOWED_COLUMNS) && $col !== 'id') {
            continue;
        }
        $row[$col] = $val;
    }
    return $row;
}

/**
 * 校验 SQL 行数据的字段类型/范围/长度
 * NOTE: 按数据库 Schema 校验，防止非法输入导致 SQL 报错
 * @return array 错误消息数组（空=通过）
 */
function validateRow(array $row): array
{
    $errors = [];

    // DECIMAL(8,3)：single, avg — 数值，范围 ±99999.999
    foreach (['single', 'avg'] as $col) {
        if (isset($row[$col]) && $row[$col] !== null) {
            if (!is_numeric($row[$col])) {
                $errors[] = "$col must be a number";
            } elseif (abs($row[$col]) > 99999.999) {
                $errors[] = "$col out of range";
            }
        }
    }

    // DECIMAL(5,2)：tps — 数值，范围 ±999.99
    if (isset($row['tps']) && $row['tps'] !== null) {
        if (!is_numeric($row['tps'])) {
            $errors[] = "tps must be a number";
        } elseif (abs($row['tps']) > 999.99) {
            $errors[] = "tps out of range";
        }
    }

    // DATE：必须是合法的 YYYY-MM-DD（不接受 2026-99-99 等）
    if (isset($row['date']) && $row['date'] !== null) {
        $d = DateTime::createFromFormat('Y-m-d', $row['date']);
        if (!$d || $d->format('Y-m-d') !== $row['date']) {
            $errors[] = "date must be a valid YYYY-MM-DD date";
        }
    }

    // TINYINT：整数，-128 ~ 127
    foreach (['solve_num', 'free_pair', 'y_rot', 'regrip', 'lockup', 'cross_type', 's_move'] as $col) {
        if (isset($row[$col]) && $row[$col] !== null) {
            if (!is_numeric($row[$col]) || intval($row[$col]) != $row[$col]) {
                $errors[] = "$col must be an integer";
            } elseif ($row[$col] < -128 || $row[$col] > 127) {
                $errors[] = "$col out of range (-128~127)";
            }
        }
    }

    // SMALLINT：整数，-32768 ~ 32767
    foreach (['stm', 'cross_stm', 'f2l', 'll'] as $col) {
        if (isset($row[$col]) && $row[$col] !== null) {
            if (!is_numeric($row[$col]) || intval($row[$col]) != $row[$col]) {
                $errors[] = "$col must be an integer";
            } elseif ($row[$col] < -32768 || $row[$col] > 32767) {
                $errors[] = "$col out of range (-32768~32767)";
            }
        }
    }

    // INT UNSIGNED：created_at — 非负整数
    if (isset($row['created_at']) && $row['created_at'] !== null) {
        if (!is_numeric($row['created_at']) || intval($row['created_at']) != $row['created_at'] || $row['created_at'] < 0) {
            $errors[] = "created_at must be a non-negative integer";
        }
    }

    // VARCHAR 长度限制
    $varcharLimits = [
        'event' => 20,
        'method' => 20,
        'round' => 20,
        'comp' => 200,
        'country' => 100,
        'solver' => 100,
        'solver_zh' => 100,
        'wca_id' => 20,
        'display_single' => 20,
        'r_single' => 20,
        'r_avg' => 20,
        'ao_type' => 50,
        'r_ao_xr' => 20,
        'oll' => 100,
        'pll' => 100,
        'oll_short' => 50,
        'pll_short' => 50,
    ];
    foreach ($varcharLimits as $col => $max) {
        if (isset($row[$col]) && $row[$col] !== null && mb_strlen($row[$col]) > $max) {
            $errors[] = "$col exceeds max length ($max)";
        }
    }

    // CHAR(1)：cross_color
    if (isset($row['cross_color']) && $row['cross_color'] !== null && mb_strlen($row['cross_color']) > 1) {
        $errors[] = "cross_color must be a single character";
    }

    // TEXT 上限 64KB（防 DoS，TEXT 类型上限 65535 字节）
    foreach (['recon', 'scramble', 'wca_scramble', 'caption', 'note'] as $col) {
        if (isset($row[$col]) && $row[$col] !== null && strlen($row[$col]) > 65535) {
            $errors[] = "$col exceeds max size (64KB)";
        }
    }

    return $errors;
}

/**
 * 建表 SQL（供迁移脚本使用）
 *
 * 三张表的关系：
 *   recons       — 主表，存储用户提交的原始复盘数据（不可被管理员编辑直接修改）
 *   edits        — 编辑覆盖层，管理员的修正以 JSON 字段存储，前端加载时与原始数据合并
 *                  （设计理念：原始数据永远不变，修正叠加在上面，类似 Photoshop 图层）
 *   edit_history — 编辑历史，每次覆盖操作的前后快照，用于审计追踪和回退
 */
function getCreateTablesSql(): string
{
    return <<<'SQL'
-- 主表：用户提交的原始复盘数据
CREATE TABLE IF NOT EXISTS recons (
  id             INT UNSIGNED   PRIMARY KEY AUTO_INCREMENT,
  official       TINYINT(1)     NOT NULL DEFAULT 1,
  event          VARCHAR(20)    NOT NULL DEFAULT '3x3',
  method         VARCHAR(20)    DEFAULT NULL,
  date           DATE           DEFAULT NULL,
  comp           VARCHAR(200)   DEFAULT NULL,
  country        VARCHAR(100)   DEFAULT NULL,
  round          VARCHAR(20)    DEFAULT NULL,
  solve_num      TINYINT        DEFAULT NULL,
  solver         VARCHAR(100)   DEFAULT NULL,
  solver_zh      VARCHAR(100)   DEFAULT NULL,
  wca_id         VARCHAR(20)    DEFAULT NULL,
  single         DECIMAL(8,3)   DEFAULT NULL,
  avg            DECIMAL(8,3)   DEFAULT NULL,
  display_single VARCHAR(20)    DEFAULT NULL,
  r_single       VARCHAR(20)    DEFAULT NULL,
  r_avg          VARCHAR(20)    DEFAULT NULL,
  ao_type        VARCHAR(50)    DEFAULT NULL,
  r_ao_xr        VARCHAR(20)    DEFAULT NULL,
  recon          TEXT           DEFAULT NULL,
  scramble       TEXT           DEFAULT NULL,
  wca_scramble   TEXT           DEFAULT NULL,
  caption        TEXT           DEFAULT NULL,
  note           TEXT           DEFAULT NULL,
  stm            SMALLINT       DEFAULT NULL,
  tps            DECIMAL(5,2)   DEFAULT NULL,
  oll            VARCHAR(100)   DEFAULT NULL,
  pll            VARCHAR(100)   DEFAULT NULL,
  oll_short      VARCHAR(50)    DEFAULT NULL,
  pll_short      VARCHAR(50)    DEFAULT NULL,
  free_pair      TINYINT        DEFAULT NULL,
  y_rot          TINYINT        DEFAULT NULL,
  regrip         TINYINT        DEFAULT NULL,
  lockup         TINYINT        DEFAULT NULL,
  cross_type     TINYINT        DEFAULT NULL,
  cross_stm      SMALLINT       DEFAULT NULL,
  f2l            SMALLINT       DEFAULT NULL,
  ll             SMALLINT       DEFAULT NULL,
  s_move         TINYINT        DEFAULT NULL,
  cross_color    CHAR(1)        DEFAULT NULL,
  created_at     INT UNSIGNED   DEFAULT NULL,
  INDEX idx_solver (solver),
  INDEX idx_date (date),
  INDEX idx_wca_id (wca_id),
  INDEX idx_comp (comp(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 编辑覆盖层：管理员修正不直接改原始数据，而是存一份 JSON 覆盖
-- 前端用 Object.assign(原始数据, edits.fields) 合并，覆盖层优先
CREATE TABLE IF NOT EXISTS edits (
  solve_id   VARCHAR(50)  PRIMARY KEY,
  fields     JSON         NOT NULL,
  edited_at  INT UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 编辑历史：记录每次覆盖操作的修改前后快照，支持审计和回退
CREATE TABLE IF NOT EXISTS edit_history (
  id              VARCHAR(50)  PRIMARY KEY,
  solve_id        VARCHAR(50)  NOT NULL,
  before_snapshot JSON         DEFAULT NULL,
  after_fields    JSON         DEFAULT NULL,
  edited_by       VARCHAR(100) DEFAULT NULL,
  edited_at       INT UNSIGNED DEFAULT NULL,
  INDEX idx_solve_id (solve_id),
  INDEX idx_edited_at (edited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL;
}
