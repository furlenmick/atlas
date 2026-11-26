# Atlas — 个人知识库

Atlas 是一个纯前端知识库项目：没有后端、没有数据库，数据就是仓库里的
Markdown 文件。代码和生成页面都在这个固定文件夹里，GitHub 是唯一可信来源。

- 16 篇文章，6 个分类，5 篇置顶
- 首页：顶部标题（Atlas 大字 + 副标题）、标题下方的搜索框、总览行、分类卡、
  置顶推荐、分类筛选片、文章列表（扁平列表，分页，每页最多 20 条）；
  吸顶栏里只有「＋ 新增文章」按钮
- 详情页：左侧固定目录（滚动高亮跟随、长目录栏内滚动）、顶部 3px 朱红
  阅读进度条、上一篇/下一篇
- 字体分工：正文无衬线 Noto Sans SC，标题衬线 Noto Serif SC，朱红 `#d94f30`，
  暖纸底色 `#faf7f2`；离线可看，零外部请求

## 目录结构

```
atlas/
├── README.md            本说明
├── articles/            16 篇文章的 Markdown（带 frontmatter），这就是数据源
│   ├── 01-grok-harness.md
│   └── …（共 16 篇）
├── scripts/
│   ├── build.py         构建脚本（Python 标准库，无依赖）
│   └── atlas.js         浏览器端运行代码：新增/编辑/删除、localStorage 改动、导出
└── dist/                构建产物（已提交，拉下来就能看）
    ├── index.html       首页（＋ 新增文章；搜索框在标题下方；文章列表分页，每页最多 20 条）
    └── articles/
        ├── 1.html … 16.html   每篇详情页（编辑 / 删除按钮）
        └── view.html          新增文章的详情页（按 id 渲染）
```

## 在其它主机上拉取并打开

```bash
git clone https://github.com/furlenmick/atlas.git
cd atlas
python3 -m http.server 8000 --directory dist
# 浏览器打开 http://localhost:8000/
```

也可以直接双击打开 `dist/index.html`。

## 构建

改完文章后重新生成 `dist/`：

```bash
python3 scripts/build.py
# 输出：built 16 articles, 6 categories -> …/dist
```

构建脚本只读 `articles/*.md`，生成 `dist/index.html` 和
`dist/articles/<id>.html`，不联网、不依赖任何包。

## 新增 / 修改 / 删除文章

有两种办法，改完都要重新构建并推送，GitHub 才是可信来源。

### 办法一：在浏览器里改（推荐，点按钮就行）

Atlas 是纯前端、没有后端，所以浏览器里的改动先只存在本机浏览器的
localStorage（键名 `atlas_overrides`）里，换浏览器、换电脑、清缓存就
看不到了——必须走下面第 3 步导出，才能真正同步到 GitHub。

1. 首页点「＋ 新增文章」新增；详情页点「编辑」改标题、分类、标签、摘要、
   正文（Markdown），点「删除」会先弹确认框。新增的文章 id 从 1001 开始，
   不会和仓库里已有的 id 冲突；分类下拉里有现成的 6 个分类，也可以选
   「＋ 新分类…」自己填一个。
2. 改完马上就能在页面上看到：首页列表、分类篇数、搜索、置顶都会跟着变；
   被删的文章从列表和搜索里消失；新增的文章点进去是详情页（`view.html`）。
3. 导出本地改动：首页上的「导出改动」按钮已于 2026-11-26 按用户要求去掉，
   但导出功能还在 `scripts/atlas.js` 里（`atlasExportChanges()`），在浏览器
   控制台跑 `atlasExportChanges()` 即可打开导出弹框，里面列出所有本地改动，
   每篇可单独下载对应的 Markdown 文件（新增/修改），也可以一键下载
   `atlas-changes.json`；被删的文章会注明要删掉 `articles/` 里的哪个文件。
4. 把下载的文件放进仓库的 `articles/`（新增放新文件，修改覆盖同名文件，
   删除的删掉对应文件），跑 `python3 scripts/build.py`，检查 `dist/`，
   再提交推送：

```bash
git add -A
git commit -m "更新文章：<标题>"
git push origin main
```

5. 推完之后，在浏览器里做的那份本地改动就可以不用管了——下次打开页面
   时如果还留着旧的 localStorage 改动，会和已同步的仓库内容重叠显示；
   确认 GitHub 上已经有了之后，在浏览器控制台跑
   `localStorage.removeItem('atlas_overrides')` 清掉即可。

### 办法二：直接改文件

1. 在 `articles/` 里新增或修改一个 Markdown 文件。新增时复制一篇已有的
   frontmatter 格式，改 `id`（用下一个未用的数字）、`title`、`category`、
   `tags`、`pinned`、`summary` 即可；正文用标准 Markdown 写，
   二级标题 `##` 会自动进目录，标题后的 `<!-- toc: 短标题 -->` 会用作目录
   里的短标题。删除就是删掉对应文件。
2. 跑 `python3 scripts/build.py` 重新生成。
3. 检查 `dist/` 里对应页面，确认无误后提交并推送：

```bash
git add -A
git commit -m "新增/修改：<文章标题>"
git push origin main
```

GitHub 就是可信来源：本地改完不推，别人拉到的还是旧版；推上去之后，
其它主机 `git pull` 就能拿到最新版。

## 更新记录

- 2026-11-26：搜索框从吸顶栏移到标题下方；去掉首页「导出改动」按钮
  （导出逻辑仍在 `scripts/atlas.js` 的 `atlasExportChanges()` 里，可在控制台
  调用）；文章列表改为扁平分页，每页最多 20 条，底部有上一页/下一页和页码。

## 说明

- 原知识库是带数据库的托管应用（web_fullstack），源码不在工作区、导不出
  来；Atlas 是按它 1:1 复刻的纯前端版，内容以 `articles/` 为准。
- 原文内嵌配图（`kbimg:`）不在仓库里，详情页里以文字占位注明。
- 字体见下方「字体与许可证」一节：已本地打包，不依赖外部字体文件。

## 统一代码（2026-11-26）
- 空间 Atlas、GitHub、atlas.yanchs.com 三处跑同一套代码，唯一源头是本仓库的 `articles/` + `scripts/build.py`，生成 `dist/` 后部署。
- 字体：`assets/fonts/` 内含 Noto Serif SC / Noto Sans SC / JetBrains Mono 的 208 个 woff2 子集（可变字体，wght 200–900），由 Google Fonts API 下载，`dist/assets/fonts.css` 用 `@font-face` 本地加载，页面零外部请求。
- 配图：`assets/images/` 内含 Grok 文章的 9 张图（封面 + 8 张正文图，源自原文 pbs.twimg.com，已按 SHA256 与本地离线版核对一致）与 Harness 流程图；正文 `kbimg:` 引用会渲染为真实图片。其余 15 篇的封面图本地没有原图，暂无配图，不编造。
- 改完后：`python3 scripts/build.py` → 提交推送 → 用 `deploy-atlas.py` 重新部署到 atlas.yanchs.com。

## 字体与许可证

Atlas 打包了三套字体，全部使用 SIL Open Font License 1.1（OFL 1.1），
可免费使用、嵌入、再分发（包括商用），字体本身不得单独出售，改动后的
版本不得使用保留字体名。许可证全文见仓库根目录的 `OFL.txt`，构建时
也会随 `assets/fonts/` 一起复制到 `dist/assets/fonts/OFL.txt`，与字体
文件一起部署上线。

| 字体 | 版权 | 来源 |
| --- | --- | --- |
| Noto Sans SC | Copyright 2014-2021 Adobe，保留字体名 'Source' | Google Fonts |
| Noto Serif SC | Copyright 2017-2024 Adobe，保留字体名 'Source' | Google Fonts |
| JetBrains Mono | Copyright 2020 The JetBrains Mono Project Authors | Google Fonts |

字体文件在 `assets/fonts/`（208 个 woff2 子集，可变字体），由 Google
Fonts API 下载，`dist/assets/fonts.css` 用 `@font-face` 本地加载，页面
零外部请求。
