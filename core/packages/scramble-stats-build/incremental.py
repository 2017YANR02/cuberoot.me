#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
WCA 打乱增量取数 (Phase 1)

干的事:
  1. 拿 results export 元数据 (/api/v0/export/public) -> 下 TSV zip (按 export_date 缓存,已有则跳过)
  2. 解出 Scrambles / Competitions 两张 TSV (动态读表头, 按列名映射, 不硬编码顺序)
  3. 从 stats/std.csv 首列构建 "已处理 scrambleId 集合" (id // 1000)
  4. 过滤出 333 系列 (333/oh/ft/bf/mbf/fm) 且未处理过的新打乱
  5. 复用 input/wca_scramble_processor 的 step1/2/3 (拆多盲 + 去宽层) -> 只含新行的 id,scramble
产出 (全部落 incremental/):
  - new_split_mbf.csv      拆多盲后 final_id + 元数据 (给 build_wca_cross join 比赛名/日期/轮次)
  - new_no_wide_move.txt   去宽层后 final_id,scramble -> 喂给 solver (Phase 2)
  - export_date.txt        本次 export 日期 -> 编排注入 SCRAMBLE_STATS_STAMP (稳定时间戳)
  - tsv/Competitions.tsv   原样抽出; 真实模式下顺手刷 ../competitions.tsv (master)
  - new_watermark.txt      本批最大 scrambleId (仅信息; 幂等实际靠 std.csv 反推已处理集, 编排不读它)

用法 (--data-dir 指向数据根, 或设 $SCRAMBLE_DATA_DIR; 编排器 update_cross_stats.ps1 自动传):
  uv run python incremental.py --data-dir DIR                    # 正常: 下载最新 export
  uv run python incremental.py --data-dir DIR --use-cached       # 不联网: 用 cache/ 最新 export zip
  uv run python incremental.py --data-dir DIR --dry-run          # 只读: 算新增数, 不刷 competitions.tsv (master)
  uv run python incremental.py --data-dir DIR --export-zip X.zip # 用已下好的 zip
  uv run python incremental.py --data-dir DIR --tsv-dir DIR2     # 用已解压的 TSV 目录
  uv run python incremental.py --data-dir DIR --source-csv F.csv --min-scramble-id N   # 测试
"""
from __future__ import annotations

import argparse
import csv
import glob
import http.client
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile

# Windows 管道默认 GBK, 复用模块里有 emoji print -> 强制 UTF-8
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 数据根目录 (含 input/ stats/ incremental/ competitions.tsv) 由 --data-dir / $SCRAMBLE_DATA_DIR 注入,
# main() 解析后回填下面的路径全局。本文件是代码 (进 git), 不绑定任何机器上的数据位置。

# 字段大上限: WCA TSV 单行可能很长 (多盲 | 拼接)
csv.field_size_limit(1 << 24)

EXPORT_META_URL = "https://www.worldcubeassociation.org/api/v0/export/public"
EVENTS_333 = {"333", "333oh", "333ft", "333bf", "333mbf", "333fm"}
INFO_COLS = ["id", "scramble", "competition_id", "event_id",
             "round_type_id", "group_id", "is_extra", "scramble_num"]

DATA_DIR = ""    # ↓ main() 从 --data-dir / $SCRAMBLE_DATA_DIR 解析后回填
INCR_DIR = ""    # = DATA_DIR/incremental
CACHE_DIR = ""   # = INCR_DIR/cache
STD_CSV = ""     # = DATA_DIR/stats/std.csv


def _norm(name: str) -> str:
    return name.strip().lower().replace("_", "").replace(" ", "")


def build_colmap(header: list[str], aliases: dict[str, list[str]]) -> dict[str, int]:
    """target 列名 -> header 下标, 按归一化名匹配, 抗 camelCase/snake_case 漂移。"""
    norm_idx = {_norm(h): i for i, h in enumerate(header)}
    out: dict[str, int] = {}
    for target, alts in aliases.items():
        for a in alts:
            if _norm(a) in norm_idx:
                out[target] = norm_idx[_norm(a)]
                break
    return out


SCRAMBLE_ALIASES = {
    "id": ["id", "scramble_id"],
    "scramble": ["scramble"],
    "competition_id": ["competition_id"],
    "event_id": ["event_id"],
    "round_type_id": ["round_type_id"],
    "group_id": ["group_id"],
    "is_extra": ["is_extra"],
    "scramble_num": ["scramble_num"],
}

COMP_ALIASES = {
    "id": ["id", "competition_id"],
    "name": ["name", "cell_name", "short_name"],
    "start_date": ["start_date", "startdate"],
    "end_date": ["end_date", "enddate"],
    # WCA export 把日期拆成 year/month/day + end_year/end_month/end_day 六列 (无 start_date/end_date),
    # 下面补这六列做兜底 → refresh_competitions 拼成 YYYY-MM-DD。
    "year": ["year"],
    "month": ["month"],
    "day": ["day"],
    "end_year": ["end_year", "endyear"],
    "end_month": ["end_month", "endmonth"],
    "end_day": ["end_day", "endday"],
}


def _ymd(y: str, m: str, d: str) -> str:
    """year/month/day 三列 → 'YYYY-MM-DD';任一缺/NULL/0 → ''。"""
    if not y or y in ("0", "NULL") or not m or m in ("0", "NULL") or not d or d in ("0", "NULL"):
        return ""
    try:
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except ValueError:
        return ""


def refresh_competitions(src_tsv: str, dest_tsv: str) -> None:
    """export Competitions.tsv -> master 4 列 id<tab>name<tab>start_date<tab>end_date (build_wca_cross 要的格式)。"""
    with open(src_tsv, "r", encoding="utf-8", newline="") as f:
        rd = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(rd, None)
        if header is None:
            print("  competitions: 空 TSV, 跳过刷新")
            return
        cm = build_colmap(header, COMP_ALIASES)
        if "id" not in cm or "name" not in cm:
            print(f"  competitions: 表头缺 id/name, 跳过刷新 (header={header})")
            return
        n = 0
        with open(dest_tsv, "w", encoding="utf-8", newline="") as out:
            out.write("id\tname\tstart_date\tend_date\n")
            for row in rd:
                def g(k):
                    i = cm.get(k)
                    return row[i] if i is not None and i < len(row) else ""
                start = g('start_date') or _ymd(g('year'), g('month'), g('day'))
                end = g('end_date') or _ymd(g('end_year'), g('end_month'), g('end_day'))
                out.write(f"{g('id')}\t{g('name')}\t{start}\t{end}\n")
                n += 1
    print(f"  competitions.tsv 刷新 {n} 行 -> {dest_tsv}")


DOWNLOAD_TRIES = 6
TTY = sys.stdout.isatty()  # 真人终端 -> \r 单行原地刷新; 被 AI/CI/日志捕获 -> 只打里程碑, 不刷屏


def _progress(msg: str) -> None:
    """下载进度: 真人终端就地重写同一行 (不滚屏), 非 tty 静默 (由 _milestone 打里程碑)。"""
    if TTY:
        print(f"\r    {msg:<48}", end="", flush=True)


def _progress_end() -> None:
    if TTY:
        print(flush=True)  # 收尾换行, 后续输出不接在进度行尾


def _download_with_progress(url: str, dest: str) -> None:
    """流式下载 366MB export: 单行进度 + Range 断点续传重试 + 原子落盘。

    坑: 连接被中途掐断 (代理/网关超时) 时 resp.read() 只是返回空 chunk, 不抛异常 ->
    裸 while 循环会把残缺文件当成"下好了"。必须拿 Content-Length 比对实际字节数,
    差额走 Range 续传 (WCA export 返回 Accept-Ranges: bytes)。
    下载期间写 .part, 只有字节数对得上才 rename -> cache/ 里永远不会出现残缺成品。
    """
    part = dest + ".part"
    # 上次残缺的成品当续传起点, 别把已下的几百 MB 丢了重来
    if os.path.exists(dest) and not zipfile.is_zipfile(dest):
        os.replace(dest, part)

    for attempt in range(1, DOWNLOAD_TRIES + 1):
        done = os.path.getsize(part) if os.path.exists(part) else 0
        req = urllib.request.Request(url)
        if done:
            req.add_header("Range", f"bytes={done}-")
        try:
            with urllib.request.urlopen(req) as resp:
                if done and resp.status != 206:  # 服务器不认 Range -> 只能从头下
                    print("    服务端不支持 Range, 从头下载", flush=True)
                    done = 0
                    os.remove(part)
                total = done + int(resp.headers.get("Content-Length") or 0)
                tag = f"续传 (第 {attempt} 次) " if done else ""
                mark = total // 4 if total else 0   # 非 tty: 每 25% 一行, 免几分钟静默像卡死
                next_mark = (done // mark + 1) * mark if mark else 0
                tick = 0
                with open(part, "ab" if done else "wb") as out:
                    while True:
                        chunk = resp.read(1 << 20)  # 1 MB
                        if not chunk:
                            break
                        out.write(chunk)
                        done += len(chunk)
                        tick += 1
                        pct = f" ({done*100//total}%)" if total else ""
                        if TTY and tick % 4 == 0:  # 每 4 MB 刷新同一行
                            _progress(f"{tag}{done/1e6:.0f}/{total/1e6:.0f} MB{pct}")
                        elif not TTY and mark and done >= next_mark:
                            print(f"    {tag}{done/1e6:.0f}/{total/1e6:.0f} MB{pct}", flush=True)
                            next_mark += mark
                _progress_end()
        except (urllib.error.URLError, http.client.HTTPException, OSError) as e:
            _progress_end()
            print(f"    下载出错 ({type(e).__name__}: {e}), 重试 {attempt}/{DOWNLOAD_TRIES}", flush=True)
            time.sleep(2 * attempt)
            continue

        got = os.path.getsize(part)
        if not total:  # 无 Content-Length: 没法校验, 只能信它
            break
        if got >= total:
            break
        print(f"    连接提前关闭 ({got/1e6:.0f}/{total/1e6:.0f} MB), 续传 {attempt}/{DOWNLOAD_TRIES}", flush=True)
        time.sleep(2 * attempt)
    else:
        raise SystemExit(f"下载失败: 重试 {DOWNLOAD_TRIES} 次仍不完整 ({url}); 残段留在 {part}, 下次自动续传")

    os.replace(part, dest)


def _prune_cache(keep_path: str) -> None:
    """cache/ 恒只留当前 export zip(用户要求"永远只有一个"), 删其余 WCA_export_*.tsv.zip。"""
    keep = os.path.abspath(keep_path)
    removed = 0
    stale = (glob.glob(os.path.join(CACHE_DIR, "WCA_export_*.tsv.zip"))
             + glob.glob(os.path.join(CACHE_DIR, "WCA_export_*.tsv.zip.part")))  # 过期残段也扫掉
    for p in stale:
        if os.path.abspath(p) != keep:
            try:
                os.remove(p)
                removed += 1
            except OSError:
                pass
    if removed:
        print(f"  cache 清理: 删 {removed} 个旧 export zip(只留 {os.path.basename(keep)})")


def fetch_export(args) -> tuple[str, dict]:
    """返回 (tsv_dir 含 Scrambles.tsv/Competitions.tsv, meta)。"""
    os.makedirs(CACHE_DIR, exist_ok=True)

    if args.tsv_dir:
        return args.tsv_dir, {"source": "tsv-dir", "export_date": "manual"}

    zip_path = args.export_zip
    meta: dict = {"source": "manual-zip", "export_date": "manual"}
    if not zip_path and getattr(args, "use_cached", False):
        # 用本地 cache/ 最新 export, 完全不联网。export_date 从文件名还原, 保住稳定 stamp。
        cands = sorted(c for c in glob.glob(os.path.join(CACHE_DIR, "WCA_export_*.tsv.zip"))
                       if zipfile.is_zipfile(c))
        if not cands:
            raise SystemExit("--use-cached 但 cache/ 无合法 export zip; 先正常下载一次")
        zip_path = cands[-1]
        m = re.search(r"WCA_export_(\d{4}-\d{2}-\d{2})", os.path.basename(zip_path))
        meta = {"source": "cached", "export_date": m.group(1) if m else "cached"}
        print(f"  用本地缓存 {zip_path} ({os.path.getsize(zip_path)/1e6:.0f} MB), export_date={meta['export_date']}, 不联网")
    if not zip_path:
        print(f"拉取 export 元数据 {EXPORT_META_URL}")
        with urllib.request.urlopen(EXPORT_META_URL) as r:
            meta = json.load(r)
        url = meta.get("tsv_url") or meta.get("tsvUrl")
        export_date = (meta.get("export_date") or meta.get("exportDate") or "unknown")[:10]
        meta["export_date"] = export_date
        zip_path = os.path.join(CACHE_DIR, f"WCA_export_{export_date}.tsv.zip")
        # 校验缓存完整性: 残缺/中断的下载 size 也可能 > 1MB, 必须确认是合法 zip 否则重下
        cached_ok = (os.path.exists(zip_path) and os.path.getsize(zip_path) > 1_000_000
                     and zipfile.is_zipfile(zip_path))
        if cached_ok:
            print(f"  已缓存 {zip_path} ({os.path.getsize(zip_path)/1e6:.0f} MB), 跳过下载")
        else:
            if os.path.exists(zip_path) or os.path.exists(zip_path + ".part"):
                print(f"  缓存残缺 (非合法 zip), 续传补齐")
            print(f"  下载 {url} -> {zip_path}", flush=True)
            _download_with_progress(url, zip_path)
            if not zipfile.is_zipfile(zip_path):
                raise SystemExit(f"下载的 export 不是合法 zip: {zip_path}")
            print(f"  下好 {os.path.getsize(zip_path)/1e6:.0f} MB")

    if not args.export_zip:  # 手动 --export-zip(可能在 cache 外)不清理;正常/缓存/--use-cached 路径恒留一个
        _prune_cache(zip_path)

    out_dir = os.path.join(INCR_DIR, "tsv")
    os.makedirs(out_dir, exist_ok=True)
    scr_tsv, comp_tsv = os.path.join(out_dir, "Scrambles.tsv"), os.path.join(out_dir, "Competitions.tsv")
    # 同版 export 且 TSV 已在 -> 跳过重新解压(下游只读这俩, 没人改, 可跨次复用; 省 ~30s 本地 I/O)。
    # 标记仅在解压成功后落盘, 故被打断的半截解压(标记缺/旧)下次必重解, 不会复用残文件。
    marker = os.path.join(out_dir, ".export_date")
    ed = str(meta.get("export_date", "") or "")
    prev = ""
    if os.path.exists(marker):
        with open(marker, "r", encoding="utf-8") as f:
            prev = f.read().strip()
    if (not args.export_zip and ed and ed not in ("manual", "cached", "source-csv")
            and prev == ed and os.path.exists(scr_tsv) and os.path.exists(comp_tsv)):
        print(f"  tsv/ 已是 {ed} 的解压结果, 跳过重新解压")
        return out_dir, meta
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            low = name.lower()
            if "scramble" in low and low.endswith(".tsv"):
                _extract_to(z, name, scr_tsv)
            elif "competition" in low and low.endswith(".tsv"):
                _extract_to(z, name, comp_tsv)
    if ed and ed not in ("manual", "cached", "source-csv"):
        with open(marker, "w", encoding="utf-8") as f:
            f.write(ed)
    return out_dir, meta


def _extract_to(z: zipfile.ZipFile, member: str, dest: str) -> None:
    try:
        total = z.getinfo(member).file_size
    except KeyError:
        total = 0
    done = 0
    step = 1 << 27  # 非 tty 每 128 MB 报一次 (大 TSV 解压几十秒, 别静默); tty 走单行刷新
    next_mark = step
    tick = 0
    name = os.path.basename(dest)
    with z.open(member) as src, open(dest, "wb") as dst:
        while True:
            chunk = src.read(1 << 20)
            if not chunk:
                break
            dst.write(chunk)
            done += len(chunk)
            tick += 1
            tail = f"/{total/1e6:.0f} MB" if total else " MB"
            if TTY and tick % 16 == 0:
                _progress(f"解压 {name} {done/1e6:.0f}{tail}")
            elif not TTY and done >= next_mark:
                print(f"    解压 {name} {done/1e6:.0f}{tail}", flush=True)
                next_mark += step
    _progress_end()
    print(f"  解出 {member} -> {name}")


def load_processed_ids() -> set[int]:
    """从 std.csv 首列 (final_id) // 1000 还原已处理 scrambleId 集合。"""
    seen: set[int] = set()
    if not os.path.exists(STD_CSV):
        print(f"  std.csv 不存在 ({STD_CSV}), 视作首次全量")
        return seen
    with open(STD_CSV, "r", encoding="utf-8") as f:
        next(f, None)  # header
        for line in f:
            c = line.find(",")
            if c <= 0:
                continue
            try:
                seen.add(int(line[:c]) // 1000)
            except ValueError:
                continue
    return seen


def iter_source_rows(tsv_dir: str, args):
    """yield dict(INFO_COLS) for 333 系列源行。多盲 | 还原成 \\n。"""
    if args.source_csv:
        # 测试模式: 直接读 input 形状 csv (已是 \n 多行)
        with open(args.source_csv, "r", encoding="utf-8", newline="") as f:
            rd = csv.reader(f)
            header = next(rd, None)
            if header is None:
                return
            cm = build_colmap(header, {c: [c] for c in INFO_COLS})
            for row in rd:
                yield {c: (row[cm[c]] if c in cm and cm[c] < len(row) else "") for c in INFO_COLS}
        return

    path = os.path.join(tsv_dir, "Scrambles.tsv")
    with open(path, "r", encoding="utf-8", newline="") as f:
        rd = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(rd, None)
        if header is None:
            raise SystemExit(f"Scrambles.tsv 空文件 (export 损坏?): {path}")
        cm = build_colmap(header, SCRAMBLE_ALIASES)
        missing = [c for c in ("id", "scramble", "event_id") if c not in cm]
        if missing:
            raise SystemExit(f"Scrambles.tsv 缺关键列 {missing}; 表头={header}")
        seen = 0
        for row in rd:
            seen += 1
            if seen % 2_000_000 == 0:
                print(f"  扫描 Scrambles.tsv {seen // 1_000_000}M 行 ...", file=sys.stderr, flush=True)
            ev = row[cm["event_id"]] if cm["event_id"] < len(row) else ""
            if ev not in EVENTS_333:
                continue
            scr = row[cm["scramble"]] if cm["scramble"] < len(row) else ""
            scr = scr.replace("|", "\n")  # 多盲: | -> 换行, step1 按 \n 拆
            yield {
                "id": row[cm["id"]],
                "scramble": scr,
                "competition_id": _get(row, cm, "competition_id"),
                "event_id": ev,
                "round_type_id": _get(row, cm, "round_type_id"),
                "group_id": _get(row, cm, "group_id"),
                "is_extra": _get(row, cm, "is_extra"),
                "scramble_num": _get(row, cm, "scramble_num"),
            }


def _get(row, cm, key):
    i = cm.get(key)
    return row[i] if i is not None and i < len(row) else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.environ.get("SCRAMBLE_DATA_DIR"),
                    help="数据根目录 (含 input/ stats/ incremental/ competitions.tsv); 或设 $SCRAMBLE_DATA_DIR")
    ap.add_argument("--export-zip")
    ap.add_argument("--tsv-dir")
    ap.add_argument("--source-csv")
    ap.add_argument("--use-cached", action="store_true",
                    help="用本地 cache/ 最新 export zip, 不联网/不查官方元数据 (export_date 从文件名还原)")
    ap.add_argument("--dry-run", action="store_true",
                    help="只读: 下载+算新增数, 不覆写 competitions.tsv (master)")
    ap.add_argument("--min-scramble-id", type=int, default=None,
                    help="测试: 忽略已处理集合, 只取 scrambleId > 此值")
    args = ap.parse_args()

    if not args.data_dir:
        raise SystemExit("缺数据根: 传 --data-dir 或设 $SCRAMBLE_DATA_DIR (含 input/ stats/ incremental/)")
    global DATA_DIR, INCR_DIR, CACHE_DIR, STD_CSV
    DATA_DIR = os.path.abspath(args.data_dir)
    INCR_DIR = os.path.join(DATA_DIR, "incremental")
    CACHE_DIR = os.path.join(INCR_DIR, "cache")
    STD_CSV = os.path.join(DATA_DIR, "stats", "std.csv")
    sys.path.insert(0, os.path.join(DATA_DIR, "input"))
    from wca_scramble_processor import fix_scramble  # noqa: E402  去宽层 fork helper (仍在 data_dir/input; 可选后续 vendor 进仓库)

    os.makedirs(INCR_DIR, exist_ok=True)
    # 清掉上次残留: 保证"0 新打乱"时下游读不到陈旧文件 (否则会重复 append 进 master)
    for stale in ("new_no_wide_move.txt", "new_split_mbf.csv", "new_no_wide_move_std.csv",
                  "new_watermark.txt", "export_date.txt"):
        sp = os.path.join(INCR_DIR, stale)
        if os.path.exists(sp):
            os.remove(sp)

    if args.source_csv:
        tsv_dir, meta = None, {"export_date": "source-csv"}  # 测试: 不碰网络
    else:
        tsv_dir, meta = fetch_export(args)
    export_date = meta.get("export_date", "manual")

    # 真实模式: 顺手刷新 master competitions.tsv (新比赛的名字/日期, 给 build_wca_cross join)。
    # --dry-run 严格只读, 不碰这个 master (只下载 + 算新增数)。
    if tsv_dir and not args.dry_run:
        comp_src = os.path.join(tsv_dir, "Competitions.tsv")
        if os.path.exists(comp_src):
            refresh_competitions(comp_src, os.path.join(DATA_DIR, "competitions.tsv"))

    # 供编排注入 build 的 SCRAMBLE_STATS_STAMP (同一份 export 重跑 -> JSON/下载 txt 逐字节稳定)
    with open(os.path.join(INCR_DIR, "export_date.txt"), "w", encoding="utf-8") as f:
        f.write(export_date)

    if args.min_scramble_id is not None:
        processed: set[int] = set()
        threshold = args.min_scramble_id
        print(f"测试模式: 取 scrambleId > {threshold}")
    else:
        processed = load_processed_ids()
        threshold = None
        print(f"已处理 scrambleId: {len(processed)} 个 (max={max(processed) if processed else 0})")

    new_rows: list[dict] = []
    by_event: dict[str, int] = {}
    max_new_sid = 0
    scanned = 0
    for r in iter_source_rows(tsv_dir, args):
        scanned += 1
        try:
            sid = int(str(r["id"]).split("_")[0])
        except (ValueError, KeyError):
            continue
        if threshold is not None:
            if sid <= threshold:
                continue
        elif sid in processed:
            continue
        new_rows.append(r)
        by_event[r["event_id"]] = by_event.get(r["event_id"], 0) + 1
        if sid > max_new_sid:
            max_new_sid = sid

    print(f"扫描 333 系列源行后, 新增 {len(new_rows)} 条 (按项目: {by_event})")
    if not new_rows:
        print("没有新打乱, 退出。")
        return 0

    # 拆多盲 + 构造 final_id。不复用 step1: 它在 0 多盲时早退会漏掉非多盲的 +001。
    # final_id = str(scrambleId) + zfill(3, seq); 非多盲 seq=1, 多盲 1..n。
    expanded: list[tuple[str, str, dict]] = []
    for r in new_rows:
        base = str(r["id"]).split("_")[0]
        if r["event_id"] == "333mbf":
            subs = [s.strip() for s in str(r["scramble"]).split("\n") if s.strip()]
            if not subs:
                # 空/损坏的 mbf 拼接 -> 0 子打乱 -> 该 sid 永不落 std.csv -> 每次重取。告警可见而非静默。
                print(f"  [warn] 333mbf scrambleId={base} 拆出 0 个子打乱 (scramble 空/损坏), 跳过")
            for seq, sub in enumerate(subs, 1):
                assert seq < 1000, f"333mbf seq {seq} >= 1000 破坏 final_id//1000 反推 (sid={base})"
                expanded.append((f"{base}{seq:03d}", sub, r))
        else:
            expanded.append((f"{base}001", str(r["scramble"]).strip(), r))

    # new_split_mbf.csv: final_id + 元数据 (给 Phase 3 join 比赛名/日期/轮次)
    split_mbf = os.path.join(INCR_DIR, "new_split_mbf.csv")
    with open(split_mbf, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(INFO_COLS)
        for fid, scr, r in expanded:
            w.writerow([fid, scr, r["competition_id"], r["event_id"],
                        r["round_type_id"], r["group_id"], r["is_extra"], r["scramble_num"]])

    # new_no_wide_move.txt: final_id, 去宽层后打乱 -> solver 输入
    no_wide = os.path.join(INCR_DIR, "new_no_wide_move.txt")
    with open(no_wide, "w", encoding="utf-8") as f:
        for fid, scr, _r in expanded:
            f.write(f"{fid},{fix_scramble(scr)}\n")

    with open(os.path.join(INCR_DIR, "new_watermark.txt"), "w", encoding="utf-8") as f:
        f.write(str(max_new_sid))

    print("=" * 50)
    print(f"export_date={export_date}  扫描源行={scanned}")
    print(f"新 scrambleId={len(new_rows)}  拆多盲后行={len(expanded)}  本批 max scrambleId={max_new_sid}")
    print(f"split_mbf -> {split_mbf}")
    print(f"solver 输入 -> {no_wide}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
