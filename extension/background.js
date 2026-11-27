/**
 * B站活动筛选助手 - Background Service Worker
 * 处理插件生命周期、消息转发、数据缓存
 *
 * 数据抓取与推断逻辑在 core.js（三端共享），通过 importScripts 加载。
 * 抓取结果持久化到 chrome.storage.local（1小时），避免 service worker
 * 被回收后每次 popup/页面加载都重新全量抓取B站接口。
 */

importScripts('core.js');

const { daysLeft } = BAFCore;

const CACHE_KEY = 'activities_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存
const NOTIFY_KEY = 'ending_notified_ids';
const ALARM_NAME = 'baf-check-ending';

// 插件安装时初始化默认设置
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      videoType: '',
      filters: {
        category: 'all',
        time: 'all',
        reward: 'all',
        difficulty: 'all',
        search: '',
        sort: 'days-asc'
      },
      savedActivities: []
    });
    console.log('[B站活动筛选助手] 已初始化默认设置');
  }
  // 定时检查收藏活动的截止提醒（12小时一次）
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 720 });
});

// 定时提醒：收藏的活动 3 天内截止时发送系统通知
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkEndingNotifications();
});

async function checkEndingNotifications() {
  const sync = await chrome.storage.sync.get('savedActivities');
  const saved = sync.savedActivities || [];
  if (!saved.length) return;

  const local = await chrome.storage.local.get(NOTIFY_KEY);
  const notified = new Set(local[NOTIFY_KEY] || []);

  // 收集当前仍有效的活动 id，顺带清理已过期条目，避免通知记录无限增长
  const activeIds = new Set();

  for (const fav of saved) {
    activeIds.add(fav.id);
    if (notified.has(fav.id)) continue;
    const d = daysLeft(f.endDate);
    if (d < 0 || d > 3) continue;
    try {
      await chrome.notifications.create(`baf-ending-${fav.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: d === 0 ? '⏰ 收藏的活动今天截止！' : `⏰ 收藏的活动 ${d} 天后截止`,
        message: fav.title
      });
      notified.add(fav.id);
    } catch (err) {
      console.warn('[B站活动筛选助手] 发送通知失败:', err.message);
    }
  }

  await chrome.storage.local.set({
    [NOTIFY_KEY]: [...notified].filter(id => activeIds.has(id))
  });
}

// 监听来自content script/popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_ACTIVITIES') {
    fetchAllActivities()
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // 保持消息通道开放
  }

  if (request.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(null).then(settings => {
      sendResponse({ success: true, settings });
    });
    return true;
  }

  if (request.type === 'SAVE_SETTINGS') {
    // 写失败要回传，别让调用方以为存上了（sync 有 8KB/项上限，收藏多了会超）
    chrome.storage.sync.set(request.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * 获取全部活动（带 storage.local 持久缓存，1小时；失败时回退过期缓存）
 * 返回 { data, cached, stale? }
 */
async function fetchAllActivities() {
  // 命中缓存
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cached = stored[CACHE_KEY];
  if (cached?.data && Date.now() - cached.timestamp < CACHE_DURATION) {
    return { data: cached.data, cached: true };
  }

  try {
    const items = await BAFCore.fetchRawActivities(BAFCore.browserFetchOne);
    const data = BAFCore.transformActivities(items);
    await chrome.storage.local.set({ [CACHE_KEY]: { data, timestamp: Date.now() } });
    return { data, cached: false };
  } catch (err) {
    // 抓取失败但有旧缓存时，降级返回过期缓存（标记 stale）
    if (cached?.data) {
      console.warn('[B站活动筛选助手] 抓取失败，返回过期缓存:', err.message);
      return { data: cached.data, cached: true, stale: true };
    }
    throw err;
  }
}
