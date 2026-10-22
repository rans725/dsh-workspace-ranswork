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

      // ---- 工作区分组 --------------------------------------------------------
      '.dsh-wso-groups{display:flex;flex-direction:column;gap:22px}',
      '.dsh-wso-group{display:flex;flex-direction:column;gap:8px}',
      '.dsh-wso-group-title{margin:0 0 2px;padding:0 2px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}',

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

      // ---- 卡片拖动反馈：浮起半透明 + 落点虚线 --------------------------------
      '.dsh-wso-row.is-dragging{opacity:.5;transform:scale(.985);cursor:grabbing;border-style:dashed}',
      '.dsh-wso-row.is-drop-before{box-shadow:inset 0 3px 0 -1px var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))}',
      '.dsh-wso-row.is-drop-end{box-shadow:inset 0 -3px 0 -1px var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf))}',
      '.dsh-wso-rows.is-drop-target{outline:1px dashed var(--dsw-alias-brand-primary,var(--dsw-brand-primary,#247bbf));outline-offset:3px;border-radius:var(--dsw-radius-md,10px)}',

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

    /**
     * 把置顶项提到每组最前面（其余保持原顺序）。
     *
     * @param rows - 行数组。
     * @param pinned - 置顶 id 集合。
     * @returns 新数组。
     */
    function applyPinnedOrder(rows, pinned) {
      if (!Array.isArray(rows) || pinned === undefined || pinned === null) return rows;
      const hot = [];
      const rest = [];
      for (const row of rows) {
        if (pinned.has(row.id)) hot.push(row);
        else rest.push(row);
      }
      return [...hot, ...rest];
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
      const [groupAuto, setGroupAuto] = React.useState(readGroupAuto);
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
      const pointerRef = React.useRef(null);
      /** 最近一次拖动结束的时间戳（用于屏蔽尾随 click）。 */
      const guardRef = React.useRef(0);

      const openAfterClick = (id) => {
        if (Date.now() - guardRef.current < DRAG_CLICK_GUARD_MS) return;
        open(id);
      };

      /** 落位：组内顺序 → 置顶集合（与置顶按钮共用 pinnedIds / PINNED_*）。 */
      const dropCard = (groupKey, id, target) => {
        const group = groups.find((item) => item.key === groupKey);
        if (group === undefined || !Array.isArray(group.rows)) return;
        const ids = group.rows.map((item) => item.id);
        const from = ids.indexOf(id);
        if (from < 0) return;
        const order = moveCard(ids, from, target);
        const nextPinned = applyDropPin(pinnedIds, id, pinAfterDrop(order, id));
        setPinnedIds(nextPinned);
        writePinned(nextPinned);
      };

      const onCardPointerDown = (groupKey, id, event) => {
        if (event.button !== 0) return;
        pointerRef.current = { groupKey, id, x: event.clientX, y: event.clientY, intent: 'click' };
      };

      const onCardPointerMove = (groupKey, id, event) => {
        const state = pointerRef.current;
        if (state === null || state.id !== id || state.groupKey !== groupKey) return;
        if (state.intent === 'drag') {
          // 只在所属组内找落点 —— 跨组拖动无效、不改归属。
          const rows = cardRowsOf(groupKey);
          setDrag({ key: groupKey, id, target: insertionIndexAt(rows, event.clientY) });
          return;
        }
        const moved = Math.abs(event.clientX - state.x) + Math.abs(event.clientY - state.y);
        if (moved < DRAG_THRESHOLD_PX) return;
        state.intent = 'drag';
        const rows = cardRowsOf(groupKey);
        setDrag({ key: groupKey, id, target: insertionIndexAt(rows, event.clientY) });
      };

      const onCardPointerUp = (groupKey, id) => {
        const state = pointerRef.current;
        pointerRef.current = null;
        if (state === null || state.id !== id) return;
        if (state.intent !== 'drag') return; // 走 click 分支（打开会话）
        const target = drag !== null && drag.id === id ? drag.target : null;
        setDrag(null);
        guardRef.current = Date.now();
        if (target !== null) dropCard(groupKey, id, target);
      };

      /** 拖动轨迹被打断（拖出窗口 / 系统手势）时兜底清状态。 */
      const onCardPointerCancel = () => {
        pointerRef.current = null;
        setDrag(null);
      };

      /** 取某个组当前的卡片行 DOM（用于算落点）。 */
      const cardRowsOf = (groupKey) => {
        try {
          if (typeof document === 'undefined' || document === null) return [];
          const list = document.querySelectorAll(`.dsh-wso-rows[data-group-key="${groupKey}"] > .dsh-wso-row`);
          return Array.prototype.slice.call(list);
        } catch {
          return [];
        }
      };

      /** 某组渲染用的卡片顺序：静止时 = applyPinnedOrder()，拖动时 = 预览落位。 */
      const cardOrder = (group) => {
        const base = applyPinnedOrder(group.rows, pinned);
        if (drag === null || drag.key !== group.key) return base;
        const ids = base.map((item) => item.id);
        const from = ids.indexOf(drag.id);
        if (from < 0) return base;
        const next = moveCard(ids, from, drag.target);
        const byId = new Map(base.map((item) => [item.id, item]));
        return next.map((id) => byId.get(id)).filter(Boolean);
      };

      /** 某组卡片 id 的下标（拖动落点高亮用）。 */
      const indexOfRow = (groupKey, id) => {
        const group = groups.find((item) => item.key === groupKey);
        if (group === undefined) return -1;
        return cardOrder(group).findIndex((item) => item.id === id);
      };

      /** 某组卡片数量（落点「插到最后一个」的高亮用）。 */
      const countRows = (groupKey) => {
        const group = groups.find((item) => item.key === groupKey);
        return group === undefined ? -1 : cardOrder(group).length;
      };

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
      const rowOf = (groupKey) => (row) => h('div', {
        key: row.id,
        className: 'dsh-wso-row'
          + (drag !== null && drag.id === row.id ? ' is-dragging' : '')
          + (drag !== null && drag.key === groupKey && drag.target === indexOfRow(groupKey, row.id) ? ' is-drop-before' : '')
          + (drag !== null && drag.key === groupKey && drag.target === countRows(groupKey) ? ' is-drop-end' : ''),
        role: 'button',
        tabIndex: 0,
        title: row.title,
        'aria-label': `${t('openTitle')}: ${row.title}`,
        'data-session-id': row.id,
        // click 只负责「没拖动过」的情况；拖动结束后的尾随 click 由 guard 拦掉。
        onClick: () => openAfterClick(row.id),
        onMouseDown: (event) => onCardPointerDown(groupKey, row.id, event),
        onMouseMove: (event) => onCardPointerMove(groupKey, row.id, event),
        onMouseUp: () => onCardPointerUp(groupKey, row.id),
        onMouseLeave: () => onCardPointerCancel(),
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
        : h('div', { className: 'dsh-wso-groups' }, groups.map((group) => h('section', {
            className: 'dsh-wso-group',
            key: group.key,
            'data-group-key': group.key,
          },
            h('h2', { className: 'dsh-wso-group-title', title: group.title }, group.title),
            h('div', { className: 'dsh-wso-rows', 'data-group-key': group.key }, cardOrder(group).map(rowOf(group.key))))));

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

    /**
     * 把组内某张卡片移到目标插入点。
     *
     * 纯函数：不改入参、不读全局。目标点是最前（0）即「置顶」。
     *
     * @param ids - 组内当前顺序（卡片 id）。
     * @param from - 被拖卡片的下标。
     * @param target - 目标插入点（0 = 最前，ids.length = 最后）。
     * @returns 新顺序数组。
     */
    function moveCard(ids, from, target) {
      const list = Array.isArray(ids) ? ids.slice() : [];
      if (from < 0 || from >= list.length) return list;
      const at = Math.max(0, Math.min(list.length, Number.isFinite(target) ? target : from));
      const [moved] = list.splice(from, 1);
      const to = from < at ? at - 1 : at;
      list.splice(Math.max(0, Math.min(list.length, to)), 0, moved);
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
        setAuto(value);
        writeGroupAuto(value);
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
