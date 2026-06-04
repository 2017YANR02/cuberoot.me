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
#   1. 从 stats/wr_metric.json 提取去重后的顶尖选手 WCA ID + 项目 + WR 标记
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Any, Iterable

# NOTE: 修复 Windows 终端 GBK 编码问题，防止格鲁吉亚文/韩文等字符崩溃
# line_buffering=True 确保每行 print 立即刷新到终端（实时进度）
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

# ================= Configuration ==================
ROOT_DIR = Path(__file__).parent.parent
WR_METRIC_PATH = ROOT_DIR / "stats" / "wr_metric.json"
OUTPUT_JSON_PATH = ROOT_DIR / "stats" / "upcoming_comps.json"
# NOTE: Globe history/upcoming 模式 + UpcomingCompsPage All 模式共用，含全球全量 upcoming
ALL_OUTPUT_JSON_PATH = ROOT_DIR / "stats" / "all_upcoming_comps.json"
# NOTE: 中国内地比赛全员注册名单（前端"搜索选手"非 top 时,作为静态 fallback;WCA API 不覆盖 cubing.com）
CN_REGISTRATIONS_JSON_PATH = ROOT_DIR / "stats" / "cn_upcoming_registrations.json"
CACHE_DIR = ROOT_DIR / ".upcoming_cache"

WCA_API_BASE = "https://www.worldcubeassociation.org/api/v0"
# NOTE: cubing.com（粗饼网）管理中国内地比赛报名，WCA API 不返回这些比赛
CUBING_CHINA_API = "https://cubing.com/api/competition"
CUBING_CHINA_BASE = "https://cubing.com"
API_DELAY_SEC = 0.5
MAX_RETRIES = 3
# NOTE: 429 限流独立于失败重试——遵守 Retry-After 多等几次，别因限流就丢掉一场比赛
MAX_RATE_LIMIT_WAITS = 10
# NOTE: 缓存有效期（秒），默认 24 小时。用户选择刷新时会被置为 0
CACHE_TTL_SEC = 24 * 3600

# NOTE: 设为正整数可截断调试，生产环境为 None
# NOTE: 设为 10 方便测试，全量为 None
DEBUG_LIMIT = None

# NOTE: wr_metric.json section.title 全名 -> WCA 内部 ID
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
# 显示短名 -> 内部ID（反查；all_comps 存短名，CN 集成存内部ID，统一回内部ID 再规范化）
SHORT_TO_EVENT_ID = {short: eid for eid, short in EVENT_DISPLAY_ORDER}
USER_AGENT = "WCA-Stats-Bot/1.0 (cuberoot.me)"
# ==================================================


# 选手数据类型: { wca_id: { name, events: { event_id: { ranking: bool, wr: bool } } } }
CuberData = Dict[str, Dict[str, Any]]


def extract_top_cubers() -> CuberData:
    """
    从 wr_metric.json 的 single/average × ranking/history 面板中提取选手。
    - ranking 面板: 当前各项目 Top 10（最高名次的选手 = current WR holder，含并列）
    - history 面板: 曾经打破过 WR 的选手
    每位选手的数据包含其上榜项目及是否持有/曾破 WR。
    """
    if not WR_METRIC_PATH.exists():
        raise FileNotFoundError(f"Cannot find: {WR_METRIC_PATH}")

    data = json.loads(WR_METRIC_PATH.read_text(encoding="utf-8"))
    # NOTE: 选手 cell 是 markdown link `[Name](https://.../persons/WCAID)`
    person_pattern = r'\[([^\]]+)\]\(https://www\.worldcubeassociation\.org/persons/([A-Z0-9]+)\)'

    cubers: CuberData = {}
    current_wr_holders: dict[str, set[str]] = {}

    # NOTE: 只关心 single / average 两个指标，下含 ranking / history 两个面板
    metric_panels = {mp["id"]: mp for mp in data.get("metricPanels", [])}

    for metric_id in ("single", "average"):
        mp = metric_panels.get(metric_id)
        if not mp:
            print(f"  [WARN] 未找到 metric: {metric_id}")
            continue
        sub_panels = {p["id"]: p for p in mp.get("panels", [])}

        for panel_id in ("ranking", "history"):
            panel = sub_panels.get(panel_id)
            if not panel:
                print(f"  [WARN] 未找到 panel: {metric_id}-{panel_id}")
                continue

            is_history = panel_id == "history"
            label = "WR历史" if is_history else "排名"

            # NOTE: 列索引——从 panel.header 找 person / result 列位置（防 schema 漂移）
            header_keys = [h.get("key", "") for h in panel.get("header", [])]
            try:
                person_col = header_keys.index("person")
            except ValueError:
                print(f"  [WARN] {metric_id}-{panel_id} 没有 person 列")
                continue
            result_col = header_keys.index("result") if "result" in header_keys else None

            for section in panel.get("sections", []):
                event_name = section.get("title", "")
                event_id = EVENT_NAME_TO_ID.get(event_name, event_name)
                rows = section.get("rows", [])

                # NOTE: ranking 区域识别 current WR holder（与第 1 名同成绩的并列）
                if not is_history and result_col is not None:
                    rank1_result = None
                    for row in rows:
                        result = str(row[result_col]).strip()
                        if rank1_result is None:
                            rank1_result = result
                        elif result != rank1_result:
                            break
                        m = re.search(person_pattern, str(row[person_col]))
                        if m:
                            current_wr_holders.setdefault(event_id, set()).add(m.group(2))

                for row in rows:
                    m = re.search(person_pattern, str(row[person_col]))
                    if not m:
                        continue
                    name, wca_id = m.group(1), m.group(2)
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

            print(f"  [{label}] {metric_id}-{panel_id} 处理完毕")

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
    attempt = 0
    rate_limit_waits = 0
    while attempt < MAX_RETRIES:
        try:
            time.sleep(API_DELAY_SEC)
            with urllib.request.urlopen(req, timeout=10) as resp:
                text = resp.read().decode("utf-8")
                return text if raw else json.loads(text)

        except urllib.error.HTTPError as e:
            if e.code in (404, 403):
                # NOTE: 404 = 无 WCA 账号；403 = 端点需要认证，重试无意义
                return {}
            elif e.code == 429:
                # NOTE: 429 = 速率限流，不是失败。遵守 Retry-After 耐心等待，且不消耗
                #       attempt（否则 3 次 429 就丢掉这场比赛）；仅独立上限防无限卡死。
                if rate_limit_waits >= MAX_RATE_LIMIT_WAITS:
                    print(f"[ERROR] 429 连续 {MAX_RATE_LIMIT_WAITS} 次仍限流，放弃: {url}")
                    return {}
                wait = int(e.headers.get("Retry-After", 2))
                print(f"[WARN] 触发 429 限制，等待 {wait} 秒...")
                time.sleep(wait)
                rate_limit_waits += 1
                continue
            else:
                print(f"[ERROR] API 返回 {e.code}: {url}")
                time.sleep(1)
                attempt += 1

        except (urllib.error.URLError, OSError) as e:
            print(f"[WARN] 请求异常 {e}, 重试 {attempt + 1}/{MAX_RETRIES}...")
            time.sleep(2)
            attempt += 1

    return {}


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
                "registration_open": wca_data.get("registration_open"),
                "registration_close": wca_data.get("registration_close"),
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


def build_cn_registrations() -> Dict[str, List[str]]:
    """
    抓 cubing.com 上每场即将举行的中国比赛的全员注册 WCA ID 名单。
    返回 {comp_id: [wca_id, ...]}（已排序）。

    与 _integrate_cubing_china 不同 — 这里**不**做 top cuber 过滤,产出全员表;
    供前端"搜索选手"在 WCA API 不覆盖 (cubing.com) 时作静态兜底用。
    复用 _fetch_cubing_china_competitors 的文件级 HTML 缓存,二次抓近乎零成本。
    """
    out: Dict[str, List[str]] = {}
    try:
        cn_comps = _fetch_cubing_china_comps()
    except Exception as e:
        print(f"[CN-REG][WARN] 比赛列表拉取失败: {e}")
        return out
    if not cn_comps:
        return out

    total = len(cn_comps)
    total_ids = 0
    for i, comp in enumerate(cn_comps, 1):
        alias = comp["alias"]
        comp_id = alias.replace("-", "")
        try:
            ids = _fetch_cubing_china_competitors(alias)
            out[comp_id] = sorted(ids)
            total_ids += len(ids)
            print(f"[CN-REG] [{i}/{total}] {comp_id}: {len(ids)} 人")
        except Exception as e:
            print(f"[CN-REG][WARN] {comp_id}: {e}")
            out[comp_id] = []
    print(f"[CN-REG] 共 {total} 场,合计 {total_ids} 个 WCA ID")
    return out


def build_upcoming_comps_from_wcif(
    cubers: CuberData, all_comps: List[Dict], wcif_map: Dict[str, Dict]
) -> List[Dict[str, Any]]:
    """
    WCA 限制 /users/:id?upcoming_competitions=true（返回 403）后的替代方案。
    用每场 WCIF public 端点的 persons 数组（含 wcaId + registration.status）
    与 top cubers 交叉匹配。wcif_map 由 fetch_wcif_batch 预拉好（rounds 复用同份）。
    """
    cuber_ids = set(cubers.keys())
    comps_map: Dict[str, Dict] = {}

    for comp in all_comps:
        comp_id = comp["id"]
        competitors = wcif_map.get(comp_id, {}).get("competitors", [])
        matched = [w for w in competitors if w in cuber_ids]
        if not matched:
            continue

        comps_map[comp_id] = {
            "id": comp_id,
            "name": comp.get("name", ""),
            "city": comp.get("city", ""),
            "country": comp.get("country", ""),
            "start_date": comp.get("start_date", ""),
            "end_date": comp.get("end_date", ""),
            # NOTE: all_comps 存短名 → 转回内部ID，与 CN 集成统一，最后再规范化成短名
            "events": set(SHORT_TO_EVENT_ID.get(e, e) for e in comp.get("events", [])),
            "competitor_limit": comp.get("competitor_limit", 0),
            "registration_open": comp.get("registration_open"),
            "registration_close": comp.get("registration_close"),
            "top_cubers": [],
        }
        for wca_id in matched:
            cuber_info = cubers[wca_id]
            comps_map[comp_id]["top_cubers"].append({
                "id": wca_id,
                "name": cuber_info["name"],
                "events": _build_event_tags(cuber_info),
            })

    print(f"[REG] {len(comps_map)} 场比赛有 top cubers 参赛")

    # 集成 cubing.com CN 比赛（不在 WCA all_comps 里）
    _integrate_cubing_china(comps_map, cubers)

    # NOTE: 过滤太遥远的比赛（仅到明年底），排除占位赛事如 2028 年欧锦赛
    max_year = datetime.datetime.now().year + 1
    results = [
        info for info in comps_map.values()
        if info["start_date"][:4].isdigit() and int(info["start_date"][:4]) <= max_year
    ]

    # events 统一从内部ID 按 WCA 官方顺序排序 → 转短名
    for info in results:
        info["events"] = sorted(
            list(info["events"]),
            key=lambda e: EVENT_ORDER_MAP.get(e, (999, e))[0]
        )
        info["events"] = [EVENT_ORDER_MAP.get(e, (999, e))[1] for e in info["events"]]
        info["top_cubers"].sort(
            key=lambda c: (
                -sum(1 for e in c["events"] if e.get("wr") == "current"),
                -sum(1 for e in c["events"] if e.get("wr") == "former"),
                c["name"]
            )
        )

    results.sort(key=lambda x: x["start_date"])
    return results


def _wcif_cache_ok(cached) -> bool:
    """新缓存格式必须含 rounds + competitors 两个键；旧的纯 rounds dict 视为失效。"""
    return isinstance(cached, dict) and "rounds" in cached and "competitors" in cached


def fetch_wcif(comp_id: str) -> Dict[str, Any]:
    """
    拉取单场比赛 WCIF 公开端点，一次性提取轮次数 + 报名选手 wcaId。
    返回 { "rounds": {短名: rounds_count}, "competitors": [wcaId, ...] }。
    失败 / 无 events → {}（不缓存，下次重试）。单文件缓存（24h）。
    """
    cache_file = CACHE_DIR / f"_wcif_{comp_id}.json"
    if _is_cache_valid(cache_file):
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            if _wcif_cache_ok(cached):
                return cached
        except Exception:
            pass  # 缓存损坏 / 旧格式 → 重新拉

    url = f"{WCA_API_BASE}/competitions/{comp_id}/wcif/public"
    data = fetch_with_retry(url)
    # NOTE: fetch_with_retry 网络失败 / 429 重试耗尽 / 404 都返回 {}（无 events 键）。
    #       区分"真无 events"和"fetch 失败"很重要：失败不写缓存，让下次重试；
    #       成功（哪怕 events 列表为空）才缓存。否则一次 429 → 缓存 24h 内永远空。
    if not isinstance(data, dict) or "events" not in data:
        return {}
    rounds: Dict[str, int] = {}
    for ev in data["events"] or []:
        eid = ev.get("id")
        if not eid:
            continue
        n = len(ev.get("rounds") or [])
        _, short = EVENT_ORDER_MAP.get(eid, (999, eid))
        rounds[short] = n
    # NOTE: persons[].registration 可能为 null（纯 staff/delegate）；只取 accepted 报名者
    competitors: List[str] = []
    for p in data.get("persons") or []:
        wid = p.get("wcaId")
        reg = p.get("registration") or {}
        if wid and reg.get("status") == "accepted":
            competitors.append(wid)
    out = {"rounds": rounds, "competitors": competitors}
    cache_file.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


def fetch_wcif_batch(comp_ids: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    """
    并行拉一批比赛的 WCIF（轮次 + 报名名单）。已缓存的直接读，未缓存的多线程拉取。
    返回 { comp_id: {"rounds": {...}, "competitors": [...]} }。
    """
    out: Dict[str, Dict[str, Any]] = {}
    pending: List[str] = []
    for cid in comp_ids:
        cache_file = CACHE_DIR / f"_wcif_{cid}.json"
        if _is_cache_valid(cache_file):
            try:
                cached = json.loads(cache_file.read_text(encoding="utf-8"))
                if _wcif_cache_ok(cached):
                    out[cid] = cached
                    continue
            except Exception:
                pass
        pending.append(cid)

    if not pending:
        print(f"[WCIF] 全部 {len(out)} 场命中缓存")
        return out

    print(f"[WCIF] 缓存命中 {len(out)} 场，待拉取 {len(pending)} 场...")
    # NOTE: 1 worker × 0.5s/req ≈ 2 req/s。2 worker(~4 req/s)实测仍频繁 429，降到 1 串行更
    #       平滑：每次严格遵守上一个 429 的 Retry-After，自适应到 WCA 允许的最快合法速率。
    workers = 1
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(fetch_wcif, cid): cid for cid in pending}
        for fut in as_completed(futures):
            cid = futures[fut]
            try:
                out[cid] = fut.result() or {"rounds": {}, "competitors": []}
            except Exception as e:
                print(f"[WCIF][WARN] {cid}: {e}")
                out[cid] = {"rounds": {}, "competitors": []}
            done += 1
            if done % 50 == 0 or done == len(pending):
                print(f"[WCIF] {done}/{len(pending)} 已拉取")
    return out


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
    # NOTE: cutoff 取 14 天前 —— 刚结束、还没进下一次 stats.yml(周日) dump 的比赛留在 JSON 里，
    #       让 CompPicker / Globe 在两份数据交接的空窗期仍能查到。
    cutoff = time.strftime("%Y-%m-%d", time.gmtime(time.time() - 14 * 86400))
    per_page = 100
    out = []
    for page in range(1, 21):  # 20 * 100 = 2000 上限
        url = (
            f"{WCA_API_BASE}/competitions"
            f"?ongoing_and_future={cutoff}&per_page={per_page}&page={page}"
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
            "registration_open": c.get("registration_open"),
            "registration_close": c.get("registration_close"),
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

    # NOTE: 在此显式建缓存目录（下游 fetch_wcif_batch / CN 集成写缓存前依赖它存在）
    CACHE_DIR.mkdir(exist_ok=True)

    # 2. 先拉全量 upcoming（Globe + All 模式），同时作 Top 模式的比赛来源
    print("\n[ALL] 开始拉取 WCA 全球全量 upcoming 比赛...")
    all_comps = build_all_upcoming_comps()

    # 3. 批量拉每场 WCIF（轮次 + 报名名单）。
    # NOTE: WCA /users/:id?upcoming_competitions=true 现返回 403（端点级限流，非 IP 段封）。
    #       改用 WCIF public 的 persons 数组拿报名 wcaId，同份请求顺带拿轮次，避免双拉。
    all_ids = {c["id"] for c in all_comps} if all_comps else set()
    if all_ids:
        print(f"\n[WCIF] 拉取 {len(all_ids)} 场比赛的 WCIF（轮次 + 报名名单）...")
        wcif_map = fetch_wcif_batch(all_ids)
    else:
        wcif_map = {}

    # 4. 用 WCIF 报名名单与 top cubers 交叉匹配，构建 Top 模式
    if all_comps:
        print(f"\n[REG] WCIF 报名名单匹配（{len(all_comps)} 场 × top {len(cubers)} 名选手）...")
        comps_data = build_upcoming_comps_from_wcif(cubers, all_comps, wcif_map)
    else:
        print("[WARN] all_comps 为空，Top 模式无数据源")
        comps_data = []

    # 5. 补拉 CN 集成新建（不在 all_ids 里）的比赛 WCIF 轮次，再统一填 rounds
    cn_only_ids = {c["id"] for c in comps_data} - all_ids
    if cn_only_ids:
        print(f"\n[WCIF] 补拉 {len(cn_only_ids)} 场 CN 比赛轮次...")
        wcif_map.update(fetch_wcif_batch(cn_only_ids))
    for c in comps_data:
        c["rounds"] = wcif_map.get(c["id"], {}).get("rounds", {})
    if all_comps:
        for c in all_comps:
            c["rounds"] = wcif_map.get(c["id"], {}).get("rounds", {})

    # 6. 写出 Top 模式 JSON
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

    # 7. 写出 All 模式 JSON
    if all_comps is not None:
        ALL_OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        with ALL_OUTPUT_JSON_PATH.open("w", encoding="utf-8") as f:
            json.dump(all_comps, f, ensure_ascii=False, separators=(',', ':'))
        print(f"[ALL] 共 {len(all_comps)} 场 → {ALL_OUTPUT_JSON_PATH.relative_to(ROOT_DIR)}")

    # 8. 写出 CN 全员注册名单（前端搜选手非 top 时的静态兜底）
    print("\n[CN-REG] 开始构建中国内地比赛全员注册名单...")
    cn_reg = build_cn_registrations()
    if cn_reg:
        CN_REGISTRATIONS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        with CN_REGISTRATIONS_JSON_PATH.open("w", encoding="utf-8") as f:
            json.dump(cn_reg, f, ensure_ascii=False, separators=(',', ':'))
        print(f"[CN-REG] 写入 {CN_REGISTRATIONS_JSON_PATH.relative_to(ROOT_DIR)}")

    print(f"[INFO] 总耗时: {time.time() - start_time:.2f} 秒")


if __name__ == "__main__":
    main()
