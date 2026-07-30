---
name: github-deploy
description: Publish local git repository changes to GitHub when direct push is unreliable (network-restricted environment) - fast-fail direct push, fall back to per-file upload via gh api (Contents API), then realign local history. Also covers deploying a new Agent Skill into a skills collection repo (files + junction + commit + upload). Use when the user asks to push, upload, publish, or deploy to GitHub, deploy a skill to the skills repo, or when git push fails with "Connection was reset", times out, or hangs.
---

# GitHub 发布(直连受限网络)

受限网络的典型特征(会随时间波动): `api.github.com` **稳定可用**; `github.com` push 方向
**基本被重置**, fetch 时通时断。因此策略是**先试直连快速失败, 被墙立即走 gh API 兜底**,
不要反复死磕直连。

运行时探测(不要凭记忆假设, 每次现查):

- 登录账号: `gh auth status`(gh CLI 为机器级授权, 各窗口共享);
- 目标仓库 `owner/repo`: 从 `git -C <repo> remote get-url origin` 解析;
- gh 不在旧 shell 的 PATH 时用标准安装全路径, Windows 为
  `C:\Program Files\GitHub CLI\gh.exe`;
- 提交身份优先用仓库本地配置(`git -C <repo> config user.name`), 缺失时让用户
  提供或自行配置, **不要改全局 git config**。

## 0. 前置自检

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status   # 应显示已登录账号
```

## 1. 直连推送(快速失败)

```powershell
$env:GIT_TERMINAL_PROMPT=0    # 关键: 认证缺失立刻报错, 不挂起假死
git -C <repo> push origin main
```

- 挂起无输出 → 先 `& <gh> auth setup-git` 配好凭据助手, 再试一次;
- 报 `Connection was reset` / 连接超时 → 走 §2, 不要重试。

## 2. gh API 上传兜底(逐文件 PUT)

只上传 git 跟踪的文件(天然排除 node_modules 等)。上传**最近一次提交**涉及的文件:

```powershell
$root="<本地仓库路径>"
$gh="C:\Program Files\GitHub CLI\gh.exe"
$repo=((git -C $root remote get-url origin) -replace '.*github\.com[:/]','') -replace '\.git$',''
foreach($f in (git -C $root diff-tree --no-commit-id --name-only -r HEAD)){
  $b64=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root $f)))
  & $gh api -X PUT "repos/$repo/contents/$f" -f message="add $f" -f content="$b64" -f branch=main --jq ".content.path"
}
```

- 全量上传所有跟踪文件: 循环源换成 `git -C $root ls-files`;
- **更新远端已存在的文件必须先取 sha**(否则 409/422):

```powershell
$sha = & $gh api "repos/$repo/contents/<path>?ref=main" --jq .sha
& $gh api -X PUT "repos/$repo/contents/<path>" -f message="update <path>" -f content="$b64" -f sha="$sha" -f branch=main
```

- 上传后验证: `& $gh api "repos/$repo/contents/<dir>?ref=main" --jq ".[].name"`

## 3. API 上传后的本地对齐(必做, 可延后)

API 上传产生的远端提交与本地提交 SHA 分叉, 之后直接 push 会被拒(non-fast-forward)。
待 fetch 能通时执行一次(内容相同只对齐历史, 不丢文件, 未跟踪文件不受影响):

```powershell
git -C <repo> fetch origin
git -C <repo> reset --hard origin/main
```

**陷阱(已踩过)**: 两步必须成对执行, fetch 被墙失败时绝不能单独 reset——
本地 origin/main 引用是过期的, reset --hard 会把新提交连同其 tracked 文件一起
退回旧历史(内容仍在对象库, 用 `git reflog` 找回: `git checkout <丢的提交> -- <目录>`
后重新 commit)。对齐前必须确认 fetch 真正成功。

## 4. 部署新 skill 到 skills 集合仓库(完整流程)

1. skill 文件放入 `<skills仓库本地路径>\<skill-name>\`(`SKILL.md` 必需;
   本地配置类文件加 skill 级 `.gitignore` 排除, 严禁把绝对路径/账号/凭据写进入库文件);
2. 建 junction 让 Qoder 从原生路径加载(若已存在真实目录副本, 先删再建;
   Qoder Bash 操作用户主目录需申请沙箱外权限):
   ```powershell
   New-Item -ItemType Junction -Path "$env:USERPROFILE\.qoder\skills\<skill-name>" -Target "<skills仓库本地路径>\<skill-name>"
   ```
3. `git add <skill-name>`, 提交前用 `git status --short` 核对无本地配置文件混入,
   然后 commit;
4. 推送: 按 §1 → §2 → §3 决策执行;
5. 新 skill 需重启/重载 Qoder 才会被识别。

## 排错速查

| 现象 | 处理 |
|---|---|
| push 挂起无输出 | `gh auth setup-git` + `GIT_TERMINAL_PROMPT=0` |
| push 报 Connection was reset | 走 §2 API 上传 |
| API PUT 报 409/422 | 更新已有文件没带 sha, 按 §2 先取 sha |
| 本地 push 被拒 non-fast-forward | API 上传造成历史分叉, 按 §3 对齐 |
| reset 后 tracked 文件消失 | 单独 reset 踩了 §3 陷阱, reflog 找回重新 commit |
| Qoder 的 Write/编辑工具不能写工作区外 | 先在工作区内组装, 再 Copy-Item 拷出 |
| clone/fetch 被墙 | 公开仓库加 `https://gh-proxy.com/` 前缀, 或逐文件走 API 拉取 |
