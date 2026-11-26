# Atlas — 个人知识库

Atlas 是一个纯前端知识库项目：没有后端、没有数据库，数据就是仓库里的
Markdown 文件。代码和生成页面都在这个固定文件夹里，GitHub 是唯一可信来源。

- 16 篇文章，6 个分类，5 篇置顶
- 首页：吸顶搜索、总览行、分类卡、置顶推荐、分类筛选片、文章卡
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
│   └── build.py         构建脚本（Python 标准库，无依赖）
└── dist/                构建产物（已提交，拉下来就能看）
    ├── index.html       首页
    └── articles/
        └── 1.html … 16.html   每篇详情页
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

## 新增 / 修改文章

1. 在 `articles/` 里新增或修改一个 Markdown 文件。新增时复制一篇已有的
   frontmatter 格式，改 `id`（用下一个未用的数字）、`title`、`category`、
   `tags`、`pinned`、`summary` 即可；正文用标准 Markdown 写，
   二级标题 `##` 会自动进目录，标题后的 `<!-- toc: 短标题 -->` 会用作目录
   里的短标题。
2. 跑 `python3 scripts/build.py` 重新生成。
3. 检查 `dist/` 里对应页面，确认无误后提交并推送：

```bash
git add -A
git commit -m "新增/修改：<文章标题>"
git push origin main
```

GitHub 就是可信来源：本地改完不推，别人拉到的还是旧版；推上去之后，
其它主机 `git pull` 就能拿到最新版。

## 说明

- 原知识库是带数据库的托管应用（web_fullstack），源码不在工作区、导不出
  来；Atlas 是按它 1:1 复刻的纯前端版，内容以 `articles/` 为准。
- 原文内嵌配图（`kbimg:`）不在仓库里，详情页里以文字占位注明。
- 字体只写字体名、不加载外部字体文件，在没装 Noto 的 Windows 上会回退
  到系统宋体/黑体。
