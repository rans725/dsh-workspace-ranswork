# dsh-workspace-ranswork

> Workspace overview for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — one panel that shows what is running right now, and falls back to all conversations when nothing is.

[中文说明](#中文) · [English](#english)

---

## 中文

### 它做什么

侧边栏多一个入口，主面板把会话铺成一条扁平卡片列表（不再按工作区分块）：

| 状态 | 侧栏按钮 | 面板内容 |
| --- | --- | --- |
| 有会话在运行 | **进行中** | 只列正在运行的会话，卡片带脉冲状态点 |
| 没有会话在运行 | **对话总览** | 列出全部可见会话，按更新时间倒序 |

两种模式都会自动排除：已归档会话、空白草稿、子代理会话。行内不显示目录路径。

### 卡片上的操作

鼠标移到卡片上，右上角浮出操作条：

| 操作 | 说明 |
| --- | --- |
| 置顶 | 固定模式下提到最前（自动模式下只是个标记，排序按活跃度；记在 cookie + localStorage） |
| 重命名 | 卡片内就地编辑，Enter 保存 / Esc 取消 |
| 复制 ID | 复制会话 ID 到剪贴板 |
| 分叉 | 从当前点创建分支并跳过去 |
| 停止运行 | 中断当前轮次（仅运行中的卡片出现，需二次确认） |
| 归档 | 从列表移除（需二次确认） |

点击卡片空白处仍然是打开该会话。

### 自定义卡片按钮

`设置 → 进行中/对话总览` 里的「**卡片按钮**」可以逐项开关操作条上的按钮：置顶 / 重命名 /
复制 ID / **分叉** / 归档。**默认全开**，改完立即生效。

- **「停止」不在可配置项里**：运行中的卡片永远显示停止按钮，随时能中断 —— 这条不交给
  配置决定。
- **全部关掉 = 全部打开**：勾掉最后一个会自动回到全开，操作条不会变成空白（否则像插件坏了）。
- 配置存在 cookie `dsh_wso_card_actions` + localStorage
  `dsh.workspace-ranswork.cardActions`（逗号分隔的动作名，如 `pin,rename,copy`）。
- 没存过配置、或存的值里有不认识的按钮名，都按「全开 / 忽略未知项」处理 —— 以后增删
  按钮不会让老配置失效。

### 卡片拖动排序（自由排序）

面板是**一整张扁平列表**，没有工作区分组标题，所以卡片可以拖到任意位置 —— 不限于
原来那张卡所在的组，也**不会**改变会话的归属工作区：

- 排序结果就是面板自己的自由顺序（cookie `dsh_wso_order` + localStorage
  `dsh.workspace-ranswork.order`），刷新后保留。
- **拖到最前 = 置顶**，卡片出现置顶徽标；把已置顶的卡片拖到非首位（比如中间）=
  **取消置顶**。拖动置顶和「置顶」按钮写的是**同一份**置顶集合（cookie
  `dsh_wso_pinned` + localStorage `dsh.workspace-ranswork.pinned`），不会出现两套状态。
- **指针压在哪张卡身上，就与那张卡换位**：不需要瞄准卡片之间的缝隙。被拖的卡会实时
  让位到目标那一格，其余卡片平滑滑过去（虚线空位跟着落点走）。
- 指针还停在被拖那张卡自己的范围内时，位置**完全不动** —— 把卡片挪起来一点点看看，
  不会让旁边的卡先乱跳。
- 指针从某张卡上滑到两张卡之间的缝隙时，落点**停在刚换到的那一格**，不会跳回起手
  位置 —— 所以不会出现「位置错一下又回来」的来回闪动。
- 已经换好位的卡片会**平滑滑停一次**就待住：指针继续微动时它不会再从旧位置重新出
  发（不会在原地闪）。让位动画只在**顺序真的变了**时触发，与渲染无关。
- 在设置里把组排序从「固定」切到「自动」会清掉手动排序、按新模式重排。

**点击还是拖动？规则是 5 像素**：

1. 按下鼠标时先当作「点击」；
2. 指针累计位移一旦达到 **5px**，就转成「拖动」—— 而且**不可逆**：即使又拖回原点，
   松手也不会打开会话；
3. 松手时，仍在「点击」状态才打开会话；拖动松手只做落位，并屏蔽紧接着的那个 `click`
   事件（200ms），避免一拖就误开。

键盘行为不变：卡片获得焦点后按 Enter / 空格仍然是打开会话。

`prefers-reduced-motion: reduce` 的用户不播放让位动画（位置直接到位）。

### 排序（自动 / 固定）

**默认是「自动」**：整张列表按**最后活跃**从新到旧排 —— **跨工作区一起比**，
不是先按工作区分块再各自排。

> 0.4.1 修的问题：以前自动模式其实是「组内按活跃度、组间按组序」，所以 A 组的旧会话
> 会把 B 组刚更新的会话压在下面，看起来就是「设了自动，最后活跃的没排前面」。另外置顶
> 记录和拖过一次留下的旧顺序都是**永久**的，会无条件插队。现在自动模式这三样都不看了。

- 自动模式下**置顶只是个标记**，不会把卡提到最前；切到「自动」还会顺带清掉置顶记录。
- 自动模式下**拖拽仍然立刻生效**（你刚摆好的位置不会被活跃度立刻弹回去），但下一次
  活跃度变化（挂载 / 运行态翻转 / 手动刷新）就回到按活跃度排。
- **「未分组」永远排在最后**，无论它多活跃。

选「**固定**」则完全按你自己排的顺序来：置顶的卡在前面，其余按拖动顺序 ——
与 0.1.x 的行为一致。

**在哪设置**：`设置 → 进行中/对话总览`，单选「自动 / 固定」，改完立即生效（写入 cookie +
localStorage，双保险）。

**老用户升级**：如果你以前手动拖过顺序（存在侧栏面板顺序记录），首次升级会自动落成
「固定」，顺序原样不动；面板底部会出现一次提示条，点「去设置」可直接跳到设置页。
不想再看到它，点掉即可 —— 提示不常驻、不占位。

**关于「实时」**：会话流式输出时 `updatedAt` 会毫秒级抖动。如果拿它当排序依据，列表会一行
一行地跳。所以自动模式只在**挂载、运行态翻转、手动刷新**这三个时机重算顺序，期间活跃度
变动不会触发重排。

### 与主题联动

卡片底色与模糊直接消费 `dsh-glass-ranswork`（自定义主题）写在 `body` 上的
`--dsh-glass-panel-light/dark`、`--dsh-glass-blur`、`--dsh-glass-saturate`。
没装主题时自动回退到 DSH 原生主题令牌，观感与内置面板一致。

### 数据来源

全部读取 Harness 已有的客户端快照（`useWorkspaces` / `useSessions` 标准 props）与客户端服务
（`uiWorkspace`、`sessions`）。宿主半侧是空实现：**不新增路由、不轮询、不写任何文件**。

### 安装

```bash
# 推荐：从 npm 安装
pnpm add dsh-workspace-ranswork
```

**请走 npm。** npm 安装的插件会被插件市场识别为可更新来源，新版本会出现在
插件市场的「可更新」列表里；从 URL / Release 附件安装的包在 registry 里没有身份，
市场只会如实报告“无更新”，等于每升一版都要你手动重装。

```bash
# 指定版本
pnpm add dsh-workspace-ranswork@0.4.0

# 不想用 npm 时（能装，但没有更新提醒）
pnpm add https://github.com/rans725/dsh-workspace-ranswork/archive/refs/tags/v0.4.0.tar.gz

# 本地开发时
pnpm add link:/path/to/dsh-workspace-ranswork
```

然后在 Harness 插件管理器里启用该 bundle，刷新 Web UI。

---

## English

### What it does

A sidebar entry that opens one flat card list (no per-workspace sections):

- **When something is running** → the button reads *Running* and the panel lists only running sessions.
- **When nothing is running** → the button reads *Conversations* and the panel lists every visible conversation, newest first.

Archived sessions, blank drafts and subagent sessions are always excluded.

### Card actions

Hover a card to reveal an action strip: **pin** (this panel only), **rename**, **copy session id**,
**fork**, **stop** (running cards only) and **archive**. Destructive actions ask for confirmation.
Clicking the card body still opens the session.

### Custom card buttons

The **Card buttons** section of `Settings → Running / Conversations` toggles each button of the
action strip on or off: pin / rename / copy id / **fork** / archive. **All are on by default** and
changes apply immediately.

- **“Stop” is not configurable**: running cards always show it, so you can always interrupt a run.
- **All off = all on**: unchecking the last one falls back to everything on, so the strip is never
  empty (an empty strip looks like a broken plugin).
- Stored in cookie `dsh_wso_card_actions` + localStorage
  `dsh.workspace-ranswork.cardActions` as a comma-separated list of action names (e.g.
  `pin,rename,copy`).
- A missing config, or one containing unknown names, means “all on / ignore the unknown ones”, so
  adding or removing buttons later never invalidates an old config.

### Drag cards within a group

Besides the pin button, you can **drag a card to the position you want inside its group**:

- **Within the owning group only**: dropping into another group does nothing and never changes the
  session's workspace.
- **Dropping at the top pins it** (a pin badge appears); dragging an already-pinned
  card to a non-first position keeps the pin as a marker only. Pin ordering applies in **Fixed**
  mode — in Auto the list stays activity-ordered. Drag-to-pin and the pin button share the **same**
  pinned set (cookie `dsh_wso_pinned` + localStorage `dsh.workspace-ranswork.pinned`) — there is
  only ever one source of truth.
- While dragging, the card is lifted and semi-transparent, and a dashed indicator marks the drop
  position.

**Click or drag? The threshold is 5 pixels:**

1. Pressing the mouse starts as a *click*;
2. Once the pointer has moved **5px** in total it becomes a *drag* — **irreversibly**: dragging back
   to the origin and releasing does not open the session;
3. On release, a click opens the session; a drag only commits the drop and suppresses the trailing
   `click` event (200ms) so a drag never opens a session by accident.

Keyboard behaviour is unchanged: focus a card and press Enter / Space to open it. Card dragging and
header dragging (group order) do not interfere — a card drag only reacts to cards, a header drag only
to groups.

### Ordering (Auto / Fixed)

**The default is Auto**: the whole list runs from most to least recently active — compared
**across all workspaces**, not grouped by workspace first and sorted within each group.

> What 0.4.1 fixed: Auto used to be "sorted within a group, but groups ordered by group". So an
> older conversation from workspace A could sit above a conversation in workspace B that had just
> been updated — exactly the "I set Auto but the most recent one isn't first" report. On top of
> that, pins and any order left over from a past drag were **permanent** and always jumped the
> queue. Auto now ignores all three.

- In Auto, **a pin is only a marker** — it does not hoist the card. Switching to Auto also clears
  the pin records.
- In Auto, **a drag still applies immediately** (your freshly dropped position is not bounced
  straight back by activity), but the next activity change (mount / running-state flip / explicit
  refresh) returns the list to activity order.
- **“Ungrouped” is always last**, however active it is.

**Fixed** keeps exactly the order you arranged: pinned cards first, then the rest in drag order —
the 0.1.x behaviour.

**Where to change it**: `Settings → Running / Conversations`, a single Auto / Fixed radio. The
change applies immediately and is stored in both a cookie and localStorage.

**Upgrading from 0.1.x**: if you had previously dragged a manual order (a sidebar panel-order
record exists), the first launch switches you to **Fixed** and your order stays exactly as it
was. A one-time hint appears at the bottom of the panel with an “Open settings” link; dismiss it
and it never comes back. The hint is not persistent and reserves no space.

**About “live” ordering**: `updatedAt` churns on a millisecond scale while a session streams.
Sorting on it directly would make the list jump around row by row. Auto therefore recomputes the
order only on mount, on a running-state flip, and on an explicit refresh.

### Theme integration

Card surfaces and blur consume the `dsh-glass-ranswork` custom-theme variables
(`--dsh-glass-panel-light/dark`, `--dsh-glass-blur`, `--dsh-glass-saturate`) with graceful
fallbacks to the stock DSH theme tokens.

### Data

Reads existing client snapshots and services only. The host half is intentionally empty:
no new routes, no polling, no files written.

### Install

```bash
# Recommended: install from npm
pnpm add dsh-workspace-ranswork
```

**Use npm.** A plugin installed from the registry is recognized by the plugin market
as an updatable source, so new versions show up in its "updates available" list.
A package installed from a URL or a Release asset has no registry identity, so the
market correctly reports "no update" — every version then needs a manual reinstall.

```bash
# pin a version
pnpm add dsh-workspace-ranswork@0.4.0

# without npm (installs fine, but no update notifications)
pnpm add https://github.com/rans725/dsh-workspace-ranswork/archive/refs/tags/v0.4.0.tar.gz

# or a local checkout, for development
pnpm add link:/path/to/dsh-workspace-ranswork
```

Enable the bundle in the Harness plugin manager, then refresh the Web UI.

---

## License

MIT © rans725
