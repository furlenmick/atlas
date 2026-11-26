---
id: 2
title: "Harness 到底在干嘛：一句话讲清"
category: "AI 与 Agent"
tags: ["Harness", "Agent", "概念图"]
pinned: false
cover_key: harness-explainer
summary: "一句话：大模型只动嘴，Harness 负责动手、传话、兜底。以“修登录闪退”为例走一遍完整流程。"
source_note: "来源：your_files/harness-diagram.md（配套有同名 HTML / PDF / PNG 图）。"
updated_at: "2026-11-26T04:51:42.795Z"
---

# Harness 到底在干嘛？

一句话：大模型只动嘴，Harness 负责动手 + 传话 + 兜底

![Harness 流程图：大模型只动嘴，Harness 负责动手、传话、兜底](kbimg:harness-diagram.png)

## 流程（以“修登录闪退”为例）

```
① 你：说一句话 “修登录闪退”
        ↓
② HARNESS · 准备材料
   把你的话 + 相关文件 + 能用的工具清单，打包好喂给大模型
   它不思考，只负责“拼材料、递话”
        ↓
③ 大模型 · 只动脑、只动嘴
   决定下一步：“先读登录代码”
   它自己不会读文件、改代码、跑测试
        ↓
④ HARNESS · 动手干活
   读文件、改一行代码、跑测试
   再把真实结果贴回去：文件内容 / 测试报错
        ↓
   ↺ 循环 ③ → ④，直到大模型说“修好了”
        ↓
⑤ 收尾：Harness 停下来，向你汇报改了什么
```

## Harness 顺手还管这些（防失控）

- 工具清单：能调哪些工具
- 上下文：一次喂多少文件
- 权限：哪些文件能改 / 不能改
- 上限：试几次就停，不死循环
- 留记录：每步都记下来给你检查
- 目标：盯着你的任务不跑偏

## 分清四个词

- 大模型 = 大脑，只会说话
- Harness = 身体 + 管家，动手 + 传话
- Agent = 大脑 + 身体 + 一个目标
- Codex = 打包好的 Agent：GPT + 自家 Harness + 命令行外壳

## 关键纠正

拆解不是 Codex 在外面先拆，是大模型自己拆；
循环也不只是“再问一次”，关键是中间 Harness 真的动手改了、跑了。
