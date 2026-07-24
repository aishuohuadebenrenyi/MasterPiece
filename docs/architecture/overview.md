# 总体技术架构

更新时间：2026-07-24

仓库包含两个当前可运行客户端：

- 微信个人版：原生小程序、Skyline、Glass-Easel，并承载 CloudBase `improv-api` 部署单元。
- iOS/iPadOS 个人版：SwiftUI Universal App，通过 HTTPS 复用同一 action 与数据契约。

```text
微信小程序 ── wx.cloud.callFunction ──┐
                                     ├─ improv-api ── improv_* 集合 / improv/* 存储
iOS App ───── HTTPS + Apple Session ─┘
```

平台实现分别见 [微信与 CloudBase 架构](wechat.md) 和 [iOS/iPadOS 架构](ios.md)。共享对象、集合和 action 见 [数据契约](data-contract.md)，工程运行事实见 [`apps/wechat-cloudbase/docs/database.md`](../../apps/wechat-cloudbase/docs/database.md)。

## 约束

- 保持单仓库、多产品分区，不复制后端或建立第二套数据模型。
- 小程序与 iOS 可以拥有各自的页面、状态和原生交互实现。
- action、字段、认证和媒体契约变化必须同时核对两个客户端。
- 原型、报告和未来产品计划不得作为运行事实源。
