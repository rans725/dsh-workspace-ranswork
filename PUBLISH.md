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

## 三、发布到 npm（**主要渠道**）

从 0.4.0 起 npm 是正式分发渠道，插件市场认这个来源。

```bash
cd F:/work/github/dsh-workspace-ranswork

# 1. 拿 token（npmjs.com → Access Tokens → Generate → Granular 或 Classic Automation）
#    必须勾 "Bypass two-factor authentication (2FA)"，否则 403
printf '//registry.npmjs.org/:_authToken=%s\nregistry=https://registry.npmjs.org/\naccess=public\n' \
  "$TOKEN" > .npmrc-pub
export NPM_CONFIG_USERCONFIG="$(pwd)/.npmrc-pub"

# 2. 发布（pnpm publish 不支持 --userconfig，只能走环境变量）
pnpm publish --no-git-checks --access public

# 3. 清理
rm -f .npmrc-pub
```

`package.json` 里**没有** `private: true`，可以直接发布。
`files` 已显式列出，`node_modules`、`*.tgz` 不会进包（实测 9 个文件）。

### 发布后必须验证（顺序很重要）

```bash
# a) 版本元数据（几乎立刻可查）
curl -s -o /dev/null -w "%{http_code}\n" \
  https://registry.npmjs.org/dsh-workspace-ranswork/0.4.0

# b) tarball —— 这个会延迟 10~60 秒，404 就先等等，别急着判失败
curl -s -o /dev/null -w "%{http_code}\n" \
  https://registry.npmjs.org/dsh-workspace-ranswork/-/dsh-workspace-ranswork-0.4.0.tgz

# c) 真实安装（最有说服力）
mkdir -p /tmp/it && cd /tmp/it && echo '{"name":"t","version":"1.0.0"}' > package.json
pnpm add dsh-workspace-ranswork && cat node_modules/dsh-workspace-ranswork/package.json | grep version
```

> 反向确认技巧：对同版本再发一次，若报
> `You cannot publish over the previously published versions`，说明上次其实已经成功。

## 四、给别人的安装方式

```bash
# 推荐：npm（市场能推送更新）
pnpm add dsh-workspace-ranswork

# 固定版本
pnpm add dsh-workspace-ranswork@0.4.0

# 不想用 npm 时（能装，但收不到更新提醒）
pnpm add https://github.com/rans725/dsh-workspace-ranswork/archive/refs/tags/v0.4.0.tar.gz
```

> **⚠️ 为什么推荐 npm**：从 Release 附件 URL 或 tag 归档装的包，插件市场**永远**报"无更新"。
> 市场对 URL 安装没有 registry 身份可比，宁可不说也不猜错（dshmarket #768）。
> 只有裸包名（npm）安装才能进入常规更新流程。

> **老用户必须重装一次**：0.3.x 用 URL 装的人，lockfile 里记的还是 URL，改 npm 后**仍然收不到推送**。
> `pnpm remove dsh-workspace-ranswork && pnpm add dsh-workspace-ranswork`

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
