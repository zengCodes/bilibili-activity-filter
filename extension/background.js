/**
 * B站活动筛选助手 - Background Service Worker
 * 处理插件生命周期、消息转发、数据缓存
 */

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
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_ACTIVITIES') {
    fetchAllActivities()
      .then(data => sendResponse({ success: true, data }))
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
    chrome.storage.sync.set(request.payload).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * 从B站API获取全部活动（自动分页）
 */
async function fetchAllActivities() {
  const PAGE_SIZE = 50;
  const firstPage = await fetchPage(1);
  const total = firstPage.data?.page?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  let allItems = [...(firstPage.data?.list || [])];

  if (totalPages > 1) {
    const promises = [];
    for (let pn = 2; pn <= totalPages; pn++) {
      promises.push(fetchPage(pn));
    }
    const pages = await Promise.all(promises);
    pages.forEach(p => {
      if (p.code === 0 && p.data?.list) {
        allItems = allItems.concat(p.data.list);
      }
    });
  }

  return allItems.map(transformActivity);
}

async function fetchPage(pn) {
  const url = `https://api.bilibili.com/x/activity_components/video_activity/hot_activity?pn=${pn}&ps=50&web_location=888.139379`;
  const resp = await fetch(url, {
    credentials: 'include',
    headers: { 'Referer': 'https://www.bilibili.com/' }
  });
  return resp.json();
}

/**
 * 数据清洗和格式转换
 */
function transformActivity(item, index) {
  const labels = item.hot_labels || [];
  const name = item.name || '';
  const text = (labels.join('') + name).toLowerCase();

  // 多分类推断
  const categories = inferCategories(text);
  const primaryCategory = categories[0];

  return {
    id: item.id || index + 1,
    title: name,
    category: primaryCategory,
    categories: categories,
    tags: labels,
    startDate: item.stime ? formatDate(new Date(item.stime * 1000)) : '',
    endDate: item.etime ? formatDate(new Date(item.etime * 1000)) : '',
    stime: item.stime,
    etime: item.etime,
    rewardType: inferRewardType(text),
    rewardDesc: labels.filter(l => /奖金|瓜分|奖励|激励|扶持|周边|抽奖|材料|道具/.test(l)).join('、') || '详见活动页面',
    submitZone: inferSubmitZone(primaryCategory),
    submitTag: `#${name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') || '活动'}#`,
    url: item.act_url || '',
    cover: item.cover || '',
    difficulty: inferDifficulty(text, primaryCategory),
    competition: inferCompetition(primaryCategory, labels),
    suitableFor: inferSuitableFor(text, primaryCategory),
    desc: `${name}活动，${labels.join('、')}。详见活动页面。`
  };
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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
  if (/激励|奖励|有奖/.test(text)) return '混合';
  return '混合';
}

function inferDifficulty(text, category) {
  if (/宅舞|舞蹈|cosplay|绘画|手书|同人|调教|编曲|原创音乐|鬼畜|调音/.test(text)) return '高';
  if (/品牌合作|海尔|方程豹|高能净界/.test(text)) return '高';
  if (category === '游戏') return '中';
  return '低';
}

function inferCompetition(category, labels) {
  if (category === '游戏' && /原神|崩坏|星穹|鸣潮|永劫|蛋仔/.test(labels.join(''))) return '高';
  if (category === '游戏') return '中';
  if (category === '综合') return '中';
  return '低';
}

function inferSubmitZone(category) {
  const map = { '游戏': '游戏区', '影视': '影视区', '音乐': '音乐区', '知识': '知识区', '动画': '动画区', '美食': '美食区', '亲子': '生活区', '科技': '科技区', '综合': '生活区/综合', '鬼畜': '鬼畜区' };
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
