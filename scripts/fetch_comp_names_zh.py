#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# NOTE: 爬取 cubing.com 全部中国内地比赛，构建英文名 → 中文名映射
#
# 数据源：
#   1. cubing.com /competition?page=N — 所有中国内地比赛列表（含中文名 + alias）
#   2. WCA API /competitions?country_iso2=CN — 批量获取 WCA ID → 英文 short_name
#
# 输出：recon/comp_names_zh.json — { "English Name": "中文名", ... }
#
# 用法：python scripts/fetch_comp_names_zh.py
#   首次运行约 30 秒（自动检测页数 + WCA API 批量查询）
#   后续运行使用缓存，约 1 秒

import re
import json
import sys
import io
import time
import urllib.request
import urllib.error
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

ROOT_DIR = Path(__file__).parent.parent
OUTPUT_PATH = ROOT_DIR / "recon" / "comp_names_zh.json"
CACHE_DIR = ROOT_DIR / ".comp_names_zh_cache"

CUBING_CHINA_URL = "https://cubing.com/competition"
WCA_API_BASE = "https://www.worldcubeassociation.org/api/v0"
USER_AGENT = "WCA-Stats-Bot/1.0 (ruiminyan.github.io)"
API_DELAY_SEC = 0.3


def fetch_url(url, raw=False):
    """带重试的 HTTP 请求。"""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            time.sleep(API_DELAY_SEC)
            with urllib.request.urlopen(req, timeout=15) as resp:
                text = resp.read().decode("utf-8")
                return text if raw else json.loads(text)
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            print(f"  [WARN] 请求失败 ({e}), 重试 {attempt+1}/3...")
            time.sleep(2)
    return "" if raw else []


def _detect_total_pages(html):
    """从首页 HTML 的分页链接中提取最大 page=N 值。"""
    pages = [int(n) for n in re.findall(r'page=(\d+)', html)]
    return max(pages) if pages else 1


def scrape_cubing_china():
    """
    爬取 cubing.com 比赛列表全部页面（自动检测页数）。
    返回 { wca_id: zh_name, ... }（wca_id = alias 去连字符）
    """
    # NOTE: <a> 标签内含 <img> 子元素（WCA 赛事图标），需跨标签匹配
    comp_pattern = re.compile(
        r'<a[^>]*href="https://cubing\.com/competition/([^"?]+)"[^>]*>(.*?)</a>',
        re.DOTALL
    )
    tag_strip = re.compile(r'<[^>]+>')

    wca_id_to_zh = {}
    CACHE_DIR.mkdir(exist_ok=True)

    # NOTE: 先抓首页，自动检测总页数
    first_cache = CACHE_DIR / "page_1.html"
    if first_cache.exists():
        first_html = first_cache.read_text(encoding="utf-8")
    else:
        first_html = fetch_url(
            f"{CUBING_CHINA_URL}?year=&type=&province=&event=&page=1", raw=True
        )
        if first_html:
            first_cache.write_text(first_html, encoding="utf-8")

    total_pages = _detect_total_pages(first_html) if first_html else 1
    print(f"  自动检测到 {total_pages} 页")

    for page in range(1, total_pages + 1):
        cache_file = CACHE_DIR / f"page_{page}.html"

        if cache_file.exists():
            html = cache_file.read_text(encoding="utf-8")
            source = "缓存"
        else:
            url = f"{CUBING_CHINA_URL}?year=&type=&province=&event=&page={page}"
            html = fetch_url(url, raw=True)
            if not html:
                print(f"  [{page}/{total_pages}] 抓取失败")
                continue
            cache_file.write_text(html, encoding="utf-8")
            source = "网络"

        count = 0
        for m in comp_pattern.finditer(html):
            alias = m.group(1)
            name = tag_strip.sub("", m.group(2)).strip()
            if name and not alias.startswith("?"):
                wca_id = alias.replace("-", "")
                wca_id_to_zh[wca_id] = name
                count += 1

        print(f"  [{page}/{total_pages}] {count} 条 [{source}]")

    print(f"[INFO] cubing.com: {len(wca_id_to_zh)} 条")
    return wca_id_to_zh


def fetch_wca_cn_comps():
    """
    通过 WCA API 批量获取所有中国比赛的 WCA ID → 英文 short_name。
    ~721 条记录，每页 100 条 = ~8 次请求。
    """
    cache_file = CACHE_DIR / "wca_cn_comps.json"
    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        print(f"[INFO] WCA API: {len(data)} 条 [缓存]")
        return data

    wca_id_to_en = {}
    page = 1
    while True:
        url = f"{WCA_API_BASE}/competitions?country_iso2=CN&per_page=100&page={page}"
        data = fetch_url(url)
        if not data:
            break
        for c in data:
            wca_id_to_en[c["id"]] = c.get("short_name") or c["name"]
        print(f"  [WCA API page {page}] {len(data)} 条")
        if len(data) < 100:
            break
        page += 1

    # 写入缓存
    cache_file.write_text(
        json.dumps(wca_id_to_en, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[INFO] WCA API: {len(wca_id_to_en)} 条")
    return wca_id_to_en


def main():
    print("=== 构建中国比赛英文名 → 中文名映射 ===\n")
    start = time.time()

    # Step 1: cubing.com → { wca_id: 中文名 }
    print("[Step 1] 从 cubing.com 提取中文名...")
    wca_id_to_zh = scrape_cubing_china()

    # Step 2: WCA API → { wca_id: 英文名 }
    print("\n[Step 2] 从 WCA API 获取英文名...")
    wca_id_to_en = fetch_wca_cn_comps()

    # Step 3: 英文名 → 中文名（通过 wca_id 连接）
    en_to_zh = {}
    matched = 0
    for wca_id, zh_name in wca_id_to_zh.items():
        en_name = wca_id_to_en.get(wca_id)
        if en_name:
            en_to_zh[en_name] = zh_name
            matched += 1

    # NOTE: cubing.com 有非 WCA 赛事（如校际赛），不在 WCA 数据库中，这些无英文名
    unmatched = len(wca_id_to_zh) - matched
    print(f"\n[INFO] 匹配成功: {matched}, 无英文名(非WCA): {unmatched}")

    # Step 4: 输出 JSON（按英文名排序）
    sorted_map = dict(sorted(en_to_zh.items()))
    OUTPUT_PATH.write_text(
        json.dumps(sorted_map, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[INFO] 输出: {OUTPUT_PATH.relative_to(ROOT_DIR)} ({len(sorted_map)} 条)")
    print(f"[INFO] 耗时: {time.time() - start:.1f} 秒")


if __name__ == "__main__":
    main()
