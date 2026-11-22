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

  // ========== 工具函数 ==========
  // HTML 转义：所有来自B站API的字符串插入模板前必须经过此函数
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function today() {
    return new Date(); // 每次现取，避免页面跨午夜后剩余天数全错
  }

  // 防抖：搜索/输入停止 300ms 后才触发重渲染
  function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function daysLeft(endDate) {
    const end = new Date(endDate);
    return Math.ceil((end - today()) / (1000 * 60 * 60 * 24));
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function calcMatch(activity, userInput) {
    if (!userInput || !userInput.trim()) return null;
    const input = userInput.toLowerCase().trim();
    const keywords = input.split(/[\s,，、/]+/).filter(k => k.length >= 1);
    let score = 0;
    let maxScore = 0;

    const title = activity.title.toLowerCase();
    const tags = activity.tags.map(t => t.toLowerCase());
    const suitable = (activity.suitableFor || []).map(s => s.toLowerCase());
    const desc = activity.desc.toLowerCase();

    keywords.forEach(kw => {
      maxScore += 29;
      if (title.includes(kw)) score += 10;
      if (tags.some(t => t.includes(kw) || kw.includes(t))) score += 7;
      if (suitable.some(s => s.includes(kw) || kw.includes(s))) score += 8;
      if (desc.includes(kw)) score += 4;
    });

    return maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
  }

  // ========== 数据加载 ==========
  async function loadData() {
    try {
      // 从background获取设置
      const settingsResp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (settingsResp.success && settingsResp.settings) {
        settings = { ...settings, ...settingsResp.settings };
        if (!settings.filters) settings.filters = {};
      }

      // 从background获取活动数据
      const resp = await chrome.runtime.sendMessage({ type: 'FETCH_ACTIVITIES' });
      if (resp.success) {
        activities = resp.data;
        return true;
      }
      throw new Error(resp.error || '获取失败');
    } catch (err) {
      console.error('[B站活动筛选助手] 数据加载失败:', err);
      // fallback: 直接在页面上下文调用API
      try {
        const data = await fetchInPage();
        activities = data;
        return true;
      } catch (e) {
        console.error('[B站活动筛选助手] fallback也失败:', e);
        return false;
      }
    }
  }

  // fallback: 在页面上下文中直接调用B站API
  async function fetchInPage() {
    const PAGE_SIZE = 50;
    const first = await fetch(`https://api.bilibili.com/x/activity_components/video_activity/hot_activity?pn=1&ps=${PAGE_SIZE}&web_location=888.139379`, { credentials: 'include' });
    const firstJson = await first.json();
    const total = firstJson.data?.page?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    let items = [...(firstJson.data?.list || [])];

    if (totalPages > 1) {
      const promises = [];
      for (let pn = 2; pn <= totalPages; pn++) {
        promises.push(fetch(`https://api.bilibili.com/x/activity_components/video_activity/hot_activity?pn=${pn}&ps=${PAGE_SIZE}&web_location=888.139379`, { credentials: 'include' }).then(r => r.json()));
      }
      const pages = await Promise.all(promises);
      pages.forEach(p => { if (p.data?.list) items = items.concat(p.data.list); });
    }

    // 抓到原始数据后交给 background 做完整推断转换，保证筛选/匹配与正常路径一致
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'TRANSFORM_ACTIVITIES', payload: items });
      if (resp && resp.success && Array.isArray(resp.data)) return resp.data;
      throw new Error(resp?.error || '转换失败');
    } catch (e) {
      console.warn('[B站活动筛选助手] background转换不可用，使用极简兜底（筛选/匹配功能受限）:', e);
      return items.map(minimalTransform);
    }
  }

  // 极简兜底转换：分类/奖励/匹配推断全部缺失，仅保证列表可展示
  function minimalTransform(item, i) {
    const name = item.name || '';
    return {
      id: item.id || i + 1,
      title: name,
      category: '综合',
      categories: ['综合'],
      tags: item.hot_labels || [],
      startDate: item.stime ? formatTimestamp(item.stime) : '',
      endDate: item.etime ? formatTimestamp(item.etime) : '',
      rewardType: '混合',
      rewardDesc: '详见活动页面',
      submitZone: '生活区',
      submitTag: `#${name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') || '活动'}#`,
      url: item.act_url || '',
      cover: item.cover || '',
      difficulty: '低',
      competition: '低',
      suitableFor: [],
      desc: `${name}活动，${(item.hot_labels || []).join('、')}。详见活动页面。`
    };
  }

  // Unix 时间戳 → 本地时区日期（YYYY-MM-DD），与 Web 版/油猴保持一致
  function formatTimestamp(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      list.sort((a, b) => (calcMatch(b, settings.videoType) || 0) - (calcMatch(a, settings.videoType) || 0));
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

  function getCategoryIcon(category, tags) {
    const tagText = (tags || []).join('').toLowerCase();
    // 鬼畜/鸡你太美相关活动用特殊标识
    if (/鬼畜|黄绿合战|音mad|鬼畜调教|鸡你太美|唱跳|rap|篮球/.test(tagText) || category === '鬼畜') {
      return { icon: '🏀', label: '鸡你太美', bg: '#fff1f0', color: '#f5222d' };
    }
    const map = {
      '游戏': { icon: '🎮', label: '游戏', bg: '#f0f5ff', color: '#2f54eb' },
      '动画': { icon: '🎬', label: '动画', bg: '#fff0f6', color: '#eb2f96' },
      '影视': { icon: '🎥', label: '影视', bg: '#fff7e6', color: '#fa8c16' },
      '音乐': { icon: '🎵', label: '音乐', bg: '#f9f0ff', color: '#722ed1' },
      '知识': { icon: '📚', label: '知识', bg: '#e6fffb', color: '#13c2c2' },
      '美食': { icon: '🍜', label: '美食', bg: '#fcffe6', color: '#a0d911' },
      '亲子': { icon: '👨‍👩‍👧', label: '亲子', bg: '#fcffe6', color: '#a0d911' },
      '科技': { icon: '💻', label: '科技', bg: '#f0f0f0', color: '#595959' },
      '综合': { icon: '✨', label: '综合', bg: '#e6f7ff', color: '#1890ff' }
    };
    return map[category] || { icon: '📌', label: category, bg: '#f0f0f0', color: '#595959' };
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
      const matchLevel = match === null ? null : match >= 50 ? 'high' : match >= 25 ? 'medium' : 'low';
      const isHighMatch = matchLevel === 'high';
      const isEndingSoon = days >= 0 && days <= 7;
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
        <div class="baf-activity-item ${isHighMatch ? 'baf-high-match' : ''} ${isEndingSoon ? 'baf-ending-soon' : ''}" data-url="${esc(a.url)}" data-id="${Number(a.id) || 0}">
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
          ${matchBadge ? `<div style="margin-top:6px;">${matchBadge}</div>` : ''}
          <div class="baf-activity-item-footer">
            <span class="${daysClass}">${daysText}</span>
            ${a.url ? '<span style="color:#fb7299;">点击投稿 →</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    listContainer.querySelectorAll('.baf-activity-item').forEach(item => {
      item.addEventListener('click', () => {
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
