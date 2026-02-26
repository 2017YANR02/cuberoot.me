#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# NOTE: 顶尖选手近期比赛追踪 - 数据抓取脚本
# 遵循原则: DRY, 模块化, 前后端分离, 防 BUG (限流重试)
# 
# 1. 从 stats/wr_metric.md 的 "排名" 区域提取去重后的顶尖选手 WCA ID
# 2. 爬取 WCA API 获取此名单内所有人 upcoming_competitions
# 3. 数据清洗、去重和按时间线聚合
# 4. 生成极简 JSON 给前端页面使用

import re
import json
import sys
import io
import time
import requests
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any

# NOTE: 修复 Windows 终端 GBK 编码问题，防止格鲁吉亚文/韩文等字符崩溃
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ================= Configuration ==================
ROOT_DIR = Path(__file__).parent.parent
WR_METRIC_PATH = ROOT_DIR / "stats" / "wr_metric.md"
OUTPUT_JSON_PATH = ROOT_DIR / "stats" / "upcoming_comps.json"

WCA_API_BASE = "https://www.worldcubeassociation.org/api/v0"
# 限流：WCA 一般限制每秒最多几个请求，这里保守设定每次请求间隔
API_DELAY_SEC = 0.5
MAX_RETRIES = 3

# NOTE: 设为正整数可截断调试，生产环境为 None
DEBUG_LIMIT = None
# ==================================================


def extract_top_cubers() -> Dict[str, str]:
    """
    分离模块：获取白名单。
    从 wr_metric.md 的单次和平均排名区域中提取 WCA ID -> Name 的映射。
    WARNING: 为了避免内存溢出，直接用正则匹配核心区域，切勿加载未过滤的全网页 HTML 解析树。
    """
    if not WR_METRIC_PATH.exists():
        raise FileNotFoundError(f"Cannot find: {WR_METRIC_PATH}")

    content = WR_METRIC_PATH.read_text(encoding="utf-8")
    
    # 仅限定在这两个特定的排名面板（排除历史纪录和其他衍生数据）
    target_sections = {"single-ranking", "average-ranking"}
    
    # NOTE: 已取消的 WCA 项目，其选手不应被追踪
    # 八板(magic), 十二板(mmagic), 脚拧(333ft), 旧多盲(333mbo)
    deprecated_events = {
        "3x3x3 With Feet",
        "Rubik's Magic",
        "Master Magic",
        "Rubik's Cube: Multiple blind old style",
    }
    
    section_pattern = r'id="(\w+-ranking)"[^>]*>(.*?)(?=<div id="\w+-history")'
    matches = re.finditer(section_pattern, content, re.DOTALL)
    
    cubers = {}
    person_pattern = r'href="https://www\.worldcubeassociation\.org/persons/([A-Z0-9]+)">([^<]+)</a>'
    
    for match in matches:
        section_id = match.group(1)
        if section_id not in target_sections:
            continue
            
        section_html = match.group(2)
        
        # NOTE: 按 <h3> 标签将 ranking 区域拆分成各项目段
        # 每个项目格式: <h3 data-i18n-en="EventName">...</h3> 后跟该项目的排名表格
        event_blocks = re.split(r'<h3[^>]*data-i18n-en="([^"]*)"[^>]*>', section_html)
        
        # event_blocks[0] 是第一个 <h3> 之前的内容（通常为空或元信息）
        # event_blocks[1] = 事件名, event_blocks[2] = 该事件的 HTML
        # event_blocks[3] = 事件名, event_blocks[4] = 该事件的 HTML, ...
        for i in range(1, len(event_blocks), 2):
            event_name = event_blocks[i]
            event_html = event_blocks[i + 1] if i + 1 < len(event_blocks) else ""
            
            if event_name in deprecated_events:
                print(f"  [SKIP] 已取消项目: {event_name}")
                continue
            
            for pm in re.finditer(person_pattern, event_html):
                wca_id, name = pm.group(1), pm.group(2)
                cubers[wca_id] = name
                
    print(f"[INFO] 从 wr_metric.md 提取到 {len(cubers)} 名活跃顶尖选手（已排除已取消项目）.")
    
    return cubers


def fetch_with_retry(session: requests.Session, url: str) -> Dict[str, Any]:
    """带限流和防封禁重试机制的网络请求"""
    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(API_DELAY_SEC) # 强制间隔，保护服务器
            resp = session.get(url, timeout=10)
            
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                # Too Many Requests
                wait = int(resp.headers.get("Retry-After", 2))
                print(f"[WARN] 触发 429 限制，等待 {wait} 秒...")
                time.sleep(wait)
            else:
                print(f"[ERROR] API 返回 {resp.status_code}: {url}")
                # 非 429 错误可能不用重试，这里给 1 秒缓冲
                time.sleep(1)
                
        except requests.RequestException as e:
            print(f"[WARN] 请求异常 {e}, 尝试重试 {attempt + 1}/{MAX_RETRIES}...")
            time.sleep(2)
            
    return {}


def build_upcoming_comps(cubers: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    分离模块：获取和聚类逻辑。
    遍历传入的选手，请求 WCA API 并聚合出结构化的 JSON。
    """
    session = requests.Session()
    # 模拟浏览器 User-Agent，某些 API 对空/默认 UA 限制更严
    session.headers.update({"User-Agent": "WCA-Stats-Bot/1.0 (ruiminyan.github.io)"})

    # { comp_id: { details, top_cubers: [{id, name}], all_events: set() } }
    comps_map = {}
    
    cuber_items = list(cubers.items())
    if DEBUG_LIMIT:
        print(f"[DEBUG] 开启了 DEBUG_LIMIT={DEBUG_LIMIT}，仅抓取前 N 人！")
        cuber_items = cuber_items[:DEBUG_LIMIT]

    total = len(cuber_items)
    for i, (wca_id, name) in enumerate(cuber_items, 1):
        print(f"[{i}/{total}] 拉取 {wca_id} ({name}) 的赛程...")
        url = f"{WCA_API_BASE}/users/{wca_id}?upcoming_competitions=true"
        data = fetch_with_retry(session, url)
        
        comps = data.get("upcoming_competitions", [])
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
                    "top_cubers": []
                }
            else:
                comps_map[c_id]["events"].update(comp.get("event_ids", []))
                
            comps_map[c_id]["top_cubers"].append({
                "id": wca_id,
                "name": name
            })

    # 将 map 转化为 list，并将 events 处理为 sorted list
    results = []
    for c_id, info in comps_map.items():
        info["events"] = sorted(list(info["events"]))
        results.append(info)
        
    # 按比赛时间正序排列（最近的在最前面）
    results.sort(key=lambda x: x["start_date"])
    return results


def main():
    print("=== 开始构建 Top Cubers 近期比赛追踪数据 ===")
    start_time = time.time()
    
    # 1. 抽取白名单
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
    print(f"[INFO] 总耗时: {time.time() - start_time:.2f} 秒")


if __name__ == "__main__":
    main()
