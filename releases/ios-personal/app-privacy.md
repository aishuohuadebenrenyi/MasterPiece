# App Privacy Details 填报口径

1.0.0 不跟踪用户、不投放广告、不接入第三方分析 SDK。以下数据均与用户身份关联，用途选择 **App Functionality**，`Used for Tracking` 选择 **No**：

| App Store 数据类型 | 应用中的对应数据 |
| --- | --- |
| Name | 用户主动填写的昵称 |
| Other User Contact Info | 意见反馈中选填的联系方式 |
| Photos or Videos | 用户主动上传的头像、灵感与练习附件 |
| Audio Data | 用户主动保存的录音附件 |
| Other User Content | 灵感、复盘、排练、方法卡、自定义素材与反馈正文 |
| User ID | Sign in with Apple 用户标识及服务端账号命名空间 |

不申报：位置、通讯录、健康、财务、购买记录、设备 ID、搜索历史、浏览历史、广告数据。当前应用不主动保存分析、崩溃或性能遥测；若后续启用 App Analytics 之外的诊断 SDK，须在发版前重新审计。

仓库声明位置：`apps/ios-personal/Sources/PrivacyInfo.xcprivacy`。App Store Connect 的答案必须与清单、应用内隐私政策、公开隐私政策和后端实际字段一致。

官方口径：

- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Describing data use in privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)
