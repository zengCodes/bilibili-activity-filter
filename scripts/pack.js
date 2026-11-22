/**
 * 打包脚本：把 extension/ 目录打成商店上传用的 zip
 *
 * - 条目路径强制正斜杠（manifest.json 引用的是 icons/icon16.png 这类正斜杠路径，
 *   Windows 右键压缩会产生反斜杠条目，商店解析时会丢图标/国际化文件而被拒）
 * - 文件名带版本号，双产物输出到项目根：
 *   bilibili-activity-filter-chrome-v{version}.zip / bilibili-activity-filter-edge-v{version}.zip
 *   （同一份扩展，仅按目标商店区分命名，Edge 商店上传用 edge 版）
 * - 打包时逐条目自检，发现反斜杠则删除产物并以失败退出，坏包不会留下
 *
 * 前置：先运行 npm run build（本脚本只打包，不构建）
 * 运行：node scripts/pack.js（或 npm run pack）
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));

// 版本一致性双保险：build.js 会同步 manifest 版本，这里再拦一次（漏 build 直接打包会产出错版本）
if (manifest.version !== pkg.version) {
  console.error(`版本不一致: package.json=${pkg.version}, extension/manifest.json=${manifest.version}，请先 npm run build`);
  process.exitCode = 1;
  return;
}

// 两端共用同一份 MV3 扩展（Edge 兼容 Chrome 包格式），zip 内容一致，仅按目标商店区分文件名
const outNames = [
  `bilibili-activity-filter-chrome-v${pkg.version}.zip`,
  `bilibili-activity-filter-edge-v${pkg.version}.zip`,
];
const outPath = path.join(root, outNames[0]);
const fail = (msg) => {
  for (const n of outNames) fs.rmSync(path.join(root, n), { force: true }); // 半成品一律删除
  console.error(`打包失败: ${msg}`);
  process.exitCode = 1;
};

const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

// 自检：逐条目记录反斜杠路径；archive 流式错误也归入失败
let badEntry = null;
archive.on('entry', (e) => {
  if (!badEntry && String(e.name).includes('\\')) badEntry = e.name;
});
archive.on('error', (err) => {
  if (!badEntry) badEntry = err.message;
});
archive.on('warning', (err) => {
  // ENOENT = 打包途中源文件消失，会产出缺文件的包，按失败处理；其余警告忽略
  if (err.code === 'ENOENT') fail(err.message);
});

output.on('close', () => {
  if (badEntry) return fail(badEntry.includes('\\') ? `发现反斜杠条目 ${badEntry}` : badEntry);
  fs.copyFileSync(outPath, path.join(root, outNames[1])); // Edge 版 = Chrome 版同内容复制
  console.log(`已生成 ${outNames[0]} 与 ${outNames[1]}（各 ${archive.pointer()} 字节，v${manifest.version}）`);
});

archive.pipe(output);
// false = 不带 extension/ 顶层目录，manifest.json 直接在 zip 根（商店要求）
archive.directory(path.join(root, 'extension'), false);
archive.finalize();
