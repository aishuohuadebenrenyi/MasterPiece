import type { Game, ViewMode } from '../../types/domain'
import { createGame, listGames, updateSaved } from '../../services/game'
import { getState, setGames, setState, subscribe, toggleSaved } from '../../store/index'
import { toast } from '../../utils/page'
import { closeModal, openModal } from '../../utils/modal'
import { syncTabBar } from '../../utils/tabbar'
import { getLayoutStyle } from '../../utils/layout'

const tagOptions = [
  { value: 'all', label: '全部' },
  { value: '破冰', label: '快速破冰' },
  { value: '热身', label: '5分钟热身' },
  { value: '关系', label: '关系构建' },
  { value: '专注', label: '专注力训练' },
  { value: '身体', label: '肢体表达' },
  { value: '叙事', label: '即兴叙事' }
]

const defaultCategoryOptions = ['热身', '关系', '专注', '叙事']

type NewGameDraft = Partial<Game> & {
  people?: string
  duration?: string
  steps?: string
}

const fabSizeRpx = 116
const fabRightRpx = 42
const fabBottomRpx = 160
const fabDragThreshold = 6

Page({
  data: {
    games: [] as Game[],
    filteredGames: [] as Game[],
    view: 'list' as ViewMode,
    query: '',
    tag: 'all',
    people: 'all',
    duration: 'all',
    goal: 'all',
    status: 'all',
    randomVisible: false,
    filterVisible: false,
    addVisible: false,
    modalOpen: false,
    randomIndex: 0,
    drawnCount: 1,
    currentRandomGame: null as Game | null,
    newGame: {} as NewGameDraft,
    selectedCategoryTags: ['热身'] as string[],
    customCategoryVisible: false,
    customCategoryFocus: false,
    customCategoryInput: '',
    categorySuggestions: [] as Array<{ value: string; label: string }>,
    showMoreOptions: false,
    moreOptionsToggleText: '补充玩法与提示',
    categoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    listActiveClass: 'active',
    cardActiveClass: '',
    isListView: true,
    tagChips: [] as Array<{ value: string; label: string; activeClass: string }>,
    peopleFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    durationFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    goalFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    statusFilters: [] as Array<{ value: string; label: string; activeClass: string }>,
    fabReady: false,
    fabX: 0,
    fabY: 0,
    layoutStyle: '',
    loadingGames: true,
    showEmptyState: false
  },

  unsubscribeStore: null as null | (() => void),
  fabStartTouch: null as null | { x: number; y: number },
  fabTouchOffset: null as null | { x: number; y: number },
  fabWindow: null as null | { width: number; height: number; size: number },
  fabMoved: false,
  fabIgnoreTapUntil: 0,

  syncFromStore() {
    const state = getState()
    this.setData({
      games: state.games,
      view: state.viewMode
    }, () => this.syncFiltered())
  },

  getFilteredGames() {
    const { games, query, tag, people, duration, goal, status } = this.data
    const lowerQuery = query.trim().toLowerCase()
    return games.filter((game: Game) => {
      const inTag = tag === 'all' || (game.tags && game.tags.includes(tag))
      const peopleText = game.meta[0] || ''
      const durationText = game.meta[1] || ''
      const inPeople = people === 'all'
        || (people === '2-4' && /2-4|2-6/.test(peopleText))
        || (people === '5-8' && /5-8|6-12|4-8/.test(peopleText))
        || (people === '8+' && /8\+|6-12|8-12|10-/.test(peopleText))
      const inDuration = duration === 'all'
        || (duration === '5' && /5\s*分钟|8\s*分钟/.test(durationText))
        || (duration === '5-15' && /(8|10|12|15)\s*分钟/.test(durationText))
        || (duration === '15+' && /15|20|30/.test(durationText))
      const inGoal = goal === 'all'
        || (game.tags && game.tags.includes(goal))
        || `${game.desc} ${game.lead}`.includes(goal)
      const inStatus = status === 'all'
        || (status === 'saved' && game.saved)
        || (status === 'played' && game.played)
        || (status === 'unplayed' && !game.played)
      const text = `${game.title} ${game.desc} ${game.tags.join(' ')} ${game.meta.join(' ')}`.toLowerCase()
      return inTag && inPeople && inDuration && inGoal && inStatus && (!lowerQuery || text.includes(lowerQuery))
    })
  },

  syncFiltered() {
    const filteredGames = this.getFilteredGames()
    const showEmptyState = !this.data.loadingGames && this.data.games.length === 0
    this.setData({
      filteredGames,
      currentRandomGame: filteredGames[this.data.randomIndex % Math.max(filteredGames.length, 1)] || this.data.games[0] || null,
      listActiveClass: this.data.view === 'list' ? 'active' : '',
      cardActiveClass: this.data.view === 'card' ? 'active' : '',
      isListView: this.data.view === 'list',
      showEmptyState,
      tagChips: tagOptions.map((item) => Object.assign({}, item, {
        activeClass: this.data.tag === item.value ? 'active' : ''
      })),
      peopleFilters: [
        { value: 'all', label: '全部' },
        { value: '2-4', label: '2-4 人' },
        { value: '5-8', label: '5-8 人' },
        { value: '8+', label: '8+ 人' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.people === item.value ? 'active' : ''
      })),
      durationFilters: [
        { value: 'all', label: '全部' },
        { value: '5', label: '5 分钟内' },
        { value: '5-15', label: '5-15 分钟' },
        { value: '15+', label: '15 分钟+' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.duration === item.value ? 'active' : ''
      })),
      goalFilters: [
        { value: 'all', label: '全部' },
        { value: '破冰', label: '破冰' },
        { value: '关系', label: '关系' },
        { value: '身体', label: '身体' },
        { value: '叙事', label: '叙事' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.goal === item.value ? 'active' : ''
      })),
      statusFilters: [
        { value: 'all', label: '全部' },
        { value: 'played', label: '玩过' },
        { value: 'unplayed', label: '未玩过' },
        { value: 'saved', label: '收藏' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.status === item.value ? 'active' : ''
      })),
      categoryOptions: this.getCategoryPool().map((value) => ({
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
    this.data.games.forEach((game: Game) => {
      if (Array.isArray(game.tags)) {
        game.tags.forEach((tag) => categories.push(tag))
      }
    })
    return Array.from(new Set(categories.map((item) => String(item).trim()).filter(Boolean)))
  },

  getCategorySuggestions(input: string) {
    const keyword = String(input || '').trim().toLowerCase()
    if (!keyword) return []
    return this.getCategoryPool()
      .filter((item) => item.toLowerCase().includes(keyword))
      .slice(0, 5)
      .map((value) => ({ value, label: value }))
  },

  async onLoad() {
    this.setData({ layoutStyle: getLayoutStyle() })
    this.resetFabPosition()
    this.unsubscribeStore = subscribe(() => this.syncFromStore())
    try {
      setGames(await listGames())
    } catch (error) {
      this.syncFromStore()
    } finally {
      this.setData({ loadingGames: false }, () => this.syncFiltered())
    }
  },

  onShow() {
    syncTabBar(this, 0)
    this.syncFromStore()
  },

  onUnload() {
    if (this.unsubscribeStore) this.unsubscribeStore()
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
    setState({ viewMode: view })
  },

  search(event: WechatMiniprogram.Input) {
    this.setData({ query: event.detail.value }, () => this.syncFiltered())
  },

  filterTag(event: WechatMiniprogram.TouchEvent) {
    this.setData({ tag: event.currentTarget.dataset.tag }, () => this.syncFiltered())
  },

  filterStatus(event: WechatMiniprogram.TouchEvent) {
    this.setData({ status: event.currentTarget.dataset.status }, () => this.syncFiltered())
  },

  filterPeople(event: WechatMiniprogram.TouchEvent) {
    this.setData({ people: event.currentTarget.dataset.value }, () => this.syncFiltered())
  },

  filterDuration(event: WechatMiniprogram.TouchEvent) {
    this.setData({ duration: event.currentTarget.dataset.value }, () => this.syncFiltered())
  },

  filterGoal(event: WechatMiniprogram.TouchEvent) {
    this.setData({ goal: event.currentTarget.dataset.value }, () => this.syncFiltered())
  },

  openGame(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/game-detail/index?id=${event.detail.id}` })
  },

  async toggleSave(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = event.detail.id
    const nextValue = toggleSaved(id)
    await updateSaved(id, nextValue)
  },

  openRandom() {
    if (Date.now() < this.fabIgnoreTapUntil) return
    if (!this.data.games.length) return
    this.setData({ drawnCount: 1 })
    openModal(this, { randomVisible: true })
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
    if (distanceX > fabDragThreshold || distanceY > fabDragThreshold) {
      this.fabMoved = true
    }
    const maxX = Math.max(0, this.fabWindow.width - this.fabWindow.size)
    const maxY = Math.max(0, this.fabWindow.height - this.fabWindow.size)
    const x = Math.min(maxX, Math.max(0, touch.clientX - this.fabTouchOffset.x))
    const y = Math.min(maxY, Math.max(0, touch.clientY - this.fabTouchOffset.y))
    this.setData({ fabX: x, fabY: y })
  },

  onFabTouchEnd() {
    if (this.fabMoved) {
      this.fabIgnoreTapUntil = Date.now() + 250
    }
    this.fabStartTouch = null
    this.fabTouchOffset = null
  },

  reroll() {
    const candidates = this.data.filteredGames.length ? this.data.filteredGames : this.data.games
    if (candidates.length <= 1 || this.data.drawnCount >= candidates.length) {
      toast('已无更多卡片')
      return
    }
    const randomIndex = this.data.randomIndex + 1
    this.setData({
      randomIndex,
      currentRandomGame: candidates[randomIndex % candidates.length],
      drawnCount: this.data.drawnCount + 1
    })
  },

  openRandomDetail() {
    const game = this.data.currentRandomGame
    if (!game) return
    this.closeSheet()
    wx.navigateTo({ url: `/pages/game-detail/index?id=${game.id}` })
  },

  openFilter() {
    openModal(this, { filterVisible: true })
  },

  applyFilter() {
    closeModal(this, { filterVisible: false })
    toast(`已筛选出 ${this.getFilteredGames().length} 个游戏`)
  },

  openAdd() {
    openModal(this, { addVisible: true })
  },

  closeSheet() {
    closeModal(this, {
      randomVisible: false,
      filterVisible: false,
      addVisible: false,
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: [],
      newGame: {},
      selectedCategoryTags: ['热身'],
      showNewGameSteps: false,
      stepsToggleText: '补充玩法步骤'
    })
  },

  voiceFill(event: WechatMiniprogram.TouchEvent) {
    const target = event.currentTarget.dataset.target
    const patch: Record<string, string> = {}
    if (target === 'title') patch['newGame.title'] = '情绪接力'
    if (target === 'title') patch['newGame.people'] = '4-8 人'
    if (target === 'title') patch['newGame.duration'] = '10 分钟'
    if (target === 'desc') patch['newGame.desc'] = '用一个简单动作和一句台词传递情绪，适合让大家快速进入状态。'
    if (target === 'steps') patch['newGame.steps'] = '围成一圈，第一位做出一个动作并说一句台词。\n下一位接住情绪，再放大或反转。\n一圈结束后复盘哪一次情绪最清楚。'
    if (target === 'title') {
      this.setData(Object.assign(patch, { selectedCategoryTags: ['热身', '情绪'] }), () => this.syncFiltered())
    } else {
      this.setData(patch)
    }
    toast('已模拟语音输入')
  },

  updateNewGame(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`newGame.${field}`]: event.detail.value })
  },

  toggleNewGameCategory(event: WechatMiniprogram.TouchEvent) {
    const category = String(event.currentTarget.dataset.category || '').trim()
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
    if (!this.data.customCategoryFocus) {
      this.setData({ customCategoryFocus: true })
    }
  },

  handleCustomCategoryBlur() {
    if (this.data.customCategoryFocus) {
      this.setData({ customCategoryFocus: false })
    }
  },

  updateCustomCategory(event: WechatMiniprogram.Input) {
    const customCategoryInput = event.detail.value
    this.setData({
      customCategoryInput,
      categorySuggestions: this.getCategorySuggestions(customCategoryInput)
    })
  },

  selectCategorySuggestion(event: WechatMiniprogram.TouchEvent) {
    const category = String(event.currentTarget.dataset.category || '').trim()
    if (!category) return
    this.addCategoryTag(category)
  },

  confirmCustomCategory() {
    const category = String(this.data.customCategoryInput || '').trim()
    if (!category) {
      toast('先输入分类')
      return
    }
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
      moreOptionsToggleText: nextVisible ? '收起玩法与提示' : '补充玩法与提示'
    })
  },

  async addGame() {
    const title = this.data.newGame.title
    if (!title) {
      toast('先写游戏名称')
      return
    }
    const tags: string[] = Array.from(new Set(this.data.selectedCategoryTags.map((item) => item.trim()).filter(Boolean)))
    if (!tags.length) tags.push('自定义')
    const steps = typeof this.data.newGame.steps === 'string' && this.data.newGame.steps.trim()
      ? this.data.newGame.steps.split('\n').map((item) => item.trim()).filter(Boolean)
      : ['先用一句话讲清核心规则，试玩后再补完整步骤。']
    const game: Game = {
      id: `custom-${Date.now()}`,
      title,
      desc: this.data.newGame.desc || '这是你添加的新游戏，可以稍后继续完善。',
      tags,
      meta: [this.data.newGame.people || '待补充', this.data.newGame.duration || '待补充', '自定义'],
      fit: [],
      lead: this.data.newGame.desc || '先试玩一轮，再补充带领提示。',
      steps,
      tips: this.data.newGame.tips || '第一次带领时先保持规则短。',
      variant: this.data.newGame.variant || '',
      issue: this.data.newGame.issue || '',
      relatedGameId: '',
      stripeTone: 'orange',
      sortOrder: 999
    }
    setGames([game].concat(getState().games))
    closeModal(this, {
      addVisible: false,
      newGame: {},
      selectedCategoryTags: ['热身'],
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: [],
      showMoreOptions: false,
      moreOptionsToggleText: '补充玩法与提示'
    }, () => this.syncFiltered())
    await createGame(game)
    toast('已加入游戏库，可稍后继续完善')
  }
})
