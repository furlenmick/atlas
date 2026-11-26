---
id: 14
title: "Lather & Lore 手工皂站：发布流程与待办"
category: "网站与项目"
tags: ["Lather & Lore", "Cloudflare", "Workers", "网站发布", "Search Console"]
pinned: false
cover_key: lather-lore
summary: "yanchs.com 的发布通道已打通（Token 自动发布）；剩下 Search Console 验证待手动——部署 Token 无 DNS 权限，网域验证要本人加 TXT 或改用网址前缀验证。"
source_note: "整理自 2026-11-12 上线记录；不是对话原文。"
updated_at: "2026-11-26T04:51:42.795Z"
---

# Lather & Lore 手工皂站：发布流程与待办（定版）

> 状态：2026-11-12 已上线。站点 yanchs.com（手工皂品牌 Lather & Lore）。
> 发布通道已打通：改完内容由 Muse 经 Cloudflare 自动发布，不需要手动上传。

## 站点事实

- 域名 yanchs.com 已在 Cloudflare 托管，同时绑了 www.yanchs.com。
- 部署方式：Cloudflare Workers 静态上传，预览域名 lather-and-lore.ruiyingyui.workers.dev。
- 商品：6 款手工皂，均 $12。
- Instagram 三处入口统一指向 https://www.instagram.com/ruiyingyui/
- 页脚作者：Site Author Paul Lee，邮箱 yanchi@yanchs.com。
- About 页人物 Lin Wei 是虚构的中国女皂匠形象（品牌故事用，不是真人）。

## 发布流程（已走通）

1. 改内容（文案、商品、图片）。
2. 用部署 Token `***`（已接入 Cloudflare 连接器）自动发布到 Workers。
3. 发布后打开 yanchs.com 与 www 两个地址各验一遍，确认新内容生效。

## 待办：Google Search Console（需本人手动）

1. 去 Google Search Console 建资源并验证所有权：
   - 网域验证需要在 Cloudflare 加 DNS TXT 记录——部署 Token 没有 DNS 权限，这一步只能本人手动在 Cloudflare 加；或改用"网址前缀"验证方式绕开。
2. 验证通过后提交 sitemap。
3. 请求编入索引。

## 踩坑记录

- **Token 权限边界**：部署 Token 能发布站点，但没有 DNS 权限。凡是涉及改 DNS 的验证方式都会卡住，要么本人手动加记录，要么换不依赖 DNS 的验证方式。
