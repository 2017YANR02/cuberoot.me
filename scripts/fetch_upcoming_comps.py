#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# NOTE: 顶尖选手近期比赛追踪 - 数据抓取脚本
# 遵循原则: DRY, 模块化, 前后端分离, 防 BUG (限流重试)
#
# 数据源:
#   1. WCA API — 全球比赛 + 选手注册信息
#   2. cubing.com（粗饼网）— 中国内地比赛（WCA API 不覆盖）
#
# 流程:
#   1. 从 stats/wr_metric.md 提取去重后的顶尖选手 WCA ID + 项目 + WR 标记
#   2. 爬取 WCA API 获取名单内所有人的 upcoming_competitions
#   3. 从 cubing.com 获取中国内地比赛列表 + 选手 HTML 页面，交叉匹配 top cubers
#   4. 数据清洗、去重、按时间线聚合
#   5. 生成极简 JSON 给前端页面使用

import re
import json
import sys
import io
import time
import datetime
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Any

# NOTE: 修复 Windows 终端 GBK 编码问题，防止格鲁吉亚文/韩文等字符崩溃
# line_buffering=True 确保每行 print 立即刷新到终端（实时进度）
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

# ================= Configuration ==================
ROOT_DIR = Path(__file__).parent.parent
WR_METRIC_PATH = ROOT_DIR / "stats" / "wr_metric.md"
OUTPUT_JSON_PATH = ROOT_DIR / "stats" / "upcoming_comps.json"
# NOTE: Globe history/upcoming 模式 + UpcomingCompsPage All 模式共用，含全球全量 upcoming
ALL_OUTPUT_JSON_PATH = ROOT_DIR / "stats" / "data" / "all_upcoming_comps.json"
CACHE_DIR = ROOT_DIR / ".upcoming_cache"

WCA_API_BASE = "https://www.worldcubeassociation.org/api/v0"
# NOTE: cubing.com（粗饼网）管理中国内地比赛报名，WCA API 不返回这些比赛
CUBING_CHINA_API = "https://cubing.com/api/competition"
CUBING_CHINA_BASE = "https://cubing.com"
API_DELAY_SEC = 0.5
MAX_RETRIES = 3
# NOTE: 缓存有效期（秒），默认 24 小时。用户选择刷新时会被置为 0
CACHE_TTL_SEC = 24 * 3600

# NOTE: 设为正整数可截断调试，生产环境为 None
# NOTE: 设为 10 方便测试，全量为 None
DEBUG_LIMIT = None

# NOTE: wr_metric.md 中 <h3 data-i18n-en> 全名 -> WCA 内部 ID
EVENT_NAME_TO_ID = {
    "Rubik's Cube": "333",
    "2x2x2 Cube": "222",
    "4x4x4 Cube": "444",
    "5x5x5 Cube": "555",
    "6x6x6 Cube": "666",
    "7x7x7 Cube": "777",
    "3x3x3 Blindfolded": "333bf",
    "3x3x3 Fewest Moves": "333fm",
    "3x3x3 One-Handed": "333oh",
    "Megaminx": "minx",
    "Pyraminx": "pyram",
    "Rubik's Clock": "clock",
    "Skewb": "skewb",
    "Square-1": "sq1",
    "4x4x4 Blindfolded": "444bf",
    "5x5x5 Blindfolded": "555bf",
    "3x3x3 Multi-Blind": "333mbf",
    "3x3x3 With Feet": "333ft",
    "Rubik's Magic": "magic",
    "Master Magic": "mmagic",
    "Rubik's Cube: Multiple blind old style": "333mbo",
}

# NOTE: WCA 官方项目顺序 + 前端展示用短名
# (内部ID, 显示短名) — 排序依据此列表的顺序
EVENT_DISPLAY_ORDER = [
    ("333",   "3"),    ("222",   "2"),    ("444",   "4"),
    ("555",   "5"),    ("666",   "6"),    ("777",   "7"),
    ("333bf", "3bf"),  ("333fm", "fm"),   ("333oh", "oh"),
    ("minx",  "minx"), ("pyram", "py"),   ("clock", "clock"),
    ("skewb", "sk"),   ("sq1",   "sq1"),
    ("444bf", "4bf"),  ("555bf", "5bf"),  ("333mbf","mbf"),
    ("333ft", "ft"),   ("333mbo","mbo"),  ("magic", "mag"),
    ("mmagic","mmag"),
]
# 内部ID -> (排序索引, 显示短名)
EVENT_ORDER_MAP = {eid: (idx, short) for idx, (eid, short) in enumerate(EVENT_DISPLAY_ORDER)}
USER_AGENT = "WCA-Stats-Bot/1.0 (ruiminyan.github.io)"
# ==================================================


# 选手数据类型: { wca_id: { name, events: { event_id: { ranking: bool, wr: bool } } } }
CuberData = Dict[str, Dict[str, Any]]


def extract_top_cubers() -> CuberData:
    """
    从 wr_metric.md 的排名(ranking)和历史(history)区域中提取选手。
    - ranking 区域: 当前各项目 Top 10
    - history 区域: 曾经打破过 WR 的选手
    每位选手的数据包含其上榜项目及是否持有/曾破 WR。
    """
    if not WR_METRIC_PATH.exists():
        raise FileNotFoundError(f"Cannot find: {WR_METRIC_PATH}")

    content = WR_METRIC_PATH.read_text(encoding="utf-8")
    person_pattern = r'href="https://www\.worldcubeassociation\.org/persons/([A-Z0-9]+)">([^<]+)</a>'
    # NOTE: 从 ranking 表格行中同时提取 WCA ID、姓名和成绩值，用于判断 current WR
    row_pattern = r'<tr>\s*<td[^>]*>\d+</td>\s*<td><a href="[^"]*persons/([A-Z0-9]+)">([^<]+)</a></td>\s*<td[^>]*>([^<]+)</td>'

    cubers: CuberData = {}
    # NOTE: 记录每个项目的当前 WR 保持者（含 tie），key=event_id, value=set(wca_id)
    current_wr_holders: dict[str, set[str]] = {}

    # NOTE: 遍历 4 个 section: single/average × ranking/history
    section_ids = [
        "single-ranking", "average-ranking",
        "single-history", "average-history",
    ]

    for section_id in section_ids:
        is_history = "history" in section_id
        label = "WR历史" if is_history else "排名"

        # 提取该 section 的 HTML 内容
        pattern = rf'id="{section_id}"[^>]*>(.*?)(?=<div id=")'
        m = re.search(pattern, content, re.DOTALL)
        if not m:
            print(f"  [WARN] 未找到 section: {section_id}")
            continue

        section_html = m.group(1)

        # 按 <h3> 标签拆分成各项目段
        event_blocks = re.split(r'<h3[^>]*data-i18n-en="([^"]*)"[^>]*>', section_html)

        for i in range(1, len(event_blocks), 2):
            event_name = event_blocks[i]
            event_html = event_blocks[i + 1] if i + 1 < len(event_blocks) else ""
            event_id = EVENT_NAME_TO_ID.get(event_name, event_name)

            # NOTE: ranking 区域额外做 current WR 识别（early termination）
            if not is_history:
                rank1_result = None
                for row in re.finditer(row_pattern, event_html):
                    result = row.group(3).strip()
                    if rank1_result is None:
                        rank1_result = result
                    elif result != rank1_result:
                        break  # 成绩与第1名不同，后续不可能是 WR holder
                    wca_id = row.group(1)
                    current_wr_holders.setdefault(event_id, set()).add(wca_id)

            for pm in re.finditer(person_pattern, event_html):
                wca_id, name = pm.group(1), pm.group(2)

                if wca_id not in cubers:
                    cubers[wca_id] = {"name": name, "events": {}}

                if event_id not in cubers[wca_id]["events"]:
                    cubers[wca_id]["events"][event_id] = {
                        "ranking": False, "wr": False, "current_wr": False,
                    }

                if is_history:
                    cubers[wca_id]["events"][event_id]["wr"] = True
                else:
                    cubers[wca_id]["events"][event_id]["ranking"] = True

        print(f"  [{label}] {section_id} 处理完毕")

    # NOTE: 将 current_wr_holders 的信息写入 cubers 数据
    for ev_id, holder_ids in current_wr_holders.items():
        for wca_id in holder_ids:
            if wca_id in cubers and ev_id in cubers[wca_id]["events"]:
                cubers[wca_id]["events"][ev_id]["current_wr"] = True

    print(f"[INFO] 提取到 {len(cubers)} 名选手（排名+WR历史，含已取消项目）.")
    return cubers


def _is_cache_valid(path: Path) -> bool:
    """检查缓存文件是否存在且未过期。"""
    return path.exists() and (time.time() - path.stat().st_mtime) < CACHE_TTL_SEC


def _build_event_tags(cuber_info) -> list:
    """从选手数据构造事件标签列表（按 WR优先级 -> WCA 官方顺序）。"""
    tags = []

    def sort_key(item):
        ev_id, flags = item
        # WR 优先级: current(0) > former(1) > 无(2)
        wr_priority = 0 if flags["current_wr"] else (1 if flags["wr"] else 2)
        # 项目优先级
        event_priority = EVENT_ORDER_MAP.get(ev_id, (999, ev_id))[0]
        return (wr_priority, event_priority)

    for ev_id, flags in sorted(cuber_info["events"].items(), key=sort_key):
        _, short = EVENT_ORDER_MAP.get(ev_id, (999, ev_id))
        # NOTE: current=当前WR保持者, former=曾破WR但非当前保持者
        wr_val = "current" if flags["current_wr"] else ("former" if flags["wr"] else None)
        tags.append({"id": short, "wr": wr_val})
        
    return tags


def fetch_with_retry(url: str, raw: bool = False):
    """带限流和防封禁重试机制的网络请求。raw=True 时返回原始文本，否则解析 JSON。"""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(API_DELAY_SEC)
            with urllib.request.urlopen(req, timeout=10) as resp:
                text = resp.read().decode("utf-8")
                return text if raw else json.loads(text)

        except urllib.error.HTTPError as e:
            if e.code == 404:
                # NOTE: 404 说明选手无 WCA 账号（已退役/被合并），立即跳过不重试
                return {}
            elif e.code == 429:
                wait = int(e.headers.get("Retry-After", 2))
                print(f"[WARN] 触发 429 限制，等待 {wait} 秒...")
                time.sleep(wait)
            else:
                print(f"[ERROR] API 返回 {e.code}: {url}")
                time.sleep(1)

        except (urllib.error.URLError, OSError) as e:
            print(f"[WARN] 请求异常 {e}, 重试 {attempt + 1}/{MAX_RETRIES}...")
            time.sleep(2)

    return {}


def _aggregate_comps(comps_map, comps, wca_id, cuber_info):
    """将某位选手的比赛列表聚合到全局 comps_map 中。"""
    name = cuber_info["name"]
    for comp in comps:
        c_id = comp["id"]
        if c_id not in comps_map:
            comps_map[c_id] = {
                "id": c_id,
                "name": comp["name"],
                "city": comp.get("city", "Unknown"),
                "country": comp.get("country_iso2", ""),
                "start_date": comp["start_date"],
                "end_date": comp["end_date"],
                "events": set(comp.get("event_ids", [])),
                "competitor_limit": comp.get("competitor_limit", 0),
                "top_cubers": []
            }
        else:
            comps_map[c_id]["events"].update(comp.get("event_ids", []))

        comps_map[c_id]["top_cubers"].append({
            "id": wca_id,
            "name": name,
            "events": _build_event_tags(cuber_info),
        })


def _fetch_cubing_china_comps():
    """
    从 cubing.com API 获取即将举行的中国内地 WCA 比赛列表。
    返回 [{alias, name, city, start_date, end_date, competitor_limit}, ...]
    """
    cache_file = CACHE_DIR / "_cubing_china_list.json"
    if _is_cache_valid(cache_file):
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        print(f"[CN] 比赛列表: {len(data)} 场 [缓存]")
        return data

    raw_data = fetch_with_retry(CUBING_CHINA_API)
    if not raw_data or raw_data.get("status") != 0:
        print("[CN] 获取比赛列表失败")
        return []

    now_ts = time.time()
    comps = []
    for c in raw_data.get("data", []):
        # NOTE: 只要 WCA 认证赛、未结束、日期在未来
        if c.get("type") != "WCA" or c.get("live") != 0:
            continue
        date_from = c.get("date", {}).get("from", 0)
        if date_from <= now_ts:
            continue

        # NOTE: 时间戳 → YYYY-MM-DD（UTC）
        start = datetime.datetime.fromtimestamp(
            date_from, tz=datetime.timezone.utc
        ).strftime("%Y-%m-%d")
        date_to = c.get("date", {}).get("to", date_from)
        end = datetime.datetime.fromtimestamp(
            date_to, tz=datetime.timezone.utc
        ).strftime("%Y-%m-%d")

        # NOTE: 多地点比赛顶级 competitor_limit 可能为 0，fallback 到各 location 限额之和
        limit = c.get("competitor_limit", 0)
        if not limit:
            limit = sum(
                loc.get("competitor_limit", 0)
                for loc in c.get("locations", [])
            )

        # NOTE: 拼接省份+城市（取第一个 location）
        locs = c.get("locations", [{}])
        province = locs[0].get("province", "")
        city = locs[0].get("city", "")

        comps.append({
            "alias": c["alias"],
            "name": c["name"],
            "city": f"{province}, {city}" if province != city else city,
            "start_date": start,
            "end_date": end,
            "competitor_limit": limit,
        })

    # 写入缓存
    cache_file.write_text(json.dumps(comps, ensure_ascii=False), encoding="utf-8")
    print(f"[CN] 比赛列表: {len(comps)} 场")
    return comps


def _fetch_cubing_china_competitors(alias):
    """
    从 cubing.com 比赛选手页面提取所有参赛者的 WCA ID。
    返回 set of WCA IDs。
    """
    cache_file = CACHE_DIR / f"_cubing_china_{alias}.html"
    if _is_cache_valid(cache_file):
        html = cache_file.read_text(encoding="utf-8")
    else:
        url = f"{CUBING_CHINA_BASE}/competition/{alias}/competitors"
        html = fetch_with_retry(url, raw=True)
        # NOTE: raw=True 失败时返回空 dict（fetch_with_retry 的兜底）
        if not html or isinstance(html, dict):
            return set()
        cache_file.write_text(html, encoding="utf-8")

    # NOTE: cubing.com 使用完整 URL（href="https://cubing.com/results/person/..."）
    ids = set(re.findall(r'person/([A-Z0-9]+)', html))
    # NOTE: 0 个 ID 通常意味着 cubing.com 页面结构变更，需要更新正则
    if not ids:
        print(f"[CN][WARN] {alias}: 选手页面未解析到任何 WCA ID，请检查 cubing.com 页面结构")
    return ids


def _integrate_cubing_china(comps_map, cubers):
    """
    集成 cubing.com 上的中国内地比赛到 comps_map。
    只有当比赛中有 top cubers 参赛时才加入（与 WCA 数据逻辑一致）。
    整体 try/except 保护：失败时优雅降级，不影响 WCA 数据。
    """
    try:
        cn_comps = _fetch_cubing_china_comps()
        if not cn_comps:
            return

        cn_added = 0
        for comp in cn_comps:
            alias = comp["alias"]
            # NOTE: alias 去连字符 = WCA comp ID，确保前端链接正确
            comp_id = alias.replace("-", "")

            # NOTE: WCA API 可能已创建此条目，但缺少 cubing.com 独有字段
            if comp_id in comps_map:
                # NOTE: 补充中文名、中文城市、cubing.com 链接
                comps_map[comp_id]["name_zh"] = comp["name"]
                comps_map[comp_id]["city_zh"] = comp["city"]
                comps_map[comp_id]["cubing_china_url"] = f"https://cubing.com/competition/{alias}"
                continue

            competitor_ids = _fetch_cubing_china_competitors(alias)
            if not competitor_ids:
                continue

            # NOTE: 与 top cubers 名单交叉匹配
            matched = competitor_ids & set(cubers.keys())
            if not matched:
                continue

            # NOTE: 从 WCA API 获取英文名、英文城市和比赛项目（带缓存）
            wca_cache = CACHE_DIR / f"_wca_comp_{comp_id}.json"
            if _is_cache_valid(wca_cache):
                wca_data = json.loads(wca_cache.read_text(encoding="utf-8"))
            else:
                wca_data = fetch_with_retry(
                    f"{WCA_API_BASE}/competitions/{comp_id}"
                )
                wca_cache.write_text(
                    json.dumps(wca_data, ensure_ascii=False), encoding="utf-8"
                )

            # NOTE: WCA API 提供英文名和城市；cubing.com 提供中文名和城市
            en_name = wca_data.get("name", comp["name"])
            en_city = wca_data.get("city", comp["city"])
            event_ids = set(wca_data.get("event_ids", []))

            # 创建比赛条目
            comps_map[comp_id] = {
                "id": comp_id,
                "name": en_name,
                "name_zh": comp["name"],
                "city": en_city,
                "city_zh": comp["city"],
                "country": "CN",
                "start_date": comp["start_date"],
                "end_date": comp["end_date"],
                "events": event_ids,
                "competitor_limit": comp["competitor_limit"],
                # NOTE: 中国内地比赛链接跳转粗饼网而非 WCA 官网
                "cubing_china_url": f"https://cubing.com/competition/{alias}",
                "top_cubers": [],
            }

            for wca_id in matched:
                comps_map[comp_id]["top_cubers"].append({
                    "id": wca_id,
                    "name": cubers[wca_id]["name"],
                    "events": _build_event_tags(cubers[wca_id]),
                })

            cn_added += 1

        if cn_added > 0:
            print(f"[CN] 成功集成 {cn_added} 场中国内地比赛")
        else:
            print("[CN] 未找到有 top cubers 参赛的中国内地比赛")

    except Exception as e:
        # NOTE: 优雅降级 — CN 集成失败不影响 WCA 数据
        print(f"[CN][WARN] cubing.com 集成失败，已跳过: {e}")

def build_upcoming_comps(cubers: CuberData) -> List[Dict[str, Any]]:
    """
    遍历选手名单，请求 WCA API 获取近期比赛并聚合。
    每个比赛的 top_cubers 包含选手的事件标签和 WR 标记。
    """
    comps_map = {}

    cuber_items = list(cubers.items())
    if DEBUG_LIMIT:
        print(f"[DEBUG] 开启了 DEBUG_LIMIT={DEBUG_LIMIT}，仅抓取前 N 人！")
        cuber_items = cuber_items[:DEBUG_LIMIT]

    total = len(cuber_items)
    CACHE_DIR.mkdir(exist_ok=True)
    cache_hit = 0

    for i, (wca_id, cuber_info) in enumerate(cuber_items, 1):
        name = cuber_info["name"]
        cache_file = CACHE_DIR / f"{wca_id}.json"

        # NOTE: 缓存命中判断 — 文件存在且未过期
        if cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < CACHE_TTL_SEC:
                data = json.loads(cache_file.read_text(encoding="utf-8"))
                cache_hit += 1
                comps = data.get("upcoming_competitions", [])
                print(f"[{i}/{total}] {wca_id} ({name}): {len(comps)} 场 [缓存]")
                _aggregate_comps(comps_map, comps, wca_id, cuber_info)
                continue

        # 缓存未命中，走网络请求
        url = f"{WCA_API_BASE}/users/{wca_id}?upcoming_competitions=true"
        data = fetch_with_retry(url)

        comps = data.get("upcoming_competitions", [])
        n = len(comps)
        if n > 0:
            print(f"[{i}/{total}] {wca_id} ({name}): {n} 场")
        elif not data:
            print(f"[{i}/{total}] {wca_id} ({name}): 404 跳过")
        else:
            print(f"[{i}/{total}] {wca_id} ({name}): 0 场")

        # NOTE: 写入缓存（包括空结果和 404，防止重复请求）
        cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

        _aggregate_comps(comps_map, comps, wca_id, cuber_info)

    # NOTE: 集成 cubing.com 上的中国内地比赛
    _integrate_cubing_china(comps_map, cubers)

    # NOTE: 过滤掉太遥远的比赛（仅保留到明年底），排除占位赛事如 2028 年欧锦赛
    max_year = datetime.datetime.now().year + 1  # 2026 -> 最多展示到 2027
    results = []
    for c_id, info in comps_map.items():
        if int(info["start_date"][:4]) > max_year:
            continue
        # NOTE: events 也用短名并按 WCA 官方顺序排序
        info["events"] = sorted(
            list(info["events"]),
            key=lambda e: EVENT_ORDER_MAP.get(e, (999, e))[0]
        )
        info["events"] = [EVENT_ORDER_MAP.get(e, (999, e))[1] for e in info["events"]]
        results.append(info)

    results.sort(key=lambda x: x["start_date"])

    # NOTE: 选手先按 current WR 数量排，再按 former WR 数量排，最后字母序
    for info in results:
        info["top_cubers"].sort(
            key=lambda c: (
                -sum(1 for e in c["events"] if e.get("wr") == "current"),
                -sum(1 for e in c["events"] if e.get("wr") == "former"),
                c["name"]
            )
        )

    return results


def _shortify_events(event_ids):
    """WCA 内部 event_id → 前端短名，按 WCA 官方顺序排序。"""
    pairs = []
    for eid in event_ids:
        idx, short = EVENT_ORDER_MAP.get(eid, (999, eid))
        pairs.append((idx, short))
    pairs.sort(key=lambda p: p[0])
    return [p[1] for p in pairs]


def build_all_upcoming_comps():
    """
    从 WCA /competitions?ongoing_and_future=... 分页拉全球全量 upcoming 比赛。
    与 top-cubers 那份 upcoming_comps.json 不同，这份不过滤选手，是"地图+日历 All 模式"的源数据。
    """
    today = time.strftime("%Y-%m-%d", time.gmtime())
    per_page = 100
    out = []
    for page in range(1, 21):  # 20 * 100 = 2000 上限
        url = (
            f"{WCA_API_BASE}/competitions"
            f"?ongoing_and_future={today}&per_page={per_page}&page={page}"
        )
        batch = fetch_with_retry(url)
        # NOTE: fetch_with_retry 404/失败时返回 {}；list 端点正常返回 list
        if not isinstance(batch, list):
            if page == 1:
                print("[ALL] 第一页就拿不到 list，放弃生成 all_upcoming_comps.json")
                return None
            break
        out.extend(batch)
        if len(batch) < per_page:
            break
        print(f"[ALL] 已取 {len(out)} 场（page {page}）")

    # 过滤已取消 + 精简字段 + 按 id 去重
    # NOTE: WCA API 分页期间排序可能漂移（新增 / cancel 状态变化），同一 id 会跨页重复出现
    result = []
    seen_ids = set()
    for c in out:
        if c.get("cancelled_at"):
            continue
        cid = c["id"]
        if cid in seen_ids:
            continue
        seen_ids.add(cid)
        result.append({
            "id": c["id"],
            "name": c.get("name", ""),
            "city": c.get("city", ""),
            "country": c.get("country_iso2", ""),
            "start_date": c.get("start_date", ""),
            "end_date": c.get("end_date", ""),
            "events": _shortify_events(c.get("event_ids", [])),
            "competitor_limit": c.get("competitor_limit") or 0,
            "latitude_degrees": c.get("latitude_degrees", 0),
            "longitude_degrees": c.get("longitude_degrees", 0),
            "url": c.get("url", f"https://www.worldcubeassociation.org/competitions/{c['id']}"),
        })
    result.sort(key=lambda x: x["start_date"])
    return result


def main():
    global CACHE_TTL_SEC
    print("=== 开始构建 Top Cubers 近期比赛追踪数据 ===")
    start_time = time.time()

    # NOTE: 交互式询问缓存策略；CI 环境用 --refresh 参数跳过交互
    if "--refresh" in sys.argv:
        print("[INFO] 检测到 --refresh 参数，强制刷新缓存。")
        CACHE_TTL_SEC = 0
    elif CACHE_DIR.exists() and any(CACHE_DIR.iterdir()):
        ans = input("发现已有缓存，是否刷新? (y=重新拉取 / 回车=用缓存): ").strip().lower()
        if ans == "y":
            CACHE_TTL_SEC = 0
            print("[INFO] 将重新拉取所有数据。")
        else:
            print("[INFO] 使用已有缓存（24h 内有效）。")

    # 1. 抽取白名单（含事件标签和 WR 标记）
    cubers = extract_top_cubers()
    if not cubers:
        print("[ERROR] 提取到的选手列表为空，退出。")
        return

    # 2. 拉取和清洗数据
    comps_data = build_upcoming_comps(cubers)

    # 3. 输出 JSON 给前端呈现 (前后端契约)
    output_obj = {
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_cubers_tracked": len(cubers) if not DEBUG_LIMIT else DEBUG_LIMIT,
        "competitions": comps_data
    }

    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(output_obj, f, ensure_ascii=False, separators=(',', ':'))

    print(f"\n[INFO] 成功！共找到 {len(comps_data)} 场即将举行的比赛。")
    print(f"[INFO] 数据已写入: {OUTPUT_JSON_PATH.relative_to(ROOT_DIR)}")

    # 4. 生成 all_upcoming_comps.json（全球全量 upcoming，Globe + All 模式消费）
    print("\n[ALL] 开始拉取 WCA 全球全量 upcoming 比赛...")
    all_comps = build_all_upcoming_comps()
    if all_comps is not None:
        ALL_OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        with ALL_OUTPUT_JSON_PATH.open("w", encoding="utf-8") as f:
            json.dump(all_comps, f, ensure_ascii=False, separators=(',', ':'))
        print(f"[ALL] 共 {len(all_comps)} 场 → {ALL_OUTPUT_JSON_PATH.relative_to(ROOT_DIR)}")

    print(f"[INFO] 总耗时: {time.time() - start_time:.2f} 秒")


if __name__ == "__main__":
    main()
