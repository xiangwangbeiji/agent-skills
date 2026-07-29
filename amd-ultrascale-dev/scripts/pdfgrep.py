#!/usr/bin/env python3
"""pdfgrep.py - AMD/Xilinx UG 手册检索工具(供 AI agent 调用)

用法:
  python pdfgrep.py list                       列出可用的 PDF 手册
  python pdfgrep.py toc <doc>                  输出手册书签目录(章节+页码)
  python pdfgrep.py search <doc> <keyword>     在手册中搜索关键词, 返回命中页码+上下文
  python pdfgrep.py read <doc> <pages>         提取指定页文本, 如 87 或 87-92 (单次最多 12 页)

<doc> 为文档编号片段, 不区分大小写, 如 ug572 / ug903 / ds893。
PDF 目录定位优先级: --docs-dir 参数 > AMD_DOCS_DIR 环境变量 > 脚本同目录 docs-location.txt
(一行 PDF 目录绝对路径, 本地配置不入库) > 向上查找 AMD-Xilinx-UG/amd-docs。
选项: --regex 按正则搜索; --max-hits N 限制命中页数(默认 30)。
退出码: 0 成功; 2 找不到 PDF 目录; 3 找不到指定文档; 4 参数错误。
"""
import argparse
import os
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("缺少依赖: 请先执行  python -m pip install pymupdf", file=sys.stderr)
    sys.exit(4)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def find_docs_dir(cli_dir: str | None) -> Path | None:
    """定位 amd-docs 目录: 参数 > 环境变量 > 从脚本位置向上找仓库根。"""
    candidates = []
    if cli_dir:
        candidates.append(Path(cli_dir))
    if os.environ.get("AMD_DOCS_DIR"):
        candidates.append(Path(os.environ["AMD_DOCS_DIR"]))
    # 脚本同目录 docs-location.txt: 一行 PDF 目录绝对路径(本地配置, 被 .gitignore 排除)
    loc = Path(__file__).resolve().parent / "docs-location.txt"
    if loc.is_file():
        txt = loc.read_text(encoding="utf-8", errors="ignore").strip()
        if txt:
            candidates.append(Path(txt))
    # 脚本位于 <repo>/.qoder/skills/amd-ultrascale-dev/scripts/, 向上逐级找
    p = Path(__file__).resolve()
    for parent in p.parents:
        candidates.append(parent / "AMD-Xilinx-UG" / "amd-docs")
        candidates.append(parent / "amd-docs")
    for c in candidates:
        if c.is_dir() and any(c.glob("*.pdf")):
            return c
    return None


def resolve_doc(docs_dir: Path, token: str) -> Path | None:
    token = token.lower()
    pdfs = sorted(docs_dir.glob("*.pdf"))
    exact = [p for p in pdfs if p.name.lower().startswith(token)]
    if exact:
        return exact[0]
    part = [p for p in pdfs if token in p.name.lower()]
    return part[0] if part else None


def cmd_list(docs_dir: Path) -> None:
    for p in sorted(docs_dir.glob("*.pdf")):
        with fitz.open(p) as d:
            print(f"{p.name}  ({d.page_count} 页)")


def cmd_toc(pdf: Path, depth: int) -> None:
    with fitz.open(pdf) as d:
        toc = d.get_toc()
        if not toc:
            print("(无书签目录)")
            return
        for lvl, title, page in toc:
            if lvl <= depth:
                print(f"{'  ' * (lvl - 1)}p{page}  {title}")


def cmd_search(pdf: Path, keyword: str, use_regex: bool, max_hits: int) -> None:
    pattern = re.compile(keyword if use_regex else re.escape(keyword), re.IGNORECASE)
    hits = 0
    with fitz.open(pdf) as d:
        for page in d:
            text = page.get_text()
            m = pattern.search(text)
            if not m:
                continue
            hits += 1
            # 取命中处所在行及其后一行作为上下文
            start = text.rfind("\n", 0, m.start()) + 1
            end = text.find("\n", m.end())
            end = text.find("\n", end + 1) if end != -1 else len(text)
            snippet = " ".join(text[start:end if end != -1 else None].split())[:220]
            print(f"p{page.number + 1}: {snippet}")
            if hits >= max_hits:
                print(f"... 已达 {max_hits} 页上限, 命中过多请换更具体的关键词")
                break
    if hits == 0:
        print(f"'{keyword}' 在 {pdf.name} 中无命中 (试试同义词/缩写, 或 --regex)")
    else:
        print(f"—— 共 {hits} 页命中 {pdf.name}, 用 read 命令提取目标页全文 ——")


def cmd_read(pdf: Path, pages: str) -> None:
    m = re.fullmatch(r"(\d+)(?:-(\d+))?", pages)
    if not m:
        print("页码格式: 87 或 87-92", file=sys.stderr)
        sys.exit(4)
    lo = int(m.group(1))
    hi = int(m.group(2) or lo)
    if hi - lo + 1 > 12:
        print("单次最多提取 12 页, 请缩小范围", file=sys.stderr)
        sys.exit(4)
    with fitz.open(pdf) as d:
        hi = min(hi, d.page_count)
        for n in range(lo, hi + 1):
            print(f"===== {pdf.name} p{n} =====")
            print(d[n - 1].get_text().strip())


def main() -> None:
    ap = argparse.ArgumentParser(add_help=True, description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["list", "toc", "search", "read"])
    ap.add_argument("doc", nargs="?", help="文档编号片段, 如 ug572")
    ap.add_argument("arg", nargs="?", help="search 的关键词 / read 的页码")
    ap.add_argument("--docs-dir", default=None)
    ap.add_argument("--regex", action="store_true")
    ap.add_argument("--max-hits", type=int, default=30)
    ap.add_argument("--depth", type=int, default=2, help="toc 显示层级, 默认 2")
    args = ap.parse_args()

    docs_dir = find_docs_dir(args.docs_dir)
    if not docs_dir:
        print("找不到 amd-docs PDF 目录。请用 amd-docs-downloader skill(或 ug-downloader.js)下载手册,"
              "然后把 PDF 目录绝对路径写入脚本同目录的 docs-location.txt,"
              "或用 --docs-dir / 环境变量 AMD_DOCS_DIR 指定。", file=sys.stderr)
        sys.exit(2)

    if args.command == "list":
        cmd_list(docs_dir)
        return

    if not args.doc:
        print("缺少 <doc> 参数", file=sys.stderr)
        sys.exit(4)
    pdf = resolve_doc(docs_dir, args.doc)
    if not pdf:
        print(f"未找到匹配 '{args.doc}' 的 PDF, 用 list 查看可用文档", file=sys.stderr)
        sys.exit(3)

    if args.command == "toc":
        cmd_toc(pdf, args.depth)
    elif args.command == "search":
        if not args.arg:
            print("缺少关键词", file=sys.stderr)
            sys.exit(4)
        cmd_search(pdf, args.arg, args.regex, args.max_hits)
    elif args.command == "read":
        if not args.arg:
            print("缺少页码", file=sys.stderr)
            sys.exit(4)
        cmd_read(pdf, args.arg)


if __name__ == "__main__":
    main()
