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
  'material.get',
  'inspiration.create',
  'rehearsal.create',
  'practiceRecord.create',
  'methodCard.create',
  'practice.complete',
  'rehearsal.complete',
  'feedback.create',
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

const wxssFiles = collectFiles(path.join(root, 'frontend'), '.wxss')
wxssFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8')
  assert(!/max-width:\s*none/.test(source), `Skyline unsupported max-width remains: ${path.relative(root, file)}`)
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
assert(discover.includes('buildFacetOptions'), 'discover page does not build dynamic facet options')
assert(discover.includes('page.facets'), 'discover page does not consume server facets')

const materialService = read('frontend/services/material.ts')
const materialDetail = read('frontend/pages/material-detail/index.ts')
assert(materialService.includes("('material.get'"), 'material service does not call material.get')
assert(materialDetail.includes('getMaterial(id)'), 'material detail does not load material by id')
assert(!materialDetail.includes('const serverMaterials = await listMaterials()'), 'material detail still depends on default material list pagination')
assert(backend.includes('scanLimitReached'), 'material.list must expose scan limit capacity state')
assert(backend.includes('MAX_MATERIAL_SCAN + 1'), 'material.list must detect scan limit overflow')

const { buildMaterialFacets, buildMaterialTypeCounts, MATERIAL_TYPES } = require('../backend/cloudfunctions/improv-api/material-policy')
const facetMaterials = [
  { type: '游戏', title: '接龙', desc: '', abilities: ['积极聆听'], scenes: ['排练'], tags: [], meta: [], saved: true, played: false, referenceOnly: false },
  { type: '角色', title: '身份卡', desc: '', abilities: ['角色塑造'], scenes: ['排练'], tags: [], meta: [], saved: false, played: true, referenceOnly: false },
  { type: '路径', title: '学习地图', desc: '', abilities: ['积极聆听'], scenes: ['备课'], tags: [], meta: [], saved: false, played: false, referenceOnly: true }
]
const facets = buildMaterialFacets(facetMaterials, { query: '', type: '游戏', ability: 'all', scene: '排练', status: 'all' })
assert(facets.types['游戏'] === 1 && facets.types['角色'] === 1, 'type facets must ignore the selected type and apply other dimensions')
assert(facets.abilities['积极聆听'] === 1 && facets.abilities['角色塑造'] === 0, 'ability facets must apply selected type and scene')
assert(facets.scenes['备课'] === 0 && facets.scenes['排练'] === 1, 'scene facets must ignore the selected scene and apply selected type')
assert(facets.statuses.saved === 1 && facets.statuses.played === 0, 'status facets must apply selected type and scene')
const categoryCounts = buildMaterialTypeCounts(facetMaterials)
assert(categoryCounts['游戏'] === 1 && categoryCounts['角色'] === 1 && categoryCounts['路径'] === 1, 'category counts must ignore pagination and filters')
assert(MATERIAL_TYPES.length === 8, 'material taxonomy must keep eight fixed types')

const helpTemplate = read('frontend/pages/help/index.wxml')
;['认识素材分类与筛选', '训练能力', '使用场景', '标签不会创建新的一级分类'].forEach((text) => {
  assert(helpTemplate.includes(text), `help page missing material guidance: ${text}`)
})

const privacyTemplate = read('frontend/pages/privacy/index.wxml')
;['昵称', '剧团名', '头像', 'cloud://', '选填联系方式'].forEach((text) => {
  assert(privacyTemplate.includes(text), `privacy page missing disclosure: ${text}`)
})
const releaseRunbook = fs.readFileSync(path.join(root, '..', 'docs/release-runbook.md'), 'utf8')
;['云函数资源与回滚', '数据库安全规则验收', 'npm audit --omit=dev', '15 张视觉审计清单截图'].forEach((text) => {
  assert(releaseRunbook.includes(text), `release runbook missing: ${text}`)
})

const rehearsalRecordTemplate = read('frontend/pages/rehearsal-record/index.wxml')
const practiceRecordsTemplate = read('frontend/pages/practice-records/index.wxml')
assert(rehearsalRecordTemplate.includes('bindrefresherrefresh="onPullDownRefresh"'), 'rehearsal record page must use scroll-view refresher')
assert(practiceRecordsTemplate.includes('bindrefresherrefresh="onPullDownRefresh"'), 'practice records page must use scroll-view refresher')
assert(rehearsalRecordTemplate.includes('refresher-triggered="{{isRefreshing}}"'), 'rehearsal record page must bind refresher state')
assert(practiceRecordsTemplate.includes('refresher-triggered="{{isRefreshing}}"'), 'practice records page must bind refresher state')

const discoverTemplate = read('frontend/pages/discover/index.wxml')
assert(discoverTemplate.includes('role="button" aria-label="切换到全部素材"'), 'discover all switch needs accessible label')
assert(discoverTemplate.includes('aria-label="查看{{category.type}}分类，{{category.count}}条素材"'), 'discover category card needs accessible label')

const feedbackService = read('frontend/services/feedback.ts')
const settingsPage = read('frontend/pages/settings/index.js')
const settingsTemplate = read('frontend/pages/settings/index.wxml')
assert(feedbackService.includes("'feedback.create'"), 'feedback service does not call feedback.create')
assert(settingsPage.includes("require('../../services/feedback')"), 'settings page does not import feedback service')
assert(settingsPage.includes('await createFeedback('), 'settings page does not submit feedback')
assert(settingsTemplate.includes('bindtap="submitFeedback"'), 'settings template does not bind feedback submit action')
assert(backend.includes('retryable: true'), 'account.delete must return retryable partial-failure status')
assert(backend.includes('results.push({ target:'), 'account.delete must collect per-target delete results')

const bottomSheetTemplate = read('frontend/components/bottom-sheet/index.wxml')
const bottomSheetStyles = read('frontend/components/bottom-sheet/index.wxss')
const bottomSheetScript = read('frontend/components/bottom-sheet/index.js')
assert(bottomSheetTemplate.includes('<view class="sheet-scroll-static">'), 'bottom-sheet fit mode must use a normal view')
assert(
  bottomSheetTemplate.includes('<scroll-view scroll-y enable-flex enhanced show-scrollbar="{{false}}" class="sheet-scroll">'),
  'bottom-sheet scroll mode must use a vertical scroll-view'
)
assert(
  !bottomSheetTemplate.includes('scroll-y="{{resolvedBodyMode'),
  'bottom-sheet fit and scroll modes must not share one scroll-view'
)
assert(/\.sheet-scroll\s*\{[^}]*height:\s*calc\(/s.test(bottomSheetStyles), 'bottom-sheet scroll mode must have an explicit height')
assert(/\.sheet-scroll-static\s*\{[^}]*overflow-y:\s*auto/s.test(bottomSheetStyles), 'bottom-sheet fit mode must cap long content')
assert(bottomSheetScript.includes("value: 'fit'"), 'bottom-sheet must default to fit mode')

const emptyStatePanelStyles = read('frontend/components/empty-state-panel/index.wxss')
assert(/\.empty-state-panel \.empty-actions\s*\{[^}]*flex-wrap:\s*wrap/s.test(emptyStatePanelStyles), 'empty-state-panel actions must wrap on narrow cards')
assert(/\.empty-state-panel \.empty-action-btn\s*\{[^}]*min-width:\s*0/s.test(emptyStatePanelStyles), 'empty-state-panel buttons must not force card overflow')

const practiceFeedbackTemplate = read('frontend/pages/practice-feedback/index.wxml')
const practiceFeedbackStyles = read('frontend/pages/practice-feedback/index.wxss')
assert(!practiceFeedbackTemplate.includes('title="{{material.title}}"'), 'practice feedback header must not repeat the material title')
assert(practiceFeedbackTemplate.includes('practice-duration-summary'), 'practice feedback must show duration in a dedicated summary block')
assert(/\.score-value-badge\s*\{[^}]*align-items:\s*center/s.test(practiceFeedbackStyles), 'score badge text must be vertically centered')

const practiceRecordsJson = read('frontend/pages/practice-records/index.json')
const practiceRecordsScript = read('frontend/pages/practice-records/index.js')
const materialFilterHandler = practiceRecordsScript.match(/setMaterialFilter\(e\)\s*\{[\s\S]*?\n  \},/)
const materialOptionsSync = practiceRecordsScript.match(/syncMaterialOptions\(records = \[\]\)\s*\{[\s\S]*?\n  \},/)
const practiceRecordsOnLoad = practiceRecordsScript.match(/onLoad\(options = \{\}\)\s*\{[\s\S]*?\n  \},/)
assert(practiceRecordsJson.includes('"search-bar": "../../components/search-bar/index"'), 'practice records material sheet must register search-bar')
assert(practiceRecordsTemplate.includes('<search-bar'), 'practice records material sheet must use shared search-bar')
assert(!practiceRecordsTemplate.includes('material-search-clear'), 'practice records material sheet must not keep custom clear button')
assert(practiceRecordsTemplate.includes('data-index="{{index}}"'), 'practice records material options must pass a stable option index')
assert(!practiceRecordsScript.includes('暂无练习记录'), 'practice records material options must not include materials without records')
assert(materialFilterHandler && !materialFilterHandler[0].includes("dataset.value || 'all'"), 'practice records material option selection must not fall back to all when dataset is missing')
assert(materialOptionsSync && !materialOptionsSync[0].includes('filters,'), 'practice records material option sync must not rewrite active filters')
assert(practiceRecordsOnLoad && practiceRecordsOnLoad[0].includes('materialId })'), 'practice records must preserve route materialId before remote records load')

console.log(`Checked ${requiredActions.length} actions, ${pageFiles.length} page scripts, ${wxmlFiles.length} templates and ${wxssFiles.length} stylesheets`)
