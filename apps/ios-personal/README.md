# 即兴工具箱 iOS / iPadOS 个人版

SwiftUI Universal App，最低支持 iOS/iPadOS 17。客户端复用微信工程中的 CloudBase `improv-api` 与共享数据契约。

## 当前能力

- 发现、搜索、分类、抽卡、收藏和自建素材。
- 快速灵感、练习复盘、排练计划与记录。
- 待整理、方法卡、帮助、隐私、反馈和账号删除。
- iPhone Tab 导航与 iPad `NavigationSplitView` 工作区。
- Mock 本地预览和 CloudBase HTTPS Repository。

公开仓库不包含生产 CloudBase、Apple 登录、媒体网关或 App Store Connect 配置。

## 本地运行

```bash
cd apps/ios-personal
swift test
swift run ImprovToolCoreValidation
open ImprovToolIOS.xcodeproj
```

Xcode 工程中的 `DEVELOPMENT_TEAM` 为空。开发者在自己的 Xcode 账号中选择 Team，不要提交个人 Team ID、证书、描述文件或用户状态。

## CloudBase 配置

通过本地 Scheme 环境变量注入 HTTPS endpoint：

```text
IMPROV_CLOUDBASE_API_ENDPOINT=https://<your-cloudbase-http-endpoint>
```

未配置时使用 `MockAppRepository`。正式环境所需 session secret、媒体网关地址和签名 secret 只配置在服务端环境变量中，不进入客户端或 Git。

Apple 登录得到的 identity token 只用于交换 CloudBase session；session 保存在 Keychain，不写入源码、日志或文档。

## 验证范围

- `路径` 素材不能开始训练。
- 排练和单素材练习全局互斥。
- 素材筛选、搜索和收藏状态。
- 灵感、练习、排练和方法卡写入契约。
- 空复盘拦截与媒体上传失败保稿。

公开运行截图见仓库根 README。完整内部视觉审计和发布证据不随公开源码发布，说明见 [`Docs/README.md`](Docs/README.md)。

共享架构见 [`../../docs/architecture/ios.md`](../../docs/architecture/ios.md)，公开 App Store 文案见 [`../../releases/ios-personal/README.md`](../../releases/ios-personal/README.md)。
