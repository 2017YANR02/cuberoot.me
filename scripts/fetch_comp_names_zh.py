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
OUTPUT_PATH = ROOT_DIR / "stats" / "data" / "comp_names_zh.json"
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


# NOTE: 硬编码映射——cubing.com alias 与 WCA ID 差异过大、规则救不回来的老比赛
# 每年 update_upcoming.yml 会重新跑，新加的 alias 若走通规则就不需要进这里
# 加新条目前用 WCA API (https://www.worldcubeassociation.org/api/v0/competitions/<ID>) 验证 ID 存在
ALIAS_TO_WCA_ID_OVERRIDE = {
    "Shenzhen-Cubing-10th-Anniversary-2019": "Shenzhen10thAnniversary2019",
    "PKU-Spring-2019": "PekingUniversitySpring2019",
    "Peking-University-2018": "PKU2018",
    "Cross-strait-FMC-2018": "CrossstraitFMC2018",
    "Nanchang-Medium-and-Small-Cubes-2018": "NanchangMediumnSmallCubes2018",
    "FMC-Asia-2017": "FMCAsia2017",
    "Qingdao-Cube-of-Prime-Numbers-2017": "QingdaoPrimeNumbers2017",
    "FMC-Asia-2016": "FMCAsia2016",
    "Cross-strait-Cubing-Exchange-2016": "CrossstraitCubing2016",
    "Cross-strait-FMC-2016": "CrossstraitFMC2016",
    "2015-Beijing-Long-Events-Open": "BeijingLongEvents2015",
    "Cube-of-Prime-Numbers-2015": "CubeOfPrimeNumbers2015",
    "Cross-strait-Cubing-Exchange-2014": "CrossstraitCubing2014",
    "China-FM-2011-Beijing": "ChinaFMBeijing2011",
    "China-FM-2011-Shanghai": "ChinaFMShanghai2011",
    "China-FM-2011-Guangzhou": "ChinaFMGuangzhou2011",
    "China-FM-2011-Xian": "ChinaFMXian2011",
    "China-FM-2011-Shenyang": "ChinaFMShenyang2011",
    "China-FM-2011-Zhengzhou": "ChinaFMZhengzhou2011",
    "Hefei-After-Term-Open-2011": "HefeiOpen2011",
    "Henan-University-of-Science-and-Technology-Open-2011": "HenanUniversityOpen2011",
    "Shenyang-Cubing-Boxing-Day-2010": "ShenyangBoxingDay2010",
    "Hong-Kong-Open-2010": "HongKongOpen2010",
    "Hong-Kong-Cube-Day-2010": "HongKongCubeDay2010",
    "Macau-Rubiks-Open-2009": "MacauOpen2009",
    "Hong-Kong-Open-2009": "HongKongOpen2009",
    "Hong-Kong-Open-2008": "HongKongOpen2008",
    # NOTE: Hangzhou-open-2019 故意不加——cubing.com 中文名"杭州"与 WCA 里同日唯一的 HengyangOpen2019（衡阳）不一致，疑为 cubing.com 源数据错
}


def _alias_to_wca_id_candidates(alias):
    """
    从 cubing.com URL alias 推测可能的 WCA ID。
    WCA 对比 cubing.com 的 alias 可能省略 'Open' 这类词（或 'Cubing' 前缀），
    所以一个 alias 需要生成多个候选 ID 去匹配。
    """
    tokens = alias.split("-")
    seen = set()

    def yield_once(candidate):
        if candidate and candidate not in seen:
            seen.add(candidate)
            return candidate
        return None

    # 1) 原始：全部 token 拼接
    c = yield_once("".join(tokens))
    if c: yield c
    # 2) 去掉 "Open"（WCA ID 常省略）
    if "Open" in tokens:
        c = yield_once("".join(t for t in tokens if t != "Open"))
        if c: yield c
    # 3) 去掉 "Cubing" 前缀（cubing.com 给非 WCA 赛加的）
    if tokens and tokens[0] == "Cubing":
        c = yield_once("".join(tokens[1:]))
        if c: yield c
        if "Open" in tokens[1:]:
            c = yield_once("".join(t for t in tokens[1:] if t != "Open"))
            if c: yield c
    # 4) 前 2 个 token（跳过 "Cubing" 前缀） + 年份 token
    #    WCA short_name 常是 "地点 + 季节/类型 + 年份"，ID 把空格删掉；cubing.com alias 多含冗余词
    #    例：Beijing-University-Cube-League-2025 → BeijingUniversity2025
    start = 1 if tokens and tokens[0] == "Cubing" else 0
    year_tokens = [t for t in tokens if re.match(r'^\d{4}$', t)]
    if len(tokens) - start >= 2 and year_tokens:
        c = yield_once(tokens[start] + tokens[start + 1] + year_tokens[0])
        if c: yield c


def scrape_cubing_china():
    """
    爬取 cubing.com 比赛列表全部页面（自动检测页数）。
    返回 [(alias, zh_name, start_date), ...] —— 保留 alias + 开始日期，供后续匹配用多种策略。
    """
    # NOTE: 一行结构：<td>YYYY-MM-DD[~MM-DD]</td><td><a class="comp-type-*" href="...">...</a>...</td>
    # 捕获: (start_date, alias, inner_html)
    # cubing.com 临近开赛会把 URL 从 /competition/ 切到 /live/，alias 不变 —— 两种都收
    row_pattern = re.compile(
        r'<td>(\d{4}-\d{2}-\d{2})(?:~\d{2}(?:-\d{2})?)?</td>\s*'
        r'<td>\s*<a[^>]*class="comp-type-\w+"[^>]*href="https://cubing\.com/(?:competition|live)/([^"?]+)"[^>]*>(.*?)</a>',
        re.DOTALL
    )
    tag_strip = re.compile(r'<[^>]+>')

    rows = []
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
        for m in row_pattern.finditer(html):
            start_date = m.group(1)
            alias = m.group(2)
            name = tag_strip.sub("", m.group(3)).strip()
            # NOTE: 只收 WCA 赛事——中文名里必含 "WCA"（非 WCA 比赛前端不会出现，抓了也是 noise）
            if name and not alias.startswith("?") and "WCA" in name:
                rows.append((alias, name, start_date))
                count += 1

        print(f"  [{page}/{total_pages}] {count} 条 [{source}]")

    print(f"[INFO] cubing.com: {len(rows)} 条")
    return rows


def fetch_wca_cn_comps():
    """
    通过 WCA API 批量获取所有中国比赛的 WCA ID → {name, short_name, start_date}。
    - name 是完整名（如 "Beijing Winter Open 2013"），stats/data/all_past_comps.json 用此字段
    - short_name 是 WCA 展示用的短名（如 "Beijing 2013"），部分地方用此字段
    - start_date 用于 cubing.com URL alias 和 WCA ID 差异过大（如词序颠倒）时按日期回退匹配
    输出英文 → 中文映射时 name + short_name 两者都作为 key，提高命中率。
    ~738 条记录，每页 100 条 = ~8 次请求。
    """
    cache_file = CACHE_DIR / "wca_cn_comps.json"
    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        # 兼容旧缓存：值须是字典且包含 start_date；否则丢弃缓存
        if data:
            first = next(iter(data.values()))
            if not isinstance(first, dict) or "start_date" not in first:
                data = None
    else:
        data = None

    if data is not None:
        print(f"[INFO] WCA API: {len(data)} 条 [缓存]")
        return data

    wca_id_to_names = {}
    page = 1
    while True:
        url = f"{WCA_API_BASE}/competitions?country_iso2=CN&per_page=100&page={page}"
        resp = fetch_url(url)
        if not resp:
            break
        for c in resp:
            name_full = c.get("name") or c.get("short_name") or ""
            name_short = c.get("short_name") or name_full
            wca_id_to_names[c["id"]] = {
                "name": name_full,
                "short_name": name_short,
                "start_date": c.get("start_date", ""),
            }
        print(f"  [WCA API page {page}] {len(resp)} 条")
        if len(resp) < 100:
            break
        page += 1

    # 写入缓存
    cache_file.write_text(
        json.dumps(wca_id_to_names, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[INFO] WCA API: {len(wca_id_to_names)} 条")
    return wca_id_to_names


def fetch_wca_comp_detail(wca_id):
    """
    单条拉 WCA API detail，用于 ALIAS_TO_WCA_ID_OVERRIDE 里指向非 CN 国家（HK/MO/XA 等）
    的比赛。成功返回 {name, short_name, start_date}，否则 None。缓存到磁盘以免重复请求。
    """
    cache_file = CACHE_DIR / f"wca_comp_{wca_id}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    url = f"{WCA_API_BASE}/competitions/{wca_id}"
    resp = fetch_url(url)
    if not resp:
        return None
    info = {
        "name": resp.get("name") or resp.get("short_name") or "",
        "short_name": resp.get("short_name") or resp.get("name") or "",
        "start_date": resp.get("start_date", ""),
    }
    cache_file.write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")
    return info


def main():
    print("=== 构建中国比赛英文名 → 中文名映射 ===\n")
    start = time.time()

    # NOTE: --refresh 增量模式：只刷新第 1 页（最新比赛）和 WCA API 缓存
    if "--refresh" in sys.argv:
        p1 = CACHE_DIR / "page_1.html"
        wca = CACHE_DIR / "wca_cn_comps.json"
        if p1.exists():
            p1.unlink()
        if wca.exists():
            wca.unlink()
        print("[INFO] 增量模式：已清除第 1 页和 WCA API 缓存\n")

    # Step 1: cubing.com → [(alias, zh_name, start_date), ...]
    print("[Step 1] 从 cubing.com 提取中文名...")
    rows = scrape_cubing_china()

    # Step 2: WCA API → { wca_id: {name, short_name, start_date} }
    print("\n[Step 2] 从 WCA API 获取英文名...")
    wca_id_to_names = fetch_wca_cn_comps()

    # 构建日期 → [wca_id, ...] 索引，作为 alias 匹配失败时的回退
    wca_by_date = {}
    for wca_id, info in wca_id_to_names.items():
        d = info.get("start_date", "")
        if d:
            wca_by_date.setdefault(d, []).append(wca_id)

    # Step 3: 英文名 → 中文名
    # 匹配策略：(0) 硬编码 override；(a) alias 候选命中；(b) 按 start_date + country=CN 唯一回退
    en_to_zh = {}
    matched_by_override = 0
    matched_by_alias = 0
    matched_by_date = 0
    unmatched_samples = []
    for alias, zh_name, start_date in rows:
        matched_names = None  # {name, short_name}

        # (0) 硬编码 override——alias 与 WCA ID 差异大、规则救不回来的老比赛
        if alias in ALIAS_TO_WCA_ID_OVERRIDE:
            wid = ALIAS_TO_WCA_ID_OVERRIDE[alias]
            if wid in wca_id_to_names:
                matched_names = wca_id_to_names[wid]
            else:
                # 非 CN 国家（HK/MO/XA 等）批量拉取没有，单条 detail fetch
                matched_names = fetch_wca_comp_detail(wid)
            if matched_names:
                matched_by_override += 1

        # (a) alias 候选直接命中
        if not matched_names:
            for cand in _alias_to_wca_id_candidates(alias):
                if cand in wca_id_to_names:
                    matched_names = wca_id_to_names[cand]
                    matched_by_alias += 1
                    break

        # (b) 日期唯一回退
        if not matched_names and start_date and len(wca_by_date.get(start_date, [])) == 1:
            matched_names = wca_id_to_names[wca_by_date[start_date][0]]
            matched_by_date += 1

        if matched_names:
            if matched_names.get("name"):       en_to_zh[matched_names["name"]] = zh_name
            if matched_names.get("short_name"): en_to_zh[matched_names["short_name"]] = zh_name
        else:
            unmatched_samples.append((alias, zh_name, start_date))

    matched = matched_by_override + matched_by_alias + matched_by_date
    unmatched = len(rows) - matched
    print(f"\n[INFO] 匹配成功: {matched} (override {matched_by_override} + alias {matched_by_alias} + 日期 {matched_by_date}), 未匹配: {unmatched}")
    if unmatched_samples:
        print(f"[INFO] 未匹配 {len(unmatched_samples)} 条（alias 与 WCA ID 差异大，需硬编码对应）:")
        for a, n, d in unmatched_samples:
            print(f"  - [{d}] {a} → {n}")

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

