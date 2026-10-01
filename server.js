/**
 * B站活动筛选工具 - 后端代理服务
 * 
 * 功能：
 * 1. 静态文件服务（前端页面）
 * 2. 代理B站活动API，解决CORS跨域问题
 * 3. 内存缓存（默认1小时），减少B站API调用
 * 4. 自动分页获取全部活动数据
 * 5. 数据清洗和格式转换
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

// B站活动API
const BILI_API = 'https://api.bilibili.com/x/activity_components/video_activity/hot_activity';
const PAGE_SIZE = 50;

// 内存缓存
let cache = {
  data: null,
  timestamp: 0
};

/**
 * 从B站API获取单页活动数据
 */
async function fetchPage(pn) {
  const url = `${BILI_API}?pn=${pn}&ps=${PAGE_SIZE}&web_location=888.139379`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com/'
    }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/**
 * 获取全部活动（自动分页）
 */
async function fetchAllActivities() {
  // 先获取第一页，拿到总数
  const firstPage = await fetchPage(1);
  if (firstPage.code !== 0) throw new Error(firstPage.message || 'API错误');
  
  const total = firstPage.data?.page?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  
  let allItems = [...(firstPage.data?.list || [])];
  
  // 并发获取剩余页
  if (totalPages > 1) {
    const pagePromises = [];
    for (let pn = 2; pn <= totalPages; pn++) {
      pagePromises.push(fetchPage(pn));
    }
    const pages = await Promise.all(pagePromises);
    pages.forEach(p => {
      if (p.code === 0 && p.data?.list) {
        allItems = allItems.concat(p.data.list);
      }
    });
  }
  
  return allItems;
}

/**
 * 数据清洗和格式转换
 */
function transformActivities(items) {
  const now = Date.now();
  
  return items.map((item, index) => {
    const stime = item.stime ? new Date(item.stime * 1000) : null;
    const etime = item.etime ? new Date(item.etime * 1000) : null;
    
    // 从标签中推断分类（第一个标签通常是分类）
    const labels = item.hot_labels || [];
    const category = inferCategory(labels, item.name);
    
    // 推断奖励类型
    const rewardType = inferRewardType(labels, item.name);
    
    // 推断参赛门槛
    const difficulty = inferDifficulty(labels, item.name, category);
    
    // 推断适合的视频类型
    const suitableFor = inferSuitableFor(labels, item.name, category);
    
    return {
      id: item.id || index + 1,
      title: item.name || '未知活动',
      category: category,
      tags: labels,
      startDate: stime ? formatDate(stime) : '',
      endDate: etime ? formatDate(etime) : '',
      rewardType: rewardType,
      rewardDesc: labels.filter(l => /奖金|瓜分|奖励|激励|扶持|周边|抽奖|材料|道具/.test(l)).join('、') || '详见活动页面',
      submitZone: inferSubmitZone(category),
      submitTag: `#${item.name?.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') || '活动'}#`,
      url: item.act_url || '',
      cover: item.cover || '',
      difficulty: difficulty,
      competition: inferCompetition(category, labels),
      suitableFor: suitableFor,
      desc: `${item.name}活动，${labels.join('、')}。详见活动页面。`,
      // 原始时间戳用于前端计算
      _stime: item.stime,
      _etime: item.etime
    };
  });
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 从标签和名称推断活动分类
 */
function inferCategory(labels, name) {
  const text = (labels.join('') + name).toLowerCase();
  
  if (/游戏|手游|端游|攻略|FPS|射击|MOBA|原神|崩坏|星穹|鸣潮|永劫|阴阳师|蛋仔|暗区|三角洲|火影|逆水寒|异环|重返未来|游戏王|P5X|物华弥新|遗忘之海/.test(text)) return '游戏';
  if (/影视|电影|电视剧|漫威|复联|解说|盘点/.test(text)) return '影视';
  if (/音乐|MV|原创|唱歌|编曲|调教|Vsinger|洛天依|宅舞|舞蹈|直拍|饭拍|演唱会/.test(text)) return '音乐';
  if (/知识|科普|科学|历史|人文|诺贝尔|长视频/.test(text)) return '知识';
  if (/动画|番剧|国创|动漫|鬼畜|黄绿合战|同人|Bonly|cosplay|绘画|手书/.test(text)) return '动画';
  if (/美食|料理|做饭|烘焙|探店/.test(text)) return '美食';
  if (/亲子|家庭|育儿|宝宝/.test(text)) return '亲子';
  if (/科技|数码|测评|汽车|方程豹|海尔|品牌/.test(text)) return '科技';
  if (/vlog|生活|日常|旅行|跨文化|外国人|播客|单口|开麦|手工|DIY|赛车|体育|赛事/.test(text)) return '综合';
  
  return '综合';
}

/**
 * 推断奖励类型
 */
function inferRewardType(labels, name) {
  const text = labels.join('') + name;
  if (/瓜分/.test(text)) return '现金瓜分';
  if (/奖金|奖金池|万奖金/.test(text)) return '固定奖金';
  if (/流量扶持|流量激励|曝光/.test(text)) return '流量扶持';
  if (/道具|材料|战力|星声|游戏内/.test(text)) return '游戏道具';
  if (/周边|抽奖|贝壳金/.test(text)) return '周边抽奖';
  if (/激励|奖励|有奖/.test(text)) return '混合';
  return '混合';
}

/**
 * 推断参赛门槛
 */
function inferDifficulty(labels, name, category) {
  const text = labels.join('') + name;
  if (/宅舞|舞蹈|cosplay|绘画|手书|同人|调教|编曲|原创音乐|鬼畜|调音/.test(text)) return '高';
  if (/品牌合作|海尔|方程豹|高能净界/.test(text)) return '高';
  if (category === '游戏') return '中';
  if (/征稿|有奖|激励|瓜分|扶持/.test(text)) return '低';
  return '低';
}

/**
 * 推断投稿分区
 */
function inferSubmitZone(category) {
  const zoneMap = {
    '游戏': '游戏区',
    '影视': '影视区',
    '音乐': '音乐区',
    '知识': '知识区',
    '动画': '动画区',
    '美食': '美食区',
    '亲子': '生活区',
    '科技': '科技区',
    '综合': '生活区/综合',
    '鬼畜': '鬼畜区'
  };
  return zoneMap[category] || '生活区';
}

/**
 * 推断竞争烈度
 */
function inferCompetition(category, labels) {
  if (category === '游戏' && /原神|崩坏|星穹|鸣潮|永劫|蛋仔/.test(labels.join(''))) return '高';
  if (category === '游戏') return '中';
  if (category === '综合') return '中';
  return '低';
}

/**
 * 推断适合的视频类型
 */
function inferSuitableFor(labels, name, category) {
  const text = labels.join('') + name;
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
  
  // 去重
  return [...new Set(result)];
}

// 静态文件服务
app.use(express.static(__dirname));

// API: 获取活动列表
app.get('/api/activities', async (req, res) => {
  try {
    const now = Date.now();
    
    // 检查缓存
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      return res.json({
        code: 0,
        message: 'success',
        data: cache.data,
        cached: true,
        updatedAt: new Date(cache.timestamp).toISOString()
      });
    }
    
    console.log('[API] 正在从B站获取活动数据...');
    const rawItems = await fetchAllActivities();
    const transformed = transformActivities(rawItems);
    
    // 更新缓存
    cache.data = transformed;
    cache.timestamp = now;
    
    console.log(`[API] 获取到 ${transformed.length} 个活动，已缓存`);
    
    res.json({
      code: 0,
      message: 'success',
      data: transformed,
      cached: false,
      updatedAt: new Date(now).toISOString()
    });
  } catch (err) {
    console.error('[API] 获取失败:', err.message);
    
    // 如果有缓存，返回缓存数据（即使过期）
    if (cache.data) {
      return res.json({
        code: 0,
        message: 'stale cache',
        data: cache.data,
        cached: true,
        stale: true,
        updatedAt: new Date(cache.timestamp).toISOString()
      });
    }
    
    res.status(500).json({
      code: -1,
      message: err.message || '获取失败',
      data: []
    });
  }
});

// API: 强制刷新缓存
app.get('/api/refresh', async (req, res) => {
  cache.data = null;
  cache.timestamp = 0;
  res.json({ code: 0, message: '缓存已清除，下次请求将重新获取' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  B站活动筛选工具 - 后端服务已启动');
  console.log('========================================');
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`  活动API:  http://localhost:${PORT}/api/activities`);
  console.log(`  刷新缓存: http://localhost:${PORT}/api/refresh`);
  console.log(`  缓存时长: ${CACHE_DURATION / 1000 / 60} 分钟`);
  console.log('========================================');
});
