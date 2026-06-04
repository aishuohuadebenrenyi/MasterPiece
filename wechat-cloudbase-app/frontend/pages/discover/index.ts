import type { Game, ViewMode } from '../../types/domain'
import { createGame, listGames, updateSaved } from '../../services/game'
import { getState, setGames, setState, subscribe, toggleSaved } from '../../store/index'
import { toast } from '../../utils/page'
import { closeModal, openModal } from '../../utils/modal'
import { syncTabBar } from '../../utils/tabbar'

const tagOptions = [
  { value: 'all', label: '最近排练' },
  { value: '热身', label: '5 分钟热身' },
  { value: '关系', label: '关系练习' },
  { value: '专注', label: '专注切换' },
  { value: '叙事', label: '叙事' }
]

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
    currentRandomGame: null as Game | null,
    newGame: {} as Partial<Game>,
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
    fabY: 0
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
    return games.filter((game) => {
      const inTag = tag === 'all' || game.tags.includes(tag) || game.category === tag
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
        || game.tags.includes(goal)
        || game.category === goal
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
    this.setData({
      filteredGames,
      currentRandomGame: filteredGames[this.data.randomIndex % Math.max(filteredGames.length, 1)] || this.data.games[0] || null,
      listActiveClass: this.data.view === 'list' ? 'active' : '',
      cardActiveClass: this.data.view === 'card' ? 'active' : '',
      isListView: this.data.view === 'list',
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
      }))
    })
  },

  async onLoad() {
    this.resetFabPosition()
    this.unsubscribeStore = subscribe(() => this.syncFromStore())
    try {
      setGames(await listGames())
    } catch (error) {
      this.syncFromStore()
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

  recordGame(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/game-feedback/index?id=${event.detail.id}` })
  },

  async toggleSave(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = event.detail.id
    const nextValue = toggleSaved(id)
    await updateSaved(id, nextValue)
  },

  openRandom() {
    if (Date.now() < this.fabIgnoreTapUntil) return
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
    if (!candidates.length) return
    const randomIndex = this.data.randomIndex + 1
    this.setData({
      randomIndex,
      currentRandomGame: candidates[randomIndex % candidates.length]
    })
  },

  openRandomDetail() {
    const game = this.data.currentRandomGame
    if (!game) return
    this.closeSheet()
    wx.navigateTo({ url: `/pages/game-detail/index?id=${game.id}` })
  },

  recordRandom() {
    const game = this.data.currentRandomGame
    if (!game) return
    this.closeSheet()
    wx.navigateTo({ url: `/pages/game-feedback/index?id=${game.id}` })
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
    closeModal(this, { randomVisible: false, filterVisible: false, addVisible: false })
  },

  voiceFill(event: WechatMiniprogram.TouchEvent) {
    const target = event.currentTarget.dataset.target
    const patch: Record<string, string> = {}
    if (target === 'title') patch['newGame.title'] = '情绪接力'
    if (target === 'title') patch['newGame.people'] = '4-8 人'
    if (target === 'title') patch['newGame.duration'] = '10 分钟'
    if (target === 'title') patch['newGame.tag'] = '热身 / 情绪'
    if (target === 'desc') patch['newGame.desc'] = '用一个简单动作和一句台词传递情绪，适合让大家快速进入状态。'
    if (target === 'steps') patch['newGame.steps'] = '围成一圈，第一位做出一个动作并说一句台词。\n下一位接住情绪，再放大或反转。\n一圈结束后复盘哪一次情绪最清楚。'
    this.setData(patch)
    toast('已模拟语音输入')
  },

  updateNewGame(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`newGame.${field}`]: event.detail.value })
  },

  async addGame() {
    const title = this.data.newGame.title
    if (!title) {
      toast('先写游戏名称')
      return
    }
    const game: Game = {
      id: `custom-${Date.now()}`,
      title,
      desc: this.data.newGame.desc || '这是你添加的新游戏，可以稍后继续完善。',
      category: this.data.newGame.tag ? String(this.data.newGame.tag).split('/')[0].trim() : '自定义',
      tags: this.data.newGame.tag ? String(this.data.newGame.tag).split('/').map((item) => item.trim()).filter(Boolean) : ['自定义'],
      meta: [this.data.newGame.people || '待补充', this.data.newGame.duration || '待补充', '自定义'],
      fit: ['自定义', '待验证', '可试玩'],
      lead: this.data.newGame.desc || '先试玩一轮，再补充带领提示。',
      steps: typeof this.data.newGame.steps === 'string' ? this.data.newGame.steps.split('\n') : ['用一句话说明核心规则。'],
      tips: '第一次带领时先保持规则短。',
      variant: '',
      issue: '',
      relatedGameId: 'name-chain',
      stripeTone: 'orange',
      sortOrder: 999
    }
    setGames([game].concat(getState().games))
    closeModal(this, { addVisible: false, newGame: {} })
    await createGame(game)
    toast('已加入游戏库')
  }
})
