/**
 * 离线数据更新脚本：抓取B站最新活动 → 生成 public/data.js
 *
 * 运行：npm run update-data（需 Node 18+，依赖全局 fetch）
 * 发布/提交前运行一次，让离线 fallback 数据跟随发布流程更新，
 * 避免手工维护导致数据过期（旧数据会被"已结束"过滤，离线模式近乎空列表）。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const BAFCore = require(path.join(root, 'core.js'));

async function main() {
  console.log('正在从B站抓取最新活动数据...');
  const items = await BAFCore.fetchRawActivities(BAFCore.nodeFetchOne);
  const data = BAFCore.transformActivities(items);

  const header = `/**
 * B站活动数据 - 离线fallback
 * 当后端服务未启动时使用此数据
 * 数据来源：https://www.bilibili.com/blackboard/era/reward-activity-list-page.html#/list
 * 本文件由 npm run update-data 自动生成，请勿手工编辑
 * 更新时间：${new Date().toLocaleString('zh-CN', { hour12: false })}
 * 条目数：${data.length}
 */
const FALLBACK_ACTIVITIES = `;

  fs.writeFileSync(path.join(root, 'public', 'data.js'), header + JSON.stringify(data, null, 2) + ';\n');
  console.log(`已生成 public/data.js：${data.length} 个活动`);
}

main().catch(err => {
  console.error('更新失败:', err.message);
  process.exit(1);
});
