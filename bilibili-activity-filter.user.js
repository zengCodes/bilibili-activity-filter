// ==UserScript==
// @name         B站活动筛选助手
// @name:zh-CN   B站活动筛选助手
// @namespace    https://github.com/zengCodes/bilibili-activity-filter
// @version      1.1.4
// @description  实时获取B站173+投稿活动，智能匹配你的视频类型，支持分类/时间/奖励/门槛筛选、匹配度排序、截止提醒
// @description:zh-CN 实时获取B站173+投稿活动，智能匹配你的视频类型，支持分类/时间/奖励/门槛筛选、匹配度排序、截止提醒
// @author       zengCodes
// @match        https://www.bilibili.com/blackboard/era/reward-activity-list-page.html*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  /**
 * BAFCore - B站活动筛选工具 三端共享核心逻辑（Web版 / Chrome扩展 / 油猴脚本）
 *
 * 单一数据源：本文件是推断、匹配、工具函数的唯一实现，修改后运行 `npm run build`
 * 同步到 public/、extension/ 并重新生成油猴脚本，避免三端逻辑漂移。
 *
 * 三种加载方式：
 * - Node.js:  const BAFCore = require('./core.js')
 * - 浏览器:   <script src="core.js"></script> → window.BAFCore
 * - 油猴:     构建时由 scripts/build.js 内联进 user.js
 */
(function (global) {
  'use strict';

  // ========== 常量 ==========
  const API_URL = 'https://api.bilibili.com/x/activity_components/video_activity/hot_activity';
  const PAGE_SIZE = 50;
  const WEB_LOCATION = '888.139379'; // B站活动中心页面的固定跟踪参数

  // ========== 通用工具 ==========
  // HTML 转义：所有来自B站API的字符串插入模板前必须经过此函数
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 每次现取，避免页面跨午夜后剩余天数全错
  function today() {
    return new Date();
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

  // "2026-11-30" → "11月30日"
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  // "2026-11-30" → "11/30"（扩展 popup 空间紧凑用）
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // Unix 时间戳 → 本地时区日期（YYYY-MM-DD），与 Web 版/油猴/扩展保持一致
  function formatTimestamp(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ========== 匹配度 ==========
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
      maxScore += 29; // 每个关键词最大可能得分：标题10 + 标签7 + 适合类型8 + 描述4
      if (title.includes(kw)) score += 10;
      if (tags.some(t => t.includes(kw) || kw.includes(t))) score += 7;
      if (suitable.some(s => s.includes(kw) || kw.includes(s))) score += 8;
      if (desc.includes(kw)) score += 4;
    });

    return maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
  }

  // 阈值三端统一：≥50 高 / ≥25 中 / 其余低
  function getMatchLevel(score) {
    if (score === null) return null;
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  function getMatchText(score) {
    if (score === null) return '';
    if (score >= 50) return `⭐ 高度匹配 ${score}%`;
    if (score >= 25) return `🔹 中度匹配 ${score}%`;
    return `匹配度 ${score}%`;
  }

  // ========== 展示辅助 ==========
  // 分类图标徽章
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
      '综合': { icon: '✨', label: '综合', bg: '#e6f7ff', color: '#1890ff' }
    };
    return map[category] || { icon: '📌', label: category, bg: '#f0f0f0', color: '#595959' };
  }

  // 奖励丰厚程度排序权重
  function getRewardWeight(activity) {
    const weights = {
      '固定奖金': 5,
      '现金瓜分': 4,
      '混合': 3,
      '流量扶持': 2,
      '游戏道具': 1,
      '周边抽奖': 1
    };
    return weights[activity.rewardType] || 0;
  }

  // ========== 数据抓取 ==========
  /**
   * 分页抓取全部原始活动条目
   * @param {Function} fetchOne - 单页抓取函数 (pn) => Promise<json>，由各端注入
   *                              （Node 端可用 nodeFetchOne，浏览器端用带 credentials 的 fetch）
   */
  async function fetchRawActivities(fetchOne) {
    const first = await fetchOne(1);
    if (first.code !== 0) throw new Error(first.message || 'API错误');

    const total = first.data?.page?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    let items = [...(first.data?.list || [])];

    if (totalPages > 1) {
      const promises = [];
      for (let pn = 2; pn <= totalPages; pn++) {
        promises.push(fetchOne(pn));
      }
      const pages = await Promise.all(promises);
      pages.forEach(p => {
        if (p.code === 0 && p.data?.list) {
          items = items.concat(p.data.list);
        }
      });
    }

    return items;
  }

  /**
   * Node 端单页抓取（带伪装 headers 与 10s 超时），供 server.js / update-data 脚本使用
   */
  async function nodeFetchOne(pn) {
    const url = `${API_URL}?pn=${pn}&ps=${PAGE_SIZE}&web_location=${WEB_LOCATION}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  /**
   * 浏览器端单页抓取（同源页面/扩展 host 权限，带 cookies）
   */
  function browserFetchOne(pn) {
    const url = `${API_URL}?pn=${pn}&ps=${PAGE_SIZE}&web_location=${WEB_LOCATION}`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  }

  // ========== 数据转换与推断 ==========
  function transformActivities(items) {
    return items.map((item, index) => transformActivity(item, index));
  }

  function transformActivity(item, index) {
    const labels = item.hot_labels || [];
    const name = item.name || '';
    const text = (labels.join('') + name).toLowerCase();

    const categories = inferCategories(text);
    const primaryCategory = categories[0];

    return {
      id: item.id || index + 1,
      title: name,
      category: primaryCategory,        // 主分类（用于卡片显示）
      categories: categories,           // 所有分类（用于多分类筛选）
      tags: labels,
      startDate: item.stime ? formatTimestamp(item.stime) : '',
      endDate: item.etime ? formatTimestamp(item.etime) : '',
      rewardType: inferRewardType(text),
      rewardDesc: labels.filter(l => /奖金|瓜分|奖励|激励|扶持|周边|抽奖|材料|道具/.test(l)).join('、') || '详见活动页面',
      submitZone: inferSubmitZone(primaryCategory),
      submitTag: `#${name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') || '活动'}#`,
      url: item.act_url || '',
      cover: item.cover || '',
      difficulty: inferDifficulty(text, primaryCategory),
      competition: inferCompetition(primaryCategory, labels),
      suitableFor: inferSuitableFor(text, primaryCategory),
      desc: `${name}活动，${labels.join('、')}。详见活动页面。`,
      // 原始时间戳（备用）
      _stime: item.stime,
      _etime: item.etime
    };
  }

  /**
   * 从标签和名称推断活动分类（支持多分类）
   * 返回数组，第一个元素为主分类
   */
  function inferCategories(text) {
    const cats = [];
    if (/游戏|手游|端游|攻略|FPS|射击|MOBA|原神|崩坏|星穹|鸣潮|永劫|阴阳师|蛋仔|暗区|三角洲|火影|逆水寒|异环|重返未来|游戏王|P5X|物华弥新|遗忘之海|蔚蓝档案|无限暖暖|APEX|LOL|光遇|战双|绝区零|明日方舟|第五人格|和平精英|王者荣耀|无畏契约|瓦罗兰特/.test(text)) cats.push('游戏');
    if (/动画|番剧|国创|动漫|鬼畜|黄绿合战|同人|Bonly|cosplay|绘画|手书|up动画|动画剧场|手搓动画|3d动画|MAD|AMV|EVA|RE0|re0|凡人修仙|雪王动画|动漫二创|二创/.test(text)) cats.push('动画');
    if (/影视|电影|电视剧|漫威|复联|解说|盘点|短片|AI影视|影视解说/.test(text)) cats.push('影视');
    if (/音乐|MV|原创音乐|唱歌|编曲|Vsinger|洛天依|宅舞|舞蹈|直拍|饭拍|演唱会|live现场|音乐现场|音乐MV|音mad|鬼畜调教/.test(text)) cats.push('音乐');
    if (/知识|科普|科学|历史|人文|诺贝尔|长视频/.test(text)) cats.push('知识');
    if (/美食|料理|做饭|烘焙|探店/.test(text)) cats.push('美食');
    if (/亲子|家庭|育儿|宝宝/.test(text)) cats.push('亲子');
    if (/科技|数码|测评|汽车|方程豹|海尔|品牌合作/.test(text)) cats.push('科技');
    if (/vlog|生活|日常|旅行|跨文化|外国人|播客|单口|开麦|手工|DIY|赛车|体育|赛事|直播|切片|主播|二次元/.test(text)) cats.push('综合');
    if (cats.length === 0) cats.push('综合');
    return cats;
  }

  function inferRewardType(text) {
    if (/瓜分/.test(text)) return '现金瓜分';
    if (/奖金|奖金池|万奖金/.test(text)) return '固定奖金';
    if (/流量扶持|流量激励|曝光/.test(text)) return '流量扶持';
    if (/道具|材料|战力|星声|游戏内/.test(text)) return '游戏道具';
    if (/周边|抽奖|贝壳金/.test(text)) return '周边抽奖';
    return '混合';
  }

  function inferDifficulty(text, category) {
    if (/宅舞|舞蹈|cosplay|绘画|手书|同人|调教|编曲|原创音乐|鬼畜|调音/.test(text)) return '高';
    if (/品牌合作|海尔|方程豹|高能净界/.test(text)) return '高';
    if (category === '游戏') return '中';
    if (/征稿|有奖|激励|瓜分|扶持/.test(text)) return '低';
    return '低';
  }

  function inferCompetition(category, labels) {
    if (category === '游戏' && /原神|崩坏|星穹|鸣潮|永劫|蛋仔/.test(labels.join(''))) return '高';
    if (category === '游戏') return '中';
    if (category === '综合') return '中';
    return '低';
  }

  function inferSubmitZone(category) {
    const map = {
      '游戏': '游戏区', '影视': '影视区', '音乐': '音乐区', '知识': '知识区',
      '动画': '动画区', '美食': '美食区', '亲子': '生活区', '科技': '科技区',
      '综合': '生活区/综合', '鬼畜': '鬼畜区'
    };
    return map[category] || '生活区';
  }

  function inferSuitableFor(text, category) {
    const result = [];
    if (/解说|吐槽|盘点|混剪|剪辑/.test(text)) result.push('解说', '剪辑', '混剪', '盘点');
    if (/攻略/.test(text)) result.push('攻略');
    if (/vlog|日常|生活|旅行/.test(text)) result.push('vlog', '生活', '日常', '旅行');
    if (/美食|料理|做饭|烘焙|探店/.test(text)) result.push('美食', '做饭', '探店');
    if (/音乐|MV|唱歌|原创/.test(text)) result.push('音乐', '唱歌', 'MV');
    if (/舞蹈|宅舞|直拍|饭拍/.test(text)) result.push('舞蹈', '直拍');
    if (/科普|知识|科学|历史|人文|诺贝尔/.test(text)) result.push('科普', '知识', '历史');
    if (/手工|DIY|折纸|粘土/.test(text)) result.push('手工', 'DIY', '教程');
    if (/播客|单口|开麦|聊天/.test(text)) result.push('播客', '单口', '聊天', '分享');
    if (/cosplay|绘画|同人|手书/.test(text)) result.push('cosplay', '绘画', '同人');
    if (/鬼畜|调音/.test(text)) result.push('鬼畜', '调音');
    if (/赛车|体育|赛事/.test(text)) result.push('赛车', '体育', '赛事');
    if (/亲子|家庭|育儿/.test(text)) result.push('亲子', '家庭', '育儿');
    if (/影视|电影|电视剧|漫威/.test(text)) result.push('影视', '电影', '电视剧');
    if (category === '游戏') result.push('游戏', '解说');
    if (/二创|同人/.test(text)) result.push('二创');
    return [...new Set(result)];
  }

  // ========== 导出 ==========
  const BAFCore = {
    API_URL, PAGE_SIZE, WEB_LOCATION,
    esc, today, debounce, daysLeft, formatDate, formatDateShort, formatTimestamp,
    calcMatch, getMatchLevel, getMatchText,
    getCategoryIcon, getRewardWeight,
    fetchRawActivities, nodeFetchOne, browserFetchOne,
    transformActivities, transformActivity,
    inferCategories, inferRewardType, inferDifficulty, inferCompetition, inferSubmitZone, inferSuitableFor
  };

  global.BAFCore = BAFCore;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BAFCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);


  // ========== 注入样式 ==========
  const style = document.createElement('style');
  style.textContent = `
    /* 主题变量：.baf-dark（由 JS 检测页面背景亮度/系统偏好后挂载）覆盖为深色 */
    :root {
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
    .baf-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .baf-title { font-size: 15px; font-weight: 700; color: #fb7299; display: flex; align-items: center; gap: 6px; }
    .baf-stats { font-size: 12px; color: var(--baf-text-sub); }
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
  `;
  document.head.appendChild(style);

  // ========== 状态 ==========
  let activities = [];
  let settings = {
    videoType: '',
    favorites: [],
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
        if (!settings.filters) settings.filters = {};
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
          <option value="fav-first">收藏优先</option>
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
    refreshFavMap();
    applyDarkMode();
    const themeObserver = new MutationObserver(applyDarkMode);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

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
