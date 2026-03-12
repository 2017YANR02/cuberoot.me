#!/usr/bin/env python3
"""
从 WCA 公开 API 预构建 wca_attempts.json（增量更新）
只保留有复盘的选手的 attempts 数据 + 复盘 ID 映射，实现详情页秒加载。

输入：recon/backup/recons_backup.json, recon/recon_aux_data.json
输出：recon/data/wca_attempts.json

增量策略：
  - 读取已有的 wca_attempts.json
  - 只下载新增的 (compWcaId, personId) 对
  - 合并后写入

NOTE: CI (backup_recon.yml) 在备份后自动运行此脚本。
"""

import json
import os
import sys
import urllib.request
import time

BACKUP_PATH = os.path.join(os.path.dirname(__file__), "backup", "recons_backup.json")
AUX_PATH = os.path.join(os.path.dirname(__file__), "recon_aux_data.json")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "data", "wca_attempts.json")
WCA_API_BASE = "https://www.worldcubeassociation.org/api/v0"

# NOTE: Recon event → WCA event_id（和前端 recon_utils.js 保持一致）
EVENT_MAP = {
    "3x3": "333", "2x2": "222", "OH": "333oh",
    "3BLD": "333bf", "4BLD": "444bf", "5BLD": "555bf",
    "5x5": "555", "6x6": "666", "7x7": "777",
    "Pyraminx": "pyram", "Skewb": "skewb", "SQ1": "sq1",
    "Megaminx": "minx", "Clock": "clock",
}

# NOTE: Recon round → WCA round_type_id 列表
ROUND_MAP = {
    "R1": ["1", "d"], "R2": ["2", "e"],
    "R3": ["3", "g"], "Fi": ["f", "c", "b"],
}


def main():
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        recons = json.load(f)

    # NOTE: 加载 comp 显示名 → WCA ID 映射（fallback 用）
    comp_name_map = {}
    try:
        with open(AUX_PATH, "r", encoding="utf-8") as f:
            aux = json.load(f)
        comp_name_map = aux.get("compWcaIds", {})
        print(f"Loaded {len(comp_name_map)} comp name mappings from aux data")
    except Exception as e:
        print(f"Warning: could not load aux data: {e}")

    # NOTE: 加载已有数据（增量更新基础）
    existing = {}
    try:
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)
        print(f"Loaded existing data: {len(existing)} competitions")
    except Exception:
        print("No existing data, building from scratch")

    # 提取 (compWcaId, personId) 对和复盘 ID 关联
    pairs = set()
    recon_index = {}

    for r in recons:
        # NOTE: 优先用 compWcaId，fallback 到 comp 显示名查映射表
        comp_wca_id = r.get("compWcaId", "") or comp_name_map.get(r.get("comp", ""), "")
        person_id = r.get("personId", "")
        event = r.get("event", "")
        rnd = r.get("round", "")
        solve_num = r.get("solveNum")
        recon_id = r.get("id")

        if not comp_wca_id or not person_id:
            continue
        pairs.add((comp_wca_id, person_id))

        wca_event = EVENT_MAP.get(event)
        round_types = ROUND_MAP.get(rnd, [])
        if not wca_event or not round_types or not solve_num or not recon_id:
            continue

        comp = recon_index.setdefault(comp_wca_id, {})
        person = comp.setdefault(person_id, {})
        for rt in round_types:
            key = f"{wca_event}_{rt}"
            entry = person.setdefault(key, {})
            entry[str(solve_num)] = recon_id

    if not pairs:
        print("No (compWcaId, personId) pairs found, writing empty JSON")
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump({}, f)
        return

    # 按比赛分组全部 pairs
    all_comps = {}
    for comp_id, person_id in pairs:
        all_comps.setdefault(comp_id, set()).add(person_id)

    # NOTE: 增量判断——跳过已查询过的比赛（含空占位符）
    comps_to_fetch = {}
    for comp_id, person_ids in all_comps.items():
        if comp_id in existing:
            continue
        comps_to_fetch[comp_id] = person_ids

    print(f"Total: {len(all_comps)} competitions, {len(pairs)} person-comp pairs")
    print(f"New to fetch: {len(comps_to_fetch)} competitions")

    # NOTE: 从已有数据开始，增量合并
    result = dict(existing)

    # 只下载新增的比赛
    for comp_id, new_person_ids in sorted(comps_to_fetch.items()):
        # NOTE: 下载整个比赛的数据，过滤出所有需要的选手（含已有和新增）
        all_person_ids = all_comps.get(comp_id, set())
        print(f"  Fetching {comp_id}...", end=" ", flush=True)

        url = f"{WCA_API_BASE}/competitions/{comp_id}/results"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CubeRoot-Recon/1.0"})
            # NOTE: 大比赛（如世锦赛）数据量大，设 120 秒 timeout
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.load(resp)
        except Exception as e:
            print(f"FAILED: {e}")
            continue

        comp_data = {}
        for entry in data:
            wca_id = entry.get("wca_id", "")
            if wca_id not in all_person_ids:
                continue

            event_id = entry.get("event_id", "")
            round_type_id = entry.get("round_type_id", "")
            attempts = entry.get("attempts", [])
            if not event_id or not round_type_id or not attempts:
                continue

            person_data = comp_data.setdefault(wca_id, {})
            key = f"{event_id}_{round_type_id}"

            recon_ids = {}
            ri = recon_index.get(comp_id, {}).get(wca_id, {})
            if key in ri:
                recon_ids = ri[key]

            person_data[key] = {"a": attempts}
            if recon_ids:
                person_data[key]["r"] = recon_ids

        if comp_data:
            result[comp_id] = comp_data
            total_entries = sum(len(v) for v in comp_data.values())
            print(f"OK ({len(comp_data)} persons, {total_entries} entries)")
        else:
            # NOTE: 写入空占位符，防止下次增量运行时重复请求
            result[comp_id] = {}
            print("no matching data (cached)")

        time.sleep(1)

    # NOTE: 更新已有比赛的复盘 ID 映射（recon_index 可能有新增）
    for comp_id in result:
        if comp_id not in recon_index:
            continue
        for person_id in result[comp_id]:
            if person_id not in recon_index.get(comp_id, {}):
                continue
            for key in result[comp_id][person_id]:
                ri = recon_index.get(comp_id, {}).get(person_id, {})
                if key in ri:
                    result[comp_id][person_id][key]["r"] = ri[key]

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))

    size = os.path.getsize(OUTPUT_PATH)
    print(f"\nWrote {OUTPUT_PATH} ({size} bytes)")


if __name__ == "__main__":
    main()
