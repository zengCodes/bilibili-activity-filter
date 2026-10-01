/**
 * B站活动筛选助手 - Popup弹窗逻辑
 */

let activities = [];
const TODAY = new Date();

function daysLeft(endDate) {
  const end = new Date(endDate);
  return Math.ceil((end - TODAY) / (1000 * 60 * 60 * 24));
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

function renderEndingList() {
  const list = activities
    .filter(a => {
      const d = daysLeft(a.endDate);
      return d >= 0 && d <= 14;
    })
    .sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate))
    .slice(0, 10);

  const container = document.getElementById('endingList');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty">近期没有即将截止的活动</div>';
    return;
  }

  container.innerHTML = list.map(a => {
    const days = daysLeft(a.endDate);
    const daysClass = days <= 3 ? 'days-urgent' : days <= 7 ? 'days-normal' : 'days-long';
    const daysText = days === 0 ? '今天截止' : `剩余${days}天`;

    return `
      <div class="activity-item" data-url="${a.url}">
        <div class="activity-item-title">${a.title}</div>
        <div class="activity-item-meta">
          <span class="${daysClass}">${daysText}</span>
          <span class="reward-text">${a.rewardType}</span>
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

// 事件绑定
document.getElementById('videoType').addEventListener('input', saveSettings);

document.getElementById('openPageBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.bilibili.com/blackboard/era/reward-activity-list-page.html#/list' });
});

// 初始化
loadSettings();
loadActivities();
