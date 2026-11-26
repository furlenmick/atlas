---
id: 9
title: "住宅出口与链式代理选型定版"
category: "节点与代理"
tags: ["链式代理", "住宅IP", "RackNerd", "Verizon", "Cliproxy"]
pinned: false
cover_key: residential-proxy
summary: "主力链定版：RackNerd 前置 + Proxy-Seller Verizon 静态住宅末跳；1024proxy 只作试用，Cliproxy 洛杉矶粘性线测试中；附买前核实清单与选型排序。"
source_note: "整理自 2026-10-15/18 链式出口定版与 2026-11-23 Cliproxy 测试记录；不是对话原文。"
updated_at: "2026-11-26T04:51:42.795Z"
---

# 住宅出口与链式代理选型定版

> 定版：2026-10-15/18 链式出口已定；Cliproxy 洛杉矶线 2026-11-23 测试中。
> 用途：给地区敏感账号准备干净出口，以及给节点做前置链。先看结论，再看细节。

## 定版结论：主力链式出口

- 结构：RackNerd VPS 作 vless 入口中转（前置链）→ Proxy-Seller Verizon Business 静态 IP 作末跳出口。
- 末跳属性：住宅属性、human 81.77% / IPPure 1%、原生 IP；GeoIP 大区美东，设备时区按 America/New_York 钉死。
- 待办：跑业务实测 + 完成 RackNerd 前置链式配置，之后才把敏感账号迁过来。

## 备用与试用线

- **1024proxy**：只留 $0.99 动态住宅试用，给谷歌重试当非美出口用，不作主力。
- **Cliproxy 洛杉矶**（测试中）：us.cliproxy.io:3010，SOCKS5，粘性会话约 120 分钟。自测出口 ***，Charter/Spectrum AS20001 住宅 IP，时区 America/Los_Angeles。注意：非固定 IP，约 120 分钟后可能换 IP，用前必须重测；尚未决定是否用它替换 Verizon 作主力末跳。

## 选型规则（踩出来的）

- **机场大多做不了链式前置**：买前必须核实是否支持中转 / UDP / ToS；TikTok 等场景必须 UDP 通，不通直接排除。
- **Proxy-Seller 不支持选地区**：ISP 静态线只有美 / 英 / 德 / 法 / 日 5 国；要城市级定位只能找客服。
- **住宅静态 > 动态住宅 > 机房 IP**：敏感账号只认第一档；动态住宅只配做重试和非敏感业务；机房 IP 只能当节点中转，绝不直接登敏感账号（与《Claude 账号防封与付款完整流程》的定级一致）。

## 踩坑记录

- **链式能不能搭，先问再买**：前置链需要中转支持，很多机场套餐买完才发现不支持——核实顺序要在付款之前。
- **粘性会话不是固定 IP**：Cliproxy 的"粘性"只有约 120 分钟，拿它当固定出口用会在换 IP 时翻车；每次用前重测出口 IP 和归属。
