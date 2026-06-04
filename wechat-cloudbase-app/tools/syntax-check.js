const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const jsFiles = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (entry.name.endsWith('.js')) jsFiles.push(full)
  }
}

walk(root)

for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8')
  try {
    new Function('require', 'module', 'exports', source)
  } catch (error) {
    console.error(`Syntax error in ${path.relative(root, file)}`)
    throw error
  }
}

console.log(`Checked ${jsFiles.length} JavaScript files`)
