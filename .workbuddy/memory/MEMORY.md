# 项目长期约定 · bilibili-activity-filter

## 分发渠道（重要，写任何对外文案都要遵守）

- **代码仓库是私有的**（GitHub）。不对外提供 `git clone`。
  → 面向用户的文档（README / 推广文 / 商店描述 / 回复评论）**不要引导 clone、提 Issue、提 PR**，
  统一改成"评论区反馈 / 邮件反馈"。
- **扩展仅上架 Microsoft Edge 加载项商店**，未上架 Chrome 网上应用店。
  - 理由：Edge 商店**免开发者注册费**，审核更快，同为 Chromium 内核代码无需改动。
  - Chrome 用户的安装路径：先在 Edge 装 → 到
    `C:\Users\<用户名>\AppData\Local\Microsoft\Edge\User Data\Default\Extensions\<扩展ID>\<版本号>\`
    找到解压目录 → Chrome `chrome://extensions/` 开启开发者模式 → 加载该**版本号目录**。
    （副作用：不会自动更新。）
  - 已知事实：Edge 商店的扩展**无法**在 Chrome 里从商店页直接安装；但反过来 Edge 支持直接装
    Chrome 网上应用店的扩展。
- 项目里的**网页版（index.html）与 Node 后端（server.js）源码未公开**，
  对外只能作为"技术方案"讲解，不能作为"使用方式"介绍。

## 项目结构速记

- `extension/` —— MV3 扩展：`content.js` 向 B站活动列表页
  （`blackboard/era/reward-activity-list-page.html`）注入筛选工具栏；`background.js` 负责请求与缓存；
  `popup.html/js` 弹窗展示"即将截止"。
- `server.js` —— Express 代理（绕 CORS），1 小时内存缓存，`/api/activities`、`/api/refresh`。
- `data.js` —— 40 条离线兜底数据，后端未启动时使用。
- 数据源：`api.bilibili.com/x/activity_components/video_activity/hot_activity`，分页 4 页 ≈ 173 条。

## Edge 扩展商店

- 扩展名：**B站活动筛选助手**
- 商店地址：`https://microsoftedge.microsoft.com/addons/detail/cgecpefaijldaikaepdebafgghoaljle`
- 扩展 ID：`cgecpefaijldaikaepdebafgghoaljle`

## 对外内容的口径约定（重要）

- **扩展主要是由 AI 生成代码的。用户已决定：对外不公开这一点，但绝不虚构劳动。**
  → 写任何对外文案时：
  - **可以**说"我做了这个工具""这个项目"（项目层面的归属）；
  - **可以**描述**任务本身的难点**（页面异步渲染、接口只给标签不给分类、门槛与奖励靠推断、
    扩展失效不报错、报错现象误导）；
  - **禁止**写"我 debug 了一整天""我一个个手调""我的代码……"这类**具体劳动过程 / 时长 / 调试细节**
    —— 一旦被追问就会穿帮，且性质上属于虚假信息。
  - **禁止**出现任何 AI 相关的字眼（曾有"AI 不会告诉你哪个词是噪音"的意外泄漏，务必排查）。
- 掘金红线（查证结论）：掘金社区规范明确「AI 生成的文章全部不推荐」并降权；用户协议要求 AI 生成内容
  **显著标识**；有奖活动"AI 检测超 70% 取消资格"。
  → **"人写的文章 + 讲项目经历"安全；"AI 写的文章"踩线。**
  文章本身发布前建议让用户用口语过一遍，降低 AI 撰稿痕迹。

## 文档产出

- `juejin-article/B站活动筛选助手-掘金推广文.md` —— 掘金推广正文。
  **当前为非技术版**（已按用户要求删除"技术实现"与"项目结构"两节）。
  留存的技术章节内容见 `2026-10-02.md` 日志；如需恢复技术版可据此重建，架构图脚本已被删除。
- `juejin-article/发布指南.md` —— 标题备选 / 摘要 / 分类标签 / 图片上传对照表 / 风险提示 / 评论区 FAQ
- `juejin-article/assets/` —— 5 张配图：`01-cover`（插画封面）+ `02-pain`/`03-match`/`04-deadline`/`05-bug`（表情包）
- `juejin-article/tools/make-memes.py` —— 表情包字幕叠加脚本（改字幕文案后重跑即可）

## 表情包生产线（可复用）

1. 用 ImageGen 出**纯白背景、上下留白、明确"无文字"**的 Q版卡通角色底图
   （当前角色设定：**圆滚滚的白色小熊 + 粉色头戴式耳机**，与封面插画呼应）。
2. 用 Pillow 叠字幕：字体 `C:/Windows/Fonts/msyhbd.ttc`，`stroke_width≈12` + `stroke_fill='#FFFFFF'` 白描边黑字，
   经典表情包观感。**绝不让 AI 写字，中文必糊。**
3. 统一 `quantize(256)` 压缩，单张 400–600 KB。
