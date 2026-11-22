/**
 * B站活动筛选工具 - 后端代理服务
 *
 * 功能：
 * 1. 静态文件服务（仅 public 目录）
 * 2. 代理B站活动API，解决CORS跨域问题
 * 3. 内存缓存（默认1小时），减少B站API调用
 * 4. 自动分页获取全部活动数据
 *
 * 数据抓取与推断逻辑在 core.js（三端共享），本文件只负责代理与缓存。
 */

const express = require('express');
const path = require('path');
const BAFCore = require('./core.js');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

// 内存缓存
let cache = {
  data: null,
  timestamp: 0
};

// 正在进行中的抓取任务（多个请求并发到达时复用同一次抓取，避免轰炸B站接口）
let inflightFetch = null;

/**
 * 缓存过期瞬间的并发请求复用同一次抓取
 */
function fetchWithInflightReuse() {
  if (!inflightFetch) {
    inflightFetch = BAFCore.fetchRawActivities(BAFCore.nodeFetchOne)
      .then(items => BAFCore.transformActivities(items))
      .finally(() => { inflightFetch = null; });
  }
  return inflightFetch;
}

// 静态文件服务（只暴露 public 目录，避免泄露 server.js 源码、打包产物等私有文件）
app.use(express.static(path.join(__dirname, 'public')));

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
    const transformed = await fetchWithInflightReuse();

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
