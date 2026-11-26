---
id: 15
title: "Codex CLI 在 Windows 上的安装流程（进行中）"
category: "AI 与 Agent"
tags: ["Codex", "Windows", "PowerShell", "CLI"]
pinned: false
cover_key: codex-windows
summary: "npm 安装已完成（0.168.0），登录待跑 Sign in with ChatGPT；踩坑：PowerShell 执行策略拦 .ps1 垫片，用 codex.cmd 或改 RemoteSigned。"
source_note: "整理自 2026-11-13 安装记录；不是对话原文。"
updated_at: "2026-11-26T04:51:42.795Z"
---

# Codex CLI 在 Windows 上的安装流程（进行中）

> 状态：2026-11-13 已装好 CLI（版本 0.168.0），登录尚未完成。
> 机器：本机 Win11。开发角色定位：以架构师 + 代码审查为主，大部分编码交给 agent，所以 CLI 是日常主力入口。

## 已走通的步骤

1. 经 npm 安装 Codex CLI。
2. 验证版本：`codex.cmd --version` 输出 0.168.0，安装成功。

## 待完成

1. 跑 `codex`，选 **Sign in with ChatGPT** 完成登录。
2. WezTerm 已下载（2026-11-13），待把默认 shell 配成 PowerShell 7。

## 踩坑记录

- **PowerShell 执行策略会拦 `codex`**：直接跑 `codex --version` 曾被拦下，因为 npm 生成的 codex.ps1 在 Restricted 策略下禁止运行。两个解法：
  - `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` 放开当前用户策略；或
  - 一直用 `codex.cmd` 启动，绕开 .ps1。
- 记住这个坑的通用形态：npm 装的 CLI 在 Windows 上都有 .ps1 垫片，凡是"命令存在却跑不起来先报策略错误"，先换 .cmd 试。
