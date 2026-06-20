const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function collectFiles(directory, extension, result = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectFiles(fullPath, extension, result)
    else if (entry.name.endsWith(extension)) result.push(fullPath)
  })
  return result
}

const backend = read('backend/cloudfunctions/improv-api/index.js')
const requiredActions = [
  'material.list',
  'inspiration.create',
  'rehearsal.create',
  'practiceRecord.create',
  'methodCard.create',
  'practice.complete',
  'rehearsal.complete',
  'account.delete'
]

requiredActions.forEach((action) => {
  assert(backend.includes(`'${action}'`), `missing backend action: ${action}`)
})

;['inspirations', 'methodCards', 'rehearsals', 'practiceRecords'].forEach((key) => {
  assert(backend.includes(`[COLLECTIONS.${key}]`), `whitelist is not keyed by collection: ${key}`)
})

;[
  'materialTitle',
  'rehearsalTitle',
  'reviewKeep',
  'reviewTry',
  'reviewReminder',
  'linkedMaterialId',
  'linkedRehearsalId'
].forEach((field) => {
  assert(backend.includes(`'${field}'`), `missing canonical backend field: ${field}`)
})

const wxmlFiles = collectFiles(path.join(root, 'frontend'), '.wxml')
wxmlFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8')
  assert(!/bind:?input=/.test(source), `Skyline input rule violation: ${path.relative(root, file)}`)
})

const pageFiles = collectFiles(path.join(root, 'frontend/pages'), '.js')
  .concat(collectFiles(path.join(root, 'frontend/pages'), '.ts'))
pageFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8')
  assert(!source.includes("syncStatus: 'pending'"), `fake pending write remains: ${path.relative(root, file)}`)
  assert(!source.includes('已本地保存，待同步'), `fake local-save success remains: ${path.relative(root, file)}`)
})

const discover = read('frontend/pages/discover/index.ts')
assert(discover.includes('listMaterialsPage'), 'discover page does not use paged material API')
assert(discover.includes('currentOffset'), 'discover page does not track material offset')

console.log(`Checked ${requiredActions.length} actions, ${pageFiles.length} page scripts and ${wxmlFiles.length} templates`)
