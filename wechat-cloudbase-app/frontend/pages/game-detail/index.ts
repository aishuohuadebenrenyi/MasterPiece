import type { Game } from '../../types/domain'
import { findLocalGame, listGames, updateGameState, updateGame, deleteGame } from '../../services/game'
import { getState, markPlayed, unmarkPlayed, setGames, toggleSaved, startGameSession, subscribe, updateGameSession, clearGameSession , getThemeClass } from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'
import { getLayoutStyle } from '../../utils/layout'

const defaultCategoryOptions = ['热身', '关系', '专注', '叙事']

type EditGameDraft = Partial<Game> & {
  people?: string
  duration?: string
  steps?: string
}

type HistoryCard = {
  id: string
  title: string
  desc: string
  meta: string[]
  date: string
}

function buildGameMeta(people = '', duration = '') {
  if (!people && !duration) return []
  return [people || '', duration || '']
}

Page({
  data: {
    themeClass: 'theme-default',
    game: null as Game | null,
    related: null as Game | null,
    saved: false,
    played: false,
    saveIcon: '♡',
    savedText: '♡ 收藏',
    playedText: '○ 玩过',
    tagText: '',
    displayMeta: [] as string[],
    layoutStyle: '',
    detailLoading: true,
    detailErrorTitle: '',
    detailErrorDesc: '',
    isCustomGame: false,
    isEditMode: false,
    editGame: {} as EditGameDraft,
    timer: null as number | null,
    currentGameSession: null as any,
    historyCards: [] as HistoryCard[],
    categoryOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    customCategoryVisible: false,
    customCategoryInput: '',
    categorySuggestions: [] as Array<{ value: string; label: string }>,
    customCategoryFocus: false,
    showMoreOptions: false,
    moreOptionsToggleText: '补充玩法与提示',
    selectedCategoryTags: [] as string[]
  },

  syncStatusText() {
    this.setData({
      saveIcon: this.data.saved ? '♥︎' : '♡',
      savedText: this.data.saved ? '♥︎ 已收藏' : '♡ 收藏',
      playedText: this.data.played ? '✓ 已玩过' : '○ 玩过'
    })
  },

  unsubscribeStore: null as null | (() => void),

  async onLoad(options: Record<string, string>) {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const id = getRouteParam(options, 'id', '')
    if (!id) {
      this.setData({
        detailLoading: false,
        detailErrorTitle: '没有找到这个游戏',
        detailErrorDesc: '返回上一页，重新选择一个游戏。'
      })
      return
    }
    
    // 1. 先尝试从本地 store 渲染，避免白屏等待
    let allGames = getState().games
    let game = allGames.find((item) => item.id === id) || findLocalGame(id)
    if (game) {
      this.renderGame(game)
    }

    this.unsubscribeStore = subscribe((state) => {
      const currentGameSession = state.currentGame && state.currentGame.gameId === id ? state.currentGame : null
      const historyCards = state.methodCards
        .filter((card) => game && card.title === game.title)
        .map((card) => ({
          id: card.id,
          title: card.title,
          desc: card.desc,
          meta: card.meta,
          date: new Date(card.createdAt as number).toLocaleDateString()
        }))

      this.setData({ currentGameSession, historyCards })
    })

    // 2. 后台拉取最新数据，确保云端状态同步
    try {
      const serverGames = await listGames()
      setGames(serverGames)
    } catch (error) {
      if (!this.data.game) {
        this.setData({
          detailLoading: false,
          detailErrorTitle: '游戏详情加载失败',
          detailErrorDesc: '云开发暂时没有返回游戏数据，可以回到记录页或稍后重试。'
        })
      }
      return
    }

    // 3. 更新为最新数据
    allGames = getState().games
    game = allGames.find((item) => item.id === id) || findLocalGame(id)
    if (game) {
      this.renderGame(game)
    } else {
      this.setData({
        detailLoading: false,
        detailErrorTitle: '没有找到这个游戏',
        detailErrorDesc: '这张推荐卡可能已不在当前游戏库中，返回记录页重新选择。'
      })
    }
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer)
    if (this.unsubscribeStore) this.unsubscribeStore()
  },

  renderGame(game: Game) {
    const allGames = getState().games
    const related = allGames.find((item) => item.id === game.relatedGameId) || findLocalGame(game.relatedGameId)
    const state = getState()
    const isCustomGame = game.tags.includes('自定义') || game.id.startsWith('custom-')
    const displayMeta = (game.meta || []).filter((item) => typeof item === 'string' && item.trim())
    this.setData({
      game,
      related,
      isCustomGame,
      tagText: game.tags.join(' · '),
      displayMeta,
      saved: state.savedGameIds.includes(game.id),
      played: state.playedGameIds.includes(game.id),
      detailLoading: false,
      detailErrorTitle: '',
      detailErrorDesc: ''
    }, () => this.syncStatusText())
  },

  retryLoad() {
    if (!this.data.game) {
      this.setData({
        detailLoading: true,
        detailErrorTitle: '',
        detailErrorDesc: ''
      })
      const pages = getCurrentPages()
      const current = pages[pages.length - 1] as { options?: Record<string, string> }
      if (this.unsubscribeStore) {
        this.unsubscribeStore()
        this.unsubscribeStore = null
      }
      this.onLoad(current.options || {})
    }
  },

  back() {
    wx.navigateBack()
  },

  async toggleSaved() {
    if (!this.data.game) return
    const saved = toggleSaved(this.data.game.id)
    this.setData({ saved }, () => this.syncStatusText())
    await updateGameState(this.data.game.id, { saved })
  },

  async togglePlayed() {
    if (!this.data.game) return
    const isPlayed = this.data.played
    if (isPlayed) {
      unmarkPlayed(this.data.game.id)
      this.setData({ played: false }, () => this.syncStatusText())
      await updateGameState(this.data.game.id, { played: false })
    } else {
      markPlayed(this.data.game.id)
      this.setData({ played: true }, () => this.syncStatusText())
      await updateGameState(this.data.game.id, { played: true })
      toast('已标记玩过')
    }
  },

  startGame() {
    try {
      const { game } = this.data
      if (!game) return
      startGameSession({
        id: `session-${Date.now()}`,
        gameId: game.id,
        title: game.title,
        startTime: Date.now(),
        duration: 0,
        status: '进行中'
      })
      this.startTimer()
    } catch (e: any) {
      toast(e.message || '开启失败')
    }
  },

  pauseGame() {
    if (this.data.timer) clearInterval(this.data.timer)
    this.setData({ timer: null })
    updateGameSession({ status: '暂停中' })
  },

  resumeGame() {
    updateGameSession({ status: '进行中' })
    this.startTimer()
  },

  finishGame() {
    if (this.data.timer) clearInterval(this.data.timer)
    const session = this.data.currentGameSession
    if (!session) return
    clearGameSession()
    wx.navigateTo({ url: `/pages/game-feedback/index?id=${session.gameId}&duration=${session.duration}` })
  },

  startTimer() {
    if (this.data.timer) return
    const timer = setInterval(() => {
      const session = this.data.currentGameSession
      if (session) {
        updateGameSession({ duration: session.duration + 1 })
      }
    }, 1000) as unknown as number
    this.setData({ timer })
  },

  openRelated() {
    if (!this.data.related) return
    wx.redirectTo({ url: `/pages/game-detail/index?id=${this.data.related.id}` })
  },

  enterEditMode() {
    const game = this.data.game
    if (!game) return
    const editGame: EditGameDraft = { ...game }
    editGame.people = game.meta[0] || ''
    editGame.duration = game.meta[1] || ''
    editGame.steps = (game.steps || []).join('\n')
    
    this.setData({
      editGame,
      selectedCategoryTags: game.tags || [],
      showMoreOptions: false,
      moreOptionsToggleText: '补充玩法与提示',
      isEditMode: true
    })
    this.syncCategoryOptions()
  },

  cancelEdit() {
    this.setData({
      isEditMode: false,
      editGame: {},
      selectedCategoryTags: [],
      customCategoryVisible: false,
      customCategoryFocus: false,
      customCategoryInput: '',
      categorySuggestions: [],
      showMoreOptions: false,
      moreOptionsToggleText: '补充玩法与提示'
    })
  },

  getCategoryPool() {
    const categories: string[] = []
    defaultCategoryOptions.forEach((item) => categories.push(item))
    getState().games.forEach((game: Game) => {
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
      .filter((item: string) => item.toLowerCase().includes(keyword))
      .slice(0, 5)
      .map((value: string) => ({ value, label: value }))
  },

  syncCategoryOptions() {
    this.setData({
      categoryOptions: this.getCategoryPool().map((value: string) => ({
        value,
        label: value,
        activeClass: this.data.selectedCategoryTags.includes(value) ? 'active' : ''
      })),
      categorySuggestions: this.getCategorySuggestions(this.data.customCategoryInput)
    })
  },

  updateEditGame(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`editGame.${field}`]: event.detail.value })
  },

  handleGameFormFieldChange(event: WechatMiniprogram.CustomEvent<{ field: string; value: string }>) {
    const { field, value } = event.detail || { field: '', value: '' }
    if (!field) return
    this.setData({ [`editGame.${field}`]: value })
  },

  toggleEditGameCategory(event: WechatMiniprogram.TouchEvent) {
    const category = String((event as WechatMiniprogram.CustomEvent<{ category: string }>).detail?.category || event.currentTarget.dataset.category || '').trim()
    if (!category) return
    const selectedCategoryTags = this.data.selectedCategoryTags.includes(category)
      ? this.data.selectedCategoryTags.filter((item: string) => item !== category)
      : this.data.selectedCategoryTags.concat(category)
    this.setData({ selectedCategoryTags }, () => this.syncCategoryOptions())
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
    const category = String((event as WechatMiniprogram.CustomEvent<{ category: string }>).detail?.category || event.currentTarget.dataset.category || '').trim()
    if (!category) return
    this.addCategoryTag(category)
  },

  confirmCustomCategory() {
    const maybeEvent = arguments[0] as WechatMiniprogram.CustomEvent<{ value?: string }> | undefined
    const nextValue = maybeEvent && maybeEvent.detail && typeof maybeEvent.detail.value === 'string'
      ? maybeEvent.detail.value
      : this.data.customCategoryInput
    const category = String(nextValue || '').trim()
    if (!category) {
      toast('先输入分类')
      return
    }
    const existed = this.getCategoryPool().find((item: string) => item.toLowerCase() === category.toLowerCase())
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
    }, () => this.syncCategoryOptions())
  },

  toggleMoreOptions() {
    const nextVisible = !this.data.showMoreOptions
    this.setData({
      showMoreOptions: nextVisible,
      moreOptionsToggleText: nextVisible ? '收起玩法与提示' : '补充玩法与提示'
    })
  },

  voiceFill(event: WechatMiniprogram.TouchEvent) {
    const target = (event as WechatMiniprogram.CustomEvent<{ target: string }>).detail?.target || event.currentTarget.dataset.target
    const patch: Record<string, string> = {}
    if (target === 'title') patch['editGame.title'] = '情绪接力'
    if (target === 'title') patch['editGame.people'] = '4-8 人'
    if (target === 'title') patch['editGame.duration'] = '10 分钟'
    if (target === 'desc') patch['editGame.desc'] = '用一个简单动作和一句台词传递情绪，适合让大家快速进入状态。'
    if (target === 'steps') patch['editGame.steps'] = '围成一圈，第一位做出一个动作并说一句台词。\n下一位接住情绪，再放大或反转。\n一圈结束后复盘哪一次情绪最清楚。'
    if (target === 'tips') patch['editGame.tips'] = '先示范一轮节奏变化，再提醒大家不要急着抢台词，优先把情绪接清楚。'
    if (target === 'variant') patch['editGame.variant'] = '可以改成双人接力，或者规定每次必须反转前一个人的情绪。'
    if (target === 'issue') patch['editGame.issue'] = '最容易卡在情绪不够明确或节奏断掉，带领时要及时示范并收束轮次。'
    if (target === 'title') {
      this.setData(Object.assign(patch, { selectedCategoryTags: ['热身', '情绪'] }), () => this.syncCategoryOptions())
    } else {
      this.setData(patch)
    }
    toast('已模拟语音输入')
  },

  async saveGame() {
    const title = this.data.editGame.title
    if (!title) {
      toast('先写游戏名称')
      return
    }
    const tags: string[] = Array.from(new Set(this.data.selectedCategoryTags.map((item: string) => item.trim()).filter(Boolean)))
    if (!tags.length) tags.push('自定义')
    const steps = typeof this.data.editGame.steps === 'string' && this.data.editGame.steps.trim()
      ? this.data.editGame.steps.split('\n').map((item: string) => item.trim()).filter(Boolean)
      : []

    const currentGame = { ...(this.data.game as Game & { fit?: string[]; lead?: string; avoid?: string; verdict?: string }) }
    delete currentGame.fit
    delete currentGame.lead
    delete currentGame.avoid
    delete currentGame.verdict

    const updatedGame: Game = {
      ...currentGame,
      title,
      desc: this.data.editGame.desc || '',
      tags,
      meta: buildGameMeta(this.data.editGame.people, this.data.editGame.duration),
      steps,
      tips: this.data.editGame.tips || '',
      variant: this.data.editGame.variant || '',
      issue: this.data.editGame.issue || ''
    }

    const allGames = getState().games
    const index = allGames.findIndex((gameItem: Game) => gameItem.id === updatedGame.id)
    if (index > -1) {
      allGames[index] = updatedGame
      setGames([...allGames])
    }

    this.renderGame(updatedGame)
    this.cancelEdit()
    await updateGame(updatedGame)
    toast('已保存修改')
  },

  confirmDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          const gameId = this.data.game?.id
          if (!gameId) return
          
          const allGames = getState().games
          setGames(allGames.filter((gameItem: Game) => gameItem.id !== gameId))
          
          wx.navigateBack()
          setTimeout(() => {
            toast('已删除')
          }, 300)
          await deleteGame(gameId)
        }
      }
    })
  }
})
