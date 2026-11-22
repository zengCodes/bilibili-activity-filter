/**
 * B站活动筛选助手 - Popup弹窗逻辑
 */

let activities = [];

// HTML 转义：所有来自B站API的字符串插入模板前必须经过此函数
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function today() {
  return new Date(); // 每次现取，避免弹窗跨午夜后剩余天数全错
}

// 防抖：输入停止 300ms 后才触发重渲染
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
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.sync.get(['videoType']);
  if (result.videoType) {
    document.getElementById('videoType').value = result.videoType;
  }
}

// 保存设置
function saveSettings() {
  const videoType = document.getElementById('videoType').value;
  chrome.storage.sync.set({ videoType });
}

// 加载活动数据
async function loadActivities() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'FETCH_ACTIVITIES' });
    if (resp.success) {
      activities = resp.data;
      updateStats();
      renderEndingList();
    } else {
      showError('数据加载失败');
    }
  } catch (err) {
    showError('数据加载失败: ' + err.message);
  }
}

function updateStats() {
  document.getElementById('totalCount').textContent = activities.length;
  document.getElementById('activeCount').textContent = activities.filter(a => daysLeft(a.endDate) >= 0).length;
  document.getElementById('endingCount').textContent = activities.filter(a => {
    const d = daysLeft(a.endDate);
    return d >= 0 && d <= 7;
  }).length;
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

function renderEndingList() {
  const videoType = document.getElementById('videoType').value;
  const hasVideoType = videoType && videoType.trim();

  let list = activities
    .filter(a => {
      const d = daysLeft(a.endDate);
      return d >= 0 && d <= 14;
    })
    .map(a => ({
      ...a,
      match: hasVideoType ? calcMatch(a, videoType) : null
    }));

  // 有视频类型时按匹配度降序，相同匹配度按截止时间升序；无视频类型时按截止时间升序
  if (hasVideoType) {
    list.sort((a, b) => (b.match || 0) - (a.match || 0) || daysLeft(a.endDate) - daysLeft(b.endDate));
  } else {
    list.sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));
  }

  list = list.slice(0, 10);

  const container = document.getElementById('endingList');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty">近期没有即将截止的活动</div>';
    return;
  }

  container.innerHTML = list.map(a => {
    const days = daysLeft(a.endDate);
    const daysClass = days <= 3 ? 'days-urgent' : days <= 7 ? 'days-normal' : 'days-long';
    const daysText = days === 0 ? '今天截止' : `剩余${days}天`;
    const matchBadge = a.match !== null
      ? `<span class="match-badge ${a.match >= 50 ? 'match-high' : a.match >= 25 ? 'match-mid' : 'match-low'}">匹配${a.match}%</span>`
      : '';

    return `
      <div class="activity-item" data-url="${esc(a.url)}">
        <div class="activity-item-title">${esc(a.title)}</div>
        <div class="activity-item-meta">
          <span class="${daysClass}">${daysText}</span>
          ${matchBadge}
          <span class="reward-text">${esc(a.rewardType)}</span>
        </div>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  container.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
}

function showError(msg) {
  document.getElementById('endingList').innerHTML = `<div class="empty">${msg}</div>`;
}

// 事件绑定（防抖）
const debouncedRender = debounce(() => renderEndingList());
document.getElementById('videoType').addEventListener('input', () => {
  saveSettings();
  debouncedRender();
});

document.getElementById('openPageBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.bilibili.com/blackboard/era/reward-activity-list-page.html#/list' });
});

// 初始化
loadSettings();
loadActivities();
