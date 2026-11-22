/**
 * 构建脚本（零依赖）：单一源 core.js 同步到三端
 *
 * 1. 复制 core.js → public/core.js（Web版）与 extension/core.js（Chrome扩展）
 * 2. 将 core.js 内联进 user.src.js 的占位符，生成 bilibili-activity-filter.user.js
 *    版本号自动取自 package.json，保证三端一致
 * 3. 将 package.json 的 version 同步写入 extension/manifest.json
 *    （扩展商店更新包以此校验版本，漂移会被拒收，必须一起改）
 *
 * 修改 core.js 或 user.src.js 后必须运行：npm run build
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');

// 1. 同步到 Web 版与扩展
fs.writeFileSync(path.join(root, 'public', 'core.js'), core);
fs.writeFileSync(path.join(root, 'extension', 'core.js'), core);

// 2. 同步版本号到扩展 manifest（只替换 version 行，保留 manifest 其余格式与内容）
const manifestPath = path.join(root, 'extension', 'manifest.json');
const manifest = fs.readFileSync(manifestPath, 'utf8');
if (!/"version"\s*:/.test(manifest)) {
  throw new Error('manifest.json 缺少 version 字段');
}
fs.writeFileSync(manifestPath, manifest.replace(/("version"\s*:\s*")[^"]*(")/, `$1${pkg.version}$2`));

// 3. 生成油猴脚本（内联 core + 注入版本号）
const src = fs.readFileSync(path.join(root, 'user.src.js'), 'utf8');
const version = pkg.version;
if (!src.includes('// __BAF_CORE__')) {
  throw new Error('user.src.js 缺少 // __BAF_CORE__ 占位符');
}
const user = src
  .replace('// __BAF_CORE__', core)
  .replace(/^\/\/ @version\s+.*$/m, `// @version      ${version}`);

fs.writeFileSync(path.join(root, 'bilibili-activity-filter.user.js'), user);

console.log(`构建完成: public/core.js, extension/core.js, extension/manifest.json(v${version}), bilibili-activity-filter.user.js`);
