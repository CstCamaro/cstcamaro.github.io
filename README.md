# Camaro · 边界之外

面向网络安全研究员的静态博客。深色与浅色主题、文章搜索与分类、代码复制、文章目录、归档、关于页、RSS 和站点地图。无需安装第三方依赖。

## 中英文版本

首次访问默认英文：https://cstcamaro.github.io/ 。中文版：https://cstcamaro.github.io/zh/ 。右上角的 `EN / 中文` 在对应页面之间切换，所选语言保存在当前浏览器；选择中文后，再次访问首页会自动进入中文版。直接打开其他语言页面仍可正常查看。

两种语言都有独立的页面标题、简介、导航、关于页、归档和 RSS。界面文案在 `scripts/locales.mjs` 中维护；站点标题和描述在 `site.config.json` 的 `locales.en` 与 `locales.zh` 中维护。

## 本地预览

安装 Node.js 20 或更新版本后，在项目目录执行：

```sh
npm run build
npm run check
npm run preview
```

打开 http://127.0.0.1:4173/ 。修改内容后重新执行构建，刷新浏览器。

Windows PowerShell 如限制执行 `npm.ps1`，可将上述命令中的 `npm` 换为 `npm.cmd`，无需修改系统执行策略。

## 写一篇文章

1. 新建 `posts/2026-10-20-my-research.md`，参考下方格式填写元信息。
2. 修改开头的标题、日期、分类、标签和摘要。
3. 写入正文，将 `draft: true` 改为 `draft: false`。
4. 提交到 `master`，GitHub Actions 将自动构建并发布。

```yaml
---
title: 一篇新的研究笔记
date: 2026-10-20
category: Web 安全
tags: ["HTTP", "Research"]
lang: zh
translationKey: my-research
summary: 用一两句话概括文章内容。
draft: false
demo: false
featured: true
---
```

`featured: true` 将文章设为首页精选；存在多篇精选时显示日期最新的一篇。分类和标签会自动从文章中读取。`draft: true` 和以下划线开头的文件不会发布。文章按日期降序显示；未来日期不会自动隐藏，请用 `draft` 控制发布。当前没有示例文章或草稿，文章目录仅保留空目录占位文件。

文章用 `lang: en` 或 `lang: zh` 指定语言，分别进入英文或中文列表；旧文章未写 `lang` 时按中文处理。中英文正文需分别撰写，系统不会自动翻译。两篇译文使用同一个 `translationKey`，例如 `my-research`，即可在文章页切换到对应译文；没有译文时，切换会返回另一语言的首页。不同文件名即可，例如 `2026-10-20-my-research-en.md` 和 `2026-10-20-my-research-zh.md`。

正文支持标题、段落、粗体、斜体、行内代码、链接、图片、无序列表、有序列表、引用、围栏代码块和简单表格。代码块可标注语言；当前以统一等宽样式展示，不提供语法高亮。原始 HTML 会转义，不执行。暂不支持嵌套列表、脚注、数学公式、MDX 和内嵌 HTML。不要依赖未支持的 Markdown 扩展。

文章截图放到 `assets/images/`，正文引用示例：`![实验环境截图](/assets/images/lab.png)`。建议填写有意义的图片说明，并在发布前对截图中的敏感信息脱敏。

## 修改站点信息

编辑 `site.config.json` 中的名字、各语言标题和简介、GitHub 地址。个人介绍文案位于 `scripts/locales.mjs`，页面结构位于 `scripts/render.mjs`，样式位于 `assets/style.css`。

当前发布地址为 https://cstcamaro.github.io/ ，源码仓库为 `CstCamaro/cstcamaro.github.io`。根路径站点的 `basePath` 为 `""`。如果以后使用自定义域名，需要修改 `url` 并配置 GitHub Pages 和 DNS。

## 自动发布

在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。工作流位于 `.github/workflows/pages.yml`，每次推送到 `master` 自动运行；也支持在 Actions 页面手动运行。部署产物为 `dist/`，源文件与历史保留在仓库中。

## 设计

橄榄黑背景、薄荷绿标记、衬线强调与网格线示意图。移动端自动折叠侧栏；支持键盘操作、减少动态效果偏好和主题记忆。按 `/` 聚焦首页搜索。字体通过 Google Fonts 加载，网络不可用时回退至本机字体；核心功能不依赖外部资源。

英文 RSS 地址：`/feed.xml`；中文 RSS 地址：`/zh/feed.xml`。纯静态实现，无后台、评论系统、访问统计或数据库。
