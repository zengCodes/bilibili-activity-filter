// ==UserScript==
// @name         B站活动筛选助手
// @name:zh-CN   B站活动筛选助手
// @namespace    https://github.com/zengCodes/bilibili-activity-filter
// @version      0.0.0-src（构建时由 scripts/build.js 注入 package.json 版本号）
// @description  实时获取B站170+投稿活动，按分类/时间/奖励筛选，按你的视频类型计算匹配度，支持收藏与截止提醒
// @description:zh-CN 实时获取B站170+投稿活动，按分类/时间/奖励筛选，按你的视频类型计算匹配度，支持收藏与截止提醒
// @author       zengCodes
// @match        https://www.bilibili.com/blackboard/era/reward-activity-list-page.html*
// @grant        none
// @tag          B站
// @tag          bilibili
// @tag          活动
// @tag          筛选功能
// @tag          倒计时提醒
// @license      MIT
// @icon        data:image/png;base64,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
// ==/UserScript==

(function () {
  'use strict';

  // __BAF_CORE__

  // ========== 注入样式 ==========
  const style = document.createElement('style');
  style.textContent = `
    /* 主题变量：.baf-dark（由 JS 检测页面背景亮度/系统偏好后挂载）覆盖为深色 */
    :root {
      --baf-panel-w: 380px;
      --baf-top-offset: 0px; /* 由 JS 按页面顶栏实测高度设置，避免遮挡右上角用户信息 */
      --baf-bg: #fff;
      --baf-bg-subtle: #f4f5f7;
      --baf-bg-accent: #fff5f7;
      --baf-accent-border: #ffd6e0;
      --baf-bg-warning: #fffbe6;
      --baf-bg-match-high: linear-gradient(135deg, #f6ffed 0%, #fff 60%);
      --baf-text-main: #18191c;
      --baf-text-sub: #61666d;
      --baf-text-faint: #9499a0;
      --baf-text-warning: #ad8b00;
      --baf-border: #e3e5e7;
      --baf-brand: #fb7299;
      --baf-contrast: #fff;
    }
    .baf-dark {
      --baf-bg: #1e1e20;
      --baf-bg-subtle: #2a2a2d;
      --baf-bg-accent: #2a1f24;
      --baf-accent-border: #3a3a3f;
      --baf-bg-warning: #322a12;
      --baf-bg-match-high: #16251a;
      --baf-text-main: #e8e8ea;
      --baf-text-sub: #a8a8b0;
      --baf-text-faint: #70707a;
      --baf-text-warning: #d9b13b;
      --baf-border: #3a3a3f;
    }
    .bili-activity-filter-toolbar {
      position: sticky; top: 0; z-index: 1000; background: var(--baf-bg);
      border-bottom: 2px solid #fb7299; padding: 12px 20px; margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      /* B站页面 html { font-size: 100px }（rem 方案），必须在容器显式声明基础字号，
         否则未声明字号的流内子元素会继承 100px，line-height:normal 撑出百像素行盒 */
      font-size: 13px; line-height: 1.5;
    }
    .baf-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .baf-title { font-size: 15px; font-weight: 700; color: #fb7299; display: flex; align-items: center; gap: 6px; }
    .baf-header-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .baf-icon-btn {
      width: 26px; height: 26px; border: 1px solid var(--baf-border); background: var(--baf-bg);
      border-radius: 6px; font-size: 14px; line-height: 1; color: var(--baf-text-sub);
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
      padding: 0; transition: all 0.15s;
    }
    .baf-icon-btn:hover { border-color: #fb7299; color: #fb7299; }
    .baf-stats { font-size: 12px; color: var(--baf-text-sub); margin-bottom: 8px; }
    .baf-stats strong { color: #fb7299; font-size: 14px; }
    .baf-filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .baf-filter-label { font-size: 12px; color: var(--baf-text-faint); font-weight: 600; min-width: 50px; flex-shrink: 0; }
    .baf-filter-btns { display: flex; flex-wrap: wrap; gap: 6px; }
    .baf-filter-btn {
      padding: 3px 10px; border: 1px solid var(--baf-border); border-radius: 12px; background: var(--baf-bg);
      font-size: 12px; color: var(--baf-text-sub); cursor: pointer; transition: all 0.15s; user-select: none;
    }
    .baf-filter-btn:hover { border-color: #fb7299; color: #fb7299; }
    .baf-filter-btn.active { background: #fb7299; border-color: #fb7299; color: var(--baf-contrast); }
    .baf-search-row { display: flex; gap: 8px; align-items: center; }
    .baf-search-input { flex: 1; padding: 6px 12px; border: 1px solid var(--baf-border); border-radius: 6px; font-size: 13px; outline: none; }
    .baf-search-input:focus { border-color: #fb7299; }
    .baf-select { padding: 6px 10px; border: 1px solid var(--baf-border); border-radius: 6px; font-size: 12px; background: var(--baf-bg); cursor: pointer; outline: none; }
    .baf-video-type-input { width: 200px; padding: 6px 10px; border: 1px solid var(--baf-accent-border); border-radius: 6px; font-size: 12px; outline: none; background: var(--baf-bg-accent); }
    .baf-video-type-input:focus { border-color: #fb7299; }
    .baf-loading { text-align: center; padding: 40px; color: var(--baf-text-faint); font-size: 14px; }
    .baf-loading-spinner {
      display: inline-block; width: 24px; height: 24px; border: 3px solid #f0f0f0;
      border-top-color: #fb7299; border-radius: 50%; animation: baf-spin 0.8s linear infinite; margin-bottom: 8px;
    }
    @keyframes baf-spin { to { transform: rotate(360deg); } }
    .baf-hide-original .list-scroll-box { display: none !important; }
    .baf-activity-list {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      /* 行高强制按内容计算：容器块向尺寸确定（停靠面板 flex:1）+卡片 overflow:hidden 时，
         auto 行会被压成等分填充、容器误判无溢出，卡片内容全被裁掉 */
      grid-auto-rows: max-content;
      gap: 12px; padding: 0 20px 20px;
      /* 同工具栏：显式声明基础字号，切断 B站 html font-size:100px 的继承污染 */
      font-size: 13px; line-height: 1.5;
    }
    .baf-activity-item {
      background: var(--baf-bg); border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s;
      border: 1px solid var(--baf-border); position: relative; overflow: hidden;
      /* 白卡片贴白页面需要淡阴影拉开层次 */
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .baf-cat-badge {
      position: absolute; top: 8px; left: 8px; width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 5;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .baf-activity-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: #fb7299; }
    .baf-activity-item-title { font-size: 14px; font-weight: 600; color: var(--baf-text-main); margin-bottom: 6px; line-height: 1.4; padding-left: 36px; }
    .baf-activity-item-cats { display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap; }
    .baf-cat-tag { padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .baf-activity-item-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .baf-activity-item-tag { padding: 1px 6px; background: var(--baf-bg-subtle); border-radius: 3px; font-size: 10px; color: var(--baf-text-sub); }
    .baf-activity-item-info { font-size: 11px; color: var(--baf-text-faint); line-height: 1.6; }
    .baf-activity-item-reward { margin-top: 8px; padding: 6px 8px; background: var(--baf-bg-warning); border-radius: 4px; font-size: 11px; color: var(--baf-text-warning); }
    .baf-activity-item-footer { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .baf-days-urgent { color: #ff4d4f; font-weight: 600; }
    .baf-days-normal { color: #52c41a; }
    .baf-days-long { color: #1890ff; }
    .baf-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: var(--baf-contrast); }
    .baf-badge-match { background: #52c41a; }
    .baf-badge-mid { background: #1890ff; }
    .baf-badge-low { background: var(--baf-text-faint); }
    .baf-high-match { border: 2px solid #52c41a !important; background: var(--baf-bg-match-high) !important; }
    .baf-activity-item.is-fav { border-color: #faad14 !important; }
    .baf-fav-btn {
      position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border: none; background: transparent;
      font-size: 16px; cursor: pointer; z-index: 12; line-height: 1; padding: 0;
      opacity: 0.45; transition: all 0.15s; filter: grayscale(1);
    }
    .baf-fav-btn:hover { opacity: 1; transform: scale(1.15); }
    .baf-fav-btn.active { opacity: 1; filter: none; }
    /* 包裹层用类而非 inline style：保证字号/行高随容器，不会被B站 100px 字体污染；
       padding-left 与标题的 36px 对齐，给左上角 absolute 的分类图标徽章让位，避免同排重叠 */
    .baf-ending-wrap { margin-bottom: 6px; padding-left: 36px; }
    .baf-ending-badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      background: #ff4d4f; color: #fff; font-size: 10px; font-weight: 600;
    }
    /* 匹配度徽章包裹层（同理） */
    .baf-match-wrap { margin-top: 6px; }
    .baf-empty { text-align: center; padding: 60px 20px; color: var(--baf-text-faint); grid-column: 1 / -1; }

    /* ========== 右侧停靠面板模式（dock） ========== */
    /* 面板打开时收窄页面内容区（原列表保留可浏览） */
    body.baf-panel-open { padding-right: var(--baf-panel-w); }
    #baf-panel {
      position: fixed; top: var(--baf-top-offset, 0px); right: 0; bottom: 0; width: var(--baf-panel-w); max-width: 100vw;
      z-index: 9999; background: var(--baf-bg-subtle);
      box-shadow: -6px 0 24px rgba(0,0,0,0.15);
      display: flex; flex-direction: column;
      /* B站页面 html { font-size: 100px }（rem 方案），面板必须显式声明基础字号 */
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 13px; line-height: 1.5;
    }
    body:not(.baf-panel-open) #baf-panel { display: none; }
    /* 面板内工具栏：固定头部，不再 sticky，去掉页内留白 */
    #baf-panel .bili-activity-filter-toolbar {
      position: static; padding: 12px 14px; margin-bottom: 0; box-shadow: none;
      flex-shrink: 0; border-bottom: 1px solid var(--baf-border);
    }
    #baf-panel .baf-title { font-size: 14px; }
    #baf-panel .baf-stats { font-size: 11px; margin-bottom: 8px; }
    #baf-panel .baf-filter-row { margin-bottom: 6px; }
    #baf-panel .baf-filter-label { min-width: 34px; font-size: 11px; }
    #baf-panel .baf-filter-btn { padding: 2px 9px; font-size: 11px; }
    /* 窄面板下的输入区：搜索独占一行，类型与排序并排补位换行 */
    #baf-panel .baf-search-row { flex-wrap: wrap; }
    #baf-panel .baf-search-input { flex: 1 1 100%; font-size: 12px; }
    #baf-panel .baf-video-type-input { width: auto; flex: 1 1 150px; font-size: 11px; }
    #baf-panel .baf-select { flex: 1 1 130px; font-size: 11px; }
    /* 面板内列表：单列卡片、内部滚动，占满剩余高度 */
    #baf-panel .baf-activity-list {
      flex: 1; min-height: 0; overflow-y: auto;
      grid-template-columns: 1fr; gap: 10px; padding: 12px 14px;
    }
    #baf-panel .baf-activity-item { padding: 12px; }
    #baf-panel .baf-activity-item:hover { transform: none; }
    #baf-panel .baf-empty { padding: 40px 16px; }
    /* 收起面板后的右缘悬浮竖条 */
    #baf-fab {
      display: none; position: fixed; right: 0; top: 50%; transform: translateY(-50%);
      writing-mode: vertical-rl; letter-spacing: 3px; padding: 16px 8px;
      border: none; border-radius: 8px 0 0 8px;
      background: #fb7299; color: #fff; font-size: 13px; font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      cursor: pointer; z-index: 9998;
      box-shadow: -2px 2px 10px rgba(0,0,0,0.2);
    }
    body.baf-fab-show #baf-fab { display: block; }
    #baf-fab:hover { background: #f55d8a; }
  `;
  document.head.appendChild(style);

  // ========== 状态 ==========
  let activities = [];
  let settings = {
    videoType: '',
    favorites: [],
    panelDocked: false,   // 是否停靠到页面右侧（dock 模式）
    panelHidden: false,   // dock 模式下面板是否被收起（收起后显示悬浮竖条）
    filters: {
      category: 'all',
      time: 'all',
      reward: 'all',
      difficulty: 'all',
      search: '',
      sort: 'days-asc'
    }
  };

  const STORAGE_KEY = 'baf_settings';

  // ========== 工具函数（来自 BAFCore 三端共享，见根目录 core.js） ==========
  const { esc, debounce, daysLeft, formatDate, calcMatch, getMatchLevel, getMatchText, getCategoryIcon, fetchRawActivities, browserFetchOne, transformActivities } = BAFCore;

  // ========== 收藏 ==========
  let favMap = new Map(); // id -> {id, title, url, endDate}，数据源 settings.favorites（localStorage）

  function refreshFavMap() {
    favMap = new Map((settings.favorites || []).map(f => [f.id, f]));
  }

  function toggleFav(id) {
    const list = settings.favorites || [];
    const idx = list.findIndex(f => f.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      const a = activities.find(x => x.id === id);
      if (a) list.push({ id: a.id, title: a.title, url: a.url, endDate: a.endDate });
    }
    settings.favorites = list;
    refreshFavMap();
    saveSettings();
    renderActivityList();
  }

  // ========== 暗色模式检测 ==========
  // B站页面深色模式是站点自身实现的（不跟随系统），所以跟随页面实际背景：
  // 从 body → html 找第一个非透明背景色判定亮度；都没有时按浏览器默认白画布处理，
  // 仅当页面显式声明 color-scheme: dark 才用暗色（不退回系统偏好，避免白页面配黑 UI）。
  // 注意：rgba(0,0,0,0) 是"未声明背景"而非黑色，不能按亮度 0 误判成暗色。
  function applyDarkMode() {
    let dark = false;
    try {
      let lum = null;
      for (const el of [document.body, document.documentElement]) {
        if (!el) continue;
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg && bg.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const p = m[1].split(',').map(s => parseFloat(s));
        if (p.length < 3) continue;
        if (p.length >= 4 && p[3] === 0) continue; // 全透明，继续向上找
        lum = p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114;
        break;
      }
      if (lum !== null) {
        dark = lum < 128; // 页面有明确背景 → 跟随页面
      } else {
        // 页面未声明背景：浏览器默认以白色画布渲染，UI 也用浅色；
        // 仅当页面显式声明 color-scheme: dark 时才用暗色。
        // 不能退回系统偏好，否则系统深色 + 浅色页面会再次出现"黑块贴白纸"
        const scheme = String(getComputedStyle(document.documentElement).colorScheme || '').toLowerCase();
        dark = scheme.includes('dark');
      }
    } catch (e) { /* 忽略 */ }
    document.documentElement.classList.toggle('baf-dark', dark);
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = { ...settings, ...parsed };
        // 旧版本存档可能缺字段：先铺默认值再覆盖，保证高亮恢复与实际筛选一致
        settings.filters = { category: 'all', time: 'all', reward: 'all', difficulty: 'all', search: '', sort: 'days-asc', ...(settings.filters || {}) };
        if (!settings.favorites) settings.favorites = [];
      }
    } catch (e) { console.warn('读取设置失败', e); }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { console.warn('保存设置失败', e); }
  }

  // ========== 数据加载 ==========
  async function fetchActivities() {
    const items = await fetchRawActivities(browserFetchOne);
    return transformActivities(items);
  }


  // ========== 筛选逻辑 ==========
  function filterActivities() {
    let list = [...activities];
    const f = settings.filters;

    if (f.category !== 'all') {
      list = list.filter(a => (a.categories || [a.category]).includes(f.category));
    }

    if (f.time !== 'all') {
      list = list.filter(a => {
        const days = daysLeft(a.endDate);
        if (f.time === 'week') return days >= 0 && days <= 7;
        if (f.time === 'month') return days >= 0 && days <= 30;
        if (f.time === 'long') return days > 30;
        return true;
      });
    }

    if (f.reward !== 'all') {
      list = list.filter(a => a.rewardType === f.reward);
    }

    if (f.search) {
      const kw = f.search.toLowerCase();
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(kw) ||
        (a.tags || []).some(t => t.toLowerCase().includes(kw)) ||
        (a.desc || '').toLowerCase().includes(kw)
      );
    }

    list = list.filter(a => daysLeft(a.endDate) >= -1);

    if (f.sort === 'days-asc') {
      list.sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));
    } else if (f.sort === 'days-desc') {
      list.sort((a, b) => daysLeft(b.endDate) - daysLeft(a.endDate));
    } else if (f.sort === 'match-desc') {
      // 预计算匹配度，避免排序比较器中每个元素重复计算正则
      const matchCache = new Map(list.map(a => [a.id, calcMatch(a, settings.videoType) || 0]));
      list.sort((a, b) => (matchCache.get(b.id) || 0) - (matchCache.get(a.id) || 0));
    } else if (f.sort === 'fav-first') {
      list.sort((a, b) => (favMap.has(b.id) ? 1 : 0) - (favMap.has(a.id) ? 1 : 0) || daysLeft(a.endDate) - daysLeft(b.endDate));
    }

    return list;
  }

  // ========== 渲染 ==========
  function getAllCategories() {
    const set = new Set();
    activities.forEach(a => (a.categories || [a.category]).forEach(c => set.add(c)));
    return Array.from(set);
  }

  function findActivityContainer() {
    const listView = document.querySelector('.list-view');
    if (listView) return listView;
    const selectors = ['.activity-list', '[class*="activity-list"]', '[class*="ActivityList"]', '.list-container', '#app'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function renderToolbar() {
    if (document.getElementById('baf-toolbar')) return;

    const categories = getAllCategories();
    const toolbar = document.createElement('div');
    toolbar.id = 'baf-toolbar';
    toolbar.className = 'bili-activity-filter-toolbar';

    toolbar.innerHTML = `
      <div class="baf-header">
        <div class="baf-title">🏀 B站活动筛选助手</div>
        <div class="baf-header-actions">
          <button type="button" class="baf-icon-btn" id="baf-dock-btn" title="停靠到页面右侧">⇥</button>
          <button type="button" class="baf-icon-btn" id="baf-undock-btn" title="恢复页面内显示">⇤</button>
          <button type="button" class="baf-icon-btn" id="baf-close-btn" title="收起面板">✕</button>
        </div>
      </div>
      <div class="baf-stats">
        共 <strong id="baf-total">0</strong> 个活动 |
        进行中 <strong id="baf-active">0</strong> |
        本周截止 <strong id="baf-ending">0</strong> |
        筛选结果 <strong id="baf-result">0</strong>
      </div>
      <div class="baf-filter-row">
        <span class="baf-filter-label">分类</span>
        <div class="baf-filter-btns" id="baf-cat-btns">
          <span class="baf-filter-btn ${settings.filters.category === 'all' ? 'active' : ''}" data-cat="all">全部</span>
          ${categories.map(c => `<span class="baf-filter-btn ${settings.filters.category === c ? 'active' : ''}" data-cat="${c}">${c}</span>`).join('')}
        </div>
      </div>
      <div class="baf-filter-row">
        <span class="baf-filter-label">时间</span>
        <div class="baf-filter-btns" id="baf-time-btns">
          <span class="baf-filter-btn ${settings.filters.time === 'all' ? 'active' : ''}" data-time="all">全部</span>
          <span class="baf-filter-btn ${settings.filters.time === 'week' ? 'active' : ''}" data-time="week">本周截止</span>
          <span class="baf-filter-btn ${settings.filters.time === 'month' ? 'active' : ''}" data-time="month">本月截止</span>
          <span class="baf-filter-btn ${settings.filters.time === 'long' ? 'active' : ''}" data-time="long">长期</span>
        </div>
        <span class="baf-filter-label" style="margin-left:16px;">奖励</span>
        <div class="baf-filter-btns" id="baf-reward-btns">
          <span class="baf-filter-btn ${settings.filters.reward === 'all' ? 'active' : ''}" data-reward="all">全部</span>
          <span class="baf-filter-btn ${settings.filters.reward === '现金瓜分' ? 'active' : ''}" data-reward="现金瓜分">现金瓜分</span>
          <span class="baf-filter-btn ${settings.filters.reward === '固定奖金' ? 'active' : ''}" data-reward="固定奖金">固定奖金</span>
          <span class="baf-filter-btn ${settings.filters.reward === '流量扶持' ? 'active' : ''}" data-reward="流量扶持">流量扶持</span>
          <span class="baf-filter-btn ${settings.filters.reward === '游戏道具' ? 'active' : ''}" data-reward="游戏道具">游戏道具</span>
          <span class="baf-filter-btn ${settings.filters.reward === '周边抽奖' ? 'active' : ''}" data-reward="周边抽奖">周边抽奖</span>
        </div>
      </div>
      <div class="baf-search-row">
        <input type="text" class="baf-search-input" id="baf-search" placeholder="搜索活动名称、标签..." value="${esc(settings.filters.search || '')}" />
        <input type="text" class="baf-video-type-input" id="baf-video-type" placeholder="我的视频类型（如：影视解说）" value="${esc(settings.videoType || '')}" />
        <select class="baf-select" id="baf-sort">
          <option value="days-asc" ${settings.filters.sort === 'days-asc' ? 'selected' : ''}>截止时间（近→远）</option>
          <option value="fav-first" ${settings.filters.sort === 'fav-first' ? 'selected' : ''}>收藏优先</option>
          <option value="days-desc" ${settings.filters.sort === 'days-desc' ? 'selected' : ''}>截止时间（远→近）</option>
          <option value="match-desc" ${settings.filters.sort === 'match-desc' ? 'selected' : ''}>匹配度（高→低）</option>
        </select>
      </div>
    `;

    const container = findActivityContainer();
    if (container) {
      container.insertBefore(toolbar, container.firstChild);
    } else {
      document.body.appendChild(toolbar);
    }

    bindToolbarEvents();
  }

  function renderActivityList() {
    let listContainer = document.getElementById('baf-activity-list');
    if (!listContainer) {
      listContainer = document.createElement('div');
      listContainer.id = 'baf-activity-list';
      listContainer.className = 'baf-activity-list';
      const toolbar = document.getElementById('baf-toolbar');
      if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.insertBefore(listContainer, toolbar.nextSibling);
      }
    }

    const list = filterActivities();

    document.getElementById('baf-total').textContent = activities.length;
    document.getElementById('baf-active').textContent = activities.filter(a => daysLeft(a.endDate) >= 0).length;
    document.getElementById('baf-ending').textContent = activities.filter(a => { const d = daysLeft(a.endDate); return d >= 0 && d <= 7; }).length;
    document.getElementById('baf-result').textContent = list.length;

    if (list.length === 0) {
      listContainer.innerHTML = '<div class="baf-empty">🔍 没有找到符合条件的活动，试试调整筛选条件</div>';
      return;
    }

    const catColors = {
      '综合': '#e6f7ff,#1890ff', '游戏': '#f0f5ff,#2f54eb', '影视': '#fff7e6,#fa8c16',
      '音乐': '#f9f0ff,#722ed1', '知识': '#e6fffb,#13c2c2', '动画': '#fff0f6,#eb2f96',
      '美食': '#fcffe6,#a0d911', '亲子': '#fcffe6,#a0d911', '科技': '#f0f0f0,#595959',
      '生活': '#f6ffed,#52c41a', '鬼畜': '#fff1f0,#f5222d'
    };

    listContainer.innerHTML = list.map(a => {
      const days = daysLeft(a.endDate);
      const match = calcMatch(a, settings.videoType);
      const matchLevel = getMatchLevel(match);
      const isHighMatch = matchLevel === 'high';
      const isEndingSoon = days >= 0 && days <= 7;
      const isFav = favMap.has(a.id);
      const daysClass = days <= 7 ? 'baf-days-urgent' : days <= 30 ? 'baf-days-normal' : 'baf-days-long';
      const daysText = days < 0 ? '已结束' : days === 0 ? '今天截止' : `剩余${days}天`;
      const catIcon = getCategoryIcon(a.category, a.tags);
      const matchBadge = match === null ? '' : matchLevel === 'high'
        ? `<span class="baf-badge baf-badge-match" style="display:inline-block;">⭐ 高度匹配 ${match}%</span>`
        : matchLevel === 'medium'
          ? `<span class="baf-badge baf-badge-mid" style="display:inline-block;">🔹 中度匹配 ${match}%</span>`
          : `<span class="baf-badge baf-badge-low" style="display:inline-block;">匹配度 ${match}%</span>`;

      return `
        <div class="baf-activity-item ${isHighMatch ? 'baf-high-match' : ''} ${isFav ? 'is-fav' : ''}" data-url="${esc(a.url)}" data-id="${Number(a.id) || 0}">
          <button class="baf-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? '取消收藏' : '收藏此活动'}">${isFav ? '⭐' : '☆'}</button>
          ${isEndingSoon ? `<div class="baf-ending-wrap"><span class="baf-ending-badge">⏰ ${days === 0 ? '今天截止' : `${days}天后截止`}</span></div>` : ''}
          <div class="baf-cat-badge" style="background:${catIcon.bg};color:${catIcon.color};" title="${esc(catIcon.label)}">${catIcon.icon}</div>
          <div class="baf-activity-item-title">${esc(a.title)}</div>
          <div class="baf-activity-item-cats">
            ${(a.categories || [a.category]).map(c => {
              const colors = (catColors[c] || '#f0f0f0,#595959').split(',');
              return `<span class="baf-cat-tag" style="background:${colors[0]};color:${colors[1]};">${esc(c)}</span>`;
            }).join('')}
          </div>
          <div class="baf-activity-item-tags">
            ${(a.tags || []).slice(0, 4).map(t => `<span class="baf-activity-item-tag">${esc(t)}</span>`).join('')}
          </div>
          <div class="baf-activity-item-info">
            📅 ${formatDate(a.startDate)} - ${formatDate(a.endDate)}<br>
            🏷️ ${esc(a.submitTag)}<br>
            📂 ${esc(a.submitZone)}
          </div>
          <div class="baf-activity-item-reward">💰 ${esc(a.rewardType)}：${esc(a.rewardDesc)}</div>
          ${matchBadge ? `<div class="baf-match-wrap">${matchBadge}</div>` : ''}
          <div class="baf-activity-item-footer">
            <span class="${daysClass}">${daysText}</span>
            ${a.url ? '<span style="color:#fb7299;">点击投稿 →</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.baf-activity-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('baf-fav-btn')) {
          e.stopPropagation();
          toggleFav(Number(item.dataset.id));
          return;
        }
        const url = item.dataset.url;
        if (url) window.open(url, '_blank');
      });
    });
  }

  // ========== 顶栏避让 ==========
  // 右侧面板是 fixed 定位，若从 top:0 开始会盖住B站顶栏右侧的头像/大会员/消息。
  // 实测页面顶栏高度写入 CSS 变量；找不到时保持 0（退回原行为）。
  function updateTopOffset() {
    let offset = 0;
    const consider = (el) => {
      if (!el) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.top > 4 || r.height < 40 || r.height > 120) return;
      if (r.width < window.innerWidth * 0.6) return;
      offset = Math.max(offset, r.bottom);
    };
    // B站新版 / 旧版顶栏的常见选择器
    for (const sel of [
      '.bili-header__bar',
      '.bili-header-bar',
      '#bili-header .nav-bar',
      '.bili-header-container .bili-header-bar'
    ]) {
      consider(document.querySelector(sel));
    }
    // 兜底：扫描名字里带 header / nav 的顶部条
    if (!offset) {
      document.querySelectorAll('header, [class*="header"], [id*="header"], [class*="nav-bar"], [id*="nav"]')
        .forEach(consider);
    }
    // 再兜底：扫描 body 下前两层的宽幅顶部横条（不依赖 class 命名）
    if (!offset) {
      document.querySelectorAll('body > *, body > * > *').forEach(consider);
    }
    document.documentElement.style.setProperty('--baf-top-offset', Math.round(offset) + 'px');
  }

  // ========== 布局切换（页面内 / 右侧停靠） ==========
  // 停靠模式：工具栏+列表搬进 fixed 右侧面板，body 加 padding-right 收窄页面；
  // 同时不再隐藏B站原列表（baf-hide-original），左边照常浏览、右边筛选。
  function applyLayout() {
    updateTopOffset();
    const toolbar = document.getElementById('baf-toolbar');
    const list = document.getElementById('baf-activity-list');
    if (!toolbar || !list) return;

    const dockedOpen = !!settings.panelDocked && !settings.panelHidden;

    // 头部按钮按模式显隐：⇥ 仅页面内模式显示；⇤ / ✕ 仅停靠模式显示
    const dockBtn = document.getElementById('baf-dock-btn');
    const undockBtn = document.getElementById('baf-undock-btn');
    const closeBtn = document.getElementById('baf-close-btn');
    if (dockBtn) dockBtn.style.display = settings.panelDocked ? 'none' : '';
    if (undockBtn) undockBtn.style.display = settings.panelDocked ? '' : 'none';
    if (closeBtn) closeBtn.style.display = settings.panelDocked ? '' : 'none';

    if (settings.panelDocked) {
      let panel = document.getElementById('baf-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'baf-panel';
        panel.className = 'baf-panel';
        document.body.appendChild(panel);
      }
      panel.appendChild(toolbar);
      panel.appendChild(list);
      document.body.classList.remove('baf-hide-original');
    } else {
      const panel = document.getElementById('baf-panel');
      if (panel) panel.remove();
      const container = findActivityContainer();
      if (container) container.insertBefore(toolbar, container.firstChild);
      else document.body.appendChild(toolbar);
      toolbar.parentNode.insertBefore(list, toolbar.nextSibling);
      document.body.classList.add('baf-hide-original');
    }

    document.body.classList.toggle('baf-panel-open', dockedOpen);
    renderFab();
  }

  // 收起面板后的右侧悬浮竖条：点击重新展开
  function renderFab() {
    let fab = document.getElementById('baf-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.type = 'button';
      fab.id = 'baf-fab';
      fab.className = 'baf-fab';
      fab.title = '打开活动筛选面板';
      fab.textContent = '筛选助手';
      fab.addEventListener('click', () => {
        settings.panelHidden = false;
        saveSettings();
        applyLayout();
      });
      document.body.appendChild(fab);
    }
    document.body.classList.toggle('baf-fab-show', !!settings.panelDocked && !!settings.panelHidden);
  }

  // ========== 事件绑定 ==========
  const debouncedRender = debounce(() => renderActivityList());

  function bindToolbarEvents() {
    document.querySelectorAll('#baf-cat-btns .baf-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#baf-cat-btns .baf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settings.filters.category = btn.dataset.cat;
        saveSettings();
        renderActivityList();
      });
    });

    document.querySelectorAll('#baf-time-btns .baf-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#baf-time-btns .baf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settings.filters.time = btn.dataset.time;
        saveSettings();
        renderActivityList();
      });
    });

    document.querySelectorAll('#baf-reward-btns .baf-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#baf-reward-btns .baf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settings.filters.reward = btn.dataset.reward;
        saveSettings();
        renderActivityList();
      });
    });

    document.getElementById('baf-search').addEventListener('input', (e) => {
      settings.filters.search = e.target.value;
      debouncedRender();
    });

    document.getElementById('baf-video-type').addEventListener('input', (e) => {
      settings.videoType = e.target.value;
      saveSettings();
      debouncedRender();
    });

    document.getElementById('baf-sort').addEventListener('change', (e) => {
      settings.filters.sort = e.target.value;
      saveSettings();
      renderActivityList();
    });

    // 布局开关：停靠到右侧 / 恢复页面内 / 收起面板
    document.getElementById('baf-dock-btn').addEventListener('click', () => {
      settings.panelDocked = true;
      settings.panelHidden = false;
      saveSettings();
      applyLayout();
    });
    document.getElementById('baf-undock-btn').addEventListener('click', () => {
      settings.panelDocked = false;
      settings.panelHidden = false;
      saveSettings();
      applyLayout();
    });
    document.getElementById('baf-close-btn').addEventListener('click', () => {
      settings.panelHidden = true;
      saveSettings();
      applyLayout();
    });
  }

  // ========== 初始化 ==========
  async function init() {
    console.log('[B站活动筛选助手] 正在初始化...');
    loadSettings();
    refreshFavMap();
    applyDarkMode();
    const themeObserver = new MutationObserver(applyDarkMode);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // 窗口尺寸变化时重新测量顶栏高度，保持面板不遮挡顶部信息
    window.addEventListener('resize', debounce(updateTopOffset, 150));

    const loading = document.createElement('div');
    loading.id = 'baf-loading';
    loading.className = 'baf-loading';
    loading.innerHTML = '<div class="baf-loading-spinner"></div><div>正在加载活动数据...</div>';
    document.body.appendChild(loading);

    try {
      activities = await fetchActivities();
    } catch (err) {
      console.error('[B站活动筛选助手] 数据加载失败:', err);
      if (loading.parentNode) loading.parentNode.removeChild(loading);
      const errEl = document.createElement('div');
      errEl.className = 'baf-loading';
      errEl.innerHTML = '⚠️ 活动数据加载失败，请刷新页面重试';
      document.body.appendChild(errEl);
      return;
    }

    if (loading.parentNode) loading.parentNode.removeChild(loading);

    if (activities.length === 0) {
      const errEl = document.createElement('div');
      errEl.className = 'baf-loading';
      errEl.innerHTML = '⚠️ 未获取到活动数据，请刷新页面重试';
      document.body.appendChild(errEl);
      return;
    }

    console.log(`[B站活动筛选助手] 加载到 ${activities.length} 个活动`);

    renderToolbar();
    renderActivityList();
    applyLayout();
  }

  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }
})();
