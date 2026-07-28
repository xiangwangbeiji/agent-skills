# AMD 文档下载器 · 进阶参考

供 `SKILL.md` 在需要时查阅。核心用法看 SKILL.md 即可，本文件是机制细节、故障排除与扩展。

## 两套文档系统

docs.amd.com 基于 Fluid Topics，同一份文档只属于其中一套；脚本先试阅读器，
标题出现"未找到/not found"时自动回退查看器。

| 系统 | 页面 URL | 适用 | PDF 接口 |
|---|---|---|---|
| 阅读器 reader | `docs.amd.com/r/en-US/{slug}` | 多主题工具手册（Vivado 类 UG，版本如 `2026.1`） | `GET /api/khub/maps/{mapId}/attachments` → 取 `mimeType=application/pdf` 项 → `GET /api/khub/maps/{mapId}/attachments/{attId}/content` |
| 查看器 viewer | `docs.amd.com/v/u/en-US/{slug}` | 单册硬件手册（如 UG571，版本如 `v1.16`） | `GET /api/khub/documents/{docId}/content` |

## 核心机制（为什么这样做）

1. **JS 渲染**：页面正文与下载入口全由 JavaScript 生成，直接 GET 拿到空壳。用无头浏览器渲染。
2. **网络监听是关键**：`mapId`/`docId` 只出现在页面 JS 发起的 XHR 请求 URL 里，
   **不在渲染后的 DOM 中**。因此靠 `page.on("request")` 截获，而非解析 HTML。
   这也是 Firecrawl 等"网页转 Markdown"工具无法替代本方案的原因——它们只返回 DOM，不返回网络日志。
3. **下载是普通 HTTP**：拿到 ID 后，content 接口是普通 GET，返回**原始 PDF** 二进制，无需 JS。
4. **始终最新版**：永远打开不带版本号的 `en-US` 地址（自动指向 latest），现场解析 ID。
   切忌硬编码旧 mapId 或带版本号的 URL。

## 版本号来源

| 系统 | 位置 | 示例 |
|---|---|---|
| 阅读器 | 附件文件名 | `ug974-...-en-us-2026.1.pdf` → `2026.1` |
| 查看器 | 页面"发送反馈"mailto 链接 body | `[UG571] [2025-01-14] [1.16 English]` → `v1.16` |

## 故障排除

| 症状 | 原因 | 解决 |
|---|---|---|
| `Cannot find module 'playwright'` | 脚本目录未装依赖 | 在 `scripts/` 执行 `npm install` |
| `✗ 无法访问 docs.amd.com`（exit 2） | 网络/代理/防火墙 | 浏览器手动验证可达；配置代理后重试 |
| 报错找不到 msedge | 目标机无 Edge | 脚本会自动回退 chromium；需先 `npx playwright install chromium` |
| `✗ 两套系统都没找到` | slug 拼写错/文档改名 | 到 docs.amd.com 搜索，复制 URL 最后一段更新 slug |
| 标题一直"未找到任何内容" | 文档不在阅读器系统 | 正常，脚本会自动回退 `/v/u/` 查看器 |
| `✗ 返回非 PDF` | 偶发限流/会话异常 | 稍后重跑该 slug；确认未被网关拦截 |
| PowerShell 报 `&&` 无效 | Windows PowerShell 5.x 不支持 | 用分号 `;` 分隔，或分次执行 |
| 控制台中文乱码 | 终端编码 | 仅显示问题，不影响功能；可 `chcp 65001` |

**AMD 改版自救**：若正则失效，临时打印 `page.on("request")` 捕获的所有含 `khub`/`api`
的 URL，对照"两套文档系统"表更新 `openAndCapture()` 里的正则即可。这套"监听网络找 ID"
的方法论对改版适应性很强。

## 常见文档编号与 slug 线索

slug 一律取自 docs.amd.com 文档页 URL 的最后一段，形如 `{编号}-{英文短标题}`：

- UG（User Guide 用户指南）：`ug571-ultrascale-selectio`、`ug949-vivado-design-methodology`
- DS（Data Sheet 数据手册）：`ds892-...`
- PG（Product Guide IP 手册）：`pg...`
- AM（Versal 架构手册）：`am...`

不确定时先随便试，脚本会明确报"两套系统都没找到"，不会产生错误文件。

## 扩展建议

- **增量更新**：下载前比对输出目录已有文件名/版本，相同则跳过。
- **manifest 清单**：每次运行输出 JSON（slug、版本、大小、日期），便于追溯与 diff。
- **定时巡检**：结合系统计划任务定期跑，发现新版本时通知。
- **自动 slug 发现**：调用站内搜索接口按编号反查 slug，免手工找 URL。

## 已验证记录（2026-07-27）

UG571 v1.16 (5.33MB, 查看器) · UG903/904/906/949/974 均 2026.1（阅读器），
6/6 全部成功，落盘前均通过 `%PDF-` 头校验。
