// ==UserScript==
// @name         B站活动筛选助手
// @name:zh-CN   B站活动筛选助手
// @namespace    https://github.com/zengCodes/bilibili-activity-filter
// @version      1.0.3
// @description  实时获取B站173+投稿活动，智能匹配你的视频类型，支持分类/时间/奖励/门槛筛选、匹配度排序、截止提醒
// @description:zh-CN 实时获取B站173+投稿活动，智能匹配你的视频类型，支持分类/时间/奖励/门槛筛选、匹配度排序、截止提醒
// @author       zengCodes
// @match        https://www.bilibili.com/blackboard/era/reward-activity-list-page.html*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

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

  const TODAY = new Date();
  const STORAGE_KEY = 'baf_settings';

  // ========== 工具函数 ==========
  function daysLeft(endDate) {
    const end = new Date(endDate);
    return Math.ceil((end - TODAY) / (1000 * 60 * 60 * 24));
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

    const title = (activity.title || '').toLowerCase();
    const tags = (activity.tags || []).map(t => t.toLowerCase());
    const suitable = (activity.suitableFor || []).map(s => s.toLowerCase());
    const desc = (activity.desc || '').toLowerCase();

    keywords.forEach(kw => {
      maxScore += 29;
      if (title.includes(kw)) score += 10;
      if (tags.some(t => t.includes(kw) || kw.includes(t))) score += 7;
      if (suitable.some(s => s.includes(kw) || kw.includes(s))) score += 8;
      if (desc.includes(kw)) score += 4;
    });

    return maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
  }

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
    const PAGE_SIZE = 50;
    const API_URL = 'https://api.bilibili.com/x/activity_components/video_activity/hot_activity';

    const first = await fetch(`${API_URL}?pn=1&ps=${PAGE_SIZE}&web_location=888.139379`, { credentials: 'include' });
    const firstJson = await first.json();
    const total = firstJson.data?.page?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    let items = [...(firstJson.data?.list || [])];

    if (totalPages > 1) {
      const promises = [];
      for (let pn = 2; pn <= totalPages; pn++) {
        promises.push(fetch(`${API_URL}?pn=${pn}&ps=${PAGE_SIZE}&web_location=888.139379`, { credentials: 'include' }).then(r => r.json()));
      }
      const pages = await Promise.all(promises);
      pages.forEach(p => { if (p.data?.list) items = items.concat(p.data.list); });
    }

    return items.map((item, i) => {
      const tags = item.hot_labels || [];
      const tagText = tags.join('').toLowerCase();
      const name = item.name || '';

      // 推断分类
      let categories = ['综合'];
      if (/游戏|手游|网游|电竞|steam|主机游戏/.test(tagText + name)) categories.push('游戏');
      if (/动画|动漫|国创|番剧|二次元|鬼畜|音mad|黄绿合战/.test(tagText + name)) categories.push('动画');
      if (/影视|电影|电视剧|综艺|纪录片|剪辑|解说|混剪/.test(tagText + name)) categories.push('影视');
      if (/音乐|翻唱|原创|演奏|声乐|说唱|rap|唱跳/.test(tagText + name)) categories.push('音乐');
      if (/知识|科普|科技|数码|编程|人工智能|AI|学习|教育|读书/.test(tagText + name)) categories.push('知识');
      if (/美食|吃播|探店|做饭|烹饪|零食/.test(tagText + name)) categories.push('美食');
      if (/亲子|萌娃|育儿|家庭/.test(tagText + name)) categories.push('亲子');
      if (/生活|vlog|日常|旅行|时尚|美妆|健身|动物|宠物/.test(tagText + name)) categories.push('生活');

      // 推断奖励类型
      let rewardType = '混合';
      if (/现金|奖金|瓜分|红包|元\b|万元/.test(tagText + name)) rewardType = '现金瓜分';
      else if (/流量|扶持|推荐|曝光|热门/.test(tagText + name)) rewardType = '流量扶持';
      else if (/奖品|周边|礼品|实物|抽奖|礼包/.test(tagText + name)) rewardType = '周边抽奖';

      // 推断投稿分区
      let submitZone = '生活区';
      if (categories.includes('游戏')) submitZone = '游戏区';
      else if (categories.includes('动画') || categories.includes('影视')) submitZone = '动画区';
      else if (categories.includes('音乐')) submitZone = '音乐区';
      else if (categories.includes('知识')) submitZone = '知识区';
      else if (categories.includes('美食')) submitZone = '美食区';

      return {
        id: item.id || i + 1,
        title: name,
        category: categories[0],
        categories: [...new Set(categories)],
        tags: tags,
        startDate: item.stime ? new Date(item.stime * 1000).toISOString().slice(0, 10) : '',
        endDate: item.etime ? new Date(item.etime * 1000).toISOString().slice(0, 10) : '',
        rewardType: rewardType,
        rewardDesc: '详见活动页面',
        submitZone: submitZone,
        submitTag: `#${name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')}#`,
        url: item.act_url || '',
        cover: item.cover || '',
        difficulty: '低',
        competition: '低',
        suitableFor: [],
        desc: name
      };
    });
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

  function getCategoryIcon(category, tags) {
    const tagText = (tags || []).join('').toLowerCase();
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
      '生活': { icon: '🌟', label: '生活', bg: '#f6ffed', color: '#52c41a' },
      '综合': { icon: '✨', label: '综合', bg: '#e6f7ff', color: '#1890ff' }
    };
    return map[category] || { icon: '📌', label: category, bg: '#f0f0f0', color: '#595959' };
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
        </div>
      </div>
      <div class="baf-search-row">
        <input type="text" class="baf-search-input" id="baf-search" placeholder="搜索活动名称、标签..." />
        <input type="text" class="baf-video-type-input" id="baf-video-type" placeholder="我的视频类型（如：影视解说）" value="${settings.videoType || ''}" />
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
      const isHighMatch = match !== null && match >= 50;
      const daysClass = days <= 7 ? 'baf-days-urgent' : days <= 30 ? 'baf-days-normal' : 'baf-days-long';
      const daysText = days < 0 ? '已结束' : days === 0 ? '今天截止' : `剩余${days}天`;
      const catIcon = getCategoryIcon(a.category, a.tags);

      return `
        <div class="baf-activity-item ${isHighMatch ? 'baf-high-match' : ''}" data-url="${a.url}" data-id="${a.id}">
          <div class="baf-cat-badge" style="background:${catIcon.bg};color:${catIcon.color};" title="${catIcon.label}">${catIcon.icon}</div>
          <div class="baf-activity-item-title">${a.title}</div>
          <div class="baf-activity-item-cats">
            ${(a.categories || [a.category]).map(c => {
              const colors = (catColors[c] || '#f0f0f0,#595959').split(',');
              return `<span class="baf-cat-tag" style="background:${colors[0]};color:${colors[1]};">${c}</span>`;
            }).join('')}
          </div>
          <div class="baf-activity-item-tags">
            ${(a.tags || []).slice(0, 4).map(t => `<span class="baf-activity-item-tag">${t}</span>`).join('')}
          </div>
          <div class="baf-activity-item-info">
            📅 ${formatDate(a.startDate)} - ${formatDate(a.endDate)}<br>
            🏷️ ${a.submitTag}<br>
            📂 ${a.submitZone}
          </div>
          <div class="baf-activity-item-reward">💰 ${a.rewardType}：${a.rewardDesc}</div>
          ${match !== null ? `<div style="margin-top:6px;"><span class="baf-badge baf-badge-match" style="display:inline-block;">匹配度 ${match}%</span></div>` : ''}
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
      renderActivityList();
    });

    document.getElementById('baf-video-type').addEventListener('input', (e) => {
      settings.videoType = e.target.value;
      saveSettings();
      renderActivityList();
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
