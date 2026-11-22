/**
 * B站活动筛选助手 - Popup弹窗逻辑
 * 工具函数与匹配算法来自 BAFCore（core.js 三端共享）
 */

let activities = [];

const { esc, debounce, daysLeft, formatDateShort, calcMatch, getMatchLevel } = BAFCore;

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.sync.get(['videoType', 'savedActivities']);
  if (result.videoType) {
    document.getElementById('videoType').value = result.videoType;
  }
  renderFavList(result.savedActivities || []);
}

// 渲染收藏列表（数据来自活动页卡片的 ☆ 收藏，含 id/title/url/endDate 精简信息）
function renderFavList(saved) {
  const container = document.getElementById('favList');
  if (!saved.length) {
    container.innerHTML = '<div class="empty">暂无收藏，在活动页点击卡片右上角 ☆ 即可收藏</div>';
    return;
  }
  const list = [...saved].sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));
  container.innerHTML = list.map(f => {
    const d = daysLeft(f.endDate);
    const daysClass = d <= 3 ? 'days-urgent' : d <= 7 ? 'days-normal' : 'days-long';
    const daysText = d < 0 ? '已结束' : d === 0 ? '今天截止' : `剩余${d}天`;
    return `
      <div class="activity-item fav-item" data-url="${esc(f.url || '')}">
        <div class="activity-item-title">${esc(f.title)}</div>
        <div class="activity-item-meta">
          <span class="${daysClass}">${daysText}</span>
        </div>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.fav-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
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
      ? `<span class="match-badge ${getMatchLevel(a.match) === 'high' ? 'match-high' : getMatchLevel(a.match) === 'medium' ? 'match-mid' : 'match-low'}">匹配${a.match}%</span>`
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
