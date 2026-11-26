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

  /**
   * 分类规则表：B站接口不给分类，只能靠标题+标签推断。
   * 维护说明：新增/调整分类只改这张表 —— patterns 中任一关键词命中（不区分大小写）
   * 即归入该分类；数组顺序即主分类优先级（第一个命中的为主分类）。
   * 未命中任何规则的条目由 transformActivities 的动态聚类兜底（见 DYNAMIC_CATEGORY_THRESHOLD）。
   */
  const CATEGORY_RULES = [
    { name: '游戏', patterns: ['游戏', '手游', '端游', '攻略', 'FPS', '射击', 'MOBA', '原神', '崩坏', '星穹', '鸣潮', '永劫', '阴阳师', '蛋仔', '暗区', '三角洲', '火影', '逆水寒', '异环', '重返未来', '游戏王', 'P5X', '物华弥新', '遗忘之海', '蔚蓝档案', '无限暖暖', 'APEX', 'LOL', '光遇', '战双', '绝区零', '明日方舟', '第五人格', '和平精英', '王者荣耀', '无畏契约', '瓦罗兰特'] },
    { name: '动画', patterns: ['动画', '番剧', '国创', '动漫', '鬼畜', '黄绿合战', '同人', 'Bonly', 'cosplay', '绘画', '手书', 'up动画', '动画剧场', '手搓动画', '3d动画', 'MAD', 'AMV', 'EVA', 'RE0', 're0', '凡人修仙', '雪王动画', '动漫二创', '二创'] },
    { name: '影视', patterns: ['影视', '电影', '电视剧', '漫威', '复联', '解说', '盘点', '短片', 'AI影视', '影视解说'] },
    { name: '音乐', patterns: ['音乐', 'MV', '原创音乐', '唱歌', '编曲', 'Vsinger', '洛天依', '宅舞', '舞蹈', '直拍', '饭拍', '演唱会', 'live现场', '音乐现场', '音乐MV', '音mad', '鬼畜调教'] },
    { name: '知识', patterns: ['知识', '科普', '科学', '历史', '人文', '诺贝尔', '长视频'] },
    { name: '美食', patterns: ['美食', '料理', '做饭', '烘焙', '探店'] },
    { name: '亲子', patterns: ['亲子', '家庭', '育儿', '宝宝'] },
    { name: '科技', patterns: ['科技', '数码', '测评', '汽车', '方程豹', '海尔', '品牌合作'] },
    { name: '综合', patterns: ['vlog', '生活', '日常', '旅行', '跨文化', '外国人', '播客', '单口', '开麦', '手工', 'DIY', '赛车', '体育', '赛事', '直播', '切片', '主播', '二次元'] }
  ];
  // 规则全部未命中时的兜底分类
  const FALLBACK_CATEGORY = '综合';
  // 动态聚类阈值：同一标签出现在 ≥N 个未命中规则的活动中时，升格为一个动态分类
  //（自适应B站新增领域，如新开"体育"类活动，各活动都带"体育"标签即可自动出现分类按钮）
  const DYNAMIC_CATEGORY_THRESHOLD = 3;

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
  /**
   * 两遍转换：
   * 第一遍 transformActivity —— 按 CATEGORY_RULES 推断分类，未命中规则的条目
   *   先挂兜底分类并打 _unclassified 标记；
   * 第二遍 refineDynamicCategories —— 在未命中规则的条目里做标签聚类，
   *   高频标签（≥DYNAMIC_CATEGORY_THRESHOLD）升格为动态分类，实现自适应B站新增领域。
   */
  function transformActivities(items) {
    const list = items.map((item, index) => transformActivity(item, index));
    refineDynamicCategories(list);
    return list;
  }

  /**
   * 动态聚类兜底：统计未命中规则活动的标签频次，高频标签升格为分类。
   * 例如B站新开"体育"类活动而规则表尚未收录，各活动都带"体育"标签，
   * 会自动生成"体育"分类按钮；孤立的条目才落入 FALLBACK_CATEGORY。
   */
  function refineDynamicCategories(list) {
    const unmatched = list.filter(a => a._unclassified);
    if (unmatched.length === 0) return list;

    const freq = new Map();
    unmatched.forEach(a => (a.tags || []).forEach(t => {
      const key = String(t).trim();
      if (!key) return;
      freq.set(key, (freq.get(key) || 0) + 1);
    }));

    const dynamicCats = new Map(
      Array.from(freq.entries())
        .filter(([, n]) => n >= DYNAMIC_CATEGORY_THRESHOLD)
        .sort((x, y) => y[1] - x[1])
    );

    unmatched.forEach(a => {
      const hits = (a.tags || [])
        .map(t => String(t).trim())
        .filter(t => dynamicCats.has(t))
        .sort((x, y) => dynamicCats.get(y) - dynamicCats.get(x));
      a.categories = hits.length ? hits : [FALLBACK_CATEGORY];
      a.category = a.categories[0];

      // 主分类变了，依赖它的字段一并重算
      const text = ((a.tags || []).join('') + a.title).toLowerCase();
      a.submitZone = inferSubmitZone(a.category);
      a.difficulty = inferDifficulty(text, a.category);
      a.competition = inferCompetition(a.category, a.tags);
      a.suitableFor = inferSuitableFor(text, a.category);
      delete a._unclassified;
    });

    // 清理规则命中条目上的标记位，保证输出对象干净
    list.forEach(a => { if ('_unclassified' in a) delete a._unclassified; });
  }

  function transformActivity(item, index) {
    const labels = item.hot_labels || [];
    const name = item.name || '';
    const text = (labels.join('') + name).toLowerCase();

    const ruleCats = inferCategories(text);
    const categories = ruleCats.length ? ruleCats : [FALLBACK_CATEGORY];
    const primaryCategory = categories[0];

    return {
      id: item.id || index + 1,
      title: name,
      category: primaryCategory,        // 主分类（用于卡片显示）
      categories: categories,           // 所有分类（用于多分类筛选）
      _unclassified: ruleCats.length === 0,  // 规则未命中标记，供动态聚类二次处理
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
   * 按 CATEGORY_RULES 推断活动分类（支持多分类，第一个元素为主分类）。
   * 全部未命中时返回空数组，由调用方走动态聚类/兜底分类。
   */
  function inferCategories(text) {
    const t = String(text || '').toLowerCase();
    const cats = [];
    for (const rule of CATEGORY_RULES) {
      if (rule.patterns.some(p => t.includes(p.toLowerCase()))) cats.push(rule.name);
    }
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
    CATEGORY_RULES, FALLBACK_CATEGORY, DYNAMIC_CATEGORY_THRESHOLD,
    esc, today, debounce, daysLeft, formatDate, formatDateShort, formatTimestamp,
    calcMatch, getMatchLevel, getMatchText,
    getCategoryIcon, getRewardWeight,
    fetchRawActivities, nodeFetchOne, browserFetchOne,
    transformActivities, transformActivity, refineDynamicCategories,
    inferCategories, inferRewardType, inferDifficulty, inferCompetition, inferSubmitZone, inferSuitableFor
  };

  global.BAFCore = BAFCore;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BAFCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
