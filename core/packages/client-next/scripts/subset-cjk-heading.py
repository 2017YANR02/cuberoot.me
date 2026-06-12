#!/usr/bin/env python3
"""Regenerate public/fonts/lxgw-wenkai-heading.woff2 — the Phase-1 CJK heading subset.

WHY: 整套 LXGW WenKai 楷体 25MB,首屏扛不住。标题里中文字是有限且构建期可知的
(页面标题 useDocumentTitle + 落地页 landing-sections + about),所以静态子集到这些字,
woff2 ~120KB,unicode-range 锁 CJK 按需加载。缺字优雅回退系统宋体。

WHEN TO RERUN: 新增/改了任何会用 .section-title-serif / Fraunces 标题栈渲染中文的标题文案后,
跑一次刷新子集,否则新字会落系统宋体(和楷体标题里其它字不一致)。

USAGE (从 packages/client-next 下):
    uv run --with fonttools --with brotli python scripts/subset-cjk-heading.py

源字体 TTF 不进仓库(25MB);脚本缺它时自动下载到 .tmp/fonts/。
"""
import os
import re
import glob
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))            # packages/client-next
REPO = os.path.abspath(os.path.join(ROOT, "..", ".."))      # repo root
FONTS_TMP = os.path.join(REPO, ".tmp", "fonts")
PUB_FONTS = os.path.join(ROOT, "public", "fonts")
# 衬线标题字重有 400 / 500(少量 600 由 500 近似);各出一档真字重,避免浏览器伪粗发糊。
REL = "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522"
WEIGHTS = [
    (400, "LXGWWenKai-Regular.ttf", "lxgw-wenkai-heading.woff2"),
    (500, "LXGWWenKai-Medium.ttf",  "lxgw-wenkai-heading-500.woff2"),
]

CJK_PUNCT = "，。、；：？！“”‘’（）《》「」『』【】—…·～"


def keep(c: str) -> bool:
    o = ord(c)
    return (0x4E00 <= o <= 0x9FFF) or (0x3400 <= o <= 0x4DBF) or c in CJK_PUNCT


def serif_class_names() -> set[str]:
    """从 CSS 解析出哪些 class 用了 var(--font-serif) / 'Fraunces' —— 这些类渲染的中文才需要楷体。"""
    classes: set[str] = set()
    css_files = (glob.glob("app/**/*.css", recursive=True)
                 + glob.glob("components/**/*.css", recursive=True))
    for f in css_files:
        if os.path.basename(f) == "fonts.css":   # @font-face 定义本身,跳过
            continue
        try:
            css = open(f, encoding="utf-8").read()
        except OSError:
            continue
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
            sel, body = m.group(1), m.group(2)
            if "--font-serif" in body or "Fraunces" in body:
                classes |= set(re.findall(r"\.([A-Za-z0-9_-]+)", sel))
    return classes


def collect_heading_chars() -> str:
    os.chdir(ROOT)
    blob: list[str] = []
    serif_classes = serif_class_names()
    for f in glob.glob("app/**/*.tsx", recursive=True) + glob.glob("components/**/*.tsx", recursive=True):
        try:
            lines = open(f, encoding="utf-8").read().splitlines()
        except OSError:
            continue
        t = "\n".join(lines)
        # 1) 所有 useDocumentTitle('中文', ...) 第一参 = 页面 H1
        blob += re.findall(r"useDocumentTitle\(\s*'([^']*)'", t)
        # 2) 凡是用衬线类的元素,收其文本(同行 + 后两行,覆盖 JSX 文本/tr() 跨行)
        for i, line in enumerate(lines):
            if "className" in line and any(c in line for c in serif_classes):
                blob.append(" ".join(lines[i:i + 3]))
    # 3) 数据驱动的标题文本(板块标题 / hero / 模块名等,不是 JSX 字面量,className 扫不到)。
    data_files: list[str] = []
    # landing-sections 可能是 .ts 或 .tsx,用 glob 匹配扩展名(曾写死 .ts 漏掉 .tsx 的"探")
    ls = glob.glob("lib/landing-sections.*")
    if not ls:
        print("WARN: lib/landing-sections.* not found")
    data_files += ls
    # 固定路径含 [lang] 字面量,用 os.path.exists(glob 会把方括号当字符类)
    for f in ["app/[lang]/page.tsx", "app/[lang]/code/page.tsx"]:
        if os.path.exists(f):
            data_files.append(f)
        else:
            print(f"WARN: data-heading source not found: {f}")
    for f in data_files:
        blob.append(open(f, encoding="utf-8").read())
    chars = sorted({c for c in "".join(blob) if keep(c)})
    return "".join(chars)


def ensure_ttf(ttf_name: str) -> str:
    path = os.path.join(FONTS_TMP, ttf_name)
    if not os.path.exists(path):
        os.makedirs(FONTS_TMP, exist_ok=True)
        url = f"{REL}/{ttf_name}"
        print(f"downloading {url}")
        urllib.request.urlretrieve(url, path)
    return path


def main() -> None:
    from fontTools.subset import main as subset_main

    chars = collect_heading_chars()
    txt_path = os.path.join(FONTS_TMP, ".cjk-heading.txt")
    os.makedirs(FONTS_TMP, exist_ok=True)
    open(txt_path, "w", encoding="utf-8").write(chars)
    print(f"heading CJK chars: {len(chars)}")

    for weight, ttf_name, out_name in WEIGHTS:
        ttf = ensure_ttf(ttf_name)
        out = os.path.join(PUB_FONTS, out_name)
        subset_main([
            ttf,
            f"--text-file={txt_path}",
            f"--output-file={out}",
            "--flavor=woff2",
            "--layout-features=",
            "--no-hinting",
            "--desubroutinize",
            "--drop-tables+=DSIG",
            "--no-recommended-glyphs",
        ])
        print(f"wrote {out_name} (weight {weight}, {os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    sys.exit(main())
