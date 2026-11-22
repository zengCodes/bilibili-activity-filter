/**
 * B站活动筛选助手 - Content Script
 * 注入B站活动列表页面，提供筛选、排序、搜索、卡片增强功能
 */

(function () {
  'use strict';

  // ========== 状态 ==========
  let activities = [];
  let settings = {
    videoType: '',
    filters: {
      category: 'all',
      time: 'all',
      reward: 'all',
      difficulty: 'all',
      search: '',
      sort: 'days-asc'
    }
  };

  // ========== 工具函数（来自 BAFCore 三端共享，见根目录 core.js） ==========
  const { esc, debounce, daysLeft, formatDate, calcMatch, getMatchLevel, getCategoryIcon, fetchRawActivities, browserFetchOne, transformActivities } = BAFCore;

  // ========== 收藏 ==========
  let favMap = new Map(); // id -> {id, title, url, endDate}，数据源 settings.savedActivities（chrome.storage.sync）

  function refreshFavMap() {
    favMap = new Map((settings.savedActivities || []).map(f => [f.id, f]));
  }

  async function toggleFav(id) {
    const list = settings.savedActivities || [];
    const idx = list.findIndex(f => f.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      const a = activities.find(x => x.id === id);
      if (a) list.push({ id: a.id, title: a.title, url: a.url, endDate: a.endDate });
    }
    settings.savedActivities = list;
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

  // ========== 数据加载 ==========
  async function loadData() {
    try {
      // 从background获取设置
      const settingsResp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (settingsResp.success && settingsResp.settings) {
        settings = { ...settings, ...settingsResp.settings };
        // 旧版本存档可能缺字段：先铺默认值再覆盖，保证高亮恢复与实际筛选一致
        settings.filters = { category: 'all', time: 'all', reward: 'all', difficulty: 'all', search: '', sort: 'days-asc', ...(settings.filters || {}) };
      }

      // 从background获取活动数据
      const resp = await chrome.runtime.sendMessage({ type: 'FETCH_ACTIVITIES' });
      if (resp.success) {
        activities = resp.data;
        if (resp.stale) console.warn('[B站活动筛选助手] 使用的是过期缓存数据');
        refreshFavMap();
        return true;
      }
      throw new Error(resp.error || '获取失败');
    } catch (err) {
      console.error('[B站活动筛选助手] 数据加载失败:', err);
      // fallback: 直接在页面上下文调用API（core.js 本地转换，与正常路径推断一致）
      try {
        activities = await fetchInPage();
        return true;
      } catch (e) {
        console.error('[B站活动筛选助手] fallback也失败:', e);
        return false;
      }
    }
  }

  // fallback: 在页面上下文中直接调用B站API并用 BAFCore 转换
  async function fetchInPage() {
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

    if (f.difficulty !== 'all') {
      list = list.filter(a => a.difficulty === f.difficulty);
    }

    if (f.search) {
      const kw = f.search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(kw) ||
        a.tags.some(t => t.toLowerCase().includes(kw)) ||
        a.desc.toLowerCase().includes(kw)
      );
    }

    list = list.filter(a => daysLeft(a.endDate) >= -1);

    // 排序
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
  function renderToolbar() {
    // 避免重复注入
    if (document.getElementById('baf-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'baf-toolbar';
    toolbar.className = 'bili-activity-filter-toolbar';

    const categories = getAllCategories();

    toolbar.innerHTML = `
      <div class="baf-header">
        <div class="baf-title"><img src="${chrome.runtime.getURL('icons/icon48.png')}" class="baf-title-logo" alt="logo"> B站活动筛选助手</div>
        <div class="baf-stats">
          共 <strong id="baf-total">0</strong> 个活动 |
          进行中 <strong id="baf-active">0</strong> |
          本周截止 <strong id="baf-ending">0</strong> |
          筛选结果 <strong id="baf-result">0</strong>
        </div>
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
        </div>
      </div>
      <div class="baf-search-row">
        <input type="text" class="baf-search-input" id="baf-search" placeholder="搜索活动名称、标签..." value="${esc(settings.filters.search || '')}" />
        <input type="text" class="baf-video-type-input" id="baf-video-type" placeholder="我的视频类型（如：影视解说）" value="${esc(settings.videoType || '')}" />
        <select class="baf-select" id="baf-sort">
          <option value="days-asc" ${settings.filters.sort === 'days-asc' ? 'selected' : ''}>截止时间（近→远）</option>
          <option value="days-desc" ${settings.filters.sort === 'days-desc' ? 'selected' : ''}>截止时间（远→近）</option>
          <option value="match-desc" ${settings.filters.sort === 'match-desc' ? 'selected' : ''}>匹配度（高→低）</option>
          <option value="fav-first" ${settings.filters.sort === 'fav-first' ? 'selected' : ''}>收藏优先</option>
        </select>
      </div>
    `;

    // 插入到页面内容区域
    const container = findActivityContainer();
    if (container) {
      // 插入到list-view内部的最前面
      container.insertBefore(toolbar, container.firstChild);
    } else {
      document.body.appendChild(toolbar);
    }

    bindToolbarEvents();
  }

  function getAllCategories() {
    const set = new Set();
    activities.forEach(a => (a.categories || [a.category]).forEach(c => set.add(c)));
    return Array.from(set);
  }

  function findActivityContainer() {
    // B站活动页面结构：.list-view > .list-scroll-box > .list-box > .activity-item
    const listView = document.querySelector('.list-view');
    if (listView) return listView;

    // fallback
    const selectors = [
      '.activity-list',
      '[class*="activity-list"]',
      '[class*="ActivityList"]',
      '.list-container',
      '#app'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function renderActivityList() {
    let listContainer = document.getElementById('baf-activity-list');
    if (!listContainer) {
      listContainer = document.createElement('div');
      listContainer.id = 'baf-activity-list';
      listContainer.className = 'baf-activity-list';
      const toolbar = document.getElementById('baf-toolbar');
      if (toolbar && toolbar.parentNode) {
        // 插入到工具栏之后
        toolbar.parentNode.insertBefore(listContainer, toolbar.nextSibling);
      }
    }

    const list = filterActivities();

    // 更新统计
    document.getElementById('baf-total').textContent = activities.length;
    document.getElementById('baf-active').textContent = activities.filter(a => daysLeft(a.endDate) >= 0).length;
    document.getElementById('baf-ending').textContent = activities.filter(a => { const d = daysLeft(a.endDate); return d >= 0 && d <= 7; }).length;
    document.getElementById('baf-result').textContent = list.length;

    if (list.length === 0) {
      listContainer.innerHTML = '<div class="baf-empty">🔍 没有找到符合条件的活动，试试调整筛选条件</div>';
      return;
    }

    listContainer.innerHTML = list.map(a => {
      const days = daysLeft(a.endDate);
      const match = calcMatch(a, settings.videoType);
      const matchLevel = getMatchLevel(match);
      const isHighMatch = matchLevel === 'high';
      const isEndingSoon = days >= 0 && days <= 7;
      const isFav = favMap.has(a.id);
      const daysClass = days <= 7 ? 'baf-days-urgent' : days <= 30 ? 'baf-days-normal' : 'baf-days-long';
      const daysText = days < 0 ? '已结束' : days === 0 ? '今天截止' : `剩余${days}天`;

      // 分类图标徽章（取主分类）
      const catIcon = getCategoryIcon(a.category, a.tags);

      const catColors = {
        '综合': '#e6f7ff,#1890ff', '游戏': '#f0f5ff,#2f54eb', '影视': '#fff7e6,#fa8c16',
        '音乐': '#f9f0ff,#722ed1', '知识': '#e6fffb,#13c2c2', '动画': '#fff0f6,#eb2f96',
        '美食': '#fcffe6,#a0d911', '亲子': '#fcffe6,#a0d911', '科技': '#f0f0f0,#595959',
        '鬼畜': '#fff1f0,#f5222d'
      };

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
            ${a.tags.slice(0, 4).map(t => `<span class="baf-activity-item-tag">${esc(t)}</span>`).join('')}
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

    // 绑定点击事件（星标按钮切换收藏，其余区域打开活动页）
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

  // ========== 事件绑定 ==========
  function bindToolbarEvents() {
    // 分类筛选
    document.querySelectorAll('#baf-cat-btns .baf-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#baf-cat-btns .baf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settings.filters.category = btn.dataset.cat;
        saveSettings();
        renderActivityList();
      });
    });

    // 时间筛选
    document.querySelectorAll('#baf-time-btns .baf-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#baf-time-btns .baf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settings.filters.time = btn.dataset.time;
        saveSettings();
        renderActivityList();
      });
    });

    // 奖励筛选
    document.querySelectorAll('#baf-reward-btns .baf-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#baf-reward-btns .baf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settings.filters.reward = btn.dataset.reward;
        saveSettings();
        renderActivityList();
      });
    });

    // 搜索（防抖）
    const debouncedRender = debounce(() => renderActivityList());
    document.getElementById('baf-search').addEventListener('input', (e) => {
      settings.filters.search = e.target.value;
      debouncedRender();
    });

    // 视频类型（防抖）
    document.getElementById('baf-video-type').addEventListener('input', (e) => {
      settings.videoType = e.target.value;
      saveSettings();
      debouncedRender();
    });

    // 排序
    document.getElementById('baf-sort').addEventListener('change', (e) => {
      settings.filters.sort = e.target.value;
      saveSettings();
      renderActivityList();
    });
  }

  function saveSettings() {
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
  }

  // ========== 初始化 ==========
  async function init() {
    console.log('[B站活动筛选助手] 正在初始化...');

    // 暗色模式：跟随页面背景；B站切换主题时（html/body class 变化）自动重新检测
    applyDarkMode();
    const themeObserver = new MutationObserver(applyDarkMode);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // 显示加载状态
    const loading = document.createElement('div');
    loading.id = 'baf-loading';
    loading.className = 'baf-loading';
    loading.innerHTML = '<div class="baf-loading-spinner"></div><div>正在加载活动数据...</div>';
    document.body.appendChild(loading);

    const success = await loadData();

    // 移除加载状态
    if (loading.parentNode) loading.parentNode.removeChild(loading);

    if (!success || activities.length === 0) {
      const err = document.createElement('div');
      err.className = 'baf-loading';
      err.innerHTML = '⚠️ 活动数据加载失败，请刷新页面重试';
      document.body.appendChild(err);
      return;
    }

    console.log(`[B站活动筛选助手] 加载到 ${activities.length} 个活动`);

    // 渲染工具栏和活动列表
    renderToolbar();
    renderActivityList();

    // 隐藏原页面的活动列表（如果存在）
    document.body.classList.add('baf-hide-original');
  }

  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // SPA页面可能需要延迟
    setTimeout(init, 1500);
  }
})();
