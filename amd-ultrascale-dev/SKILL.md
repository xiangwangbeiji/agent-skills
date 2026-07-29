---
name: amd-ultrascale-dev
description: Develop FPGA code following official AMD/Xilinx UltraScale documentation (UG/DS manuals stored locally as PDFs). Covers RTL design (Verilog/VHDL/SystemVerilog), XDC timing/physical constraints, Vivado Tcl flows, GTH/GTY transceivers, and diagnosing Vivado error messages. Use when writing or reviewing HDL code, XDC constraints, Vivado Tcl scripts, when the user mentions UltraScale, VU190, Vivado, timing closure, primitives (BUFG/MMCM/DSP48/BRAM/GTH/GTY), or pastes Vivado synthesis/implementation/DRC error messages.
---

# AMD UltraScale 开发(遵循官方 UG 文档)

目标器件: **Xilinx Virtex UltraScale XCVU190**(SSI 器件,3 个 SLR)。
所有代码产出必须符合本 skill 的硬规则,并可追溯到官方文档出处。

## 核心工作流

1. **写代码前**,先读对应领域的硬规则速查(按需,只读相关的):
   - RTL / 时钟 / 复位 / CDC / 存储 / DSP → [rules/rtl.md](rules/rtl.md)
   - XDC 约束 / 时序分析 / I/O 引脚 → [rules/constraints.md](rules/constraints.md)
   - Vivado Tcl / 综合实现流程 / 报告检查 → [rules/tcl-flow.md](rules/tcl-flow.md)
   - GTH/GTY 收发器 / 高速接口 → [rules/transceivers.md](rules/transceivers.md)
2. **速查表未覆盖或需要查证细节**(原语端口、属性合法值、开关选项、电气参数)时,
   用 pdfgrep 检索本地 PDF 原文,禁止凭记忆猜测:
   ```bash
   python scripts/pdfgrep.py list                  # 可用手册清单
   python scripts/pdfgrep.py toc ug572 --depth 2   # 章节目录+页码
   python scripts/pdfgrep.py search ug572 BUFGCE_DIV   # 关键词→命中页
   python scripts/pdfgrep.py read ug572 29-31      # 提取页面全文精读
   ```
   查哪本手册见 [doc-map.md](doc-map.md)。
3. **产出时标注出处**:关键设计决策注明依据,格式如 `依据 UG572 p29 (BUFGCE_DIV)`。
4. 通用原则冲突时,以 **UG949(设计方法论)** 为最高准绳;器件电气参数以 **DS893** 为准。

## Vivado 报错诊断工作流

用户粘贴报错信息时:

1. 提取消息 ID(如 `[Synth 8-327]`、`[Route 35-54]`、`[Timing 38-282]`、`[DRC NSTD-1]`、
   `[Place 30-575]`)和关键对象名(cell/net/pin)。
2. 按前缀路由到手册,先 `search` 消息 ID 原文,无命中再搜关键词:
   | 消息前缀 | 领域 | 查 |
   |---|---|---|
   | Synth / HDL | 综合、推断失败 | UG901 |
   | Place / Route / Opt / Phys | 实现、布局布线拥塞 | UG904 |
   | Timing / 时序违例 WNS/WHS | 时序分析与收敛 | UG906 → UG949 第 6 章 |
   | DRC / NSTD / UCIO | 设计规则、I/O 未约束 | UG903(I/O)、UG571(电平) |
   | Constraints / Vivado 12-x | XDC 语法与作用范围 | UG903 |
   | Labtools / Chipscope / ILA | 调试、下载、ILA | UG908 |
   | GT / 收发器相关 | GTH/GTY 链路 | UG576 / UG578 |
3. 给出修复方案时引用手册页码;涉及时序违例先跑
   `report_timing_summary` / `report_methodology` 再下结论,不做无证据的猜测。

## 环境前提

- PDF 手册不随本仓库分发(AMD 版权 + 150MB+)。PDF 目录定位顺序:
  `--docs-dir` > 环境变量 `AMD_DOCS_DIR` > `scripts/docs-location.txt`(一行 PDF 目录
  绝对路径, 本地配置不入库) > 向上查找工作区内 `AMD-Xilinx-UG/amd-docs`。
- 本地没有 PDF 时(脚本退出码 2):用同仓库的 **amd-docs-downloader** skill 下载全 22 本
  UltraScale/Vivado 手册(清单见 [doc-map.md](doc-map.md)),再把存放目录写入
  `scripts/docs-location.txt`。不要改用网络搜索替代官方原文。
- 依赖: `python -m pip install pymupdf`。

## 注意

- 本 skill 面向 **UltraScale**(非 UltraScale+):收发器参考时钟缓冲是 `IBUFDS_GTE3`
  (不是 GTE4),原语库以 UG974 为准,不要混用 7 系列或 UltraScale+ 的原语/属性。
- 速查表是提炼摘要;与 PDF 原文冲突时以 PDF 为准,并顺手修正速查表。
