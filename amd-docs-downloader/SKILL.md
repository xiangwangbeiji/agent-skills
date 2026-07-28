---
name: amd-docs-downloader
description: Download original PDF manuals from the AMD/Xilinx documentation portal (docs.amd.com) — UG user guides, DS datasheets, PG product guides, AM manuals. Handles the site's JavaScript rendering and khub API to always fetch the latest version as the original PDF (not a re-rendered copy). Use when the user wants to download, fetch, back up, or update AMD or Xilinx technical documents or PDFs (e.g. "download UG571", "get the latest Vivado implementation guide PDF", "下载/抓取 赛灵思/AMD 手册 UG904").
---

# AMD/Xilinx 文档下载器

从 docs.amd.com 下载**原始 PDF**（非网页转印），自动取最新版。仅访问公开接口，无需登录、无 API key。

## 何时使用

用户想下载 / 备份 / 更新 AMD 或 Xilinx 官方技术文档 PDF（UG/DS/PG/AM 系列），或给出文档编号（如 UG571、UG904、DS892）要其 PDF 时。

## 工作流程

### 步骤 1：确认 slug

每份文档由 **slug** 标识 = docs.amd.com 文档页 URL 的最后一段。

- 示例：`https://docs.amd.com/r/en-US/ug904-vivado-implementation` → slug 是 `ug904-vivado-implementation`
- 用户只给了编号不知 slug：让其在 docs.amd.com 搜索该文档并复制 URL 最后一段；或直接用"编号-英文短标题"形式尝试（脚本会校验，猜错只报错、不产生坏文件）。

### 步骤 2：准备环境（首次或换机器时）

在本 skill 的 `scripts/` 目录执行：

```bash
npm install
```

- 需 Node.js ≥ 18。
- Windows 已装 Edge 可直接用；其他系统脚本会自动回退 Playwright chromium，首次需额外执行 `npx playwright install chromium`。

### 步骤 3：运行下载

```bash
node scripts/amd-doc-downloader.js --out <输出目录> <slug> [<slug> ...]
```

- `--out` 省略时默认输出到当前目录下的 `./amd-docs`。
- 输出目录建议放在用户工作区或知识库内。
- 示例：

```bash
node scripts/amd-doc-downloader.js --out D:/docs ug904-vivado-implementation ug571-ultrascale-selectio
```

### 步骤 4：核对结果

看脚本末尾的 `===== 汇总 =====`。成功项形如：

```
✓ ug904-vivado-implementation_2026.1.pdf  版本=2026.1  7.43MB
```

文件名含版本号即为最新版原始 PDF。失败项按 [reference.md](reference.md) 的故障排除表处理。

## 重要约定

- **始终取最新版**：脚本打开不带版本号的 en-US 地址现场解析 ID，切勿改成硬编码旧 mapId/docId。
- **产物是独立文件**：下载好的 PDF 与脚本无运行时绑定，可随意移动 / 归档 / 换机器使用。
- **PowerShell 用分号**：Windows PowerShell 不支持 `&&`，多命令用 `;` 分隔。
- **不要**改用"把网页打印成 PDF"的方式——那不是原始文档。

## 进阶

机制原理、两套文档系统对照、完整故障排除表、扩展建议见 [reference.md](reference.md)。
