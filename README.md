# agent-skills

我制作的 [Qoder](https://qoder.com) / AI Agent 技能（Skill）集合。每个子目录是一个独立的 Skill，包含 `SKILL.md`（技能定义与用法）以及可选的配套脚本。

## 已有 Skills

| Skill | 说明 |
|---|---|
| [amd-docs-downloader](amd-docs-downloader/) | 从 AMD/Xilinx 文档门户（docs.amd.com）下载 UG/DS/PG/AM 系列**原始 PDF**：自动处理站点的 JavaScript 渲染与 khub API，始终抓取最新版本。 |

## 什么是 Skill

Skill 是一份 Markdown 指令（`SKILL.md`）加可选脚本，用来教 AI Agent 完成特定任务。Agent 会根据 `SKILL.md` 里的 `description` 自动判断何时启用它。

## 使用方法

把某个 skill 目录放到个人技能目录，即可被 Qoder 识别：

- Windows：`%USERPROFILE%\.qoder\skills\<skill>\`
- macOS / Linux：`~/.qoder/skills/<skill>/`

或直接克隆本仓库后，把需要的 skill 目录复制（或建软链接）到上述位置。各 skill 的依赖与具体用法见其目录内的 `SKILL.md`。

## 目录结构约定

```
<skill-name>/
├── SKILL.md        # 必需：技能定义 + 触发描述 + 使用步骤
├── reference.md    # 可选：进阶参考（机制、故障排除等）
└── scripts/        # 可选：配套脚本
```
