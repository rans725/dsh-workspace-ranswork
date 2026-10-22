/**
 * ============================================================================
 * dsh-workspace-ranswork 浏览器半侧 —— 「进行中 / 对话总览」自适应面板
 * ============================================================================
 *
 * 【展示规则】
 *   有会话在跑时：只显示**正在运行**的会话（按工作区分组），侧栏按钮叫「进行中」；
 *   没有会话在跑时：自动切回**对话总览**，列出全部可见会话（同样按工作区分组），
 *   侧栏按钮叫「对话总览」。
 *
 *   两种情况都排除：已归档、空白草稿、子代理会话。行内不显示目录路径、不显示计数。
 *   点击任意一行跳到该会话的主对话。
 *
 * 【组的排序：自动 / 固定】（0.2.0 新增，见「设置 → 进行中/对话总览」）
 *   自动（默认）：有运行中会话的组优先 → 组活跃度（组内可见会话的最大 updatedAt）
 *   倒序 → 活跃度完全相同的保持工作区原始顺序；「未分组」恒排最后。
 *   固定：忽略活跃度，完全按工作区原始顺序（0.1.0 的老行为），组内卡片仍按
 *   updatedAt 倒序。
 *   升级迁移：读开关时若发现存在**手动组顺序记录**而从未写过开关，落成「固定」，
 *   老用户的顺序不变；第一次也会在面板底部给一次带「去设置」的提示（只此一次）。
 *   防抖：组顺序只在「挂载 / 运行态翻转 / 手动刷新」时重算，
 *   updatedAt 的毫秒级抖动不会让组跳来跳去（用运行态签名做 useMemo 依赖）。
 *
 * 【卡片按钮可配置】（0.3.0 新增，见同一个设置页的「卡片按钮」）
 *   置顶 / 重命名 / 复制 ID / 分叉 / 归档 可逐项关掉，默认全开。
 *   **停止按钮不在可配置项里**：运行中的卡片永远显示，随时可中断。
 *   全部关掉自动回退成全开（不出空操作条）；未知动作名忽略，方便以后增删按钮。
 *   落盘：cookie `dsh_wso_card_actions` + localStorage
 *   `dsh.workspace-ranswork.cardActions`，值为逗号分隔的动作名。
 *
 * 【卡片组内拖动 + 置顶】（0.3.0 新增）
 *   卡片可在**所属组内**拖动排序：落到组内最前 = 置顶，落到其它位置 = 取消置顶；
 *   与置顶按钮共用同一份 pinnedIds / PINNED_* 持久化，只有一份真相。
 *   跨组拖动无效（不改归属）。点击 / 拖动判定：累计位移 ≥5px 即视为拖动且**不可逆**
 *   （拖回原点也不打开会话），拖动松手后屏蔽 200ms 内的 click；键盘 Enter/空格照旧打开。
 *
 * 【按钮文案怎么做到"自适应"】
 *   侧栏条目的 `label` 是 thunk，但侧栏并不会订阅我们的会话快照，所以光靠 thunk
 *   不够。这里订阅 `ctx.get('sessions').list`（ObservableSnapshot），
 *   在「有运行中 / 没有运行中」翻转时**重新注册一次侧栏条目**，让侧栏重投影。
 *   只有布尔翻转才重注册，普通事件不会抖。
 *
 * 【与「自定义主题」联动】
 *   行底色/模糊消费 dsh-glass-ranswork 写在 body 上的
 *   --dsh-glass-panel-light/dark、--dsh-glass-blur、--dsh-glass-saturate，
 *   并用 `var(…, 回退)` 兜底：没装主题时观感等同原生面板。
 *
 * 【为什么不会再把启动搞挂】
 *   样式注入是 bundle 内置符号 `styles`，**不是** `ctx.styles`（那恒为 undefined，
 *   一调用就抛错 → 整条 entry 激活失败 → “web boot: 1 entry did not activate”）。
 *   另外每个注册步骤都包在 safe() 里，单步失败只打日志，不让 apply 抛出。
 * ============================================================================
 */
window.__ModuleLoader__.load({
  id: 'dsh-workspace-ranswork',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** 文案命名空间。 */
    const NS = 'workspaceRanswork';
    /** 侧栏图标 id 与 main 的 key 必须一致，侧栏按钮才能寻址到这个面板。 */
    const PANEL_ID = 'workspace-ranswork';
    /** 设置页区块的排序：夹在「自定义主题」(25) 和「使用统计」(27) 之间。 */
    const SECTION_ORDER = 26;

    // ==========================================================================
    // 文案
    // ==========================================================================
    const ZH = {
      entryRunning: '进行中',
      entryOverview: '对话总览',
      titleRunning: '进行中的任务',
      titleOverview: '对话总览',
      subtitleRunning: '按工作区分组，只显示当前正在运行的任务；点击任意任务即可跳到主对话。',
      subtitleOverview: '当前没有正在运行的任务，这里列出全部对话；有任务开始运行时会自动切回进行中视图。',
      empty: '还没有对话',
      emptyHint: '在工作区里新建一个会话后，它会出现在这里。',
      ungrouped: '未分组',
      unnamed: '未命名任务',
      openFailed: '无法打开这个会话。',
      loading: '正在读取…',
      openTitle: '打开任务',
      live: '进行中',
      openHint: '正在运行，点击打开主对话',
      openHintIdle: '点击打开主对话',
      updatedAgo: '{time} 前更新',
      actions: '会话操作',
      actArchive: '归档',
      actArchiveConfirm: '确认归档？',
      actStop: '停止运行',
      actStopConfirm: '确认停止？',
      actRename: '重命名',
      actFork: '分叉',
      actCopy: '复制会话 ID',
      actPin: '置顶（本面板）',
      actUnpin: '取消置顶',
      renamePlaceholder: '输入新标题',
      save: '保存',
      cancel: '取消',
      copied: '已复制会话 ID',
      actionFailed: '操作失败：{error}',
      pinBadge: '置顶',
      groupOrderHint: '组顺序已固定（沿用你原来的手动顺序）。',
      groupOrderGo: '去设置',
      nav: '进行中/对话总览',
      pageTitle: '进行中/对话总览',
      pageDesc: '选择工作区分组的排列方式。自动按活跃度排序：正在运行的组置顶，其余按最近活动时间从新到旧，「未分组」始终在最后。',
      modeLabel: '组排序',
      modeAuto: '自动',
      modeAutoDesc: '最新活跃的组置顶，有运行中会话的组优先，「未分组」排在最后。',
      modeFixed: '固定',
      modeFixedDesc: '忽略活跃度，始终按工作区的原始顺序排列。',
      cardActionsTitle: '卡片按钮',
      cardActionsLabel: '卡片按钮',
      cardActionsDesc: '选择卡片悬浮操作条上显示哪些按钮，改完立即生效。',
      cardActionsStopNote: '「停止」按钮不在此列：运行中的卡片始终显示，随时可以中断。',
      cardActionsEmptyNote: '全部取消勾选会恢复为全开，不会出现空操作条。',
      cardActionsDragNote: '提示：卡片可以在所属组内直接拖动排序，拖到组内最前即置顶，拖回非首位则取消置顶。',
      act_pin: '置顶',
      act_pinDesc: '把卡片提到本组最前（只影响本面板）。',
      act_rename: '重命名',
      act_renameDesc: '在卡片内就地修改标题。',
      act_copy: '复制会话 ID',
      act_copyDesc: '把会话 ID 复制到剪贴板。',
      act_fork: '分叉',
      act_forkDesc: '从当前点创建分支会话。',
      act_archive: '归档',
      act_archiveDesc: '把会话移到归档（需二次确认）。',
    };
    const EN = {
      entryRunning: 'Running',
      entryOverview: 'Conversations',
      titleRunning: 'Running tasks',
      titleOverview: 'All conversations',
      subtitleRunning: 'Grouped by workspace; only tasks running right now. Click one to open its conversation.',
      subtitleOverview: 'Nothing is running right now, so every conversation is listed. The view switches back automatically when a task starts.',
      empty: 'No conversations yet',
      emptyHint: 'Create a session in a workspace and it shows up here.',
      ungrouped: 'Ungrouped',
      unnamed: 'Untitled task',
      openFailed: 'Could not open this session.',
      loading: 'Loading…',
      openTitle: 'Open task',
      live: 'Running',
      openHint: 'Running now — open the conversation',
      openHintIdle: 'Open conversation',
      updatedAgo: 'updated {time} ago',
      actions: 'Session actions',
      actArchive: 'Archive',
      actArchiveConfirm: 'Archive?',
      actStop: 'Stop',
      actStopConfirm: 'Stop?',
      actRename: 'Rename',
      actFork: 'Fork',
      actCopy: 'Copy session ID',
      actPin: 'Pin (this panel)',
      actUnpin: 'Unpin',
      renamePlaceholder: 'New title',
      save: 'Save',
      cancel: 'Cancel',
      copied: 'Session ID copied',
      actionFailed: 'Action failed: {error}',
      pinBadge: 'Pinned',
      groupOrderHint: 'Group order is fixed (your previous manual order is kept).',
      groupOrderGo: 'Open settings',
      nav: 'Running / Conversations',
      pageTitle: 'Running / Conversations',
      pageDesc: 'Choose how workspace groups are ordered. Auto sorts by activity: groups with a running session first, then by most recent activity, with “Ungrouped” always last.',
      modeLabel: 'Group order',
      modeAuto: 'Auto',
      modeAutoDesc: 'The most recently active group goes first, running groups lead, and “Ungrouped” stays last.',
      modeFixed: 'Fixed',
      modeFixedDesc: 'Ignore activity and always keep the original workspace order.',
      cardActionsTitle: 'Card buttons',
      cardActionsLabel: 'Card buttons',
      cardActionsDesc: 'Choose which buttons appear in the card action strip. Changes apply immediately.',
      cardActionsStopNote: '“Stop” is not in this list: running cards always show it so you can interrupt at any time.',
      cardActionsEmptyNote: 'Unchecking everything falls back to all-on, so the action strip is never empty.',
      cardActionsDragNote: 'Tip: cards can be dragged within their own group. Drop one at the top of the group to pin it; drop it anywhere else to unpin it.',
      act_pin: 'Pin',
      act_pinDesc: 'Move the card to the top of its group (this panel only).',
      act_rename: 'Rename',
      act_renameDesc: 'Edit the title in place on the card.',
      act_copy: 'Copy session ID',
      act_copyDesc: 'Copy the session ID to the clipboard.',
      act_fork: 'Fork',
      act_forkDesc: 'Create a branch from the current point.',
      act_archive: 'Archive',
      act_archiveDesc: 'Move the session to the archive (asks for confirmation).',
    };

    // ==========================================================================
    // 样式 —— 只用主题令牌；行底色/模糊跟随「自定义主题」
    // ==========================================================================
    const CSS = [
      '.dsh-wso-page{box-sizing:border-box;width:100%;height:100%;min-height:0;overflow-y:auto;color:var(--dsw-alias-label-primary);font-family:inherit}',
      '.dsh-wso-wrap{box-sizing:border-box;max-width:920px;margin:0 auto;padding:38px clamp(20px,4vw,56px) 72px}',

      // ---- 页头 --------------------------------------------------------------
      '.dsh-wso-head{margin-bottom:26px}',
      '.dsh-wso-title{margin:0;font-size:26px;line-height:1.26;font-weight:680;letter-spacing:-.02em}',
      '.dsh-wso-subtitle{margin:8px 0 0;max-width:600px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary)}',

      // ---- 面板容器 ----------------------------------------------------------
      // 0.3.2：面板改成平坦列表，不再按工作区分块显示（工作区数据本身不变）。
      '.dsh-wso-groups{display:flex;flex-direction:column;gap:22px}',

      // ---- 卡片网格（对齐「使用统计」插件的概览卡片）-------------------------
      // 一行一个 → 自适应多列，空白收掉；窄屏自动回落到单列。
      '.dsh-wso-rows{display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:10px}',
      '.dsh-wso-row{position:relative;display:flex;flex-direction:column;gap:7px;box-sizing:border-box;width:100%;margin:0;padding:13px 15px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);background:var(--dsh-glass-panel-light,var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-module-platform)));-webkit-backdrop-filter:blur(var(--dsh-glass-blur,0px)) saturate(var(--dsh-glass-saturate,100%));backdrop-filter:blur(var(--dsh-glass-blur,0px)) saturate(var(--dsh-glass-saturate,100%));color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;appearance:none;-webkit-appearance:none;overflow:hidden;transition:border-color .16s,background .16s,transform .16s,box-shadow .16s}',
      'body[data-ds-dark-theme] .dsh-wso-row{background:var(--dsh-glass-panel-dark,var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-module-platform)))}',
      '.dsh-wso-row:hover{border-color:var(--dsw-alias-border-l1);box-shadow:0 10px 26px -22px rgba(0,0,0,.55);transform:translateY(-1px)}',
      '.dsh-wso-row:active{transform:translateY(0)}',
      '.dsh-wso-row:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 62%,transparent);outline-offset:2px}',

      // 卡片头部：状态点 + 相对时间 / 进行中胶囊（对应统计卡的 cardLabel 那一行）
      '.dsh-wso-head-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}',
      '.dsh-wso-status{display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dsh-wso-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}',
      '.dsh-wso-dot.is-live{position:relative;background:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)))}',
      '.dsh-wso-dot.is-live:after{position:absolute;inset:-3px;border-radius:50%;border:1px solid currentColor;content:"";opacity:.45;animation:dsh-wso-ping 1.9s ease-out infinite}',

      // 标题：固定两行高度（内容不足两行也占两行）→ 同一行里卡片高度必然一致。
      '.dsh-wso-text{display:flex;flex-direction:column;gap:3px;min-width:0;min-height:40px}',
      '.dsh-wso-text-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:14.5px;line-height:20px;max-height:40px;font-weight:600;letter-spacing:-.006em}',
      '.dsh-wso-text-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px}',

      // 底部：进行中胶囊 / 打开提示 + 箭头（贴在卡片下沿）
      '.dsh-wso-tail{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:1px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;min-width:0}',
      '.dsh-wso-live{display:inline-flex;align-items:center;gap:6px;flex:none;padding:2px 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))) 32%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))) 11%,transparent);color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)));font-size:10.5px;line-height:15px;font-weight:560}',
      '.dsh-wso-live-dot{width:5px;height:5px;border-radius:50%;background:currentColor}',
      '.dsh-wso-hint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.dsh-wso-arrow{flex:none;display:inline-flex;opacity:.5;transition:opacity .16s,transform .16s}',
      '.dsh-wso-row:hover .dsh-wso-arrow{opacity:1;transform:translateX(2px)}',
      '@keyframes dsh-wso-ping{0%{transform:scale(.55);opacity:.6}70%{transform:scale(1.35);opacity:0}100%{opacity:0}}',

      // ---- 悬浮操作条 --------------------------------------------------------
      // 卡片本体是 div[role=button]（<button> 里不能嵌 <button>），
      // 操作条绝对定位在卡片右上角，hover / focus-within 才显形。
      '.dsh-wso-row{position:relative}',
      '.dsh-wso-acts{position:absolute;top:6px;right:6px;display:flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-layer-2)));box-shadow:0 6px 18px -12px rgba(0,0,0,.6);opacity:0;pointer-events:none;transform:translateY(-2px);transition:opacity .14s,transform .14s}',
      '.dsh-wso-row:hover .dsh-wso-acts,.dsh-wso-row:focus-within .dsh-wso-acts{opacity:1;pointer-events:auto;transform:translateY(0)}',
      '.dsh-wso-act{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s,color .12s}',
      '.dsh-wso-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary)}',
      '.dsh-wso-act:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 62%,transparent);outline-offset:1px}',
      '.dsh-wso-act.is-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 16%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.dsh-wso-act:disabled{opacity:.4;cursor:default}',
      '.dsh-wso-act.is-on{color:var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))}',

      // 二次确认：直接替换操作条内容，避免再弹一层。
      '.dsh-wso-confirm{display:flex;align-items:center;gap:4px;padding:0 2px 0 8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dsh-wso-confirm-go{padding:3px 9px;border:none;border-radius:6px;background:var(--dsw-alias-state-error-primary);color:#fff;font:inherit;font-size:11px;line-height:15px;cursor:pointer}',
      '.dsh-wso-confirm-go.is-plain{background:var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))}',
      '.dsh-wso-confirm-cancel{padding:3px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:15px;cursor:pointer}',

      // 就地重命名
      '.dsh-wso-rename{display:flex;align-items:center;gap:4px;margin-top:2px}',
      '.dsh-wso-rename-input{box-sizing:border-box;flex:1 1 auto;min-width:0;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.dsh-wso-rename-input:focus{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 55%,var(--dsw-alias-border-l2))}',

      // 置顶标记
      '.dsh-wso-pin{flex:none;display:inline-flex;color:var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))}',
      '.dsh-wso-toast{margin:10px 2px 0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}',

      // ---- 空状态 ------------------------------------------------------------
      '.dsh-wso-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:60px 20px 64px;text-align:center;border:1px dashed var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsh-glass-panel-light,color-mix(in srgb,var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-module-platform)) 55%,transparent))}',
      'body[data-ds-dark-theme] .dsh-wso-empty{background:var(--dsh-glass-panel-dark,color-mix(in srgb,var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-module-platform)) 55%,transparent))}',
      '.dsh-wso-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;margin-bottom:3px;border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 12%,transparent);color:var(--dsw-alias-label-secondary)}',
      '.dsh-wso-empty-title{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.dsh-wso-empty-hint{max-width:330px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.dsh-wso-error{margin:14px 2px 0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:17px}',

      // ---- 设置页「设置 → 进行中/对话总览」-----------------------------------
      // 对齐「使用统计」的设置区块（16px 内边距 + layer-1 底 + l2 边框）。
      '.dsh-wso-set{box-sizing:border-box;display:flex;flex-direction:column;gap:16px;width:100%;color:var(--dsw-alias-label-primary);font-family:inherit}',
      '.dsh-wso-set-intro{padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1)}',
      '.dsh-wso-set-title{margin:0;font-size:14px;line-height:20px;font-weight:600}',
      '.dsh-wso-set-desc{margin:2px 0 0;max-width:46em;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dsh-wso-set-body{margin-top:14px}',
      '.dsh-wso-opt{display:flex;align-items:flex-start;gap:10px;margin:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);cursor:pointer;transition:border-color .14s,background .14s}',
      '.dsh-wso-opt + .dsh-wso-opt{margin-top:8px}',
      '.dsh-wso-opt:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.10))}',
      '.dsh-wso-opt.is-on{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 48%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 8%,transparent)}',
      '.dsh-wso-opt:focus-within{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf)) 55%,var(--dsw-alias-border-l2))}',
      '.dsh-wso-opt input{flex:none;width:14px;height:14px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf));cursor:pointer}',
      '.dsh-wso-opt-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsh-wso-opt-name{font-size:13px;line-height:19px;font-weight:560}',
      '.dsh-wso-opt-desc{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dsh-wso-set-link{align-self:flex-start;padding:0;border:none;background:transparent;color:var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf));font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.dsh-wso-set-link:hover{text-decoration:underline}',
      '.dsh-wso-check{display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,8px);cursor:pointer}',
      '.dsh-wso-check:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.10))}',
      '.dsh-wso-check input{flex:none;width:14px;height:14px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf));cursor:pointer}',
      '.dsh-wso-note{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',

      // ---- 卡片拖动：全程 pointer capture 跟手 --------------------------------
      // touch-action:none 让触屏 / 手写笔也能拖（否则浏览器把手势抢去滚动）；
      // user-select:none 从一开始就禁掉文字选中 —— 拖动中不会刷蓝。
      '.dsh-wso-row{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
      // 拖动中：不再有 hover 浮起，锁住光标；默认状态完全不透明（影子卡片负责跟手）。
      // 注意：没有 .is-dragging 放大 / 缩小 —— 原卡原地"开口"才是拖动的视觉反馈。
      '.dsh-wso-row.is-dragging{cursor:grabbing;border-style:dashed;border-color:var(--dsw-alias-border-l1);background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none;transform:none;transition:none}',
      '.dsh-wso-row.is-dragging > *{opacity:.32;transition:opacity .12s}',
      'body[data-ds-dark-theme] .dsh-wso-row.is-dragging{background:transparent}',
      // 0.3.5：白条（is-drop-before / is-drop-end）整条下线条已**删除**。
      // 落点改为「指针落在哪张卡上就跟它换位」，覆盖整张卡；拖动时其他卡片
      // 实时让位，被拖卡的虚线空位跟着落点走 —— 松手前的画面就是松手后的
      // 真实排列，不需要再靠一根线去瞄准缝隙。
      // 跟手的"影子卡片"：fixed + 视口坐标 + 略倾斜 + 投影，pointer-events 全关，
      // 拖动期间用 transform 移动（合成层，不触发布局）。
      '.dsh-wso-ghost{position:fixed;left:0;top:0;z-index:2147483000;margin:0;pointer-events:none;opacity:.96;will-change:transform;transform-origin:0 0;box-shadow:0 18px 40px -14px rgba(0,0,0,.45),0 4px 12px -6px rgba(0,0,0,.28);outline:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);transition:none}',
      '.dsh-wso-ghost.is-returning{transition:transform .16s ease,opacity .16s ease;opacity:0}',

      // ---- 面板底部的一次性升级提示 ------------------------------------------
      '.dsh-wso-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:22px 2px 0;color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:17px}',

      '@media (max-width:720px){.dsh-wso-wrap{padding:28px 16px 56px}.dsh-wso-title{font-size:22px}.dsh-wso-rows{grid-template-columns:1fr}.dsh-wso-row{min-height:96px;padding:12px 13px}}',
      '@media (prefers-reduced-motion:reduce){.dsh-wso-dot.is-live:after{animation:none}.dsh-wso-row{transition:none}}',

      // ---- 侧栏「全局面板」行拖动排序（只作用于打了 data 标记的行）-----------
      // 内置侧栏的行样式不带 cursor / 选中控制，这里补「可拖」的手感；
      // 拖动期间锁住选中，避免整片文字被刷蓝（和「已归档」面板同一个教训）。
      '[data-dsh-panel-row]{cursor:grab;transition:box-shadow .12s,opacity .12s}',
      '[data-dsh-panel-dragging]{cursor:grabbing;opacity:.45}',
      'body.dsh-wso-sorting,body.dsh-wso-sorting *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important}',
      // 卡片拖动期间：全页锁选中 + 锁光标（拖到卡片外、拖到侧栏文字上也不会刷蓝）
      'body.dsh-wso-dragging-card,body.dsh-wso-dragging-card *{-webkit-user-select:none!important;user-select:none!important;cursor:grabbing!important}',
      '@media (prefers-reduced-motion:reduce){[data-dsh-panel-row]{transition:none}}',
    ].join('\n');

    // ==========================================================================
    // 选择器与纯函数（模块级，引用稳定）
    // ==========================================================================
    const EMPTY_ITEMS = Object.freeze([]);
    const EMPTY_IDS = Object.freeze([]);
    const EMPTY_BY_ID = Object.freeze({});
    const EMPTY_STATE = Object.freeze({ ids: EMPTY_IDS, byId: EMPTY_BY_ID });

    const selectWorkspaceItems = (snapshot) => (snapshot == null ? EMPTY_ITEMS : snapshot.items ?? EMPTY_ITEMS);
    const selectArchivedIds = (snapshot) => (snapshot == null ? EMPTY_IDS : snapshot.archivedSessionIds ?? EMPTY_IDS);
    const selectSessionState = (snapshot) => (snapshot == null ? EMPTY_STATE : snapshot);

    /** 取路径最后一段（只用于工作区标题回退，不渲染给用户）。 */
    function baseName(path) {
      if (typeof path !== 'string' || path === '') return '';
      const trimmed = path.replace(/[/\\]+$/, '');
      return trimmed.slice(Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\')) + 1);
    }

    /** 毫秒时间戳 → 简短相对时间。 */
    function relativeTime(now, time) {
      if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) return '';
      const diff = Math.max(0, now - time);
      const minute = 60_000;
      const hour = 60 * minute;
      const day = 24 * hour;
      if (diff < minute) return '<1m';
      if (diff < hour) return `${Math.floor(diff / minute)}m`;
      if (diff < day) return `${Math.floor(diff / hour)}h`;
      if (diff < 30 * day) return `${Math.floor(diff / day)}d`;
      return `${Math.floor(diff / (30 * day))}mo`;
    }

    /**
     * 把一个会话摘要变成一行可渲染数据。
     *
     * @param id - 会话 id。
     * @param byId - `sessions.list.byId`。
     * @param labels - `{ unnamed }`。
     * @returns 行数据，或 null（摘要缺失）。
     */
    function toRow(id, byId, labels) {
      const summary = byId[id];
      if (summary == null || typeof summary !== 'object') return null;
      const titled =
        (typeof summary.displayTitle === 'string' && summary.displayTitle.trim()) ||
        (typeof summary.title === 'string' && summary.title.trim()) ||
        '';
      return {
        id,
        title: titled === '' ? labels.unnamed : titled,
        running: summary.running === true,
        updatedAt: typeof summary.updatedAt === 'number' ? summary.updatedAt : 0,
        origin: summary.origin,
        blank: summary.blank === true,
      };
    }

    /**
     * 组装视图数据：有运行中会话时只列运行中的，否则列全部可见会话。
     *
     * @param workspaces - 工作区视图数组。
     * @param sessionState - `sessions.list` 快照（`ids` / `byId`）。
     * @param archivedIds - 归档集合。
     * @param labels - `{ unnamed, ungrouped }`。
     * @returns `{ groups, total, running, mode }`；mode 为 `'running'` 或 `'overview'`。
     */
    function buildOverview(workspaces, sessionState, archivedIds, labels) {
      const byId = sessionState?.byId ?? EMPTY_BY_ID;
      const archived = new Set(archivedIds);
      const seen = new Set();

      /** 基础可见性：存在、未归档、非子代理、非空白草稿。 */
      const visible = (id) => {
        if (archived.has(id) || seen.has(id)) return false;
        const summary = byId[id];
        if (summary == null || typeof summary !== 'object') return false;
        if (summary.origin === 'subagent') return false;
        if (summary.blank === true) return false;
        return true;
      };

      // 先判断整体是否有运行中的会话（决定模式）。
      let anyRunning = false;
      for (const id of sessionState?.ids ?? EMPTY_IDS) {
        if (!visible(id)) continue;
        if (byId[id]?.running === true) {
          anyRunning = true;
          break;
        }
      }
      const mode = anyRunning ? 'running' : 'overview';
      const wanted = (id) => (mode === 'running' ? byId[id]?.running === true : true);

      const groups = [];
      let total = 0;
      let running = 0;

      const push = (rows, key, title) => {
        rows.sort((a, b) => b.updatedAt - a.updatedAt);
        total += rows.length;
        running += rows.filter((row) => row.running).length;
        groups.push({ key, title, rows });
      };

      for (const workspace of workspaces) {
        const rows = [];
        for (const id of workspace?.sessionIds ?? EMPTY_IDS) {
          if (!visible(id) || !wanted(id)) continue;
          const row = toRow(id, byId, labels);
          if (row === null) continue;
          rows.push(row);
          seen.add(id);
        }
        if (rows.length === 0) continue;
        const title = typeof workspace.title === 'string' && workspace.title.trim() !== ''
          ? workspace.title.trim()
          : baseName(workspace.path) || labels.ungrouped;
        push(rows, String(workspace.workspaceId ?? title), title);
      }

      // 不属于任何工作区的可见会话落到最后一组。
      const stray = [];
      for (const id of sessionState?.ids ?? EMPTY_IDS) {
        if (!visible(id) || !wanted(id)) continue;
        const row = toRow(id, byId, labels);
        if (row === null) continue;
        stray.push(row);
      }
      if (stray.length > 0) push(stray, '__ungrouped__', labels.ungrouped);

      return { groups, total, running, mode };
    }

    // ==========================================================================
    // 图标
    // ==========================================================================
    function OverviewGlyph(props) {
      const size = props?.size ?? 18;
      return h(
        'svg',
        {
          viewBox: '0 0 20 20', width: size, height: size, fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': true, style: { display: 'block' },
        },
        h('rect', { x: 2.2, y: 3.2, width: 15.6, height: 13.6, rx: 2.4 }),
        h('path', { d: 'M2.2 7.4h15.6' }),
        h('rect', { x: 5, y: 9.8, width: 4.2, height: 4.6, rx: 1, fill: 'currentColor', stroke: 'none', opacity: 0.35 }),
        h('path', { d: 'M11.4 10.6h4.2M11.4 13.4h3' }),
      );
    }

    function SidebarIcon(props) {
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
        h(OverviewGlyph, { size: props?.size ?? 18 }));
    }

    /** 空状态插图。 */
    function EmptyGlyph(props) {
      const size = props?.size ?? 20;
      return h('svg', {
        viewBox: '0 0 20 20', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block' },
      },
      h('rect', { x: 2.5, y: 3.5, width: 15, height: 13, rx: 2.4 }),
      h('path', { d: 'M2.5 7.5h15' }),
      h('path', { d: 'M6 11h5M6 13.6h3' }));
    }

    // ==========================================================================
    // 操作图标（16×16 线性图标，全部 currentColor）
    // ==========================================================================
    /** 统一的图标外壳。 */
    function glyph(paths) {
      return function Icon() {
        return h('svg', {
          viewBox: '0 0 16 16', width: 15, height: 15, fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.35, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': true, style: { display: 'block' },
        }, ...paths.map((d, index) => h('path', { key: index, d })));
      };
    }

    const ArchiveIcon = glyph([
      'M2.2 4.2h11.6',
      'M3.4 4.2v7.1a1.3 1.3 0 0 0 1.3 1.3h6.6a1.3 1.3 0 0 0 1.3-1.3V4.2',
      'M2.2 2.6h11.6v1.6H2.2z',
      'M6.4 7h3.2',
    ]);
    const StopIcon = glyph(['M5.2 5.2h5.6v5.6H5.2z']);
    const RenameIcon = glyph(['M2.4 11.9l.4-2.3 6.4-6.4a1.2 1.2 0 0 1 1.7 0l.9.9a1.2 1.2 0 0 1 0 1.7L5.4 12.2l-2.3.4z', 'M9.2 4.1l2.7 2.7']);
    const ForkIcon = glyph(['M4.6 3.4v4.1a2.4 2.4 0 0 0 2.4 2.4h4.4', 'M9.6 7.9l2.2 2-2.2 2', 'M4.6 3.4a1.3 1.3 0 1 0 0-.1z']);
    const CopyIcon = glyph(['M5.6 5.6V3.9c0-.7.6-1.3 1.3-1.3h5.2c.7 0 1.3.6 1.3 1.3v5.2c0 .7-.6 1.3-1.3 1.3h-1.7', 'M3.9 5.6h5.2c.7 0 1.3.6 1.3 1.3v5.2c0 .7-.6 1.3-1.3 1.3H3.9c-.7 0-1.3-.6-1.3-1.3V6.9c0-.7.6-1.3 1.3-1.3z']);
    const PinIcon = glyph(['M9.4 2.2l4.4 4.4-1.5 1.5-.6-.2-2.4 2.4.2 1.9-1 1-2.2-2.2-3 3', 'M2.2 13.8l3-3']);

    // ==========================================================================
    // 置顶（只作用于本面板，存在 cookie + localStorage）
    // ==========================================================================
    // 宿主没有给插件暴露 pin 的客户端入口（workspaceController.pinSession 是
    // Remote-only，且我们这种 bundle 没有 harness.handle 桥），所以这里做
    // **面板内**置顶：只影响本页排序，不改动 DSH 自己的置顶集合。
    const PINNED_KEY = 'dsh.workspace-ranswork.pinned';
    const PINNED_COOKIE = 'dsh_wso_pinned';

    // 0.3.2 自由排序：置顶只能表达「谁在最前」，中间卡片拖到哪里都只能是
    // 「原地」或「置顶」，所以另存一份**平坦的卡片顺序**。
    // 与置顶的分工刻意划死，避免两份数据互相覆盖：
    //   - pinnedIds：只表达「哪些恒在最前」（不变）；
    //   - ORDER_KEY：只表达「其余卡片之间」的相对顺序。
    // 渲染时 pinned 在前、余下按 ORDER，再叠加还没进 ORDER 的新卡片（按默认顺序追加）。
    const ORDER_KEY = 'dsh.workspace-ranswork.order';
    const ORDER_COOKIE = 'dsh_wso_order';

    /**
     * 读一个 cookie（读不到返回 null，永不抛错）。
     *
     * 全文件**只能有这一份** readCookie / writeCookie：之前置顶与侧栏排序
     * 各声明了一份同名函数，后者覆盖前者（一份返回 null、一份返回空串），
     * 属于隐藏 bug，已合并。
     */
    function readCookie(name) {
      try {
        if (typeof document === 'undefined' || document === null) return null;
        const prefix = `${name}=`;
        for (const part of String(document.cookie ?? '').split(';')) {
          const text = part.trim();
          if (text.startsWith(prefix)) return decodeURIComponent(text.slice(prefix.length));
        }
        return null;
      } catch {
        return null;
      }
    }

    /** 写一个 cookie（一年有效；失败静默）。 */
    function writeCookie(name, value) {
      try {
        if (typeof document === 'undefined' || document === null) return;
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // 写不进去只影响记忆，不影响本次行为
      }
    }

    /** 读置顶集合：cookie 优先，localStorage 兜底。 */
    function readPinned() {
      const fromCookie = parseIdList(readCookie(PINNED_COOKIE));
      if (fromCookie !== null) return fromCookie;
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return [];
        return parseIdList(localStorage.getItem(PINNED_KEY)) ?? [];
      } catch {
        return [];
      }
    }

    /** 写置顶集合。 */
    function writePinned(ids) {
      const text = JSON.stringify(Array.isArray(ids) ? ids : []);
      writeCookie(PINNED_COOKIE, text);
      try {
        if (typeof localStorage !== 'undefined' && localStorage !== null) localStorage.setItem(PINNED_KEY, text);
      } catch {
        // 忽略
      }
    }

    /** 读自由排序（cookie 优先，localStorage 兜底）。 */
    function readOrder() {
      const fromCookie = parseIdList(readCookie(ORDER_COOKIE));
      if (fromCookie !== null) return fromCookie;
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return [];
        return parseIdList(localStorage.getItem(ORDER_KEY)) ?? [];
      } catch {
        return [];
      }
    }

    /** 写自由排序。 */
    function writeOrder(ids) {
      const text = JSON.stringify(Array.isArray(ids) ? ids : []);
      writeCookie(ORDER_COOKIE, text);
      try {
        if (typeof localStorage !== 'undefined' && localStorage !== null) localStorage.setItem(ORDER_KEY, text);
      } catch {
        // 忽略
      }
    }

    /**
     * 「自由顺序被重置」的订阅者集合。
     *
     * 设置页（`GroupOrderSection`）和侧栏面板（`WorkspaceOverview`）是**两个
     * 独立的组件实例**，各自持有自己的 `freeOrder` 状态。设置页把存储里的
     * 顺序清掉之后，面板那份 state 还是旧值，它不会自己知道存储变了。
     * 所以用一个模块级订阅表把「顺序已重置」广播出去。
     *
     * 不能用「渲染期对账存储」的办法：拖拽过程中 state 领先于存储，
     * 对账会把刚拖好的顺序覆盖回旧值，表现为「拖不动」。
     */
    const orderResetListeners = new Set();

    /** 广播「自由顺序已重置」，让所有挂载中的面板重新读取。 */
    function notifyOrderReset() {
      for (const listener of orderResetListeners) {
        try {
          listener();
        } catch {
          // 单个订阅者炸了不能连累其它面板
        }
      }
    }

    /** 订阅「自由顺序已重置」，返回退订函数。 */
    function subscribeOrderReset(listener) {
      orderResetListeners.add(listener);
      return () => {
        orderResetListeners.delete(listener);
      };
    }

    /**
     * 面板的展示顺序：先按自由排序，再把置顶项提到最前面。
     *
     * 0.3.2 的取舍：**一旦用户拖过卡片（有自由顺序），就以自由顺序为唯一真相**，
     * 不再把置顶项强制前置。否则置顶卡片被拖到中间后会立刻被顶回首位，
     * 表现就是「拖了没用」—— 这正是本次要修的 bug。
     * 没有自由顺序时（还没拖过 / 清过缓存）仍然把置顶项提到最前面，
     * 保持老版本「置顶就在最前」的观感。
     * 置顶**标记**（卡片上的图钉）始终按 pinned 显示，与排序无关。
     *
     * @param rows - 行数组（默认顺序）。
     * @param pinned - 置顶 id 集合（null / undefined = 不处理置顶）。
     * @param freeOrder - `readOrder()` 读出来的 id 顺序（可省略）。
     * @returns 新数组。
     */
    function applyPinnedOrder(rows, pinned, freeOrder) {
      if (!Array.isArray(rows)) return rows;
      const hasFree = Array.isArray(freeOrder) && freeOrder.length > 0;
      const ordered = applyFreeOrder(rows, freeOrder);
      const safePinned = pinned === undefined || pinned === null ? null : pinned;
      if (safePinned === null || hasFree) return ordered;
      const hot = [];
      const rest = [];
      for (const row of ordered) {
        if (safePinned.has(row.id)) hot.push(row);
        else rest.push(row);
      }
      return [...hot, ...rest];
    }

    /**
     * 按用户拖出来的平坦顺序排一次（与工作区分组无关）。
     *
     * 规则：ORDER 里出现过的卡片按 ORDER 的相对顺序排在前面；没出现过的
     * （新会话 / 被清掉的旧 id）按传入的默认顺序追加到后面。
     * 这样「新会话自动出现在末尾」不需要写存储，也不会打乱已有顺序。
     *
     * 纯函数，不修改入参。
     *
     * @param rows - 行数组（默认顺序，通常已按 updatedAt 倒序）。
     * @param freeOrder - ORDER_* 读出来的 id 数组。
     * @returns 新数组。
     */
    function applyFreeOrder(rows, freeOrder) {
      if (!Array.isArray(rows)) return rows;
      if (!Array.isArray(freeOrder) || freeOrder.length === 0) return rows.slice();
      const rank = new Map();
      for (let i = 0; i < freeOrder.length; i += 1) {
        if (!rank.has(freeOrder[i])) rank.set(freeOrder[i], i);
      }
      const known = [];
      const fresh = [];
      for (const row of rows) {
        if (row !== null && row !== undefined && rank.has(row.id)) known.push(row);
        else fresh.push(row);
      }
      known.sort((a, b) => rank.get(a.id) - rank.get(b.id));
      return [...known, ...fresh];
    }

    // ==========================================================================
    // 卡片按钮开关（0.3.0）
    // ==========================================================================
    // 用户可以在设置页里关掉某些卡片操作（比如嫌「分叉」容易误点）。
    // 两个刻意的约束：
    //   1. **stop 不在这个列表里** —— 运行中的任务必须随时能停，不交给用户关掉；
    //   2. 全关 = 全开 —— 空操作条既没用又会让人以为插件坏了，直接回退。
    // 存的是逗号分隔的**开着的**动作名，缺省即全开；未知名字直接忽略，
    // 这样以后加/删按钮，老配置也不会失效。
    const CARD_ACTIONS_KEY = 'dsh.workspace-ranswork.cardActions';
    const CARD_ACTIONS_COOKIE = 'dsh_wso_card_actions';
    /** 可配置的动作（顺序即操作条里的顺序）；stop 故意不在其中。 */
    const CARD_ACTION_LIST = ['pin', 'rename', 'copy', 'fork', 'archive'];
    /** 全部可用（默认值）。 */
    const CARD_ACTIONS_ALL = CARD_ACTION_LIST.slice();

    /**
     * 解析「开着的动作」字符串。
     *
     * @param text - 形如 `'pin,rename,copy'`；null/空串表示没存过。
     * @returns 动作名数组；没存过返回 null（交给调用方走「全开」缺省）。
     */
    function parseCardActions(text) {
      if (typeof text !== 'string') return null;
      const trimmed = text.trim();
      if (trimmed === '') return null;
      const on = [];
      for (const name of trimmed.split(',')) {
        const key = name.trim();
        if (CARD_ACTION_LIST.includes(key) && !on.includes(key)) on.push(key);
      }
      // 存过但一个都不认识（比如只有以后才有的按钮名）→ 当没配过处理。
      return on.length === 0 ? null : on;
    }

    /**
     * 读「开着的卡片动作」：cookie 优先，localStorage 兜底，都没有则全开。
     *
     * @returns 动作名数组（非空，顺序按 CARD_ACTION_LIST）。
     */
    function readCardActions() {
      const parsed = parseCardActions(readCookie(CARD_ACTIONS_COOKIE)) ?? parseCardActions(readStore(CARD_ACTIONS_KEY));
      if (parsed === null) return CARD_ACTIONS_ALL.slice();
      return CARD_ACTION_LIST.filter((name) => parsed.includes(name));
    }

    /**
     * 写「开着的卡片动作」（cookie + localStorage 双写）。
     *
     * @param names - 动作名数组；空数组按「全开」落盘。
     */
    function writeCardActions(names) {
      const on = CARD_ACTION_LIST.filter((name) => Array.isArray(names) && names.includes(name));
      const value = (on.length === 0 ? CARD_ACTION_LIST : on).join(',');
      writeCookie(CARD_ACTIONS_COOKIE, value);
      writeStore(CARD_ACTIONS_KEY, value);
    }

    /**
     * 切换一个动作的开关；抹掉最后一个也等于全开。
     *
     * @param current - 当前开着的动作名数组。
     * @param name - 要切换的动作名。
     * @returns 新的动作名数组（非空，顺序按 CARD_ACTION_LIST）。
     */
    function toggleCardAction(current, name) {
      if (!CARD_ACTION_LIST.includes(name)) return CARD_ACTION_LIST.slice();
      const on = CARD_ACTION_LIST.filter((item) => Array.isArray(current) && current.includes(item));
      const next = on.includes(name) ? on.filter((item) => item !== name) : [...on, name];
      if (next.length === 0) return CARD_ACTION_LIST.slice();
      return CARD_ACTION_LIST.filter((item) => next.includes(item));
    }

    /**
     * 操作条里真正要渲染的动作：按配置过滤，但 stop 永远保留。
     *
     * @param row - 行数据（只看 `running`）。
     * @param enabled - 开着的动作名数组。
     * @returns 动作名数组，顺序固定为 可配置项 → stop → archive。
     */
    function visibleActions(row, enabled) {
      const on = Array.isArray(enabled) ? enabled : CARD_ACTIONS_ALL;
      const out = CARD_ACTION_LIST.filter((name) => name !== 'archive' && on.includes(name));
      if (row?.running === true) out.push('stop');
      if (on.includes('archive')) out.push('archive');
      return out;
    }

    // ==========================================================================
    // 主面板
    // ==========================================================================
    /**
     * 进行中 / 对话总览 自适应面板。
     *
     * @param props - 标准 props（`t`、`useWorkspaces`、`useSessions`）+ inject 的
     *                `openSession`。
     */
    function OverviewPanel(props) {
      // 框架会注入 `t`；万一没有也退回 key，不让渲染抛错。
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const useWorkspaces = typeof props.useWorkspaces === 'function'
        ? props.useWorkspaces
        : (selector) => selector(undefined);
      const useSessions = typeof props.useSessions === 'function'
        ? props.useSessions
        : (selector) => selector(undefined);

      const workspaces = useWorkspaces(selectWorkspaceItems);
      const archivedIds = useWorkspaces(selectArchivedIds);
      const sessionState = useSessions(selectSessionState);

      const [failure, setFailure] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [confirming, setConfirming] = React.useState(null);
      const [renaming, setRenaming] = React.useState(null);
      const [draft, setDraft] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [pinnedIds, setPinnedIds] = React.useState(readPinned);
      // 0.3.2：自由排序（跨工作区的平坦顺序）。
      const [freeOrder, setFreeOrder] = React.useState(readOrder);
      const [groupAuto, setGroupAuto] = React.useState(readGroupAuto);
      // 设置页切「自动 / 固定」时会清掉自由顺序，而那是**另一个组件实例**写的存储：
      // 本实例的 state 不会自动跟着变，表现就是「设置里切了，卡片没重排」。
      // 订阅一次「顺序已重置」，收到后从存储重读（含开关状态）。
      // 注意不能用「每帧对账」：拖拽过程中 state 领先于存储，对账会把刚拖好的
      // 顺序覆盖回旧值，表现为「拖不动」。
      React.useEffect(() => subscribeOrderReset(() => {
        setFreeOrder(readOrder());
        setGroupAuto(readGroupAuto());
      }), []);
      // 一次性升级提示：仅当「迁成固定」且本地确有手动顺序记录时出现。
      // readGroupAuto() 的迁移分支已经写过开关，这里再读只会命中已存值，不会重复落盘。
      const [showOrderHint, setShowOrderHint] = React.useState(
        () => hasManualGroupOrder() && readGroupAuto() === false,
      );
      // 卡片操作条：开着的动作名数组（默认全开；stop 不在其中，永远显示）。
      const [cardActions, setCardActions] = React.useState(readCardActions);
      // 组内拖动状态：{ key, id, target } —— target 是落点插入点（0 = 最前）。
      // 拖动中的卡片顺序由 rowOrder 记忆化，松手后再落到 pinnedIds（唯一真相）。
      const [drag, setDrag] = React.useState(null);
      // 拖动状态的镜像 ref：pointerup 之类「渲染期绑定的回调」只能拿到旧闭包，
      // 必须从 ref 读最新落点，否则落点永远是 null。
      const dragRef = React.useRef(null);
      dragRef.current = drag;


      const pinned = React.useMemo(() => new Set(pinnedIds), [pinnedIds]);

      const built = buildOverview(
        Array.isArray(workspaces) ? workspaces : EMPTY_ITEMS,
        sessionState ?? EMPTY_STATE,
        Array.isArray(archivedIds) ? archivedIds : EMPTY_IDS,
        { unnamed: t('unnamed'), ungrouped: t('ungrouped') },
      );

      // 防抖：自动模式的组顺序只认「运行态签名」，updatedAt 的毫秒级抖动不重排。
      // 依赖里只放签名字符串 → 签名不变就直接复用上次的结果。
      const signature = runningSignature(sessionState ?? EMPTY_STATE);
      const groups = React.useMemo(
        () => sortGroups(built.groups, groupAuto),
        [signature, groupAuto, built],
      );

      // 0.3.2：面板改成**一个平坦列表**，不再按工作区分块。
      // 工作区归属仍然参与「有哪些卡片」（buildOverview 决定），只是不再决定
      // 卡片在哪一块、能不能互相拖动。
      // 默认顺序 = 各组按现有排序依次摊平（保持原有观感），再把自由排序叠上去。
      const flat = React.useMemo(() => {
        const rows = [];
        const seenIds = new Set();
        for (const group of Array.isArray(groups) ? groups : []) {
          for (const row of Array.isArray(group?.rows) ? group.rows : []) {
            if (seenIds.has(row.id)) continue;
            seenIds.add(row.id);
            rows.push(row);
          }
        }
        return rows;
      }, [signature, groupAuto, built]);

      /** 面板实际展示顺序：置顶在前，其余按用户拖出来的自由顺序。 */
      const panelOrder = React.useMemo(
        () => applyPinnedOrder(flat, pinned, freeOrder),
        [flat, pinned, freeOrder],
      );

      const open = (id) => {
        setFailure('');
        try {
          if (typeof props.openSession !== 'function') throw new Error('uiWorkspace unavailable');
          props.openSession(id);
        } catch {
          setFailure(t('openFailed'));
        }
      };

      // ----------------------------------------------------------------------
      // 卡片点击 / 拖动判定（用户指定的硬规则）
      // ----------------------------------------------------------------------
      // mousedown → intent='click'；位移一旦 ≥5px → intent='drag'（不可逆，
      // 拖回原处也不回退）；mouseup 时 click 才打开会话，drag 只落位并屏蔽
      // 随后 200ms 的 click。指针状态放 ref 里：它变化不该触发渲染。
      //
      // 0.3.1 起改用 **Pointer Events + setPointerCapture**：鼠标移出卡片、
      // 移到操作按钮或别的卡片上都不会中途丢事件（以前用 mouseleave 兜底，
      // 一离开卡片就被当成取消，表现就是「拖不动 / 一停就断」）。
      // 同时浮出一张 fixed 的「影子卡片」跟手 —— 原卡只留虚线占位。
      const pointerRef = React.useRef(null);
      /** 最近一次拖动结束的时间戳（用于屏蔽尾随 click）。 */
      const guardRef = React.useRef(0);
      /** 跟手的影子卡片 DOM + 运行时几何（不进 state，避免每帧重渲染）。 */
      const ghostRef = React.useRef(null);
      const ghostInfoRef = React.useRef(null);
      const rafRef = React.useRef(0);
      /** 拖动期间禁止文本选中的 body class。 */
      const SELECT_LOCK_CLASS = 'dsh-wso-dragging-card';
      /** 指针捕获的目标元素（body，重渲染不换）。 */
      let captureHost = null;

      const setSelectLock = (on) => {
        if (typeof document === 'undefined' || document === null) return;
        const body = document.body;
        if (body === null || body === undefined || body.classList === null || body.classList === undefined) return;
        body.classList.toggle(SELECT_LOCK_CLASS, on);
        // 捕获目标：body 在卡片重渲染时**不会**被替换。
        // （把捕获挂在卡片自身上很脆——setDrag 引起重渲染后节点被换掉，
        //  后续 pointermove / pointerup 就全丢了，表现是「拖一下就断」。）
        captureHost = on ? body : null;
      };

      const removeGhost = (keepClass) => {
        if (rafRef.current !== 0 && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        const node = ghostRef.current;
        ghostRef.current = null;
        ghostInfoRef.current = null;
        if (node !== null && node !== undefined && node.parentNode !== null && node.parentNode !== undefined) {
          node.parentNode.removeChild(node);
        }
        void keepClass;
        setSelectLock(false);
      };

      /** 按当前指针位置移动影子卡片（rAF 合并，合成层 transform，不排版）。 */
      const moveGhost = (x, y) => {
        const info = ghostInfoRef.current;
        const node = ghostRef.current;
        if (info === null || node === null) return;
        info.x = x;
        info.y = y;
        if (rafRef.current !== 0) return;
        const apply = () => {
          rafRef.current = 0;
          const g = ghostInfoRef.current;
          const el = ghostRef.current;
          if (g === null || el === null) return;
          // transform-origin 是 0 0，scale 会让抓取相对角点按比例放大：
          // 只写 translate(x - dx) 时，指针下方那点会漂 (dx * (1 - scale))。
          // 显式补回这一项，抓取点就永远钉在指针上（拖起来才「跟手」）。
          const sx = g.x - g.dx * GHOST_SCALE;
          const sy = g.y - g.dy * GHOST_SCALE;
          el.style.transform = `translate3d(${sx}px,${sy}px,0) rotate(-1.2deg) scale(${GHOST_SCALE})`;
        };
        // 注意：这里必须**再排一帧**，而且 compare 的是最新指针位置；
        // 只有第一帧需要 rAF 合并，之后每次 move 都要重新调度。
        if (typeof requestAnimationFrame === 'function') rafRef.current = requestAnimationFrame(apply);
        else apply();
      };

      /** 造影子卡片：克隆当前卡片外观，fixed 定位在指针下。 */
      const spawnGhost = (rowEl, x, y) => {
        removeGhost();
        if (typeof document === 'undefined' || document === null || rowEl === null || rowEl === undefined) return;
        let rect;
        try {
          rect = rowEl.getBoundingClientRect();
        } catch {
          return;
        }
        if (rect === null || rect.width <= 0 || rect.height <= 0) return;
        const host = (document.body ?? document.documentElement);
        if (host === null || host === undefined || typeof host.appendChild !== 'function') return;
        const clone = rowEl.cloneNode(true);
        if (clone === null || clone === undefined || clone.classList === null || clone.classList === undefined) return;
        clone.removeAttribute('role');
        clone.removeAttribute('tabindex');
        clone.removeAttribute('id');
        clone.setAttribute('aria-hidden', 'true');
        // 克隆里残留的拖动 / 落点 class 一律清掉，也不参与命中。
        clone.classList.remove('is-dragging');
        clone.classList.add('dsh-wso-ghost');
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.position = 'fixed';
        clone.style.left = '0px';
        clone.style.top = '0px';
        clone.style.pointerEvents = 'none';
        clone.style.margin = '0';
        // 原卡被拖住时指针在卡片内部的位置，保持"抓住那个点"的手感。
        ghostInfoRef.current = {
          dx: x - rect.left,
          dy: y - rect.top,
          x,
          y,
        };
        (host).appendChild(clone);
        ghostRef.current = clone;
        moveGhost(x, y);
        setSelectLock(true);
      };

      /** 拖动开始：捕获到 body（稳定节点），而不是会被重渲染换掉的卡片。 */
      const captureRow = (rowEl, pointerId) => {
        const target = captureHost ?? rowEl;
        try {
          if (target !== null && target !== undefined && typeof target.setPointerCapture === 'function' && pointerId !== undefined) {
            target.setPointerCapture(pointerId);
          }
        } catch {
          // 捕获失败也能靠下面的 window 兜底监听继续。
        }
      };

      const releaseCapture = (rowEl, pointerId) => {
        const target = captureHost ?? rowEl;
        try {
          if (target !== null && target !== undefined && typeof target.hasPointerCapture === 'function'
            && typeof target.releasePointerCapture === 'function' && pointerId !== undefined
            && target.hasPointerCapture(pointerId)) {
            target.releasePointerCapture(pointerId);
          }
        } catch {
          // 已释放 / 已失效都无所谓
        }
      };

      // 拖动期间的 window 兜底：卡片被重渲染、指针离开卡片、指针被别的元素
      // 抢走，都能继续跟手；松手也一定收得到（否则会卡在"一直拖"的状态）。
      const dragListenersRef = React.useRef(null);
      const detachDragListeners = () => {
        const bound = dragListenersRef.current;
        dragListenersRef.current = null;
        if (bound === null || typeof window === 'undefined' || window === null) return;
        window.removeEventListener('pointermove', bound.move, true);
        window.removeEventListener('pointerup', bound.up, true);
        window.removeEventListener('pointercancel', bound.up, true);
        window.removeEventListener('mousemove', bound.move, true);
        window.removeEventListener('mouseup', bound.up, true);
      };
      const attachDragListeners = (id) => {
        // 桩环境里 window 可能存在但没有 addEventListener —— 必须探测函数本身，
        // 只看 typeof window 会在「假的 window」上炸掉整次渲染。
        if (typeof window === 'undefined' || window === null) return;
        if (typeof window.addEventListener !== 'function') return;
        if (dragListenersRef.current !== null) return;
        const move = (event) => {
          const live = pointerRef.current;
          if (live === null || live.intent !== 'drag') return;
          // 只处理同一指针 / 鼠标事件（浏览器不实现 Pointer Events 时的回退）。
          if (event.pointerId !== undefined && live.pointerId !== undefined && event.pointerId !== live.pointerId) return;
          if (typeof event.preventDefault === 'function') event.preventDefault();
          moveGhost(event.clientX, event.clientY);
          live.lastX = event.clientX;
          live.lastY = event.clientY;
          setDrag({ id, target: dropIndexAt(event.clientX, event.clientY, live) });
        };
        const up = () => {
          onCardPointerUpRef.current?.(id);
        };
        dragListenersRef.current = { move, up };
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
        window.addEventListener('mousemove', move, true);
        window.addEventListener('mouseup', up, true);
      };
      /** 松手处理要能被旧的闭包引用到（window 监听里用 ref 取最新的）。 */
      const onCardPointerUpRef = React.useRef(null);

      const openAfterClick = (id) => {
        if (Date.now() - guardRef.current < DRAG_CLICK_GUARD_MS) return;
        open(id);
      };

      /** 落位：把卡片放到面板的任意位置，写进自由排序（与置顶互不覆盖）。 */
      const dropCard = (id, target) => {
        // 基准必须和落点同源：落点下标是从屏幕顺序（panelOrder）算的。
        const ids = panelOrder.map((item) => item.id);
        const from = ids.indexOf(id);
        if (from < 0) return;
        // 落点没变 = 用户只是抖了一下，别写存储。
        // `target` 已经在「剔除被拖卡片」的坐标系里（见 dropIndexAt），直接
        // 按插入位置处理即可 —— 不能再替它做一次 `from < at` 的换算，
        // 否则同一次拖动会被挪两次，表现就是「拖一格等于没拖」。
        const order = insertAt(ids, from, target);
        if (order.join(',') === ids.join(',')) {
          setDrag(null);
          return;
        }
        // 置顶只是**标记**，不参与排序（见 applyPinnedOrder 的说明），
        // 所以落位时唯一要做的是：落到首位就顺带打上置顶标记，
        // 其余情况一律保持原有置顶集合 —— 挪位不会让图钉凭空消失。
        const shouldPin = pinAfterDrop(order, id);
        const nextPinned = shouldPin && !pinned.has(id)
          ? [id, ...(Array.isArray(pinnedIds) ? pinnedIds : []).filter((item) => item !== id)]
          : (Array.isArray(pinnedIds) ? pinnedIds.slice() : []);
        setPinnedIds(nextPinned);
        writePinned(nextPinned);
        setFreeOrder(order);
        writeOrder(order);
      };

      const onCardPointerDown = (id, event) => {
        if (event.button !== 0) return;
        if (event.isPrimary === false) return;
        // 正在重命名时不要起拖（输入框自己 stopPropagation，这里再兜一层）。
        if (renaming === id) return;
        pointerRef.current = {
          id,
          rowEl: event.currentTarget ?? null,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          intent: 'click',
        };
      };

      const onCardPointerMove = (id, event) => {
        const state = pointerRef.current;
        if (state === null || state.id !== id) return;
        if (state.intent === 'drag') {
          if (typeof event.preventDefault === 'function') event.preventDefault();
          moveGhost(event.clientX, event.clientY);
          state.lastX = event.clientX;
          state.lastY = event.clientY;
          // 0.3.2：落点在**整个面板**里找，不再限于原工作区分组。
          state.fallback = dropIndexAt(event.clientX, event.clientY, state);
          setDrag({ id, target: state.fallback });
          return;
        }
        const moved = Math.abs(event.clientX - state.x) + Math.abs(event.clientY - state.y);
        if (moved < DRAG_THRESHOLD_PX) return;
        state.intent = 'drag';
        // 进入拖动的这一帧就要记下指针坐标：否则「起拖帧」之后如果没再收到
        // pointermove（松手很快），落点会退回起拖点算，表现是拖了等于没拖。
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        // 冻结这一帧的网格几何 + 被拖卡片在其中的槽位：之后所有落点都按它算，
        // 否则预览重排会让落点漂移（拖动中卡片乱跳 / 松手回原位）。
        // 注意存的是**量好的数值**，不是 DOM 节点 —— 渲染会重建卡片节点，
        // 松手时再对旧节点求 rect 只会得到全 0。
        // 几何与 id 必须来自**同一次**查询：桩/真实 DOM 每次 querySelectorAll
        // 都可能返回新对象，分两次取会让 grid 与 gridIds 错位。
        // gridIds 用于命中测试（按 id 认卡，再回静态顺序查下标）；命中测试
        // **不能**用实时 DOM —— 那会形成「让位 → 落点变 → 再让位」的反馈环。
        const rowsNow = cardRowsOf();
        state.grid = rowsNow.map((row) => {
          try {
            const rect = row.getBoundingClientRect();
            return { left: rect.left ?? 0, top: rect.top ?? 0, width: rect.width ?? 0, height: rect.height ?? 0 };
          } catch {
            // 用零尺寸占位：下标必须和行一一对应，跳过会让 skipIndex 错位。
            return { left: 0, top: 0, width: 0, height: 0 };
          }
        });
        state.gridIds = rowsNow.map((row) => {
          const rid = row !== null && row !== undefined && typeof row.getAttribute === 'function'
            ? row.getAttribute('data-session-id')
            : null;
          return rid === undefined ? null : rid;
        });
        state.gridSkip = cardOrder().map((item) => item.id).indexOf(id);
        // 被拖卡**自己那一格**的原始矩形：指针还压在自己身上 = 还没决定放哪，
        // 落点就该是原位（否则缝隙算法会把「抓在第一张卡中线」直接算成第 2 格，
        // 一按下去第二三张就闪）。
        state.origin = state.gridSkip >= 0 && state.gridSkip < state.grid.length
          ? state.grid[state.gridSkip]
          : null;
        // 起拖落点 = 被拖卡当前所在的位置（剔除坐标系下标）。之后指针没压到
        // 任何别的卡时，落点就保持这里给的最后一个值，不再按缝隙乱跳。
        state.fallback = state.gridSkip >= 0 ? state.gridSkip : 0;
        spawnGhost(state.rowEl, event.clientX, event.clientY);
        captureRow(state.rowEl, state.pointerId);
        attachDragListeners(id);
        setDrag({ id, target: dropIndexAt(event.clientX, event.clientY, state) });
      };

      const onCardPointerUp = (id) => {
        const state = pointerRef.current;
        // 元素处理器和 window 兜底都会调到这里：谁先到谁负责，另一个直接返回。
        if (state === null || state.id !== id) return;
        pointerRef.current = null;
        releaseCapture(state.rowEl, state.pointerId);
        detachDragListeners();
        removeGhost();
        if (state.intent !== 'drag') return; // 走 click 分支（打开会话）
        // 从 ref 读最新落点：onCardPointerUp 是渲染期绑到 DOM 上的，
        // 闭包里的 drag 是**那次渲染**的值（拖动开始前 → null），
        // 用闭包会把落点永远读成 null，表现就是「拖了但顺序不变」。
        //
        // 0.3.2 起落点直接**按最后指针位置 + 冻结的网格**重算一遍：实时
        // 预览会重排卡片、`setDrag` 也未必赶在松手前落地，两条路都靠不住。
        // 网格是拖动开始那一刻的快照，所以这里算出来的落点不会漂移。
        const latest = dragRef.current;
        const frozen = state.grid !== null && state.grid !== undefined && Array.isArray(state.grid);
        const target = frozen && typeof state.lastX === 'number' && typeof state.lastY === 'number'
          ? dropIndexAt(state.lastX, state.lastY, state)
          : (latest !== null && latest.id === id ? latest.target : null);
        setDrag(null);
        guardRef.current = Date.now();
        if (target !== null) dropCard(id, target);
      };
      onCardPointerUpRef.current = onCardPointerUp;

      /** 拖动轨迹被打断（系统手势 / 指针被系统收走）时兜底清状态。 */
      const onCardPointerCancel = () => {
        const state = pointerRef.current;
        pointerRef.current = null;
        if (state !== null) releaseCapture(state.rowEl, state.pointerId);
        detachDragListeners();
        removeGhost();
        setDrag(null);
      };

      // 卸载时把影子卡片 / 选中锁清理干净（面板关掉时不能留残留）。
      if (typeof React.useEffect === 'function') {
        React.useEffect(() => () => {
          removeGhost();
        }, []);
      }

      /** 取某个组当前的卡片行 DOM（用于算落点）。 */
      /** 面板里的卡片节点（平坦列表，0.3.2 起不再按组区分）。 */
      const cardRowsOf = () => {
        try {
          if (typeof document === 'undefined' || document === null) return [];
          const list = document.querySelectorAll('.dsh-wso-rows > .dsh-wso-row');
          return Array.prototype.slice.call(list);
        } catch {
          return [];
        }
      };

      /**
       * 卡片网格的插入点：按「行优先」的阅读顺序算，而不是只看 top。
       *
       * 卡片网格是多列（auto-fill / minmax）——同一排的几张卡 top 相同，
       * 只比 top 会让右边那一列的落点全部偏到最前。做法：
       *   1) 按 (top, left) 排出阅读顺序（视觉顺序 === DOM 顺序，网格不打乱）；
       *   2) 找到与指针在**同一排**的卡（top 区间包含指针 y）；
       *   3) 同排里：指针在这张卡左半边 → 插到它前面；右半边 → 插到它后面。
       */
      /**
       * @param rows - 卡片 DOM 列表（屏幕顺序）。
       * @param x - 指针横坐标。
       * @param y - 指针纵坐标。
       * @param skipIndex - 先从这个列表里剔除的下标。拖动中的卡片自己仍占着一个
       *   视觉槽位，但它不该是落点的参照物；不剔除会整体错一位。
       * @returns 插入下标（相对剔除 skipIndex 之后的列表）。
       */
      const insertionIndexAtGrid = (rows, x, y, skipIndex = -1) => {
        if (!Array.isArray(rows) || rows.length === 0) return 0;
        // 剔除被拖者之后，还要把「原始 DOM 下标」重新映射成「剔除后列表的下标」，
        // 否则被拖者前面的卡整体多算一位（落点差一格就是这么来的）。
        const remap = (index) => (skipIndex >= 0 && index > skipIndex ? index - 1 : index);
        // 先量成纯几何快照，再算落点。拖动一开始就必须量好：预览重排会
        // **销毁这些节点**（客户端每次渲染都重建卡片列表），留 DOM 引用到
        // 松手时再量，拿到的全是 `0,0,0`，落点就一律退化成「插到末尾」——
        // 真 Chrome 里的表现就是「拖到最前却掉到最后」。
        const boxes = [];
        for (let i = 0; i < rows.length; i += 1) {
          if (i === skipIndex) continue;
          const row = rows[i];
          // 已经量好的几何快照（拖动开始时 captureGrid 的产物）直接复用。
          if (row !== null && row !== undefined && typeof row === 'object'
            && typeof row.left === 'number' && typeof row.top === 'number'
            && typeof row.width === 'number' && typeof row.height === 'number') {
            boxes.push({ index: i, left: row.left, width: row.width, top: row.top, height: row.height });
            continue;
          }
          if (row === null || row === undefined || typeof row.getBoundingClientRect !== 'function') continue;
          let rect;
          try {
            rect = row.getBoundingClientRect();
          } catch {
            continue;
          }
          if (rect === null || rect === undefined) continue;
          if (typeof rect.top !== 'number' || typeof rect.height !== 'number') continue;
          boxes.push({ index: i, left: rect.left ?? 0, width: rect.width ?? 0, top: rect.top, height: rect.height });
        }
        if (boxes.length === 0) return 0;
        // 0.3.5 起「指针落在某张卡上」由 `hitCardIdAt` 用**实时 DOM** 处理（卡片
        // 会实时让位），这里只负责卡片之间的**缝隙 / 边缘**：按视觉顺序找最近的卡，
        // 再按指针在它中心的哪一侧决定前后。用中心点距离而不是「中点在下方的第一张」，
        // 卡片高度不一时空白处也不会突然跳到很远的落点。
        const ordered = boxes.slice().sort((p, q) => (p.top - q.top) || (p.left - q.left));
        let bestIndex = 0;
        let bestDistance = Infinity;
        let after = false;
        for (let i = 0; i < ordered.length; i += 1) {
          const box = ordered[i];
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const distance = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = remap(box.index);
            // 指针在这张卡中心右侧 → 想插到它之后。
            after = x > cx;
          }
        }
        return after ? bestIndex + 1 : bestIndex;
      };

      /**
       * 指针命中了哪张卡（0.3.5「实时让位」专用）。
       *
       * **几何用实时 DOM，但下标必须换算回静态顺序。** 这两个要求看似矛盾，
       * 其实各有各的理由：
       *
       *   - 用实时 DOM：卡片一让位，屏幕上的位置就变了。若还拿起拖时的快照判定，
       *     指标停在第一张卡自己的范围里（没碰到任何别的卡）也会算出一个跳动的
       *     落点 —— 用户看到的就是「第一排第二三张卡莫名闪动」。
       *   - 用起拖快照的下标空间：命中后把 id 映射回静态 `panelOrder` 再查下标，
       *     于是落点是"谁"的函数，而不是"第几格"的函数，不会随重排自我强化。
       *
       * 曾经的反馈环（让位 → 指针下的卡变 → 落点变 → 再让位）是因为**下标空间**
       * 也跟着实时顺序走；只让几何实时、下标走静态即可两全。
       *
       * @param x - 指针横坐标。
       * @param y - 指针纵坐标。
       * @param state - 本次拖动状态（`id` 用来跳过被拖那张）。
       * @returns 命中的会话 id；没命中返回 null。
       */
      const hitCardIdAt = (x, y, state) => {
        const grid = state !== null && Array.isArray(state.grid) ? state.grid : null;
        const ids = state !== null && Array.isArray(state.gridIds) ? state.gridIds : null;
        if (grid === null || ids === null) return null;
        const draggingId = state.id;
        // 0.3.7：命中多张卡时**取中心最近的那张**，不要"数组里第一个"。
        //
        // 快照里的矩形可能互相重叠（FLIP 过渡途中的位移、行高切换、hover 抬起），
        // 交界处指针同时落在两张卡里。按数组顺序取第一个的话，指针在交界处轻微
        // 抖动就会在两张卡之间来回翻 —— 落点跟着翻 = 卡片位置"错位一下又回来，
        // 来回颠"。按中心距离取最近的那张是个连续函数，指针不动结果就不会变。
        let bestId = null;
        let bestDist = Infinity;
        for (let i = 0; i < grid.length; i += 1) {
          const box = grid[i];
          const id = ids[i];
          if (box === null || box === undefined || id === null || id === undefined) continue;
          if (id === draggingId) continue;
          if (x >= box.left && x <= box.left + box.width
            && y >= box.top && y <= box.top + box.height) {
            const cx = box.left + box.width / 2;
            const cy = box.top + box.height / 2;
            const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dist < bestDist) {
              bestDist = dist;
              bestId = id;
            }
          }
        }
        return bestId;
      };

      /**
       * 拖动中的落点下标。
       *
       * 坐标系：**剔除被拖卡片之后**的静态列表（`panelOrder` 去掉它自己）。
       * 不能拿拖动预览的 DOM 顺序当基准 —— 预览会随着落点变化不断重排，
       * 落点就会自己漂移（表现为「拖住了但松手回到原位」）。
       *
       * 几何仍然取自真实 DOM（多列网格只有 DOM 知道每张卡在哪一格），
       * 但下标经 `skipIndex` 剔除 + `remap` 回到静态坐标系。
       *
       * 几何必须来自**拖动开始时**那一帧（`state.grid` 快照），不能用实时的
       * DOM —— 拖动预览会不断重排卡片，实时几何会让落点自己漂移，表现为
       * 「拖住了但松手回到原位」。
       *
       * @param x - 指针横坐标。
       * @param y - 指针纵坐标。
       * @param state - 本次拖动的 pointer 状态（含 grid 快照）。
       * @returns 去掉被拖者后的插入下标（0..n-1）。
       */
      const dropIndexAt = (x, y, state) => {
        const grid = state !== null && Array.isArray(state.grid) ? state.grid : null;
        if (grid === null) return 0;
        // ---- 1. 指针还在**被拖卡自己原来的矩形**里 → 落点就是原位，直接结束 ----
        //
        // 0.3.6 修的就是这一段缺失。起拖后指针必然先停在自己那张卡上，而下面的
        // 缝隙算法会把「指针在某张卡的左/右半边」换算成一个**别的**下标：
        // 抓第一张卡的中线起拖，指针其实一动没动，落点就已经被算成第 2～3 格，
        // 于是第一排第二三张卡立刻让位、第二排第一张被顶进空位 —— 用户看到
        // 的「闪动 + 第二排第一张变半透明」正是这个。
        //
        // 语义上也该如此：把卡片挪开一点点、指针仍压在它自己身上 = 还没决定
        // 要放到哪里，位置不该变。
        const origin = state !== null && state.origin !== null && state.origin !== undefined
          ? state.origin
          : null;
        if (origin !== null
          && x >= origin.left && x <= origin.left + origin.width
          && y >= origin.top && y <= origin.top + origin.height) {
          const originIndex = state.gridSkip;
          if (Number.isInteger(originIndex) && originIndex >= 0) return originIndex;
        }
        // ---- 2. 指针压在哪张卡上，就与它换位（整卡命中，几何用起拖快照） ----
        const baseIds = panelOrder.map((item) => item.id);
        const draggingId = state !== null ? state.id : null;
        const hitId = hitCardIdAt(x, y, state);
        if (hitId !== null) {
          const at = baseIds.indexOf(hitId);
          const from = draggingId === null ? -1 : baseIds.indexOf(draggingId);
          if (at >= 0 && from >= 0) {
            const rest = baseIds.filter((item) => item !== draggingId);
            const anchor = rest.indexOf(hitId);
            // 被拖卡要站在目标卡的位置：目标在它后面 → 插到目标之后。
            const target = from < at ? anchor + 1 : anchor;
            // 0.3.7：命中结果要**记成新的 fallback**。
            //
            // 不记的话，指针从「压在某张卡上」滑到「两张卡之间的缝隙」时，下面
            // 第 3 分支返回的还是**起拖时**那个落点，而不是刚刚命中的那个 ——
            // 落点凭空往回跳一次，卡片跟着翻回去再翻回来，视觉上就是
            //「位置错一下又回来，来回颠」。记下来之后，"离开卡片"只是让落点
            // 停在最后一次命中的位置，不再产生任何跳变。
            if (state !== null) state.fallback = target;
            return target;
          }
        }
        // ---- 3. 落在缝隙 / 网格外：保持上一个落点，别乱跳 ----
        //
        // 这里曾退回「按快照缝隙重新算一个下标」，后果是：指针在两张卡之间的
        // 缝隙里轻微抖动，落点就左右翻，卡片跟着来回滑（闪动的第二个来源）。
        // 没放到任何卡上 = 还没决定要放哪，落点就该定住。
        const fallback = state !== null && Number.isInteger(state.fallback) ? state.fallback : null;
        if (fallback !== null) return fallback;
        const hit = insertionIndexAtGrid(grid, x, y, state.gridSkip);
        // grid 含被拖卡片，剔除后最多只剩 grid.length - 1 个位置可插（0..len-2）。
        // 上限写成 len-1 会让「拖到末尾」多出一格，落点越界到被拖卡片自己的
        // 旧槽位，`insertAt` 夹回后表现成「拖到末尾却没动」。
        const last = Math.max(0, grid.length - 2);
        return Math.max(0, Math.min(last, hit));
      };

      /**
       * 面板渲染用的卡片顺序：静止时 = panelOrder，拖动时 = 预览落位。
       *
       * 必须用 `insertAt`（剔除被拖者之后的坐标系），不能用 `moveCard`。
       * `drag.target` 来自 `dropIndexAt`，本来就是剔除坐标系；拿原数组坐标系的
       * `moveCard` 去消费它，`from < at` 的换算会让「A 拖到 B 的位置」算成原地不动
       * —— 预览不跟手，只剩白条画在第三张卡上（用户原话：拖到第二张卡时看不到
       * 第一张变成第二张，白条却在第三张）。松手时 `dropCard` 走的是 `insertAt`，
       * 于是又"突然"变了，两边不一致。同源即可解决。
       */
      const cardOrder = () => {
        const base = panelOrder;
        if (drag === null) return base;
        const ids = base.map((item) => item.id);
        const from = ids.indexOf(drag.id);
        if (from < 0) return base;
        const next = insertAt(ids, from, drag.target);
        const byId = new Map(base.map((item) => [item.id, item]));
        return next.map((id) => byId.get(id)).filter(Boolean);
      };

      // ---- 实时让位（0.3.5）--------------------------------------------------
      // 拖动时卡片会重排到新槽位。纯 grid 重排是瞬跳：被拖卡的空位「啪」地换地方，
      // 眼睛跟不上。这里用 FLIP 把位移抹平 —— 上一帧记下每张卡的位置，渲染后量新
      // 位置，先反向 translate 回旧位置，下一帧再归零，卡片就"滑"过去。
      //
      // 只记录**普通卡片**（拖动中）的位置；`is-dragging` 那张是空位，应瞬移跟随
      // 落点，不能有过渡（否则空位会拖着一条尾巴追指针）。
      const flipRef = React.useRef(null);

      /**
       * 量每张卡的**静止**位置。
       *
       * 关键：`getBoundingClientRect()` 量的是**合成后**的视觉位置，包含 FLIP 留下的
       * inline `transform`。卡片正在过渡途中被量到，记下的基线就是偏掉的位置。
       *
       * 但**不能**靠"摘掉 inline transform 再量、量完还原"来做（0.3.7 第一版就是这么
       * 写的，反而制造了新的闪动）：那等于每次渲染都对每张卡做两次样式写入 + 一次
       * 强制回流，而且中途打断正在跑的过渡后还原，未必回到同一状态 —— `prev` 和
       * `after` 的测量条件不对称，差分永远不为 0，FLIP 于是每帧都重来一遍
       * （卡片在新位置上反复从旧位置滑过来 = 原地闪）。
       *
       * 正确做法：**FLIP 的终点必须自己就是"无 transform"的静止位置**。所以过渡
       * 一旦跑完就立刻擦掉 inline 样式（见 `clearFlipStyle` / `transitionend`），
       * 让 `getBoundingClientRect()` 天然量到静止位置，测量保持纯函数、无副作用。
       *
       * 用 `left`/`top` 而不是 `x`/`y`：`left` 已经是 translate 之后的结果，两者
       * 在无旋转/缩放时一致，但 `left` 在所有浏览器里都有。
       */
      const measureCards = () => {
        const list = [];
        const rows = cardRowsOf();
        for (let i = 0; i < rows.length; i += 1) {
          const row = rows[i];
          if (row === null || row === undefined) continue;
          const id = row.getAttribute ? row.getAttribute('data-session-id') : null;
          if (id === null || id === undefined) continue;
          const dragging = typeof row.getAttribute === 'function' && row.getAttribute('data-dragging') === '1';
          try {
            const rect = row.getBoundingClientRect();
            list.push({ id, row, dragging, left: rect.left ?? 0, top: rect.top ?? 0 });
          } catch {
            // 量不到就跳过，动画缺一帧不影响功能
          }
        }
        return list;
      };

      /** 系统是否要求减少动态效果（尊重无障碍设置；量不到就当 false）。 */
      const reducedMotion = () => {
        try {
          if (typeof window === 'undefined' || window === null) return false;
          if (typeof window.matchMedia !== 'function') return false;
          const query = window.matchMedia('(prefers-reduced-motion: reduce)');
          return query !== null && query !== undefined && query.matches === true;
        } catch {
          return false;
        }
      };

      /**
       * 擦掉某张卡上 FLIP 留下的 inline 样式。
       *
       * 这一步不能省（0.3.7）：`el.style.transition` 是 **inline** 声明，优先级高于
       * `.dsh-wso-row{transition:...}` 这条类规则。写完不复位的话，卡片会**永久**
       * 带着 `transition:transform .16s` —— 于是之后再发生任何 transform 变化
       * （最典型的就是 hover 的 `translateY(-1px)`）都被这 160ms 缓动接管，表现为
       * 「跳一下再抖」。拖动时指针会扫过一串卡片，所以用户看到的是"被覆盖过的
       * 卡片都开始闪烁"。同时类规则里 border/background/box-shadow 的过渡也被这
       * 条 inline 声明一并顶掉，hover 变得生硬。
       */
      const clearFlipStyle = (el) => {
        if (el === null || el === undefined || el.style === undefined) return;
        el.style.transition = '';
        el.style.transform = '';
      };

      /**
       * FLIP：commit 之后调用。DOM 已经是新位置，与上一次记录的位置比较，
       * 对发生位移的卡片先反向偏移再归零 —— 视觉上就是"滑过去"。
       * 结束时把当前位置记下来，供下一次渲染比较。
       */
      const flipApply = () => {
        const prev = flipRef.current;
        // ---- 第一道闸：**顺序没变就什么都不做**（0.3.7 第二轮的核心修复）--------
        //
        // 用户原话：「第二张卡跳到第一张的位置这个没问题，但是我不松手继续动的
        // 时候，第二张卡会在第一张的位置闪动」。
        //
        // FLIP 的定义是"先瞬移回旧位置，再滑到新位置"。只要它被**重复执行**，
        // 卡片就会反复从旧位置重新出发 —— 在新位置上看就是原地闪。而它之所以会
        // 被重复执行，是因为下面那个 `useLayoutEffect` **没有依赖数组、每次渲染
        // 都跑**：拖动中任何无关的状态变化（hover 重绘、时间戳刷新）都会再进来一次，
        // 这时卡片还在过渡途中，量到的 `after` 是中间值，`dx` 不为 0 → 又滑一遍。
        //
        // 所以这里先比**顺序签名**：顺序没变说明这一帧没有让位发生，直接返回。
        // 这一步是纯字符串比较，连测量都不做。
        const baseIds = cardRowsOf()
          .map((row) => (row === null || row === undefined || typeof row.getAttribute !== 'function'
            ? null : row.getAttribute('data-session-id')))
          .filter((id) => id !== null && id !== undefined);
        const nowIds = baseIds.join('|');
        if (flipRef.order === nowIds) return;

        const nowList = measureCards();
        const nowById = new Map();
        for (let i = 0; i < nowList.length; i += 1) nowById.set(nowList[i].id, nowList[i]);
        // 减少动态效果时不做位移过渡（直接跳位），功能一致、只是不滑。
        if (Array.isArray(prev) && drag !== null && !reducedMotion()) {
          for (let i = 0; i < prev.length; i += 1) {
            const before = prev[i];
            if (before.dragging) continue;
            const after = nowById.get(before.id);
            if (after === undefined || after.dragging) continue;
            const dx = before.left - after.left;
            const dy = before.top - after.top;
            const el = after.row;
            if (el === null || el === undefined || el.style === undefined) continue;
            // 没有位移：可能是上一次过渡已经跑完（或本来就静止）。顺手把上轮的
            // inline 样式擦掉再跳过，别让它留在卡上继续干扰 hover。
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
              clearFlipStyle(el);
              continue;
            }
            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            // 强制一次回流，否则同一帧里改回去会被合并成"没动"。
            void el.offsetWidth;
            el.style.transition = 'transform .16s cubic-bezier(.2,.7,.3,1)';
            el.style.transform = '';
            // 过渡结束后把 inline 样式收回去 —— 不然后续 hover 的 translateY
            // 会被这条 inline transition 接管，变成持续闪动。
            const rowEl = el;
            const done = () => {
              clearFlipStyle(rowEl);
              rowEl.removeEventListener('transitionend', done);
            };
            rowEl.addEventListener('transitionend', done);
          }
        } else {
          // 不在拖动中（或系统要求减少动态效果）：不滑，但上轮残留必须清掉。
          // 同时把顺序签名作废 —— 不在拖动中不做让位动画，下次起拖第一帧要能重新
          // 建立基线（否则拖起来第一下会缺一帧）。
          for (let i = 0; i < nowList.length; i += 1) clearFlipStyle(nowList[i].row);
          flipRef.order = null;
          flipRef.current = nowList;
          return;
        }
        flipRef.current = nowList;
        flipRef.order = nowIds;
      };

      // 必须用 useLayoutEffect：它在 DOM 更新后、**浏览器绘制前**触发。
      // 换成 useEffect 的话，用户会先看到瞬跳一帧，再看到滑动 —— 等于动画白做。
      // 桩环境没有 useLayoutEffect 时退回 useEffect（只影响动画，不影响功能）。
      const useCommitEffect = typeof React.useLayoutEffect === 'function'
        ? React.useLayoutEffect
        : React.useEffect;
      if (typeof useCommitEffect === 'function') {
        // 无依赖数组 = 每次渲染都跑，拖动中落点每变一次就让位一次。
        useCommitEffect(() => {
          flipApply();
        });
      }

      /** 统一的动作执行器：清状态 → 调用 → 失败提示。 */
      const run = (action) => {
        setFailure('');
        setNotice('');
        setConfirming(null);
        setBusy(true);
        Promise.resolve()
          .then(() => action())
          .then(() => {
            setBusy(false);
          })
          .catch((error) => {
            setBusy(false);
            setFailure(t('actionFailed', { error: error instanceof Error ? error.message : String(error) }));
          });
      };

      /** 切换置顶（只影响本面板）。 */
      const togglePin = (id) => {
        const next = new Set(pinnedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const list = [...next];
        setPinnedIds(list);
        writePinned(list);
      };

      const copyId = (id) => {
        run(async () => {
          const text = String(id);
          try {
            if (typeof navigator !== 'undefined' && navigator !== null && navigator.clipboard !== undefined && navigator.clipboard !== null) {
              await navigator.clipboard.writeText(text);
              setNotice(t('copied'));
              return;
            }
          } catch {
            // 落到下面的兜底
          }
          if (typeof props.copyId === 'function') {
            props.copyId(text);
            setNotice(t('copied'));
            return;
          }
          throw new Error('clipboard unavailable');
        });
      };

      const loading = sessionState?.phase === 'pending';
      const runningMode = built.mode === 'running';
      const now = Date.now();

      /** 一个图标按钮。 */
      const act = (key, label, Icon, onClick, options = {}) => h('button', {
        type: 'button',
        key,
        className: 'dsh-wso-act' + (options.danger ? ' is-danger' : '') + (options.on ? ' is-on' : ''),
        title: label,
        'aria-label': label,
        disabled: busy || options.disabled === true,
        onClick: (event) => {
          event.stopPropagation();
          onClick();
        },
        onPointerDown: (event) => event.stopPropagation(),
      }, h(Icon));

      /** 二次确认条：替换操作条内容。 */
      const confirmBar = (question, onYes, danger) => h('div', { className: 'dsh-wso-confirm' },
        h('span', null, question),
        h('button', {
          type: 'button',
          className: 'dsh-wso-confirm-go' + (danger ? '' : ' is-plain'),
          onClick: (event) => {
            event.stopPropagation();
            onYes();
          },
          onPointerDown: (event) => event.stopPropagation(),
        }, t('save')),
        h('button', {
          type: 'button',
          className: 'dsh-wso-confirm-cancel',
          onClick: (event) => {
            event.stopPropagation();
            setConfirming(null);
          },
          onPointerDown: (event) => event.stopPropagation(),
        }, t('cancel')));

      /** 卡片上的悬浮操作条。 */
      const actionsOf = (row) => {
        if (confirming !== null && confirming.id === row.id) {
          if (confirming.kind === 'archive') {
            return confirmBar(t('actArchiveConfirm'), () => {
              run(() => (typeof props.archiveSession === 'function' ? props.archiveSession(row.id) : Promise.reject(new Error('unavailable'))));
            }, true);
          }
          return confirmBar(t('actStopConfirm'), () => {
            run(() => (typeof props.stopSession === 'function' ? props.stopSession(row.id) : Promise.reject(new Error('unavailable'))));
          }, true);
        }

        const byName = {
          pin: act('pin', pinned.has(row.id) ? t('actUnpin') : t('actPin'), PinIcon, () => togglePin(row.id), { on: pinned.has(row.id) }),
          rename: act('rename', t('actRename'), RenameIcon, () => {
            setRenaming(row.id);
            setDraft(row.title);
          }),
          copy: act('copy', t('actCopy'), CopyIcon, () => copyId(row.id)),
          fork: act('fork', t('actFork'), ForkIcon, () => {
            run(() => (typeof props.forkSession === 'function' ? props.forkSession(row.id) : Promise.reject(new Error('unavailable'))));
          }),
          stop: act('stop', t('actStop'), StopIcon, () => setConfirming({ id: row.id, kind: 'stop' }), { danger: true }),
          archive: act('archive', t('actArchive'), ArchiveIcon, () => setConfirming({ id: row.id, kind: 'archive' }), { danger: true }),
        };

        // 先按用户配置过滤，再渲染。stop 由 visibleActions() 无条件补上，
        // 所以「运行中卡片必须有停止按钮」不受配置影响。
        const buttons = visibleActions(row, cardActions).map((name) => byName[name]).filter(Boolean);

        if (buttons.length === 0) return null;
        return h('div', { className: 'dsh-wso-acts', role: 'group', 'aria-label': t('actions') }, buttons);
      };

      // 一张卡片 = 一次会话。结构对齐「使用统计」插件的概览卡：
      //   [状态点 + 时间 / 进行中胶囊] [两行标题] [打开提示 + 箭头]
      // 卡片本体是 div[role=button]：<button> 里不能再嵌操作按钮。
      const rowOf = () => (row) => h('div', {
        key: row.id,
        className: 'dsh-wso-row' + (drag !== null && drag.id === row.id ? ' is-dragging' : ''),
        role: 'button',
        tabIndex: 0,
        title: row.title,
        'aria-label': `${t('openTitle')}: ${row.title}`,
        'data-session-id': row.id,
        // 标记被拖那张：FLIP 让位要跳过它（空位应瞬移贴住落点，不能拖着尾巴）。
        ...(drag !== null && drag.id === row.id ? { 'data-dragging': '1' } : {}),
        // 点击只负责「没拖动过」的情况；拖动结束后的尾随 click 由 guard 拦掉。
        onClick: () => openAfterClick(row.id),
        // 用 Pointer Events（不是 mouse*）：capture 之后移出卡片也不会断。
        onPointerDown: (event) => onCardPointerDown(row.id, event),
        onPointerMove: (event) => onCardPointerMove(row.id, event),
        onPointerUp: () => onCardPointerUp(row.id),
        onPointerCancel: () => onCardPointerCancel(),
        onLostPointerCapture: () => {
          // 系统收走指针（切窗口 / 手势）时兜底；正常松手时 state 已清空，这里是 no-op。
          if (pointerRef.current !== null && pointerRef.current.intent === 'drag') onCardPointerCancel();
        },
        // 拖动中不弹右键菜单 / 原生拖拽，避免打断跟手。
        onContextMenu: (event) => {
          if (pointerRef.current !== null && pointerRef.current.intent === 'drag') event.preventDefault();
        },
        onDragStart: (event) => event.preventDefault(),
        // 键盘行为不变：Enter / Space 依然直接打开。
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open(row.id);
          }
        },
      },
        h('span', { className: 'dsh-wso-head-row' },
          h('span', { className: 'dsh-wso-status' },
            h('span', { className: 'dsh-wso-dot' + (row.running ? ' is-live' : ''), 'aria-hidden': true }),
            row.running ? t('live') : t('updatedAgo', { time: relativeTime(now, row.updatedAt) })),
          pinned.has(row.id) ? h('span', { className: 'dsh-wso-pin', title: t('pinBadge') }, h(PinIcon)) : null),
        h('span', { className: 'dsh-wso-text' },
          h('span', { className: 'dsh-wso-text-title' }, row.title)),
        renaming === row.id
          ? h('span', { className: 'dsh-wso-rename', onClick: (event) => event.stopPropagation() },
              h('input', {
                className: 'dsh-wso-rename-input',
                value: draft,
                placeholder: t('renamePlaceholder'),
                autoFocus: true,
                onChange: (event) => setDraft(event.target.value ?? ''),
                onPointerDown: (event) => event.stopPropagation(),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const title = draft.trim();
                    setRenaming(null);
                    if (title !== '') {
                      run(() => (typeof props.renameSession === 'function' ? props.renameSession(row.id, title) : Promise.reject(new Error('unavailable'))));
                    }
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setRenaming(null);
                  }
                },
              }),
              h('button', {
                type: 'button',
                className: 'dsh-wso-confirm-go is-plain',
                onClick: (event) => {
                  event.stopPropagation();
                  const title = draft.trim();
                  setRenaming(null);
                  if (title !== '') {
                    run(() => (typeof props.renameSession === 'function' ? props.renameSession(row.id, title) : Promise.reject(new Error('unavailable'))));
                  }
                },
              }, t('save')),
              h('button', {
                type: 'button',
                className: 'dsh-wso-confirm-cancel',
                onClick: (event) => {
                  event.stopPropagation();
                  setRenaming(null);
                },
              }, t('cancel')))
          : h('span', { className: 'dsh-wso-tail' },
              h('span', { className: 'dsh-wso-hint' }, row.running ? t('openHint') : t('openHintIdle')),
              h('span', { className: 'dsh-wso-arrow', 'aria-hidden': true }, h('svg', {
                viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none',
                stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
                style: { display: 'block' },
              }, h('path', { d: 'M6 3.5L10.5 8L6 12.5' })))),
        actionsOf(row));

      const body = built.total === 0
        ? h('div', { className: 'dsh-wso-empty' },
            h('span', { className: 'dsh-wso-empty-icon' }, h(EmptyGlyph, { size: 20 })),
            h('div', { className: 'dsh-wso-empty-title' }, loading ? t('loading') : t('empty')),
            h('div', { className: 'dsh-wso-empty-hint' }, t('emptyHint')))
        // 0.3.2：一个平坦列表，不再按工作区分块（工作区数据本身不变）。
        : h('div', { className: 'dsh-wso-groups' },
            h('div', { className: 'dsh-wso-rows' }, cardOrder().map(rowOf())));

      // 升级提示：只在「迁移成固定」且确实有手动顺序记录时出现一次，
      // 点「去设置」直接跳到设置页的「进行中/对话总览」区块；关掉就永不再来。
      // 不占位（null 时不渲染容器），不影响既有布局。
      const orderHint = showOrderHint && groupAuto === false
        ? h('div', { className: 'dsh-wso-foot' },
            h('span', null, t('groupOrderHint')),
            typeof props.openSettings === 'function'
              ? h('button', {
                  type: 'button',
                  className: 'dsh-wso-set-link',
                  onClick: () => {
                    setShowOrderHint(false);
                    try {
                      props.openSettings(PANEL_ID);
                    } catch {
                      // 跳转失败不阻塞面板
                    }
                  },
                }, t('groupOrderGo'))
              : h('button', {
                  type: 'button',
                  className: 'dsh-wso-set-link',
                  onClick: () => setShowOrderHint(false),
                }, t('cancel')))
        : null;

      return h('main', { className: 'dsh-wso-page' },
        h('div', { className: 'dsh-wso-wrap' },
          h('header', { className: 'dsh-wso-head' },
            h('h1', { className: 'dsh-wso-title' }, runningMode ? t('titleRunning') : t('titleOverview')),
            h('p', { className: 'dsh-wso-subtitle' }, runningMode ? t('subtitleRunning') : t('subtitleOverview'))),
          body,
          orderHint,
          notice === '' ? null : h('div', { className: 'dsh-wso-toast', role: 'status' }, notice),
          failure === '' ? null : h('div', { className: 'dsh-wso-error', role: 'status' }, failure)));
    }

    // ==========================================================================
    // 侧栏「全局面板」行拖动排序（附加能力）
    // ==========================================================================
    // 内置 `ui-sidebar` 把 `sidebar.panellist` 的条目按注册 `order` 升序渲染，
    // 它**没有**拖动排序；工作区/会话行能拖，是 `ui-workspace` 自己实现的。
    //
    // 这里在浏览器侧补一层，**不改任何插件的注册数据**：
    //   1. 用 flex 的 `order` 改视觉顺序 —— 只写行容器的 inline style；
    //      内置 PanelRow 不传 style，React 重渲染不会把这个属性抹掉；
    //   2. 拖动用 pointer 事件（与「已归档」面板同一套写法），不用 HTML5 DnD，
    //      避免和内置会话行的 drag 数据互相污染；
    //   3. 顺序写 cookie + localStorage：cookie 不区分端口，DSH 换端口也不丢；
    //   4. 每一步 try/catch；最坏情况是「拖不动」，绝不抛错、绝不改别人的数据。
    //
    // 行的稳定 id 从 `ctx.slots.entriesOfSlot('sidebar.panellist')` 读
    // （内置侧栏自己就是这么读的），DOM 第 i 行 ↔ 按 order 排序后的第 i 个 id。
    /** 顺序存储：cookie 不区分端口，换端口后仍能记住。 */
    const PANEL_ORDER_KEY = 'dsh.sidebar.panellist.order';
    const PANEL_ORDER_COOKIE = 'dsh_sidebar_panel_order';
    /** 超过这个像素位移才算拖动，避免「点击切面板」被误判成拖。 */
    const PANEL_DRAG_THRESHOLD = 5;
    /** 侧栏 DOM 可能比 apply() 晚出现，按这个间隔补挂。 */
    const PANEL_SORT_TICK_MS = 500;
    /** 拖动结束后短暂吞掉那次 click，防止顺手把面板切走。 */
    const PANEL_CLICK_GUARD_MS = 300;

    /** JSON 数组文本 → 去重后的 id 数组；不是合法数组返回 null。 */
    function parseIdList(text) {
      if (typeof text !== 'string' || text === '') return null;
      try {
        const value = JSON.parse(text);
        if (!Array.isArray(value)) return null;
        const out = [];
        for (const item of value) {
          if (typeof item === 'string' && item !== '' && !out.includes(item)) out.push(item);
        }
        return out;
      } catch {
        return null;
      }
    }

    // ==========================================================================
    // 组排序（自动 / 固定）—— 0.2.0
    // ==========================================================================
    // 「自动」= 有运行中会话的组优先 → 组活跃度（组内可见会话最大 updatedAt）倒序
    //          → 活跃度完全相同的保持工作区原始顺序；「未分组」恒排最后。
    // 「固定」= 完全按工作区原始顺序（0.1.0 的老行为）。
    //
    // 两种模式都**不重排组内卡片**：卡片始终按 updatedAt 倒序（由 buildOverview 决定）。
    //
    // 关于「实时」的取舍：DSH 的 `sessions.list` 快照在会话流式输出时会不停刷新
    // updatedAt（毫秒级抖动）。若拿它直接当排序依据，组会一行一行地跳，非常闹腾。
    // 所以自动模式只在**运行态签名**（哪些会话在跑）变化时重排一次，
    // 即「挂载 / 运行态翻转 / 手动刷新」三个时机；固定模式干脆连签名都不看。
    /** 自动/固定开关（用户显式选过的值）。 */
    const GROUP_AUTO_KEY = 'dsh.workspace-ranswork.groupAuto';
    const GROUP_AUTO_COOKIE = 'dsh_wso_group_auto';
    /** 手动组顺序记录（只有老版本会写；迁移判定用，本版本只读不写）。 */
    const GROUP_ORDER_KEY = 'dsh.workspace-ranswork.groupOrder';
    const GROUP_ORDER_COOKIE = 'dsh_wso_group_order';
    /** 未分组组的 key（buildOverview 的既有约定）。 */
    const UNGROUPED_KEY = '__ungrouped__';

    /** 读 localStorage（读不到返回 null，永不抛错）。 */
    function readStore(key) {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return null;
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    /** 写 localStorage（失败静默）。 */
    function writeStore(key, value) {
      try {
        if (typeof localStorage !== 'undefined' && localStorage !== null) localStorage.setItem(key, value);
      } catch {
        // 写不进去只影响记忆，不影响本次行为
      }
    }

    /**
     * 一份「非空的 id 顺序记录」判定：能 parse 成非空数组才算数。
     *
     * @param text - cookie / localStorage 原文。
     * @returns 布尔。
     */
    function isOrderRecord(text) {
      if (typeof text !== 'string' || text === '') return false;
      const ids = parseIdList(text);
      return ids !== null && ids.length > 0;
    }

    /**
     * 判定本地有没有「手动组顺序记录」。
     *
     * 本轮新增的键（GROUP_ORDER_*）是给未来版本/手工迁移用的；
     * 0.1.x 唯一真实存在的手动顺序是侧栏「全局面板」行顺序
     * （`dsh_sidebar_panel_order` / `dsh.sidebar.panellist.order`，由下面的
     * 拖动排序功能写入），所以两个都算。
     */
    function hasManualGroupOrder() {
      if (isOrderRecord(readCookie(GROUP_ORDER_COOKIE)) || isOrderRecord(readStore(GROUP_ORDER_KEY))) return true;
      return isOrderRecord(readCookie(PANEL_ORDER_COOKIE)) || isOrderRecord(readStore(PANEL_ORDER_KEY));
    }

    /**
     * 读「自动 / 固定」开关。
     *
     * 迁移：只有**存在手动组顺序记录**、且**从未写过开关**时，才落成固定（false）——
     * 老用户升级后顺序不变。从未存过顺序的新用户保持自动。
     * 迁移结果只写开关，绝不改写/删除老的顺序记录。
     *
     * @returns `true` = 自动（默认），`false` = 固定。
     */
    function readGroupAuto() {
      const raw = readCookie(GROUP_AUTO_COOKIE) ?? readStore(GROUP_AUTO_KEY);
      if (typeof raw === 'string' && raw !== '') {
        if (raw === '1' || raw === 'true') return true;
        if (raw === '0' || raw === 'false') return false;
      }
      if (hasManualGroupOrder()) {
        writeGroupAuto(false);
        return false;
      }
      return true;
    }

    /** 写「自动 / 固定」开关（cookie + localStorage 双写）。 */
    function writeGroupAuto(auto) {
      const text = auto === true ? '1' : '0';
      writeCookie(GROUP_AUTO_COOKIE, text);
      writeStore(GROUP_AUTO_KEY, text);
    }

    /**
     * 组活跃度 = 组内可见会话的最大 updatedAt；没有时间戳时按 0。
     *
     * @param rows - 组内行数组。
     * @returns 毫秒时间戳。
     */
    function groupActivity(rows) {
      let hot = 0;
      for (const row of Array.isArray(rows) ? rows : []) {
        if (typeof row?.updatedAt === 'number' && Number.isFinite(row.updatedAt) && row.updatedAt > hot) hot = row.updatedAt;
      }
      return hot;
    }

    /**
     * 按「自动」规则排序组数组：运行组优先 → 活跃度倒序 → 原始顺序稳定；
     * 「未分组」恒在最后。
     *
     * 纯函数：不读全局、不抛错、不改入参，`auto` 为 false 时原样返回浅拷贝。
     *
     * @param groups - `buildOverview()` 的 `groups`。
     * @param auto - `true` = 自动排序，`false` = 保持原始顺序。
     * @returns 新数组。
     */
    function sortGroups(groups, auto) {
      const list = Array.isArray(groups) ? groups : [];
      if (auto !== true) return list.slice();
      const hot = [];
      const idle = [];
      let ungrouped = null;
      for (const group of list) {
        if (group?.key === UNGROUPED_KEY) ungrouped = group;
        else if (Array.isArray(group?.rows) && group.rows.some((row) => row?.running === true)) hot.push(group);
        else idle.push(group);
      }
      const byActivity = (a, b) => groupActivity(b.rows) - groupActivity(a.rows);
      // Array.prototype.sort 是稳定排序：活跃度相同 → 保持工作区原始顺序。
      const sorted = [...hot.sort(byActivity), ...idle.sort(byActivity)];
      if (ungrouped !== null) sorted.push(ungrouped);
      return sorted;
    }

    /**
     * 运行态签名：只由「哪些会话在跑」决定，updatedAt 抖动不会改变它。
     *
     * @param sessionState - `sessions.list` 快照。
     * @returns 形如 `'a s1|s2'` 的字符串。
     */
    function runningSignature(sessionState) {
      const byId = sessionState?.byId ?? EMPTY_BY_ID;
      const live = [];
      for (const id of sessionState?.ids ?? EMPTY_IDS) {
        if (byId[id]?.running === true) live.push(id);
      }
      return `${live.length}:${live.join('|')}`;
    }

    // ==========================================================================
    // 卡片组内拖动（0.3.0）
    // ==========================================================================
    /** 点击 / 拖动的分界位移（px）。用户指定的硬规则，别改小。 */
    const DRAG_THRESHOLD_PX = 5;
    /** 拖动落位后屏蔽随后 click 的时长（ms）。 */
    const DRAG_CLICK_GUARD_MS = 200;
    /** 影子卡片放大比例（比原卡略大一点，视觉上「浮起来」）。 */
    const GHOST_SCALE = 1.02;

    /**
     * 把一个元素搬到「剔除它自己之后的第 target 位」。
     *
     * 这是拖动落点的**唯一**消费方式：`insertionIndexAtGrid` 的 skipIndex/remap
     * 已经把下标换算到「剔除被拖者之后」的坐标系，这里直接按插入位置处理。
     *
     * 0.3.2 之前这里还有一个 `moveCard`（target 是**原数组**下标，内部替你做
     * `from < at` 的换算）。拖动预览当时错用了它，同一个下标被换算两次，于是
     * 「A 拖到 B 的位置」算成原地不动 —— 预览不跟手，只有白条跑到后面那张上
     * （0.3.4 修的 bug）。那个函数已删除，别再加回来：卡片拖动**只有一套坐标系**。
     *
     * @param ids - 当前顺序。
     * @param from - 被搬元素的下标。
     * @param target - 剔除被搬元素后的插入下标。
     * @returns 新顺序（不改原数组）。
     */
    function insertAt(ids, from, target) {
      const list = Array.isArray(ids) ? ids.slice() : [];
      if (from < 0 || from >= list.length) return list;
      const [moved] = list.splice(from, 1);
      const at = Math.max(0, Math.min(list.length, Number.isFinite(target) ? target : from));
      list.splice(at, 0, moved);
      return list;
    }

    /**
     * 拖完之后该卡片是否算「置顶」：落在组内首位才算。
     *
     * 纯函数。与「置顶按钮」写的是同一份 PINNED_* 集合 —— 只有一份真相。
     *
     * @param order - 拖动后的组内顺序。
     * @param id - 被拖卡片 id。
     * @returns true = 应置顶，false = 应取消置顶。
     */
    function pinAfterDrop(order, id) {
      return Array.isArray(order) && order.length > 0 && order[0] === id;
    }

    /**
     * 拖动后的置顶集合：只增删被拖这张卡片，其余置顶项原样保留。
     *
     * 0.3.2 起 `dropCard()` 会额外把「落到置顶项前面」也算成一处置顶移位，
     * 所以置顶集合的更新已经内联在那边；这里保留成纯函数供测试与复用。
     *
     * @param pinnedIds - 当前置顶 id 数组。
     * @param id - 被拖卡片 id。
     * @param shouldPin - `pinAfterDrop()` 的结果。
     * @returns 新的置顶 id 数组。
     */
    function applyDropPin(pinnedIds, id, shouldPin) {
      const list = Array.isArray(pinnedIds) ? pinnedIds.filter((item) => item !== id) : [];
      if (shouldPin) list.unshift(id);
      return list;
    }

    /** 已存顺序 + 当前存在的 id → 完整顺序（未知 id 丢掉，新 id 追加到末尾）。 */
    function mergeIdOrder(saved, ids) {
      const out = [];
      const known = new Set(ids);
      for (const id of Array.isArray(saved) ? saved : []) {
        if (known.has(id) && !out.includes(id)) out.push(id);
      }
      for (const id of ids) {
        if (!out.includes(id)) out.push(id);
      }
      return out;
    }

    /** 把 from 位置的元素移到「原始下标 target」那个插入点，返回新数组。 */
    function reorderIds(ids, from, target) {
      if (!Array.isArray(ids) || from < 0 || from >= ids.length) return Array.isArray(ids) ? ids.slice() : [];
      const next = ids.slice();
      const moved = next.splice(from, 1)[0];
      let at = from < target ? target - 1 : target;
      at = Math.max(0, Math.min(next.length, at));
      next.splice(at, 0, moved);
      return next;
    }

    /** 指针 Y 落在第几个插入点（0 = 最前，rows.length = 最后）。 */
    function insertionIndexAt(rows, y) {
      if (!Array.isArray(rows) || rows.length === 0) return 0;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row === null || row === undefined || typeof row.getBoundingClientRect !== 'function') continue;
        let rect;
        try {
          rect = row.getBoundingClientRect();
        } catch {
          continue;
        }
        if (rect === null || rect === undefined) continue;
        if (typeof rect.top !== 'number' || typeof rect.height !== 'number') continue;
        if (y < rect.top + rect.height / 2) return i;
      }
      return rows.length;
    }

    /**
     * 按**视觉**位置从上到下排序行容器。
     *
     * 关键：拖过一次之后，DOM 顺序（注册顺序）和视觉顺序（flex `order`）就不一样了。
     * 插入点、拖动源、落盘顺序都必须基于视觉顺序，否则第二次拖动会算错。
     *
     * @param rows - nav 的直接子元素数组。
     * @returns 新的数组（取不到 rect 的排在最后，保持原相对顺序）。
     */
    function rowsByVisualTop(rows) {
      if (!Array.isArray(rows)) return [];
      const keyed = rows.map((row, index) => {
        let top = Number.POSITIVE_INFINITY;
        try {
          const rect = typeof row?.getBoundingClientRect === 'function' ? row.getBoundingClientRect() : undefined;
          if (rect !== undefined && rect !== null && typeof rect.top === 'number' && Number.isFinite(rect.top)) top = rect.top;
        } catch {
          top = Number.POSITIVE_INFINITY;
        }
        return { row, index, top };
      });
      keyed.sort((a, b) => (a.top - b.top) || (a.index - b.index));
      return keyed.map((item) => item.row);
    }

    /** 读已存的侧栏面板顺序；cookie 优先，其次 localStorage。 */
    function readPanelOrder() {
      const fromCookie = parseIdList(readCookie(PANEL_ORDER_COOKIE));
      if (fromCookie !== null) return fromCookie;
      try {
        if (typeof window !== 'undefined' && window !== null && window.localStorage !== undefined && window.localStorage !== null) {
          const parsed = parseIdList(window.localStorage.getItem(PANEL_ORDER_KEY));
          if (parsed !== null) return parsed;
        }
      } catch {
        // localStorage 被禁用时忽略。
      }
      return [];
    }

    /**
     * 保存顺序（cookie + localStorage 双写，任一成功即可）。
     *
     * 顺手把「手动组顺序记录」也落一份（GROUP_ORDER_*）：用户一旦亲手排过顺序，
     * 将来若从自动切回固定，或者回退到老版本，这个记录就是迁移依据。
     */
    function writePanelOrder(ids) {
      const text = JSON.stringify(ids);
      writeCookie(PANEL_ORDER_COOKIE, text);
      writeCookie(GROUP_ORDER_COOKIE, text);
      try {
        if (typeof window !== 'undefined' && window !== null && window.localStorage !== undefined && window.localStorage !== null) {
          window.localStorage.setItem(PANEL_ORDER_KEY, text);
        }
      } catch {
        // 配额满 / 被禁用：cookie 那份还在。
      }
      writeStore(GROUP_ORDER_KEY, text);
    }

    /**
     * 安装侧栏面板行的拖动排序。
     *
     * @param ctx - 客户端根上下文（只用 `slots.entriesOfSlot` 读条目 id）。
     * @param t - 本插件命名空间的翻译函数（用来定位自己那个按钮）。
     * @returns 清理函数：移除监听、定时器与 body class。
     */
    function installPanelSorting(ctx, t) {
      if (typeof document === 'undefined' || document === null) return () => {};
      const doc = document;
      const win = typeof window === 'undefined' ? undefined : window;

      let nav = null;
      let disposed = false;
      let saved = readPanelOrder();
      let draggingId = '';
      let pending = null;
      let marked = null;
      let markedSide = '';
      let guardUntil = 0;
      let tickTimer;

      /** 自己那个侧栏按钮的两种文案（进行中 / 对话总览），随语言实时变。 */
      const labelTexts = () => {
        const out = [];
        try {
          const running = t('entryRunning');
          if (typeof running === 'string' && running !== '') out.push(running);
        } catch {
          // 字典没就绪：下一拍再试。
        }
        try {
          const overview = t('entryOverview');
          if (typeof overview === 'string' && overview !== '' && !out.includes(overview)) out.push(overview);
        } catch {
          // 同上。
        }
        return out;
      };

      const escapeLabel = (label) => {
        try {
          if (typeof CSS !== 'undefined' && CSS !== null && typeof CSS.escape === 'function') return CSS.escape(label);
        } catch {
          // 回退到手工转义。
        }
        return String(label).replace(/["\\]/g, '\\$&');
      };

      /** 找侧栏那条 `nav`：先按自己按钮的 aria-label 反查，再按内置文案兜底。 */
      const findNav = () => {
        for (const label of labelTexts()) {
          let hit = null;
          try {
            hit = doc.querySelector(`button[aria-label="${escapeLabel(label)}"]`);
          } catch {
            hit = null;
          }
          if (hit === null || hit === undefined) continue;
          let found = null;
          try {
            found = typeof hit.closest === 'function' ? hit.closest('nav') : null;
          } catch {
            found = null;
          }
          if (found !== null && found !== undefined && found.children !== undefined) return found;
        }
        for (const label of ['全局面板', 'Global panels']) {
          let list = null;
          try {
            list = doc.querySelectorAll(`nav[aria-label="${label}"]`);
          } catch {
            list = null;
          }
          if (list === null || list === undefined || list.length === 0) continue;
          return list[0];
        }
        return null;
      };

      const rowsOf = () => {
        if (nav === null) return [];
        try {
          return Array.prototype.slice.call(nav.children);
        } catch {
          return [];
        }
      };

      /** 按注册 order 排序后的 id 列表 —— 与内置侧栏的排序规则一致。 */
      const idsNow = () => {
        try {
          const entries = ctx.slots.entriesOfSlot('sidebar.panellist');
          if (entries === null || entries === undefined || typeof entries.length !== 'number') return null;
          const rows = [];
          for (const entry of Array.prototype.slice.call(entries)) {
            const options = entry === null || entry === undefined ? undefined : entry.options;
            if (options === null || options === undefined) continue;
            if (typeof options.id !== 'string' || options.id === '') continue;
            const order = typeof options.order === 'number' && Number.isFinite(options.order) ? options.order : 0;
            rows.push({ id: options.id, order });
          }
          rows.sort((a, b) => a.order - b.order);
          return rows.map((row) => row.id);
        } catch {
          return null;
        }
      };

      /** 把保存的顺序投影到 DOM：每行一个 flex `order` + 自己的 id 标记。 */
      const applyOrder = () => {
        if (nav === null) return;
        const rows = rowsOf();
        if (rows.length === 0) return;
        const ids = idsNow();
        if (ids === null || ids.length !== rows.length) return;
        // DOM 顺序 = 注册顺序（React 按 id 渲染），所以第 i 行对应 ids[i]。
        const order = mergeIdOrder(saved, ids);
        const slot = new Map();
        order.forEach((id, index) => slot.set(id, index));
        for (let i = 0; i < rows.length; i += 1) {
          const row = rows[i];
          if (row === null || row === undefined || row.style === undefined) continue;
          const id = ids[i];
          const wanted = slot.has(id) ? slot.get(id) : i;
          const text = String(wanted);
          if (row.style.order !== text) row.style.order = text;
          if (row.style.cursor !== 'grab') row.style.cursor = 'grab';
          if (row.getAttribute('data-dsh-panel-row') === null) row.setAttribute('data-dsh-panel-row', '');
          if (row.getAttribute('data-dsh-panel-id') !== id) row.setAttribute('data-dsh-panel-id', id);
        }
      };

      /** 当前视觉顺序下的 id 列表（取不到 id 标记时返回 null）。 */
      const visualIds = () => {
        const out = [];
        for (const row of rowsByVisualTop(rowsOf())) {
          const id = row === null || row === undefined || typeof row.getAttribute !== 'function'
            ? null
            : row.getAttribute('data-dsh-panel-id');
          if (typeof id !== 'string' || id === '') return null;
          out.push(id);
        }
        return out;
      };

      const clearMark = () => {
        if (marked !== null && marked !== undefined && marked.style !== undefined) marked.style.boxShadow = '';
        marked = null;
        markedSide = '';
      };

      /** 在「将要插入的位置」画一条品牌色细线。 */
      const mark = (rows, y) => {
        if (rows.length === 0) return;
        const at = insertionIndexAt(rows, y);
        const side = at >= rows.length ? 'after' : 'before';
        const target = at >= rows.length ? rows[rows.length - 1] : rows[at];
        if (target === marked && side === markedSide) return;
        clearMark();
        if (target === null || target === undefined || target.style === undefined) return;
        marked = target;
        markedSide = side;
        const color = 'var(--dsw-alias-brand-primary, var(--dsw-brand-primary, #247bbf))';
        target.style.boxShadow = side === 'before'
          ? `inset 0 2px 0 0 ${color}`
          : `inset 0 -2px 0 0 ${color}`;
      };

      /** 事件目标 → nav 的直接子元素（行容器）。 */
      const rowFromTarget = (target) => {
        if (nav === null) return null;
        let node = target;
        while (node !== null && node !== undefined) {
          if (node.parentElement === nav) return node;
          node = node.parentElement;
        }
        return null;
      };

      const setSortingBody = (on) => {
        try {
          if (doc.body === null || doc.body === undefined || doc.body.classList === undefined) return;
          if (on) doc.body.classList.add('dsh-wso-sorting');
          else doc.body.classList.remove('dsh-wso-sorting');
        } catch {
          // body 还没就绪：忽略。
        }
      };

      /** 收尾：清拖动痕迹、清标记、清 body class。 */
      const finish = () => {
        for (const row of rowsOf()) {
          if (row === null || row === undefined) continue;
          if (row.style !== undefined) row.style.opacity = '';
          if (typeof row.removeAttribute === 'function') row.removeAttribute('data-dsh-panel-dragging');
        }
        clearMark();
        setSortingBody(false);
        draggingId = '';
        pending = null;
      };

      const onPointerDown = (event) => {
        if (event === null || event === undefined) return;
        if (typeof event.button === 'number' && event.button !== 0) return;
        if (event.isPrimary === false) return;
        const row = rowFromTarget(event.target);
        if (row === null) return;
        const id = typeof row.getAttribute === 'function' ? row.getAttribute('data-dsh-panel-id') : null;
        pending = { row, id: typeof id === 'string' ? id : '', pointerId: event.pointerId, y0: event.clientY, moved: false };
        try {
          if (typeof row.setPointerCapture === 'function' && event.pointerId !== undefined) {
            row.setPointerCapture(event.pointerId);
          }
        } catch {
          // 没有捕获也能靠 nav 上的冒泡继续。
        }
      };

      const onPointerMove = (event) => {
        if (pending === null || event === null || event === undefined) return;
        if (pending.pointerId !== undefined && event.pointerId !== undefined && event.pointerId !== pending.pointerId) return;
        if (typeof event.clientY !== 'number') return;
        if (!pending.moved) {
          if (Math.abs(event.clientY - pending.y0) < PANEL_DRAG_THRESHOLD) return;
          if (pending.id === '') {
            pending = null;
            return;
          }
          pending.moved = true;
          draggingId = pending.id;
          if (pending.row.style !== undefined) pending.row.style.opacity = '0.45';
          if (typeof pending.row.setAttribute === 'function') pending.row.setAttribute('data-dsh-panel-dragging', '');
          setSortingBody(true);
        }
        mark(rowsByVisualTop(rowsOf()), event.clientY);
        if (typeof event.preventDefault === 'function') event.preventDefault();
      };

      const onPointerUp = (event) => {
        if (pending === null) return;
        const wasDragging = pending.moved;
        const row = pending.row;
        const pointerId = pending.pointerId;
        try {
          if (row !== null && row !== undefined && typeof row.releasePointerCapture === 'function' && pointerId !== undefined) {
            row.releasePointerCapture(pointerId);
          }
        } catch {
          // 已释放：忽略。
        }
        if (!wasDragging) {
          finish();
          return;
        }
        // 插入点必须按**视觉顺序**算：DOM 顺序可能已经被 flex order 打乱。
        const rows = rowsByVisualTop(rowsOf());
        const visual = visualIds();
        const from = visual === null ? -1 : visual.indexOf(draggingId);
        if (visual !== null && from >= 0 && visual.length === rows.length) {
          const at = insertionIndexAt(rows, typeof event?.clientY === 'number' ? event.clientY : 0);
          const next = reorderIds(visual, from, at);
          saved = next;
          writePanelOrder(next);
        }
        guardUntil = Date.now() + PANEL_CLICK_GUARD_MS;
        finish();
        applyOrder();
      };

      const onPointerCancel = () => {
        finish();
      };

      /** 拖完立刻松开鼠标时，别让那次 click 把面板切走。 */
      const onGuardClick = (event) => {
        if (Date.now() >= guardUntil) return;
        guardUntil = 0;
        if (event === null || event === undefined) return;
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      };

      /**
       * document 级兜底：指针在 nav 之外松开（或系统抢走指针）时也要收尾，
       * 否则那行会一直半透明地「挂着」。
       */
      const onDocumentPointerEnd = (event) => {
        if (pending === null) return;
        if (pending.pointerId !== undefined && event?.pointerId !== undefined && event.pointerId !== pending.pointerId) return;
        if (pending.moved) {
          // 真的拖过：按最后已知位置落盘，而不是默默丢弃。
          const rows = rowsByVisualTop(rowsOf());
          const visual = visualIds();
          const from = visual === null ? -1 : visual.indexOf(draggingId);
          if (visual !== null && from >= 0 && visual.length === rows.length) {
            const at = insertionIndexAt(rows, typeof event?.clientY === 'number' ? event.clientY : 0);
            const next = reorderIds(visual, from, at);
            saved = next;
            writePanelOrder(next);
          }
          guardUntil = Date.now() + PANEL_CLICK_GUARD_MS;
          finish();
          applyOrder();
          return;
        }
        finish();
      };

      /** 卸载时把行上我们写过的痕迹全部还原（不碰别人自己的 class / 属性）。 */
      const resetRows = () => {
        for (const row of rowsOf()) {
          if (row === null || row === undefined) continue;
          try {
            if (row.style !== undefined) {
              row.style.order = '';
              row.style.cursor = '';
              row.style.opacity = '';
              row.style.boxShadow = '';
            }
            if (typeof row.removeAttribute === 'function') {
              row.removeAttribute('data-dsh-panel-row');
              row.removeAttribute('data-dsh-panel-id');
              row.removeAttribute('data-dsh-panel-dragging');
            }
          } catch {
            // 单行失败不影响其它行。
          }
        }
      };

      const detach = () => {
        if (nav === null) return;
        try {
          nav.removeEventListener('pointerdown', onPointerDown);
          nav.removeEventListener('pointermove', onPointerMove);
          nav.removeEventListener('pointerup', onPointerUp);
          nav.removeEventListener('pointercancel', onPointerCancel);
        } catch {
          // 元素已卸载：忽略。
        }
        try {
          if (typeof nav.removeAttribute === 'function') nav.removeAttribute('data-dsh-panel-sort');
        } catch {
          // 忽略。
        }
        finish();
        nav = null;
      };

      const attach = (found) => {
        if (found === null || found === undefined) return;
        detach();
        nav = found;
        try {
          nav.setAttribute('data-dsh-panel-sort', '');
          nav.addEventListener('pointerdown', onPointerDown);
          nav.addEventListener('pointermove', onPointerMove);
          nav.addEventListener('pointerup', onPointerUp);
          nav.addEventListener('pointercancel', onPointerCancel);
        } catch {
          nav = null;
          return;
        }
        applyOrder();
      };

      const tick = () => {
        if (disposed) return;
        if (nav === null || nav.isConnected === false) attach(findNav());
        applyOrder();
      };

      try {
        doc.addEventListener('click', onGuardClick, true);
      } catch {
        // 没有 document 级监听也还能拖，只是拖完可能顺手切面板。
      }
      try {
        doc.addEventListener('pointerup', onDocumentPointerEnd, true);
        doc.addEventListener('pointercancel', onDocumentPointerEnd, true);
      } catch {
        // 兜底收尾装不上也不影响主流程。
      }

      tick();

      try {
        if (win !== undefined && win !== null && typeof win.setInterval === 'function') {
          tickTimer = win.setInterval(() => {
            try {
              tick();
            } catch {
              // 一拍失败不影响下一拍。
            }
          }, PANEL_SORT_TICK_MS);
        }
      } catch {
        tickTimer = undefined;
      }

      return () => {
        disposed = true;
        try {
          if (tickTimer !== undefined && win !== undefined && win !== null && typeof win.clearInterval === 'function') {
            win.clearInterval(tickTimer);
          }
        } catch {
          // 忽略。
        }
        try {
          doc.removeEventListener('click', onGuardClick, true);
          doc.removeEventListener('pointerup', onDocumentPointerEnd, true);
          doc.removeEventListener('pointercancel', onDocumentPointerEnd, true);
        } catch {
          // 忽略。
        }
        // 先把行上的痕迹还原（需要 nav 还挂着才能找到那些行），再解绑。
        resetRows();
        detach();
        try {
          if (doc.body !== null && doc.body !== undefined && doc.body.classList !== undefined) {
            doc.body.classList.remove('dsh-wso-sorting');
          }
        } catch {
          // 忽略。
        }
      };
    }

    // ==========================================================================
    // 设置页「设置 → 进行中/对话总览」—— 0.2.0
    // ==========================================================================
    // 只放一个「组排序」单选：自动（默认）/ 固定。写完即生效（cookie + localStorage
    // 双写），面板下次渲染就按新顺序排，不需要刷新页面。
    //
    // 为什么用原生 radio 而不是分段按钮：这里要的是「二选一、明确语义」，
    // 原生 radio 自带键盘方向键、读屏语义和 <label> 点选，样式也只需一条 CSS。
    /**
     * 设置页区块。
     *
     * @param props - 标准 props（`t`）+ 框架给的 `next`（本轮不使用，保持签名兼容）。
     */
    function GroupOrderSection(props) {
      const t = typeof props?.t === 'function' ? props.t : (key) => key;
      const [auto, setAuto] = React.useState(readGroupAuto);
      const [cardActions, setCardActions] = React.useState(readCardActions);

      const choose = (value) => {
        if (value === auto) return;
        setAuto(value);
        writeGroupAuto(value);
        // 手动拖出来的顺序会压住「自动 / 固定」的排序结果（applyPinnedOrder
        // 见到自由顺序就原样返回）。切模式是用户明确要求换一种排法，
        // 所以顺手清掉手动顺序，否则设置页点了没反应。
        writeOrder([]);
        notifyOrderReset();
      };

      /** 切换一个卡片按钮；抹掉最后一个会自动回退成全开。 */
      const toggleAction = (name) => {
        const next = toggleCardAction(cardActions, name);
        setCardActions(next);
        writeCardActions(next);
      };

      /** 一个单选项：<label> 包住 radio + 标题 + 说明，点哪都能选中。 */
      const option = (value, nameKey, descKey) => h('label', {
        key: value ? 'auto' : 'fixed',
        className: 'dsh-wso-opt' + (auto === value ? ' is-on' : ''),
      },
        h('input', {
          type: 'radio',
          name: 'dsh-wso-group-order',
          checked: auto === value,
          onChange: () => choose(value),
        }),
        h('span', { className: 'dsh-wso-opt-text' },
          h('span', { className: 'dsh-wso-opt-name' }, t(nameKey)),
          h('span', { className: 'dsh-wso-opt-desc' }, t(descKey))));

      /** 一个卡片按钮开关：<label> 包住 checkbox。 */
      const check = (name) => h('label', {
        key: name,
        className: 'dsh-wso-check' + (cardActions.includes(name) ? ' is-on' : ''),
      },
        h('input', {
          type: 'checkbox',
          name: 'dsh-wso-card-action',
          value: name,
          checked: cardActions.includes(name),
          onChange: () => toggleAction(name),
        }),
        h('span', { className: 'dsh-wso-opt-text' },
          h('span', { className: 'dsh-wso-opt-name' }, t(`act_${name}`)),
          h('span', { className: 'dsh-wso-opt-desc' }, t(`act_${name}Desc`))));

      return h('section', { className: 'dsh-wso-set' },
        h('div', { className: 'dsh-wso-set-intro' },
          h('h3', { className: 'dsh-wso-set-title' }, t('pageTitle')),
          h('p', { className: 'dsh-wso-set-desc' }, t('pageDesc')),
          h('div', { className: 'dsh-wso-set-body', role: 'radiogroup', 'aria-label': t('modeLabel') },
            option(true, 'modeAuto', 'modeAutoDesc'),
            option(false, 'modeFixed', 'modeFixedDesc'))),

        // 卡片按钮：只列可配置项；停止按钮不在其中，永远显示。
        h('div', { className: 'dsh-wso-set-body', role: 'group', 'aria-label': t('cardActionsLabel') },
          h('h4', { className: 'dsh-wso-set-title' }, t('cardActionsTitle')),
          h('p', { className: 'dsh-wso-set-desc' }, t('cardActionsDesc')),
          CARD_ACTION_LIST.map(check),
          h('p', { className: 'dsh-wso-note' }, t('cardActionsStopNote')),
          h('p', { className: 'dsh-wso-note' }, t('cardActionsEmptyNote')),
          h('p', { className: 'dsh-wso-note' }, t('cardActionsDragNote'))));
    }

    // ==========================================================================
    // 插件主体
    // ==========================================================================
    /**
     * 单步失败只记日志，绝不让 apply() 抛出 —— 这是上次启动失败的根因。
     *
     * @param label - 步骤名，用于日志。
     * @param run - 要执行的注册动作。
     * @returns 该动作的返回值；抛错时返回 undefined。
     */
    function safe(label, run) {
      try {
        return run();
      } catch (error) {
        try {
          console.error(`[workspace-ranswork] ${label} failed`, error);
        } catch {
          // 连 console 都不可用时保持静默，启动优先。
        }
        return undefined;
      }
    }

    /** 客户端硬依赖：只声明真正存在、缺了就别激活的服务。 */
    const inject = ['slots', 'locale'];

    function apply(ctx) {
      const t = ctx.locale.bind(NS);

      // 文案字典：注册失败也不影响面板（面板会显示 key）。
      safe('dictionaries', () => ctx.effect(
        () => ctx.locale.register(NS, { zh: ZH, en: EN }),
        'workspace-ranswork: dictionaries',
      ));

      // 样式：**自建 <style> 标签**，与 dsh-archived-sessions / 桌宠 / 市场插件同款。
      //
      // 为什么不用 `styles.insert`：那个内置符号在动态 bundle 的工厂作用域里
      // 并不总是可解析（`typeof styles` 取到 'undefined'），一旦判断失败就被
      // safe() 静默跳过 —— 表现就是「CSS 完全没生效、按钮退回浏览器默认样式」。
      // 自建标签没有这个风险，且 `ctx.effect` 的清理函数会在卸载时移除它。
      safe('stylesheet', () => ctx.effect(() => {
        if (typeof document === 'undefined' || document === null) return () => {};
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-workspace-ranswork';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, 'workspace-ranswork: stylesheet'));

      // 打开会话：uiWorkspace 是可选服务，取不到就退化为只切面板。
      const openSession = (sessionId) => {
        const uiWorkspace = safe('get uiWorkspace', () => ctx.get('uiWorkspace'));
        if (uiWorkspace !== undefined && uiWorkspace !== null && typeof uiWorkspace.openSession === 'function') {
          uiWorkspace.openSession(sessionId);
          return;
        }
        const layout = safe('get layout', () => ctx.get('layout'));
        if (layout !== undefined && layout !== null && typeof layout.selectPanel === 'function') {
          layout.selectPanel(null);
          return;
        }
        throw new Error('no session navigation service');
      };

      // ---------------------------------------------------------------- 动作
      // 全部走客户端已有服务；任一缺失只让对应按钮报错，不影响其他按钮。
      /** 取一个客户端服务（缺失返回 undefined，不抛）。 */
      const service = (name) => safe(`get ${name}`, () => ctx.get(name));

      /** 归档：uiWorkspace.archiveSession(id)。 */
      const archiveSession = async (sessionId) => {
        const uiWorkspace = service('uiWorkspace');
        if (uiWorkspace === undefined || uiWorkspace === null || typeof uiWorkspace.archiveSession !== 'function') {
          throw new Error('uiWorkspace.archiveSession unavailable');
        }
        await uiWorkspace.archiveSession(sessionId);
      };

      /** 分叉：uiWorkspace.forkSession(id) → 新会话 id，然后直接打开它。 */
      const forkSession = async (sessionId) => {
        const uiWorkspace = service('uiWorkspace');
        if (uiWorkspace === undefined || uiWorkspace === null || typeof uiWorkspace.forkSession !== 'function') {
          throw new Error('uiWorkspace.forkSession unavailable');
        }
        const childId = await uiWorkspace.forkSession(sessionId);
        if (typeof childId === 'string' && childId !== '') openSession(childId);
        return childId;
      };

      /** 在会话作用域里拿 ISession（用于 rename / cancel）。 */
      const withSession = async (sessionId, use) => {
        const sessions = service('sessions');
        if (sessions === undefined || sessions === null || typeof sessions.retain !== 'function') {
          throw new Error('sessions.retain unavailable');
        }
        return sessions.using(sessionId, { source: 'controllerOperation' }, async (reference) => {
          const binding = await reference.ready;
          const session = binding?.session;
          if (session === undefined || session === null) throw new Error('session unavailable');
          return use(session);
        });
      };

      /** 重命名：session.rename(title)。 */
      const renameSession = (sessionId, title) => withSession(sessionId, async (session) => {
        if (typeof session.rename !== 'function') throw new Error('session.rename unavailable');
        const result = await session.rename(title);
        if (result !== undefined && result !== null && result.ok === false) {
          throw new Error(result.error?.message ?? 'rename failed');
        }
      });

      /** 停止运行：session.cancel()。 */
      const stopSession = (sessionId) => withSession(sessionId, async (session) => {
        if (typeof session.cancel !== 'function') throw new Error('session.cancel unavailable');
        const result = await session.cancel();
        if (result !== undefined && result !== null && result.ok === false) {
          throw new Error(result.error?.message ?? 'cancel failed');
        }
      });

      /** 复制会话 ID：优先剪贴板，退化到临时 textarea。 */
      const copyId = (text) => {
        try {
          if (typeof document === 'undefined' || document === null) return false;
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
          area.remove();
          return ok === true;
        } catch {
          return false;
        }
      };

      // ---------------------------------------------------------------- 运行态
      /** 当前是否有会话在跑（决定按钮文案与面板模式）。 */
      let hasRunning = false;

      /** 从会话快照里读一次「是否有运行中会话」。 */
      const readHasRunning = () => {
        const sessions = safe('get sessions', () => ctx.get('sessions'));
        const list = sessions === undefined || sessions === null ? undefined : sessions.list;
        if (list === undefined || list === null || typeof list.getSnapshot !== 'function') return false;
        try {
          const snapshot = list.getSnapshot();
          const byId = snapshot === undefined || snapshot === null ? EMPTY_BY_ID : snapshot.byId ?? EMPTY_BY_ID;
          for (const key of Object.keys(byId)) {
            if (byId[key] !== null && byId[key] !== undefined && byId[key].running === true) return true;
          }
          return false;
        } catch {
          return false;
        }
      };

      hasRunning = readHasRunning();

      /** 当前侧栏条目的清理函数（重注册时先调用它）。 */
      let disposeEntry = () => {};

      /** 注册侧栏入口；label thunk 读 hasRunning，所以重注册即可换文案。 */
      const registerEntry = () => {
        safe('dispose entry', () => disposeEntry());
        const disposer = safe('sidebar entry', () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          locale: NS,
          label: () => t(hasRunning ? 'entryRunning' : 'entryOverview'),
        }, SidebarIcon)));
        disposeEntry = typeof disposer === 'function' ? disposer : () => {};
      };

      registerEntry();

      // 订阅会话快照：只在「有/无运行中」翻转时重注册侧栏条目。
      safe('running watch', () => ctx.effect(() => {
        const sessions = safe('get sessions', () => ctx.get('sessions'));
        const list = sessions === undefined || sessions === null ? undefined : sessions.list;
        if (list === undefined || list === null || typeof list.subscribe !== 'function') return () => {};

        const sync = () => {
          const next = readHasRunning();
          if (next === hasRunning) return;
          hasRunning = next;
          registerEntry();
        };

        let off;
        try {
          off = list.subscribe(sync);
        } catch {
          off = undefined;
        }
        return () => {
          if (typeof off === 'function') off();
        };
      }, 'workspace-ranswork: running watch'));

      // 主面板：key 与侧栏 id 相同，侧栏点击即寻址到这里。
      safe('main panel', () => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({
          openSession,
          archiveSession,
          forkSession,
          renameSession,
          stopSession,
          copyId,
        }),
      }, OverviewPanel)));

      // 设置页「进行中/对话总览」：只放「组排序 = 自动 / 固定」。
      // order 26 夹在「自定义主题」(25) 与「使用统计」(27) 之间。
      safe('settings section', () => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: PANEL_ID,
        order: SECTION_ORDER,
        label: () => t('nav'),
        locale: NS,
      }, GroupOrderSection)));

      // 侧栏「全局面板」行拖动排序：纯浏览器侧增强，失败也只是「拖不动」。
      safe('panel sorting', () => ctx.effect(() => installPanelSorting(ctx, t), 'workspace-ranswork: panel sorting'));
    }

    return { inject, apply };
  },
});
