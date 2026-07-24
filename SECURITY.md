# 安全政策

## 报告漏洞

请使用 GitHub 仓库的 **Private vulnerability reporting** 提交安全问题。不要在公开 Issue 中包含密钥、生产地址、用户数据、可利用步骤或尚未修复的漏洞细节。

报告应包含受影响版本、最小复现、影响范围和建议修复方式。维护者确认后再协商公开披露时间。

## 仓库安全边界

不得提交：

- 微信 AppID/AppSecret、CloudBase envId、SecretId/SecretKey 或生产 endpoint；
- Apple Developer Team ID、App Store Connect API Key、签名证书、描述文件或审核账号；
- GitHub token、SSH 私钥、API key、密码、session/access/identity token；
- 真实 OpenID、邮箱、手机号、头像或其他用户数据；
- `.env`、`project.config.json`、`project.private.config.json` 和本地开发工具状态。

提交前运行：

```bash
node tools/check-repository-safety.js
```
