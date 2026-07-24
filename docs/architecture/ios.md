# iOS / iPadOS 技术架构

更新时间：2026-07-24

运行工程位于 [`apps/ios-personal/`](../../apps/ios-personal/README.md)，最低支持 iOS/iPadOS 17.0。

## 客户端

- SwiftUI Universal App。
- 实用型 MVVM-Clean：Domain、Repository、ViewModel 与 SwiftUI Presentation。
- iPhone 使用系统 `TabView` 与单列 `NavigationStack`。
- iPad regular workspace 使用 `NavigationSplitView`；iPadOS 18+ 顶层允许 `.sidebarAdaptable`。
- 主题和纯 UI 偏好本地保存，业务事实来自 Repository。

## 后端与认证

- 通过 HTTPS 调用共享 `improv-api`。
- Sign in with Apple 经 `auth.apple` 换取短期 CloudBase `sessionToken`。
- iOS 用户映射到 `ownerOpenId = "ios:<appleUserId>"`，与微信 OPENID 隔离。
- 媒体上传、读取和删除使用绑定 method、owner、object key 与过期时间的签名 URL。
- 未配置生产 endpoint 时只允许显式 Mock/预览环境；Release 不得静默回退。

## 工程验证

```bash
cd apps/ios-personal
swift test
swift run ImprovToolCoreValidation
```

Simulator、Release 与 UI 测试命令见 [应用 README](../../apps/ios-personal/README.md)。App Store 外部门禁见 [`releases/ios-personal/`](../../releases/ios-personal/README.md)。
