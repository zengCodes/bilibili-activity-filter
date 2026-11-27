# AGENT.md

在这个仓库干活前先看一眼。项目介绍看 `README.md`，这里只写规矩。

## 1. 升版本必须先问

改版本号、跑 `npm run pack`、跑 `npm run release`、生成新 zip、更新油猴 `@version`——**动手前先问一声，等用户点头。**

问的时候别只说"要不要升版"，把三件事一起讲清楚：

1. 这次改了啥（修 bug 还是加功能）
2. 建议升到几（修 bug 走 patch，加功能走 minor，大改走 major）
3. 会连带改哪些产物，要不要重新上传商店

不用问的：平时改代码、调试、跑 `npm run build`（版本没变）、本地 commit。commit 不等于发布。

就算"顺手"，也不许自己跳版本号。

## 2. 版本号只有一个源头

`package.json` 是唯一出处，`npm run build` 负责同步到 manifest 和油猴脚本。

所以这几个是生成物，**别手改**，改了也会被覆盖：

- `public/core.js`、`extension/core.js`
- `bilibili-activity-filter.user.js`
- `extension/manifest.json` 里的 `version`

`pack` 会校验两处版本一致，不一致直接报错——那是提醒你漏跑 build，不是让你绕过。

## 3. 三端同源，改一处记得改另一处

- `core.js` 是共享逻辑源，改完 build 一下，三端自动一致
- 改 `extension/content.js` 或 `content.css`，**必须同步改 `user.src.js`**，再 build
- `public/index.html` 结构不一样（用 `.filter-btn` 那套），别照抄扩展的写法

照抄容易踩的三个差异：扩展走 `chrome.storage`、油猴走 `localStorage` 的 `baf_settings`；扩展标题是 logo，油猴是 🏀；收藏字段名也不同。

## 4. 改完自己先验一遍

- 动过的 JS 跑 `node --check`
- 动过源码跑 `npm run build`，确认产物重新生成了
- 界面改动没法自动验，交付时**明确告诉用户**：去 `edge://extensions` 重新加载（油猴要重装脚本），再刷新活动页。不这么做看到的还是旧代码，最容易被当成"改了没用"
- 布局问题先在本地搭个 1:1 复现页定位，别在真实页面上试错。以前的 `debug/panel-repro.html` 已随 `debug/` 清掉了（该目录不进库），需要就重建

## 5. 提交和发布的分寸

- commit 用 `type: 中文描述`，类型就那五个：`feat` `fix` `style` `docs` `chore`。升版的提交把版本号带上
- 这仓库的 commit 有时会在 `git add` 之前被外部工具抢先建好，导致报 `nothing to commit`。用 `git log origin/main..HEAD` 看一眼，能推就直接 `git push`，别重复提交
- 商店上传、ScriptCat 更新都由用户自己做。我们只负责产出正确的 zip 和 `user.js`，并告诉他文件在哪
- 仓库目前是公开的（匿名就能打开），但口径不变：不引导别人 clone、提 Issue 或 PR，统一引导到脚本页评论区

## 6. 对外的话怎么说

README、商店描述、推广文、评论回复都算：

- 不提 AI，一个字都别沾
- 可以讲功能和任务本身的难点（页面异步渲染、接口只给标签不给分类、门槛奖励靠推断）；别编具体劳动过程，比如"我 debug 了一整天"
- 只讲真实能用的安装路径：Edge 商店上架了；Chrome 得先装 Edge 版，再从本地目录加载，而且不会自动更新
- 网页版和 Node 后端要自己 `npm start` 才能跑，面向普通用户时别当成使用方式介绍，只作为技术方案讲

## 7. 写文档：短，像人说话

- 能一句说完别写三段。一个功能的说明控制在两百字内，除非用户要详版
- 别用"旨在""鉴于""综上""实现了"这类词，直接说干了啥
- 不堆形容词。"大幅提升""显著优化"这种，要么给数据，要么删掉
- 表格只在真要对账时用，两三行能讲清就用列表
- 写完自己读一遍，拗口的地方就是该拆的句子
- 更新日志只记大改动：新功能、使用方式变了、行为不一样了才写。修 bug、调标签、补图标这类不写进面向用户的日志
- 文档配图放 `screenshots/`，引用时用 jsDelivr 地址（`https://testingcf.jsdelivr.net/gh/zengCodes/bilibili-activity-filter@main/screenshots/xxx.png`）。
  **别用 raw.githubusercontent.com**，国内解析不了，用户看到的是裂图；jsDelivr 也不通时可以退到 `https://ghfast.top/` 前缀

## 8. 常用命令

```bash
npm run build        # 同步 core 和版本号到三端，改完源码必跑
npm run start        # 起本地代理（绕 CORS）
npm run pack         # 打成 chrome / edge 两个 zip，算发布物，先问
npm run release      # 自动 patch 升版再打包，等于升版，先问
npm run update-data  # 刷新离线兜底数据
```

## 9. 文件都在哪

```
core.js                        共享核心逻辑（分类推断、数据转换）
user.src.js                    油猴脚本源，改这个不是 .user.js
extension/content.js|.css      页面注入的工具栏和停靠面板
extension/background.js        请求、缓存、设置持久化
extension/popup.html|js        扩展弹窗
public/index.html              Web 版界面
server.js                      Express 代理，缓存一小时
data.js                        40 条离线兜底数据
scripts/build.js|pack.js       构建和打包
userscript-description.md      脚本商店描述和更新记录，大改动记得补
```

`*.zip`、`debug/`、`.workbuddy/`、`juejin-article/` 都不进库。
