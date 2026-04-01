"""
reco.nz 爬虫脚本
利用服务器端 solver[] 筛选参数获取指定选手的 solve ID，再逐个爬取详情页。

用法:
    python scrape.py "Xuanyi Geng"
    python scrape.py "Yiheng Wang"
"""
import requests
import re
import json
import sys

# NOTE: 强制 stdout 使用 UTF-8，避免 Windows GBK 编码问题
sys.stdout.reconfigure(encoding='utf-8')
import time
import os

# NOTE: 每次请求间隔（秒），避免给服务器造成压力
REQUEST_DELAY = 0.3

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_URL = "https://reco.nz/solve/index"
DETAIL_URL = "https://reco.nz/solve/{id}"


# NOTE: 进度汇报间隔（条数）
PROGRESS_INTERVAL = 20


# ========== 第一阶段：从列表页获取 solve ID ==========
def fetch_solve_ids(solver_name):
    """
    利用服务器端 solver[] 筛选参数，翻页获取指定选手的全部 solve ID。
    比扫描全部页面快得多。
    """
    all_ids = []
    page = 1

    print(f"📋 阶段 1/2: 获取 {solver_name} 的 solve 列表...")
    while True:
        params = {'solver[]': solver_name, 'page': page}
        resp = requests.get(INDEX_URL, params=params, timeout=15)
        resp.raise_for_status()

        rows = re.findall(
            r"class='solve-row'\s+data-id='(\d+)'>",
            resp.text
        )

        if not rows:
            break

        all_ids.extend([int(sid) for sid in rows])
        print(f"  第 {page} 页: {len(rows)} 条 (累计 {len(all_ids)})")
        page += 1
        time.sleep(0.1)

    return sorted(all_ids)


# ========== 第二阶段：解析详情页 ==========
def parse_solve_page(html):
    """解析 reco.nz 详情页 HTML，提取完整复盘数据"""
    result = {}

    # 1. h1: 选手名 + 成绩 + 项目
    m = re.search(
        r'<a[^>]*id="solver-link"[^>]*>([^<]+)</a>\s*-\s*([\d.]+)\s+(\S+)\s+solve',
        html
    )
    if m:
        result['person'] = m.group(1).strip()
        result['rawTime'] = float(m.group(2))
        result['event'] = m.group(3)

    # 2. h3: 日期 + 比赛 + 复盘者
    m = re.search(
        r'<h3>\s*([\d-]+)\s*-\s*(.+?)\s*-\s*reconstruction by\s*'
        r'<a[^>]*id="reconstructor-link"[^>]*>([^<]+)</a>',
        html
    )
    if m:
        result['date'] = m.group(1).strip()
        result['comp'] = m.group(2).strip()
        result['reconer'] = m.group(3).strip()

    # 3. 核心：从 <div id="reconstruction"> 提取打乱和解法
    recon_match = re.search(
        r'<div id="reconstruction">(.*?)</div>', html, re.DOTALL
    )
    if recon_match:
        raw = recon_match.group(1)
        lines = re.split(r'<br\s*/?>', raw)
        lines = [line.strip() for line in lines if line.strip()]
        if lines:
            result['scramble'] = lines[0]
            result['solution'] = '\n'.join(lines[1:])

    # 4. 统计表
    table_match = re.search(
        r"<table id='solvestats'>(.*?)</table>", html, re.DOTALL
    )
    if table_match:
        rows = re.findall(r'<tr>(.*?)</tr>', table_match.group(1), re.DOTALL)
        for row in rows:
            cells = re.findall(r'<t[hd]>(.*?)</t[hd]>', row)
            if cells and cells[0] == 'STM' and len(cells) > 1:
                try:
                    result['stm'] = int(cells[1])
                except ValueError:
                    pass
            elif cells and cells[0] == 'STPS' and len(cells) > 1:
                try:
                    result['tps'] = float(cells[1])
                except ValueError:
                    pass

    # 5. Method（从统计表表头推断）
    if table_match:
        headers_row = re.findall(r'<tr>(.*?)</tr>', table_match.group(1), re.DOTALL)
        if headers_row:
            headers = re.findall(r'<th>(.*?)</th>', headers_row[0])
            if 'ZBLL' in headers or 'ZBLS' in headers:
                result['method'] = 'ZB'
            elif 'PLL' in headers or 'OLL' in headers:
                result['method'] = 'CFOP'
            elif 'CMLL' in headers or 'LSE' in headers:
                result['method'] = 'Roux'

    # 6. Average
    m = re.search(r'=\s*([\d.]+)\s+average of\s+(\d+)', html)
    if m:
        result['average'] = float(m.group(1))

    return result


def map_to_recon_json(reco_data, reco_id):
    """将爬取数据映射到 cuberoot.me recon 系统 JSON 格式"""
    mapped = {
        'source': f'reco.nz/solve/{reco_id}',
        'recoNzId': reco_id,
        'official': True,
        'event': reco_data.get('event', ''),
        'method': reco_data.get('method'),
        'date': reco_data.get('date'),
        'comp': reco_data.get('comp'),
        'person': reco_data.get('person'),
        'rawTime': reco_data.get('rawTime'),
        'value': str(reco_data.get('rawTime', '')),
        'average': reco_data.get('average'),
        'solution': reco_data.get('solution'),
        'wcaScramble': reco_data.get('scramble'),
        'stm': reco_data.get('stm'),
        'tps': reco_data.get('tps'),
        'reconer': reco_data.get('reconer'),
        'note': f'Imported from reco.nz/solve/{reco_id}',
    }
    return {k: v for k, v in mapped.items() if v is not None}


# ========== 主流程 ==========
def main():
    if len(sys.argv) < 2:
        print("用法: python scrape.py \"Solver Name\"")
        sys.exit(1)

    solver_name = sys.argv[1]
    safe_name = solver_name.lower().replace(' ', '_')
    output_file = os.path.join(OUTPUT_DIR, f"reco_data_{safe_name}.jsonl")

    # 阶段 1: 获取 solve ID 列表
    solve_ids = fetch_solve_ids(solver_name)
    if not solve_ids:
        print(f"❌ 未在 reco.nz 找到 {solver_name} 的任何复盘")
        return

    print(f"  ✅ 共找到 {len(solve_ids)} 条 (ID: {solve_ids[0]}~{solve_ids[-1]})")

    # 断点续爬：跳过已有记录
    already_scraped = set()
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    already_scraped.add(rec.get('recoNzId'))
                except json.JSONDecodeError:
                    pass
        if already_scraped:
            print(f"  ⏭️  已有 {len(already_scraped)} 条历史记录，跳过")

    remaining = [sid for sid in solve_ids if sid not in already_scraped]
    if not remaining:
        print("  ✅ 所有记录已爬取完毕，无需操作")
        return

    # 阶段 2: 逐个爬取详情页
    print(f"\n🔍 阶段 2/2: 爬取 {len(remaining)} 条详情页...")
    success = 0
    errors = 0

    with open(output_file, 'a', encoding='utf-8') as out:
        for i, sid in enumerate(remaining):
            # 每 PROGRESS_INTERVAL 条或最后一条时打印进度
            cur = i + 1
            if cur == 1 or cur % PROGRESS_INTERVAL == 0 or cur == len(remaining):
                print(f'  [{cur}/{len(remaining)}] ({cur*100//len(remaining)}%)')

            try:
                resp = requests.get(DETAIL_URL.format(id=sid), timeout=15)
                if resp.status_code == 404:
                    errors += 1
                    continue
                resp.raise_for_status()

                data = parse_solve_page(resp.text)
                mapped = map_to_recon_json(data, sid)

                out.write(json.dumps(mapped, ensure_ascii=False) + '\n')
                out.flush()
                success += 1

            except Exception as e:
                errors += 1

            time.sleep(REQUEST_DELAY)

    # 完成汇总
    print(f"\n\n✅ 完成！成功 {success} 条" + (f"，失败 {errors} 条" if errors else ""))
    print(f"📁 输出文件: {output_file}")

    # 展示爬到的数据摘要
    print(f"\n{'─' * 60}")
    print(f"{'ID':>6} {'Event':>5} {'Time':>6} {'STM':>4} {'TPS':>6} Competition")
    print(f"{'─' * 60}")
    with open(output_file, 'r', encoding='utf-8') as f:
        for line in f:
            rec = json.loads(line)
            print(f"{rec.get('recoNzId', ''):>6} "
                  f"{rec.get('event', ''):>5} "
                  f"{rec.get('rawTime', ''):>6} "
                  f"{rec.get('stm', ''):>4} "
                  f"{rec.get('tps', ''):>6} "
                  f"{rec.get('comp', '')}")


if __name__ == '__main__':
    main()
