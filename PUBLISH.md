# 发布步骤（dsh-workspace-ranswork）

> 本机**已安装 git**（2026-10-22 实测 `git version 2.56.0.windows.2`），但**没有 `gh` CLI**。
> 本目录已经 `git init` + 提交到 `main` 分支，只剩**建远程仓库 + push** 需要凭据，
> 所以这一步要在你那侧执行（或直接用 GitHub 网页「Upload files」上传本目录）。
>
> 提交时用的是**仓库内**身份 `rans725 <rans725@users.noreply.github.com>`（全局没配身份）；
> 要用真实邮箱就先 `git config user.email "你的邮箱"` 再 `git commit --amend --reset-author`。
> `.gitattributes` 固定了 `eol=lf`，否则 Windows 的 `autocrlf=true` 会把归档 tarball 的行尾
> 变成 CRLF，和这里的源码字节不一致。

## 一、已确认的事实（2026-10-18）

- 包名 `dsh-workspace-ranswork`：npm **无**同名包，GitHub **无**同名仓库。
- 发布内容（`pnpm pack` 解包实测）共 9 个文件：
  `client.js` / `cordis.patch.yml` / `icon.svg` / `index.js` / `LICENSE` /
  `package.json` / `README.md` / `locale/en.json` / `locale/zh.json`。
- 敏感信息扫描（解包后的真实内容）**全部干净**：
  绝对路径、用户名、邮箱、`sk-`/`ghp_`/`github_pat_`/私钥、真实 session UUID、
  内网 IP / 端口，五类均无命中。
- 本机安装验证：`install_bundle` → `application: applied`；
  侧栏 `sidebar.panellist` 出现 `workspace-ranswork`（order 30, active）；
  `probe-wso-bundle.mjs` → `rev=79fb78efa582`、66180 字节 → BUNDLE OK。

## 二、推送命令

```bash
cd F:\work\github\dsh-workspace-ranswork

git init
git add -A
git commit -m "feat: workspace overview panel for DeepSeek Harness"

git branch -M main
git remote add origin https://github.com/rans725/dsh-workspace-ranswork.git
git push -u origin main
```

> 开发副本在 `F:\work\插件\dsh-workspace-ranswork`；这里是**发布快照**。
> 改了代码要重新从开发目录复制过来，再提交。

先在 GitHub 上**新建空仓库** `dsh-workspace-ranswork`（不要勾选 README/LICENSE，
否则要先 pull）。

## 三、发布到 npm（可选）

```bash
npm login
npm publish --access public
```

`package.json` 里**没有** `private: true`，可以直接发布。
`files` 已显式列出，`node_modules`、`*.tgz` 不会进包。

## 四、给别人的安装方式

```bash
# Release 附件（固定版本，推荐，无需 git）
pnpm add https://github.com/rans725/dsh-workspace-ranswork/releases/download/v0.3.0/dsh-workspace-ranswork-0.3.0.tgz

# 或 tag 源码归档
pnpm add https://github.com/rans725/dsh-workspace-ranswork/archive/refs/tags/v0.3.0.tar.gz

# 或 npm（发板后）
pnpm add dsh-workspace-ranswork
```

> **别用 `refs/heads/main`**：那样装到的是 `main` 的当前状态，你之后一改 main，
> 所有人的安装结果就跟着变，不再是某个固定版本。发版一律写 tag。

装完在插件管理器里启用 bundle，刷新 Web UI。

## 五、和已有插件的差异（避免被当成重复品）

| 已有插件 | 它做什么 | 本插件的区别 |
| --- | --- | --- |
| `dsh-activity-pane` | 左侧可贴边窗格，集中显示运行中/等待用户行动的会话 | 本插件是**主面板 + 按工作区分组**，并且**没任务时自动切成对话总览** |
| `dsh-plugin-busy-workspace` | 高亮运行中会话、把忙的工作区顶到侧栏最前 | 本插件是独立视图，不改造侧栏排序 |
| `dsh-workspace-hub` / `dsh-workspace-kit` | 工作区分组、文件夹、⌘K、图标 | 本插件聚焦「进行中/全部会话」两种视图 + 卡片操作 |

README 里已经把「进行中 ↔ 对话总览自动切换」和「卡片六个操作」写成卖点。
