// ==UserScript==
// @name         B站活动筛选助手
// @name:zh-CN   B站活动筛选助手
// @namespace    https://github.com/zengCodes/bilibili-activity-filter
// @version      0.0.0-src（构建时由 scripts/build.js 注入 package.json 版本号）
// @description  实时获取B站173+投稿活动，智能匹配你的视频类型，支持分类/时间/奖励/门槛筛选、匹配度排序、截止提醒
// @description:zh-CN 实时获取B站173+投稿活动，智能匹配你的视频类型，支持分类/时间/奖励/门槛筛选、匹配度排序、截止提醒
// @author       zengCodes
// @match        https://www.bilibili.com/blackboard/era/reward-activity-list-page.html*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // __BAF_CORE__

  // ========== 注入样式 ==========
  const style = document.createElement('style');
  style.textContent = `
    .bili-activity-filter-toolbar {
      position: sticky; top: 0; z-index: 1000; background: #fff;
      border-bottom: 2px solid #fb7299; padding: 12px 20px; margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    .baf-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .baf-title { font-size: 15px; font-weight: 700; color: #fb7299; display: flex; align-items: center; gap: 6px; }
    .baf-stats { font-size: 12px; color: #61666d; }
    .baf-stats strong { color: #fb7299; font-size: 14px; }
    .baf-filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .baf-filter-label { font-size: 12px; color: #9499a0; font-weight: 600; min-width: 50px; flex-shrink: 0; }
    .baf-filter-btns { display: flex; flex-wrap: wrap; gap: 6px; }
    .baf-filter-btn {
      padding: 3px 10px; border: 1px solid #e3e5e7; border-radius: 12px; background: #fff;
      font-size: 12px; color: #61666d; cursor: pointer; transition: all 0.15s; user-select: none;
    }
    .baf-filter-btn:hover { border-color: #fb7299; color: #fb7299; }
    .baf-filter-btn.active { background: #fb7299; border-color: #fb7299; color: #fff; }
    .baf-search-row { display: flex; gap: 8px; align-items: center; }
    .baf-search-input { flex: 1; padding: 6px 12px; border: 1px solid #e3e5e7; border-radius: 6px; font-size: 13px; outline: none; }
    .baf-search-input:focus { border-color: #fb7299; }
    .baf-select { padding: 6px 10px; border: 1px solid #e3e5e7; border-radius: 6px; font-size: 12px; background: #fff; cursor: pointer; outline: none; }
    .baf-video-type-input { width: 200px; padding: 6px 10px; border: 1px solid #ffd6e0; border-radius: 6px; font-size: 12px; outline: none; background: #fff5f7; }
    .baf-video-type-input:focus { border-color: #fb7299; }
    .baf-loading { text-align: center; padding: 40px; color: #9499a0; font-size: 14px; }
    .baf-loading-spinner {
      display: inline-block; width: 24px; height: 24px; border: 3px solid #f0f0f0;
      border-top-color: #fb7299; border-radius: 50%; animation: baf-spin 0.8s linear infinite; margin-bottom: 8px;
    }
    @keyframes baf-spin { to { transform: rotate(360deg); } }
    .baf-hide-original .list-scroll-box { display: none !important; }
    .baf-activity-list {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px; padding: 0 20px 20px;
    }
    .baf-activity-item {
      background: #fff; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s;
      border: 1px solid #e3e5e7; position: relative; overflow: hidden;
    }
    .baf-cat-badge {
      position: absolute; top: 8px; left: 8px; width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 5;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .baf-activity-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: #fb7299; }
    .baf-activity-item-title { font-size: 14px; font-weight: 600; color: #18191c; margin-bottom: 6px; line-height: 1.4; padding-left: 36px; }
    .baf-activity-item-cats { display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap; }
    .baf-cat-tag { padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .baf-activity-item-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .baf-activity-item-tag { padding: 1px 6px; background: #f4f5f7; border-radius: 3px; font-size: 10px; color: #61666d; }
    .baf-activity-item-info { font-size: 11px; color: #9499a0; line-height: 1.6; }
    .baf-activity-item-reward { margin-top: 8px; padding: 6px 8px; background: #fffbe6; border-radius: 4px; font-size: 11px; color: #ad8b00; }
    .baf-activity-item-footer { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .baf-days-urgent { color: #ff4d4f; font-weight: 600; }
    .baf-days-normal { color: #52c41a; }
    .baf-days-long { color: #1890ff; }
    .baf-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: #fff; }
    .baf-badge-match { background: #52c41a; }
    .baf-badge-mid { background: #1890ff; }
    .baf-badge-low { background: #9499a0; }
    .baf-high-match { border: 2px solid #52c41a !important; background: linear-gradient(135deg, #f6ffed 0%, #fff 60%) !important; }
    .baf-empty { text-align: center; padding: 60px 20px; color: #9499a0; grid-column: 1 / -1; }
  `;
  document.head.appendChild(style);

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

  const STORAGE_KEY = 'baf_settings';

  // ========== 工具函数（来自 BAFCore 三端共享，见根目录 core.js） ==========
  const { esc, debounce, daysLeft, formatDate, calcMatch, getMatchLevel, getMatchText, getCategoryIcon, fetchRawActivities, browserFetchOne, transformActivities } = BAFCore;

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = { ...settings, ...parsed };
        if (!settings.filters) settings.filters = {};
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
      list.sort((a, b) => (calcMatch(b, settings.videoType) || 0) - (calcMatch(a, settings.videoType) || 0));
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
          <span class="baf-filter-btn active" data-cat="all">全部</span>
          ${categories.map(c => `<span class="baf-filter-btn" data-cat="${c}">${c}</span>`).join('')}
        </div>
      </div>
      <div class="baf-filter-row">
        <span class="baf-filter-label">时间</span>
        <div class="baf-filter-btns" id="baf-time-btns">
          <span class="baf-filter-btn active" data-time="all">全部</span>
          <span class="baf-filter-btn" data-time="week">本周截止</span>
          <span class="baf-filter-btn" data-time="month">本月截止</span>
          <span class="baf-filter-btn" data-time="long">长期</span>
        </div>
        <span class="baf-filter-label" style="margin-left:16px;">奖励</span>
        <div class="baf-filter-btns" id="baf-reward-btns">
          <span class="baf-filter-btn active" data-reward="all">全部</span>
          <span class="baf-filter-btn" data-reward="现金瓜分">现金瓜分</span>
          <span class="baf-filter-btn" data-reward="固定奖金">固定奖金</span>
          <span class="baf-filter-btn" data-reward="流量扶持">流量扶持</span>
          <span class="baf-filter-btn" data-reward="游戏道具">游戏道具</span>
          <span class="baf-filter-btn" data-reward="周边抽奖">周边抽奖</span>
        </div>
      </div>
      <div class="baf-search-row">
        <input type="text" class="baf-search-input" id="baf-search" placeholder="搜索活动名称、标签..." />
        <input type="text" class="baf-video-type-input" id="baf-video-type" placeholder="我的视频类型（如：影视解说）" value="${esc(settings.videoType || '')}" />
        <select class="baf-select" id="baf-sort">
          <option value="days-asc">截止时间（近→远）</option>
          <option value="days-desc">截止时间（远→近）</option>
          <option value="match-desc">匹配度（高→低）</option>
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
      const daysClass = days <= 7 ? 'baf-days-urgent' : days <= 30 ? 'baf-days-normal' : 'baf-days-long';
      const daysText = days < 0 ? '已结束' : days === 0 ? '今天截止' : `剩余${days}天`;
      const catIcon = getCategoryIcon(a.category, a.tags);
      const matchBadge = match === null ? '' : matchLevel === 'high'
        ? `<span class="baf-badge baf-badge-match" style="display:inline-block;">⭐ 高度匹配 ${match}%</span>`
        : matchLevel === 'medium'
          ? `<span class="baf-badge baf-badge-mid" style="display:inline-block;">🔹 中度匹配 ${match}%</span>`
          : `<span class="baf-badge baf-badge-low" style="display:inline-block;">匹配度 ${match}%</span>`;

      return `
        <div class="baf-activity-item ${isHighMatch ? 'baf-high-match' : ''}" data-url="${esc(a.url)}" data-id="${Number(a.id) || 0}">
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
          ${matchBadge ? `<div style="margin-top:6px;">${matchBadge}</div>` : ''}
          <div class="baf-activity-item-footer">
            <span class="${daysClass}">${daysText}</span>
            ${a.url ? '<span style="color:#fb7299;">点击投稿 →</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.baf-activity-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) window.open(url, '_blank');
      });
    });
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
  }

  // ========== 初始化 ==========
  async function init() {
    console.log('[B站活动筛选助手] 正在初始化...');
    loadSettings();

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
    document.body.classList.add('baf-hide-original');
  }

  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500);
  }
})();
