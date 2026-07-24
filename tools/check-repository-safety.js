const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8'
}).split('\0').filter(Boolean)

const forbiddenPaths = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)(node_modules|DerivedData[^/]*|xcuserdata|\.build)(\/|$)/,
  /\.xcuserstate$/,
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)project\.config\.json$/,
  /(^|\/)project\.private\.config\.json$/,
  /\.(?:pem|key|p8|p12|pfx|cer|crt|der|mobileprovision|jks|keystore)$/i,
  /^project_memory\//,
  /^\.codex\//,
  /^\.trae\//,
  /^\.local-archive\//,
  /^data\/cloudbase-imports\/improv_materials(?:\.import)?\.json$/,
  /^releases\/ios-personal\/(?:USER-ACTION-CHECKLIST|release-task-ledger|test-evidence)\.md$/,
  /^docs\/reports\/_shared\//
]

const contentRules = [
  {
    name: '真实微信 AppID',
    pattern: /\bwx[a-f0-9]{16}\b/gi
  },
  {
    name: 'Figma 文件标识或链接',
    pattern: /https?:\/\/(?:www\.)?figma\.com\/|fileKey\b/gi
  },
  {
    name: '私钥',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  },
  {
    name: '常见访问令牌',
    pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKID[A-Za-z0-9]{13,})\b/g
  },
  {
    name: '非空 envId',
    pattern: /\benvId\s*[:=]\s*['"](?!(?:your-|<|__REPLACE|)['"])[^'"]+['"]/g
  },
  {
    name: 'CloudBase 生产地址',
    pattern: /https?:\/\/(?!(?:registry\.npmjs\.org|<))[^ \t\r\n"'<>]*(?:tcloudbase|tcb-api|cloudbase)[^ \t\r\n"'<>]*/gi
  }
]

const allowedEmailDomains = new Set(['example.com', 'users.noreply.github.com'])
const emailPattern = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi
const findings = []

for (const relativePath of trackedFiles) {
  if (forbiddenPaths.some((pattern) => pattern.test(relativePath))) {
    findings.push(`${relativePath}: 禁止跟踪的文件或目录`)
    continue
  }

  const absolutePath = path.join(root, relativePath)
  const stat = fs.statSync(absolutePath)
  if (stat.size > 10 * 1024 * 1024) {
    findings.push(`${relativePath}: 文件超过 10 MB`)
  }

  const buffer = fs.readFileSync(absolutePath)
  if (buffer.includes(0)) continue

  const content = buffer.toString('utf8')
  if (relativePath === 'tools/check-repository-safety.js') continue

  for (const rule of contentRules) {
    rule.pattern.lastIndex = 0
    if (rule.pattern.test(content)) {
      findings.push(`${relativePath}: ${rule.name}`)
    }
  }

  emailPattern.lastIndex = 0
  for (const match of content.matchAll(emailPattern)) {
    if (!allowedEmailDomains.has(match[1].toLowerCase())) {
      findings.push(`${relativePath}: 个人或未允许的邮箱`)
      break
    }
  }
}

const publicScreenshots = trackedFiles.filter((file) =>
  /^docs\/screenshots\/.*\.(?:png|jpe?g)$/i.test(file)
)
if (publicScreenshots.length > 5) {
  findings.push(`docs/screenshots/: 公开截图数量为 ${publicScreenshots.length}，上限为 5`)
}

if (findings.length > 0) {
  console.error('Repository safety check failed:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Repository safety check passed (${trackedFiles.length} tracked files, ${publicScreenshots.length} public screenshots).`)
