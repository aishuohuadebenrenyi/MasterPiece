import type { Material, MaterialType, ViewMode } from '../../types/domain'
import { createMaterial, listMaterials, updateMaterial, updateSaved } from '../../services/material'
import { getState, setMaterials, setState, subscribe, toggleSaved, getThemeClass } from '../../store/index'
import { toast } from '../../utils/page'
import { closeModal, openModal } from '../../utils/modal'
import { syncTabBar } from '../../utils/tabbar'
import { getLayoutStyle } from '../../utils/layout'
import { DEFAULT_PAGE_LIMIT, DEFAULT_SORT_ORDER, CATEGORY_SUGGESTION_LIMIT } from '../../config/constants'

const materialTypes: MaterialType[] = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const defaultCategoryOptions = ['游戏', '角色', '才艺', '格式', '主理', '技巧', '复盘', '路径']
const abilityOptions = ['自发性', 'Yes And', '积极聆听', '角色塑造', '情绪表达', '身体空间', '叙事构建', '失败复原', '主持', '团队协作']
const sceneOptions = ['临场速查', '备课', '排练', '演出']

type NewMaterialDraft = Partial<Material> & {
  people?: string
  duration?: string
  steps?: string
}

type CategoryCard = {
  type: MaterialType
  count: number
  tone: string
  hint: string
}

type CategoryCardRow = {
  id: string
  items: CategoryCard[]
}

type ExpandCardItem = {
  title: string
  desc: string
}

type PathPreset = {
  key: string
  title: string
  desc: string
  preview: string[]
  abilities: string[]
  scenes: string[]
  steps: ExpandCardItem[]
  tips: string
  sortOrder: number
}

type PathEntry = {
  key: string
  title: string
  desc: string
  preview: string[]
  customLabel: string
}

type PathSheetState = {
  key: string
  title: string
  desc: string
  abilities: string[]
  scenes: string[]
  steps: ExpandCardItem[]
  tips: string
  customId: string
  editText: string
  saveText: string
}

type PathDraft = {
  title: string
  desc: string
  steps: string
  abilityText: string
  tips: string
}

const fabSizeRpx = 116
const fabRightRpx = 42
const fabBottomRpx = 160
const fabDragThreshold = 6
const categoryHints: Record<MaterialType, string> = {
  游戏: '热身、短篇和限制玩法',
  角色: '身份、关系和状态素材',
  才艺: '模仿、身体和声音技能',
  格式: '短篇结构和长篇框架',
  主理: '主持词、带练和控场话术',
  技巧: 'Yes And、聆听和叙事能力',
  复盘: 'Keep、Try 和失败案例',
  路径: '训练地图和学习路线'
}
const learningMapItems: ExpandCardItem[] = [
  { title: '入门基础', desc: 'Yes And、积极聆听、接住同伴。' },
  { title: '身体与声音', desc: '空间、节奏、状态、情绪。' },
  { title: '角色关系', desc: '身份、关系、目标、状态差。' },
  { title: '叙事结构', desc: '平台、打破常规、升级、回收。' },
  { title: '格式与主理', desc: '短篇玩法、长篇框架、控场话术、复盘。' }
]
const trainingPathItems: ExpandCardItem[] = [
  { title: '个人热身', desc: '观察、联想、声音/身体启动。' },
  { title: '双人场景', desc: '接话、关系、情绪推进。' },
  { title: '小组排练', desc: '游戏组合、节奏控制、失败恢复。' },
  { title: '演出准备', desc: '开场、格式选择、主理提示。' },
  { title: '演后复盘', desc: 'Keep / Try、方法卡沉淀、下次提醒。' }
]
const learningMapPreview = ['反应', '身体', '角色', '叙事', '主理']
const trainingPathPreview = ['热身', '双人', '小组', '演出', '复盘']
const pathPresets: PathPreset[] = [
  {
    key: 'learning-map',
    title: '学习地图',
    desc: '从基础反应到格式主理，按能力层层展开。',
    preview: learningMapPreview,
    abilities: ['自发性', '积极聆听', '身体空间', '角色塑造', '叙事构建', '主持'],
    scenes: ['备课'],
    steps: learningMapItems,
    tips: '学习地图用于查阅和自定义学习顺序，不进入训练计时。',
    sortOrder: 980
  },
  {
    key: 'training-path',
    title: '训练路径',
    desc: '从个人启动到演后复盘，形成一条可执行路线。',
    preview: trainingPathPreview,
    abilities: ['身体空间', '积极聆听', '团队协作', '主持', '失败复原'],
    scenes: ['备课', '排练'],
    steps: trainingPathItems,
    tips: '训练路径用于安排练习方向，具体练习仍从非路径素材开始。',
    sortOrder: 981
  }
]

function buildMaterialMeta(people = '', duration = '') {
  return [people || '', duration || ''].filter(Boolean)
}

function buildCategoryRows(cards: CategoryCard[]): CategoryCardRow[] {
  const rows: CategoryCardRow[] = []
  for (let index = 0; index < cards.length; index += 2) {
    rows.push({
      id: `category-row-${index}`,
      items: cards.slice(index, index + 2)
    })
  }
  return rows
}

function getPathPreset(key: string) {
  return pathPresets.find((preset) => preset.key === key) || pathPresets[0]
}

function getCustomPathMaterial(materials: Material[], key: string) {
  return materials.find((material) => material.type === '路径' && material.relatedMaterialId === key) || null
}

function splitPathText(value: string) {
  return String(value || '').split(/[,\n，、；;]+/).map((item) => item.trim()).filter(Boolean)
}

function materialToPathSteps(material: Material | null, preset: PathPreset) {
  if (!material || !material.steps || !material.steps.length) return preset.steps
  return material.steps.map((step, index) => ({
    title: step,
    desc: preset.steps[index]?.desc || ''
  }))
}

function buildPathEntries(materials: Material[]): PathEntry[] {
  return pathPresets.map((preset) => {
    const custom = getCustomPathMaterial(materials, preset.key)
    return {
      key: preset.key,
      title: custom?.title || preset.title,
      desc: custom?.desc || preset.desc,
      preview: custom?.steps && custom.steps.length ? custom.steps.slice(0, 5) : preset.preview,
      customLabel: custom ? '我的版本' : ''
    }
  })
}

Page({
  data: {
    themeClass: 'theme-default',
    materials: [] as Material[],
    filteredMaterials: [] as Material[],
    categoryCards: [] as CategoryCard[],
    categoryRows: [] as CategoryCardRow[],
    pathEntries: buildPathEntries([]) as PathEntry[],
    pathVisible: false,
    pathEditMode: false,
    pathSheetTitle: '',
    activePath: null as PathSheetState | null,
    pathDraft: {} as PathDraft,
    view: 'all' as ViewMode,
    activeCategory: '' as MaterialType | '',
    isCategoryDetail: false,
    allActiveClass: 'active',
    categoryActiveClass: '',
    discoverTitle: '全部素材',
    searchPlaceholder: '搜索素材、能力或场景',
    query: '',
    type: 'all',
    ability: 'all',
    scene: 'all',
    status: 'all',
    randomVisible: false,
    filterVisible: false,
    addVisible: false,
    modalOpen: false,
    randomIndex: 0,
    drawnCount: 1,
    randomUseAllMaterials: false,
    currentRandomMaterial: null as Material | null,
    newMaterial: {} as NewMaterialDraft,
    selectedCategoryTags: ['游戏'] as string[],
    customCategoryVisible: false,
    customCategoryFocus: false,
    customCategoryInput: '',
    categorySuggestions: [] as Array<{ value: string; label: string }>,
    showMoreOptions: false,
    moreOptionsToggleText: '补充训练方法',
    typeCategoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    abilityCategoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    sceneCategoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    typeFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    abilityFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    sceneFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    statusFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    fabReady: false,
    fabX: 0,
    fabY: 0,
    layoutStyle: '',
    loadingMaterials: true,
    loadErrorText: '',
    showEmptyState: false,
    showLoadErrorState: false,
    showFilterNoMatchState: false,
    hasMore: true,
    pageLoading: false,
    privacyVisible: false
  },

  unsubscribeStore: null as null | (() => void),
  unsubscribePrivacy: null as null | (() => void),
  fabStartTouch: null as null | { x: number; y: number },
  fabTouchOffset: null as null | { x: number; y: number },
  fabWindow: null as null | { width: number; height: number; size: number },
  fabMoved: false,
  fabIgnoreTapUntil: 0,
  currentLimit: DEFAULT_PAGE_LIMIT,

  getRandomCandidates() {
    const source = this.data.randomUseAllMaterials ? this.data.materials : this.data.filteredMaterials
    return source.filter((material: Material) => !material.referenceOnly)
  },

  syncFromStore() {
    const state = getState()
    this.setData({
      materials: state.materials,
      view: state.viewMode
    }, () => this.syncFiltered())
  },

  getFilteredMaterials() {
    const { materials, query, type, ability, scene, status, activeCategory } = this.data
    const lowerQuery = query.trim().toLowerCase()
    return materials.filter((material: Material) => {
      const effectiveType = activeCategory || type
      const inType = effectiveType === 'all' || material.type === effectiveType
      const inAbility = ability === 'all' || (material.abilities || []).includes(ability) || (material.tags || []).includes(ability)
      const inScene = scene === 'all' || (material.scenes || []).includes(scene) || (material.tags || []).includes(scene)
      const inStatus = status === 'all'
        || (status === 'saved' && material.saved)
        || (status === 'played' && material.played)
        || (status === 'unplayed' && !material.played && !material.referenceOnly)
      const text = `${material.title} ${material.desc} ${material.type} ${(material.tags || []).join(' ')} ${(material.abilities || []).join(' ')} ${(material.scenes || []).join(' ')} ${(material.meta || []).join(' ')}`.toLowerCase()
      return inType && inAbility && inScene && inStatus && (!lowerQuery || text.includes(lowerQuery))
    })
  },

  buildCategoryCards() {
    const tones = ['orange', 'blue', 'mint', 'orange', 'blue', 'mint', 'orange', 'blue']
    return materialTypes.map((type, index) => ({
      type,
      count: this.data.materials.filter((material: Material) => material.type === type).length,
      tone: tones[index],
      hint: categoryHints[type]
    }))
  },

  syncFiltered() {
    const filteredMaterials = this.getFilteredMaterials()
    const randomCandidates = this.getRandomCandidates()
    const categoryCards = this.buildCategoryCards()
    const isCategoryDetail = !!this.data.activeCategory
    const showLoadErrorState = !this.data.loadingMaterials && !!this.data.loadErrorText && this.data.materials.length === 0
    const showEmptyState = !this.data.loadingMaterials && !this.data.loadErrorText && this.data.materials.length === 0
    const showFilterNoMatchState = !this.data.loadingMaterials && this.data.materials.length > 0 && (this.data.view === 'all' || isCategoryDetail) && filteredMaterials.length === 0
    this.setData({
      filteredMaterials,
      categoryCards,
      categoryRows: buildCategoryRows(categoryCards),
      pathEntries: buildPathEntries(this.data.materials),
      currentRandomMaterial: randomCandidates[this.data.randomIndex % Math.max(randomCandidates.length, 1)] || null,
      allActiveClass: this.data.view === 'all' ? 'active' : '',
      categoryActiveClass: this.data.view === 'category' ? 'active' : '',
      isCategoryDetail,
      discoverTitle: isCategoryDetail ? this.data.activeCategory : '全部素材',
      searchPlaceholder: isCategoryDetail ? `在${this.data.activeCategory}里搜索` : '搜索素材、能力或场景',
      showEmptyState,
      showLoadErrorState,
      showFilterNoMatchState,
      typeFilters: [{ value: 'all', label: '全部' }].concat(materialTypes.map((item) => ({ value: item, label: item }))).map((item) => {
        const effectiveType = this.data.activeCategory || this.data.type
        return Object.assign({}, item, {
          activeClass: effectiveType === item.value ? 'active' : ''
        })
      }),
      abilityFilters: [{ value: 'all', label: '全部' }].concat(abilityOptions.map((item) => ({ value: item, label: item }))).map((item) => Object.assign({}, item, {
        activeClass: this.data.ability === item.value ? 'active' : ''
      })),
      sceneFilters: [
        { value: 'all', label: '全部' },
        { value: '临场速查', label: '临场速查' },
        { value: '备课', label: '备课' },
        { value: '排练', label: '排练' },
        { value: '演出', label: '演出' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.scene === item.value ? 'active' : ''
      })),
      statusFilters: [
        { value: 'all', label: '全部' },
        { value: 'played', label: '练过' },
        { value: 'unplayed', label: '未练过' },
        { value: 'saved', label: '收藏' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.status === item.value ? 'active' : ''
      })),
      typeCategoryOptions: materialTypes.map((value) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      abilityCategoryOptions: abilityOptions.map((value) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      sceneCategoryOptions: sceneOptions.map((value) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      categorySuggestions: this.getCategorySuggestions(this.data.customCategoryInput)
    })
  },

  getCategoryPool() {
    const categories: string[] = []
    defaultCategoryOptions.forEach((item) => categories.push(item))
    this.data.materials.forEach((material: Material) => {
      categories.push(material.type)
      ;(material.tags || []).forEach((tag) => categories.push(tag))
      ;(material.abilities || []).forEach((ability) => categories.push(ability))
    })
    return Array.from(new Set(categories.map((item) => String(item).trim()).filter(Boolean)))
  },

  getCategorySuggestions(input: string) {
    const keyword = String(input || '').trim().toLowerCase()
    if (!keyword) return []
    return this.getCategoryPool()
      .filter((item) => item.toLowerCase().includes(keyword))
      .slice(0, CATEGORY_SUGGESTION_LIMIT)
      .map((value) => ({ value, label: value }))
  },

  async loadMaterials(showRetryToast = false, loadMore = false) {
    if (loadMore) {
      if (!this.data.hasMore || this.data.pageLoading) return
      this.currentLimit += DEFAULT_PAGE_LIMIT
      this.setData({ pageLoading: true })
    } else {
      this.currentLimit = DEFAULT_PAGE_LIMIT
      this.setData({ loadingMaterials: true, loadErrorText: '', hasMore: true }, () => this.syncFiltered())
    }
    try {
      const items = await listMaterials({ limit: this.currentLimit })
      setMaterials(items)
      if (items.length < this.currentLimit) {
        this.setData({ hasMore: false })
      }
    } catch (error) {
      this.syncFromStore()
      const loadErrorText = getState().materials.length
        ? '云端同步失败，先继续查看本次会话里的素材。'
        : '云端暂时不可用，稍后重试，或先手动添加素材。'
      this.setData({ loadErrorText })
      if (showRetryToast) toast(loadErrorText)
    } finally {
      this.setData({ loadingMaterials: false, pageLoading: false }, () => this.syncFiltered())
    }
  },

  async onPullDownRefresh() {
    await this.loadMaterials()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadMaterials(false, true)
  },

  onShareAppMessage() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  onShareTimeline() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      query: '',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  async onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    this.resetFabPosition()
    this.unsubscribeStore = subscribe(() => this.syncFromStore())
    const app = getApp()
    if (app.subscribePrivacy) {
      this.unsubscribePrivacy = app.subscribePrivacy(() => {
        this.setData({ privacyVisible: true })
      })
    }
    await this.loadMaterials()
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
    syncTabBar(this, 0)
    this.syncFromStore()
  },

  onUnload() {
    if (this.unsubscribeStore) this.unsubscribeStore()
    if (this.unsubscribePrivacy) this.unsubscribePrivacy()
  },

  onPrivacyAgree() {
    const app = getApp()
    if (app.onPrivacyAgree) app.onPrivacyAgree()
    this.setData({ privacyVisible: false })
  },

  onPrivacyRefuse() {
    const app = getApp()
    if (app.onPrivacyRefuse) app.onPrivacyRefuse()
    this.setData({ privacyVisible: false })
  },

  onResize() {
    this.setData({ layoutStyle: getLayoutStyle() })
    this.resetFabPosition()
  },

  resetFabPosition() {
    const wxApi = wx as any
    const info = wxApi.getWindowInfo ? wxApi.getWindowInfo() : wxApi.getSystemInfoSync()
    const rpxRatio = info.windowWidth / 750
    const safeBottom = info.safeArea && typeof info.safeArea.bottom === 'number'
      ? Math.max(0, (info.screenHeight || info.windowHeight) - info.safeArea.bottom)
      : 0
    const fabSize = fabSizeRpx * rpxRatio
    const x = Math.max(0, info.windowWidth - fabSize - fabRightRpx * rpxRatio)
    const y = Math.max(0, info.windowHeight - fabSize - fabBottomRpx * rpxRatio - safeBottom)
    this.fabWindow = { width: info.windowWidth, height: info.windowHeight, size: fabSize }
    this.setData({ fabReady: true, fabX: x, fabY: y })
  },

  switchView(event: WechatMiniprogram.TouchEvent) {
    const view = event.currentTarget.dataset.view as ViewMode
    const patch: Record<string, unknown> = {
      activeCategory: '',
      query: '',
      type: 'all',
      randomIndex: 0,
      drawnCount: 1,
      randomUseAllMaterials: false
    }
    this.setData(patch, () => {
      setState({ viewMode: view })
    })
  },

  search(event: WechatMiniprogram.Input) {
    this.setData({ query: event.detail.value }, () => this.syncFiltered())
  },

  clearSearchQuery() {
    this.setData({ query: '' }, () => this.syncFiltered())
  },

  openCategoryDetail(event: WechatMiniprogram.TouchEvent) {
    const activeCategory = String(event.currentTarget.dataset.type || '') as MaterialType
    if (!materialTypes.includes(activeCategory)) return
    this.setData({
      view: 'category',
      activeCategory,
      type: 'all',
      query: '',
      randomIndex: 0,
      drawnCount: 1,
      randomUseAllMaterials: false
    }, () => {
      setState({ viewMode: 'category' })
      this.syncFiltered()
    })
  },

  backToCategoryGrid() {
    this.setData({
      activeCategory: '',
      query: '',
      type: 'all',
      randomIndex: 0,
      drawnCount: 1,
      randomUseAllMaterials: false
    }, () => this.syncFiltered())
  },

  buildActivePath(key: string): PathSheetState {
    const preset = getPathPreset(key)
    const custom = getCustomPathMaterial(this.data.materials, key)
    const source = custom || preset
    return {
      key,
      title: source.title,
      desc: source.desc,
      abilities: source.abilities || preset.abilities,
      scenes: source.scenes || preset.scenes,
      steps: custom ? materialToPathSteps(custom, preset) : preset.steps,
      tips: source.tips || preset.tips,
      customId: custom?.id || '',
      editText: custom ? '编辑我的版本' : '编辑我的版本',
      saveText: custom ? '保存修改' : '保存为我的路径'
    }
  },

  openPathSheet(event: WechatMiniprogram.TouchEvent) {
    const key = String(event.currentTarget.dataset.key || '')
    if (!key) return
    openModal(this, {
      pathVisible: true,
      pathEditMode: false,
      activePath: this.buildActivePath(key),
      pathSheetTitle: this.buildActivePath(key).title,
      pathDraft: {}
    })
  },

  editPath() {
    const activePath = this.data.activePath
    if (!activePath) return
    this.setData({
      pathEditMode: true,
      pathSheetTitle: '编辑 · ' + activePath.title,
      pathDraft: {
        title: activePath.title,
        desc: activePath.desc,
        steps: activePath.steps.map((item: ExpandCardItem) => item.title).join('\n'),
        abilityText: activePath.abilities.join('，'),
        tips: activePath.tips
      }
    })
  },

  cancelPathEdit() {
    const activePath = this.data.activePath
    this.setData({
      pathEditMode: false,
      pathDraft: {},
      activePath: activePath ? this.buildActivePath(activePath.key) : null
    })
  },

  handlePathDraftFieldChange(event: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    const field = String(event.currentTarget.dataset.field || '')
    if (!field) return
    this.setData({ [`pathDraft.${field}`]: String(event.detail?.value || '') })
  },

  async savePathDraft() {
    const activePath = this.data.activePath
    if (!activePath) return
    const preset = getPathPreset(activePath.key)
    const title = String(this.data.pathDraft.title || '').trim()
    if (!title) {
      toast('先写路径名称')
      return
    }
    const abilities = splitPathText(this.data.pathDraft.abilityText)
    const steps = splitPathText(this.data.pathDraft.steps)
    const material: Material = {
      id: activePath.customId || `custom-${activePath.key}-${Date.now()}`,
      title,
      desc: String(this.data.pathDraft.desc || '').trim(),
      type: '路径',
      tags: Array.from(new Set(['路径', '学习路径', '自定义'].concat(abilities))),
      abilities,
      scenes: preset.scenes,
      meta: ['我的路径', '参考'],
      steps,
      tips: String(this.data.pathDraft.tips || '').trim(),
      variant: '',
      issue: '',
      relatedMaterialId: activePath.key,
      referenceOnly: true,
      stripeTone: 'mint',
      sortOrder: preset.sortOrder
    }
    try {
      if (activePath.customId) await updateMaterial(material)
      else await createMaterial(material)
      const nextMaterials = [material].concat(getState().materials.filter((item) => item.id !== material.id))
      setMaterials(nextMaterials)
      this.setData({
        materials: nextMaterials,
        pathEditMode: false,
        activePath: {
          key: activePath.key,
          title: material.title,
          desc: material.desc,
          abilities: material.abilities,
          scenes: material.scenes,
          steps: materialToPathSteps(material, preset),
          tips: material.tips,
          customId: material.id,
          editText: '编辑我的版本',
          saveText: '保存修改'
        },
        pathDraft: {}
      }, () => this.syncFiltered())
      toast(activePath.customId ? '已保存修改' : '已保存为我的路径')
    } catch (error) {
      toast('路径保存失败，请稍后再试')
    }
  },

  filterType(event: WechatMiniprogram.TouchEvent) {
    const value = (event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value
    this.setData({ type: value, activeCategory: '' }, () => this.syncFiltered())
  },

  filterAbility(event: WechatMiniprogram.TouchEvent) {
    const value = (event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value
    this.setData({ ability: value }, () => this.syncFiltered())
  },

  filterScene(event: WechatMiniprogram.TouchEvent) {
    const value = (event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value
    this.setData({ scene: value }, () => this.syncFiltered())
  },

  filterStatus(event: WechatMiniprogram.TouchEvent) {
    const value = (event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value
    this.setData({ status: value }, () => this.syncFiltered())
  },

  openMaterial(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/game-detail/index?id=${event.detail.id}` })
  },

  openMaterialFromTap(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '')
    if (id) wx.navigateTo({ url: `/pages/game-detail/index?id=${id}` })
  },

  async toggleSave(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = event.detail.id
    const nextValue = toggleSaved(id)
    try {
      await updateSaved(id, nextValue)
    } catch (error) {
      toggleSaved(id, !nextValue)
      toast('收藏状态同步失败，请稍后再试')
    }
  },

  openRandom() {
    if (Date.now() < this.fabIgnoreTapUntil) return
    if (!this.data.materials.filter((material: Material) => !material.referenceOnly).length) return
    this.setData({
      drawnCount: 1,
      randomIndex: 0,
      randomUseAllMaterials: false
    }, () => {
      this.syncFiltered()
      openModal(this, { randomVisible: true })
    })
  },

  onFabTouchStart(event: any) {
    const touch = event.changedTouches && event.changedTouches[0]
    this.fabStartTouch = touch ? { x: touch.clientX, y: touch.clientY } : null
    this.fabTouchOffset = touch ? { x: touch.clientX - this.data.fabX, y: touch.clientY - this.data.fabY } : null
    this.fabMoved = false
  },

  onFabTouchMove(event: any) {
    const touch = event.changedTouches && event.changedTouches[0]
    if (!touch || !this.fabStartTouch || !this.fabTouchOffset || !this.fabWindow) return
    const distanceX = Math.abs(touch.clientX - this.fabStartTouch.x)
    const distanceY = Math.abs(touch.clientY - this.fabStartTouch.y)
    if (distanceX > fabDragThreshold || distanceY > fabDragThreshold) this.fabMoved = true
    const maxX = Math.max(0, this.fabWindow.width - this.fabWindow.size)
    const maxY = Math.max(0, this.fabWindow.height - this.fabWindow.size)
    const x = Math.min(maxX, Math.max(0, touch.clientX - this.fabTouchOffset.x))
    const y = Math.min(maxY, Math.max(0, touch.clientY - this.fabTouchOffset.y))
    this.setData({ fabX: x, fabY: y })
  },

  onFabTouchEnd() {
    if (this.fabMoved) this.fabIgnoreTapUntil = Date.now() + 250
    this.fabStartTouch = null
    this.fabTouchOffset = null
  },

  reroll() {
    const candidates = this.getRandomCandidates()
    if (candidates.length <= 1 || this.data.drawnCount >= candidates.length) {
      toast('已无更多卡片')
      return
    }
    const randomIndex = this.data.randomIndex + 1
    this.setData({
      randomIndex,
      currentRandomMaterial: candidates[randomIndex % candidates.length],
      drawnCount: this.data.drawnCount + 1
    })
  },

  openRandomDetail() {
    const material = this.data.currentRandomMaterial
    if (!material) return
    this.closeSheet()
    wx.navigateTo({ url: `/pages/game-detail/index?id=${material.id}` })
  },

  openFilter() {
    openModal(this, { filterVisible: true })
  },

  applyFilter() {
    closeModal(this, { filterVisible: false })
    const count = this.getFilteredMaterials().length
    toast(count ? `已筛选出 ${count} 条素材` : '当前条件下没有匹配素材')
  },

  clearFilters() {
    this.setData({
      query: '',
      type: 'all',
      ability: 'all',
      scene: 'all',
      status: 'all',
      randomIndex: 0,
      drawnCount: 1,
      randomUseAllMaterials: false
    }, () => this.syncFiltered())
  },

  clearFiltersForRandom() {
    this.clearFilters()
    toast('已清空条件')
  },

  useAllMaterialsForRandom() {
    this.setData({
      randomUseAllMaterials: true,
      randomIndex: 0,
      drawnCount: 1
    }, () => this.syncFiltered())
  },

  retryLoadGames() {
    this.loadMaterials(true)
  },

  openAdd() {
    openModal(this, {
      randomVisible: false,
      filterVisible: false,
      addVisible: true
    })
  },

  closeSheet() {
    closeModal(this, {
      randomVisible: false,
      filterVisible: false,
      addVisible: false,
      pathVisible: false,
      pathEditMode: false,
      activePath: null,
      pathDraft: {},
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: [],
      newMaterial: {},
      randomUseAllMaterials: false,
      selectedCategoryTags: ['游戏'],
      showMoreOptions: false,
      moreOptionsToggleText: '补充训练方法'
    })
  },

  handleGameFormFieldChange(event: WechatMiniprogram.CustomEvent<{ field: string; value: string }>) {
    const { field, value } = event.detail || { field: '', value: '' }
    if (!field) return
    this.setData({ [`newMaterial.${field}`]: value })
  },

  setNewMaterialType(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const value = String(event.detail?.value || '').trim()
    if (!value) return
    const selectedCategoryTags = this.data.selectedCategoryTags
      .filter((item) => !materialTypes.includes(item as MaterialType))
      .concat(value)
    this.setData({ selectedCategoryTags }, () => this.syncFiltered())
  },

  toggleNewMaterialAbility(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.toggleNewMaterialCategory(String(event.detail?.value || '').trim())
  },

  toggleNewMaterialScene(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.toggleNewMaterialCategory(String(event.detail?.value || '').trim())
  },

  toggleNewMaterialCategory(category: string) {
    if (!category) return
    const selectedCategoryTags = this.data.selectedCategoryTags.includes(category)
      ? this.data.selectedCategoryTags.filter((item) => item !== category)
      : this.data.selectedCategoryTags.concat(category)
    this.setData({ selectedCategoryTags }, () => this.syncFiltered())
  },

  toggleCustomCategory() {
    const customCategoryVisible = !this.data.customCategoryVisible
    if (customCategoryVisible) {
      this.setData({
        customCategoryVisible: true,
        customCategoryFocus: false,
        customCategoryInput: this.data.customCategoryInput,
        categorySuggestions: this.getCategorySuggestions(this.data.customCategoryInput)
      }, () => {
        this.setData({ customCategoryFocus: true })
      })
      return
    }
    this.setData({
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: []
    })
  },

  handleCustomCategoryFocus() {
    if (!this.data.customCategoryFocus) this.setData({ customCategoryFocus: true })
  },

  handleCustomCategoryBlur(event: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    const customCategoryInput = String(event.detail?.value || '')
    this.setData({
      customCategoryFocus: false,
      customCategoryInput,
      categorySuggestions: this.getCategorySuggestions(customCategoryInput)
    })
  },

  selectCategorySuggestion(event: WechatMiniprogram.TouchEvent) {
    const category = String((event as WechatMiniprogram.CustomEvent<{ category: string }>).detail?.category || event.currentTarget.dataset.category || '').trim()
    if (category) this.addCategoryTag(category)
  },

  confirmCustomCategory(event?: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    const inputValue = event && event.detail ? event.detail.value : this.data.customCategoryInput
    const category = String(inputValue || '').trim()
    if (!category) {
      toast('先输入分类')
      return
    }
    this.setData({
      customCategoryInput: category,
      categorySuggestions: this.getCategorySuggestions(category)
    })
    const existed = this.getCategoryPool().find((item) => item.toLowerCase() === category.toLowerCase())
    this.addCategoryTag(existed || category)
  },

  addCategoryTag(category: string) {
    const selectedCategoryTags = this.data.selectedCategoryTags.includes(category)
      ? this.data.selectedCategoryTags
      : this.data.selectedCategoryTags.concat(category)
    this.setData({
      selectedCategoryTags,
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: []
    }, () => this.syncFiltered())
  },

  toggleMoreOptions() {
    const nextVisible = !this.data.showMoreOptions
    this.setData({
      showMoreOptions: nextVisible,
      moreOptionsToggleText: nextVisible ? '收起训练方法' : '补充训练方法'
    })
  },

  async addGame() {
    const title = this.data.newMaterial.title
    if (!title) {
      toast('先写素材名称')
      return
    }
    const tags = Array.from(new Set<string>(this.data.selectedCategoryTags.map((item) => item.trim()).filter(Boolean)))
    const materialType = (materialTypes.find((item) => tags.includes(item)) || '游戏') as MaterialType
    const abilities = abilityOptions.filter((item) => tags.includes(item))
    const scenes = sceneOptions.filter((item) => tags.includes(item))
    const steps = typeof this.data.newMaterial.steps === 'string' && this.data.newMaterial.steps.trim()
      ? this.data.newMaterial.steps.split('\n').map((item) => item.trim()).filter(Boolean)
      : []
    const material: Material = {
      id: `custom-${Date.now()}`,
      title,
      desc: this.data.newMaterial.desc || '',
      type: materialType,
      tags,
      abilities,
      scenes,
      meta: buildMaterialMeta(this.data.newMaterial.people, this.data.newMaterial.duration),
      steps,
      tips: this.data.newMaterial.tips || '',
      variant: this.data.newMaterial.variant || '',
      issue: this.data.newMaterial.issue || '',
      relatedMaterialId: '',
      referenceOnly: materialType === '路径',
      stripeTone: 'orange',
      sortOrder: DEFAULT_SORT_ORDER
    }
    setMaterials([material].concat(getState().materials))
    closeModal(this, {
      addVisible: false,
      newMaterial: {},
      selectedCategoryTags: ['游戏'],
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: [],
      showMoreOptions: false,
      moreOptionsToggleText: '补充训练方法'
    }, () => this.syncFiltered())
    await createMaterial(material)
    toast('已加入素材库，可稍后继续完善')
  }
})
