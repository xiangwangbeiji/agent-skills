# Skill 上传 GitHub 部署指南

> 面向：其他项目窗口 / AI Agent。本指南来自 2026-07 在本机（Windows 25H2）实测跑通的完整流程，
> 含国内网络受限时的可靠绕行方案。照做即可把新 skill 部署到 GitHub。

## 0. 最终形态（本机现状，可直接复用）

| 项 | 值 |
|---|---|
| GitHub 账号 | `xiangwangbeiji`（gh CLI 已完成机器级授权，所有窗口共享，无需重复登录） |
| Skill 集合仓库 | https://github.com/xiangwangbeiji/agent-skills （Public，main 分支） |
| 本地仓库（真实文件） | `D:\workspace\agent-skills\`，每个 skill 一个子目录 |
| Qoder 加载方式 | 目录联接（junction）：`~/.qoder/skills/<skill>` → `D:\workspace\agent-skills\<skill>`，同一份文件、实时生效 |
| gh CLI 路径 | `C:\Program Files\GitHub CLI\gh.exe`（旧 shell 的 PATH 可能没有它，建议用全路径调用） |
| git 提交身份 | 仓库本地配置：`xiangwangbeiji` / `xiangwangbeiji@users.noreply.github.com` |

前置自检（任何窗口开工前跑一遍）：

```powershell
git --version
& "C:\Program Files\GitHub CLI\gh.exe" auth status   # 应显示 Logged in as xiangwangbeiji
```

## 1. 新增一个 skill 的标准流程

```powershell
# ① 在集合仓库里建 skill 目录并放入文件（SKILL.md 必需, reference.md/scripts/ 可选）
#    目录结构约定见仓库根 README.md

# ② 建 junction, 让 Qoder 从原生路径加载（junction 不需要管理员权限）
New-Item -ItemType Junction -Path "C:\Users\Administrator\.qoder\skills\<skill-name>" -Target "D:\workspace\agent-skills\<skill-name>"

# ③ 提交
git -C D:\workspace\agent-skills add <skill-name>
git -C D:\workspace\agent-skills commit -m "Add <skill-name> skill"

# ④ 推送（见第 2 节的网络决策）
```

注意：
- 每个 skill 目录里应有自己的 `.gitignore`（排除 `node_modules/`、下载产物等），仓库根也有一份兜底。
- 新 skill 装好后需重启/重载 Qoder 才会被识别。

## 2. 推送：先试 git push，被墙就走 API（核心经验）

本机网络对 GitHub 的实测特征（会随时间波动）：

| 通道 | 状态 |
|---|---|
| `api.github.com`（REST API） | **稳定可用** ✅ |
| `github.com` fetch（下载方向） | 时通时断 |
| `github.com` push（上传方向） | **基本被重置**（Connection was reset）❌ |

### 2a. 先试正常推送（快速失败，不死等）

```powershell
$env:GIT_TERMINAL_PROMPT=0   # 关键: 认证缺失时立刻报错, 而不是挂起假死
git -C D:\workspace\agent-skills push origin main
```

- 若曾出现推送"卡住不动"：先跑 `& "C:\Program Files\GitHub CLI\gh.exe" auth setup-git` 配好凭据助手再试。
- 报 `Connection was reset` / 连接超时 → 走 2b。

### 2b. API 上传（可靠兜底，凭据只发官方、不经第三方）

对每个要上传/更新的文件执行（自动创建中间目录；对已存在文件更新时需先取其 sha，见 2c）：

```powershell
$repo = "xiangwangbeiji/agent-skills"
$root = "D:\workspace\agent-skills"
$gh   = "C:\Program Files\GitHub CLI\gh.exe"
foreach($f in (git -C $root ls-files)){   # 只上传被 git 跟踪的文件, 天然排除 node_modules
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root $f)))
  & $gh api -X PUT "repos/$repo/contents/$f" -f message="add $f" -f content="$b64" -f branch=main
}
```

只传单个新文件时，把循环换成对该文件的一次 PUT 即可。

### 2c. 更新远端已存在的文件

Contents API 更新已有文件必须带原文件的 `sha`：

```powershell
$sha = & $gh api "repos/$repo/contents/<path>?ref=main" --jq .sha
& $gh api -X PUT "repos/$repo/contents/<path>" -f message="update <path>" -f content="$b64" -f sha="$sha" -f branch=main
```

### 2d. API 上传后的本地对齐（重要）

API 上传产生的远端提交与本地提交 SHA 不同，之后直接 push 会因非快进被拒。
待 `github.com` 直连可用时（fetch 能通即可），跑一次：

```powershell
git -C D:\workspace\agent-skills fetch origin
git -C D:\workspace\agent-skills reset --hard origin/main
```

内容相同、只对齐历史，不会丢文件；未跟踪文件（如 node_modules）不受影响。

## 3. Qoder Agent 窗口特有的限制与技巧

| 限制 | 对策 |
|---|---|
| Bash 命令跑在沙箱里，只能写当前工作区目录 | 写 `D:\workspace\agent-skills` 等工作区外路径时，Bash 需申请沙箱外执行权限 |
| Write 文件工具不能写工作区外 | 先把文件写到工作区内临时文件，再用 `Copy-Item` 拷到目标位置，最后删临时文件 |
| PowerShell 5.x 不支持 `&&` | 用分号 `;` 分隔多条命令 |
| 新装的 CLI 不在当前 shell 的 PATH | 用全路径调用（如 gh.exe） |
| 交互式命令（如 `gh auth login`）无法在工具终端里按键 | 用管道喂入空行触发设备码流程：`'' \| & gh.exe auth login --hostname github.com --git-protocol https --web`，从输出里读一次性验证码交给用户去浏览器授权 |

## 4. 从零重建（换机器时）

1. `winget install --id GitHub.cli -e` 装 gh；`gh auth login` 浏览器授权。
2. `git clone https://github.com/xiangwangbeiji/agent-skills D:\workspace\agent-skills`
   （clone 被墙时：公开仓库可加 `https://gh-proxy.com/` 前缀克隆，或逐文件经 API 拉取）。
3. 对每个 skill 建 junction 到 `~/.qoder/skills/<skill>`（命令见第 1 节 ②）。
4. 各 skill 如有依赖，进其 `scripts/` 目录 `npm install`。
5. 重启 Qoder。

## 5. 排错速查

| 现象 | 原因 | 处理 |
|---|---|---|
| push 挂起无输出 | 凭据助手未配置，git 在等输入 | `gh auth setup-git` + `GIT_TERMINAL_PROMPT=0` |
| push 报 Connection was reset | 上传方向被墙 | 走 2b API 上传 |
| fetch 超时 | 直连抖动 | 稍后重试；hosts 用 GitHub520 刷新 |
| API PUT 报 409/422 | 更新已有文件没带 sha | 按 2c 先取 sha |
| 本地 push 被拒（non-fast-forward） | API 上传造成历史分叉 | 按 2d fetch + reset 对齐 |
| 新 skill 不生效 | junction 没建或 Qoder 未重载 | 补 junction、重启 Qoder |
