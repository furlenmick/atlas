---
id: 13
title: "RedPocket $30/年 eSIM 使用手册（实测版）"
category: "账号与服务"
tags: ["RedPocket", "eSIM", "漫游", "WiFi Calling", "验证码"]
pinned: false
cover_key: redpocket-esim
summary: "GSMA 线路与中国漫游的实测手册：网页开 Enable Roaming、漫游余额、WhatsApp 能收码而 Telegram 未收到、WiFi Calling 在中国必须走美国 IP 拉起。"
source_note: "整理自 2026-11-25 激活与实测记录；不是对话原文。"
updated_at: "2026-11-26T04:51:42.795Z"
---

# RedPocket $30/年 eSIM 使用手册（实测版）

> 状态：已激活，客服 Sean 重新应用套餐并修正日期后数据恢复正常。
> 设备：iPhone XS Max（A2104）。登录 RedPocket 须关 VPN、换连接。

## 套餐事实

- 套餐：360 Day Unlimited Talk/Text + 200MB 5G，$30/年。
- 数据：200MB/200MB（客服修正后恢复满额）。
- WiFi Calling：已开启。
- 余额续期：2026-12-26；下次付款：2027-11-25。

## 线路铁律

- 当前线路是 **GSMA（AT&T）**——唯一含国际漫游的网。别切到 GSMT / CDMA，切过去漫游就没了。
- 漫游只有 GSMA 套餐有，CDMA / GSMT 没有。

## 中国漫游（已实测可用）

1. 官网 Roaming 页显示 CHINA included；Roaming Balances 为 100/100 Minutes。
2. 必须在网页上点 **Enable Roaming** 开通，光插卡不会自动开。
3. 官方说法是须在美国境内先选好目的地国家；但本人已在中国实测漫游可用——以实测为准，官方口径记录在此备查。
4. 实测结论：没有 WiFi Calling 也打通了电话，蜂窝漫游本身能通话。

## 收短信（注册验证码用）

- WhatsApp 短信：已收到，收短信能力已证实。
- Telegram 注册：未收到码。同一线路不同服务结果不同，注册前先想好备选验证方式。

## WiFi Calling 在中国的限制（重点）

- AT&T 官网明确：WiFi Calling 在中国不可用，中国 IP 直连会被拒签。
- 拉起条件：必须走美国 IP——用支持 UDP 的美区节点做热点 / 旁路由，让手机流量从美国出口走。
- 佐证：此前唯一一次状态栏出现 "RedPocket Wi-Fi" 时，手机正开着 VPN（美国 IP）。

## 踩坑记录

- **611 / 800 免费电话在境外常打不通**，不要拿它当"线路是否正常"的测试标准，会误判。
- **套餐日期出过错**：初激活时日期不对，是客服 Sean 重新应用套餐才修正的——激活后第一件事核对数据余额和日期，不对立刻找客服。
- **登录要关 VPN**：开着 VPN 登不上 RedPocket 账户，关掉并换一条连接再登。
