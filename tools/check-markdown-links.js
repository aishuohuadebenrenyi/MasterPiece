const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const ignoredDirectories = new Set([
  '.git',
  '.local-archive',
  '.trae',
  '.codex',
  'project_memory',
  'node_modules',
  '.build',
  'DerivedData'
])

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return []
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolutePath)
    return entry.name.endsWith('.md') ? [absolutePath] : []
  })
}

function normalizeTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().replace(/^<|>$/g, '').split(/\s+["']/)[0]
  const withoutFragment = withoutTitle.split('#')[0].split('?')[0]
  if (!withoutFragment) return null
  if (/^(?:[a-z]+:|\/\/)/i.test(withoutFragment)) return null
  return decodeURIComponent(withoutFragment)
}

const failures = []
for (const markdownFile of walk(root)) {
  const content = fs.readFileSync(markdownFile, 'utf8')
  const targets = [
    ...Array.from(content.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g), (match) => match[1]),
    ...Array.from(content.matchAll(/(?:src|href)=["']([^"']+)["']/g), (match) => match[1])
  ]

  for (const rawTarget of targets) {
    const target = normalizeTarget(rawTarget)
    if (!target) continue
    const absoluteTarget = path.resolve(path.dirname(markdownFile), target)
    if (!fs.existsSync(absoluteTarget)) {
      failures.push(`${path.relative(root, markdownFile)} -> ${rawTarget}`)
    }
  }
}

if (failures.length > 0) {
  console.error('Markdown link check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Markdown link check passed.')
