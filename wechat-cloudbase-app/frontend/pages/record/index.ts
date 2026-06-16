import type { Material, InspirationItem, RehearsalRecord, TodayItem, MaterialSession } from '../../types/domain'
import {
  addInspiration,
  getState,
  getTaskMutexError,
  setCurrentRehearsal,
  setMaterials,
  startMaterialSession,
  startRehearsal as startRehearsalStore,
  subscribe,
  upsertInspiration,
  upsertRehearsalHistory,
  getThemeClass
} from '../../store/index'
import { fetchTodaySummary } from '../../services/today'
import { createRehearsal } from '../../services/rehearsal'
import { listMaterials } from '../../services/material'
import { createInspiration } from '../../services/inspiration'
import { toast } from '../../utils/page'
import { closeModal, openModal } from '../../utils/modal'
import { syncTabBar } from '../../utils/tabbar'
import { getLayoutStyle } from '../../utils/layout'

Page({
  data: {
    themeClass: 'theme-default',
    inspirationText: '',
    pausedRehearsal: null,
    currentRehearsal: null as RehearsalRecord | null,
    currentGameSession: null as MaterialSession | null,
    gameCard: null as any,
    rehearsalCard: null as null | {
      label: string
      title: string
      desc: string
      items: Array<{ indexLabel: string; text: string }>
    },
    recommendVisible: false,
    recommendDismissed: false,
    recommendClickable: false,
    recommendGameId: '',
    recommendTitle: '',
    recommendDesc: '',
    todayVisible: false,
    startRehearsalVisible: false,
    startGameVisible: false,
    startGameSelectedId: '',
    gameSearchQuery: '',
    filteredGamesList: [] as Material[],
    gamesList: [] as Material[],
    startGameEmptyTitle: '还没有可开始的素材',
    startGameEmptyDesc: '先去发现页添加几个常用素材，再回来快速开始。',
    modalOpen: false,
    todayTitle: '',
    todayItems: [] as TodayItem[],
    todayEmptyTitle: '',
    todayEmptyDesc: '',
    inspirationCount: 0,
    rehearsalCount: 0,
    showTodaySummary: false,
    teamName: '',
    rehearsalDuration: '90',
    rehearsalGoals: [] as string[],
    customGoalVisible: false,
    customGoalInput: '',
    rehearsalSource: 'recommended',
    durationOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    goalOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    sourceOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    savedSourceUnavailable: false,
    rehearsalSourceHint: '',
    layoutStyle: ''
  },

  unsubscribeStore: null as null | (() => void),

  getMergedRehearsalGoals() {
    const customGoal = String(this.data.customGoalInput || '').trim()
    return Array.from(new Set(
      (this.data.rehearsalGoals || [])
        .concat(customGoal ? [customGoal] : [])
        .map((item: string) => String(item || '').trim())
        .filter(Boolean)
    ))
  },

  syncLocalState() {
    const state = getState()
    const currentRehearsal = state.currentRehearsal || state.pausedRehearsal
    const recommendedGame = state.materials.find((material: Material) => material.id === state.recommendMaterialId) || state.materials.find((material: Material) => !material.referenceOnly) || null
    const recommendClickable = !!recommendedGame
    const recommendGameId = recommendedGame ? recommendedGame.id : ''
    const inspirationCount = state.todayInspirations.length
    const rehearsalCount = state.todayRehearsals.length
    const savedGamesCount = state.materials.filter((material: Material) => state.savedMaterialIds.includes(material.id) && !material.referenceOnly).length
    const savedSourceUnavailable = this.data.rehearsalSource === 'saved' && savedGamesCount === 0
    const rehearsalSourceHint = savedSourceUnavailable
      ? '还没有收藏可训练素材，先去发现页点亮几个爱心，再回来随机开启。'
      : ''

    const recommendTitle = recommendClickable
      ? recommendedGame.title
      : '慢下来，记录今天有触动的瞬间'
    const recommendDesc = recommendClickable
      ? (recommendedGame.desc || '当前有一张推荐素材卡')
      : '今天如果没有想练的素材，也可以先想想发生过的一个瞬间，把感受记下来。'
    const buildPlanText = (materialId: string, status: string) => {
      const material = state.materials.find((item: Material) => item.id === materialId)
      return `${material ? material.title : '未命名素材'} · ${status}`
    }
    let gameCard: any = null
    const currentGameSession = state.currentMaterial || null
    if (currentGameSession) {
      const d = currentGameSession.duration || 0
      const m = Math.floor(d / 60)
      const s = d % 60
      gameCard = {
        label: currentGameSession.status || '进行中',
        title: currentGameSession.title || '当前素材',
        durationText: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
    }

    const pausedSource = currentRehearsal && (currentRehearsal as RehearsalRecord).status === '暂停中' ? currentRehearsal as RehearsalRecord : null
    const rehearsalCard = !currentGameSession && pausedSource
      ? {
          label: '暂停中的排练',
          title: pausedSource.title,
          desc: pausedSource.desc,
          items: (pausedSource.plan || []).slice(0, 3).map((item: any, index: number) => ({
            indexLabel: String(index + 1),
            text: buildPlanText(item.materialId || item.gameId, item.status)
          }))
        }
      : null
    this.setData({
      pausedRehearsal: state.pausedRehearsal,
      currentRehearsal,
      currentGameSession,
      gameCard,
      rehearsalCard,
      recommendVisible: !this.data.recommendDismissed,
      recommendClickable,
      recommendGameId,
      recommendTitle,
      recommendDesc,
      inspirationCount,
      rehearsalCount,
      showTodaySummary: inspirationCount > 0 || rehearsalCount > 0,
      durationOptions: [
        { value: '60', label: '60 分钟' },
        { value: '90', label: '90 分钟' },
        { value: '120', label: '120 分钟' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.rehearsalDuration === item.value ? 'active' : ''
      })),
      goalOptions: [
        { value: '身体到场', label: '身体到场' },
        { value: '关系建立', label: '关系建立' },
        { value: '叙事', label: '叙事' },
        { value: '演出前', label: '演出前' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.rehearsalGoals.includes(item.value) ? 'active' : ''
      })),
      sourceOptions: [
        { value: 'recommended', label: '使用推荐 3 个' },
        { value: 'saved', label: '随机 3 个收藏' },
        { value: 'blank', label: '空白开始' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.rehearsalSource === item.value ? 'active' : ''
      })),
      savedSourceUnavailable,
      rehearsalSourceHint,
      todayItems: this.data.todayVisible ? (this.data.todayTitle === '今日灵感' ? state.todayInspirations : state.todayRehearsals) : this.data.todayItems
    })
  },

  async onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    this.unsubscribeStore = subscribe(() => this.syncLocalState())
    await fetchTodaySummary()
    await this.refreshGames()
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
    syncTabBar(this, 1)
    this.syncLocalState()
  },

  onResize() {
    this.setData({ layoutStyle: getLayoutStyle() })
  },

  onUnload() {
    if (this.unsubscribeStore) this.unsubscribeStore()
  },

  async refreshGames() {
    try {
      const games = await listMaterials()
      setMaterials(games)
    } catch (error) {
      // Keep the current-session game list when CloudBase is unavailable.
    }
  },

  resumeGameCard() {
    const session = this.data.currentGameSession as any
    if (session) {
      wx.navigateTo({ url: `/pages/game-detail/index?id=${session.materialId || session.id}` })
    }
  },

  updateInspirationText(event: WechatMiniprogram.Input) {
    this.setData({ inspirationText: String(event.detail.value || '') })
  },

  closeSheet() {
    closeModal(this, {
      todayVisible: false,
      startRehearsalVisible: false,
      startGameVisible: false,
      startGameSelectedId: '',
      gameSearchQuery: '',
      filteredGamesList: [],
      teamName: '',
      rehearsalDuration: '90',
      rehearsalGoals: [],
      customGoalVisible: false,
      customGoalInput: '',
      rehearsalSource: 'recommended'
    })
  },

  async saveInspirationDraft() {
    const text = String(this.data.inspirationText || '').trim()
    if (!text) {
      toast('先写下一点灵感')
      return
    }
    const firstLine = text.split(/\n/).map((line) => line.trim()).find(Boolean) || text
    const title = firstLine.length > 18 ? `${firstLine.slice(0, 18)}...` : firstLine
    const item: InspirationItem = {
      id: `inspiration-${Date.now()}`,
      type: '灵感',
      title,
      desc: text,
      syncStatus: 'pending',
      meta: ['快速记录', '待整理']
    }
    addInspiration(item)
    let synced = false
    try {
      await createInspiration({
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      synced = true
      upsertInspiration(Object.assign({}, item, { syncStatus: 'synced' as const }))
    } catch (error) {
      upsertInspiration(item)
    }
    this.setData({ inspirationText: '' })
    toast(synced ? '已保存灵感' : '已保存到本地，待同步')
  },

  openStartRehearsal() {
    const mutexError = getTaskMutexError('rehearsal')
    if (mutexError) {
      toast(mutexError)
      return
    }
    openModal(this, { startRehearsalVisible: true }, () => {
      this.syncLocalState()
    })
  },

  async openStartGame() {
    const mutexError = getTaskMutexError('material')
    if (mutexError) {
      toast(mutexError)
      return
    }
    
    let gamesList = (getState().materials || []).filter((material: Material) => !material.referenceOnly)
    const startGameEmptyState = this.getStartGameEmptyState('', gamesList, gamesList)
    openModal(this, {
      startGameVisible: true,
      startGameSelectedId: '',
      gameSearchQuery: '',
      gamesList: gamesList,
      filteredGamesList: gamesList,
      ...startGameEmptyState
    })

    if (gamesList.length === 0) {
      try {
        const games = (await listMaterials()).filter((material: Material) => !material.referenceOnly)
        setMaterials(games)
        const query = this.data.gameSearchQuery || ''
        const lowerQuery = query.trim().toLowerCase()
        const filteredGamesList = games.filter((game: Material) => {
          const text = `${game.title} ${game.desc} ${game.type} ${game.tags.join(' ')} ${(game.abilities || []).join(' ')} ${game.meta.join(' ')}`.toLowerCase()
          return !lowerQuery || text.includes(lowerQuery)
        })
        this.setData({
          gamesList: games,
          filteredGamesList,
          ...this.getStartGameEmptyState(query, games, filteredGamesList)
        })
      } catch (e) {
        toast('加载素材失败')
      }
    }
  },

  filterStartGames(query: string) {
    const lowerQuery = query.trim().toLowerCase()
    return this.data.gamesList.filter((game: Material) => {
      const text = `${game.title} ${game.desc} ${game.type} ${game.tags.join(' ')} ${(game.abilities || []).join(' ')} ${game.meta.join(' ')}`.toLowerCase()
      return !lowerQuery || text.includes(lowerQuery)
    })
  },

  getStartGameEmptyState(query: string, gamesList: Material[], filteredGamesList: Material[]) {
    if (filteredGamesList.length > 0) return { startGameEmptyTitle: '', startGameEmptyDesc: '' }
    if (!gamesList.length) {
      return {
        startGameEmptyTitle: '还没有可开始的素材',
        startGameEmptyDesc: '先去发现页添加几个常用素材，再回来快速开始。'
      }
    }
    if (query.trim()) {
      return {
        startGameEmptyTitle: '没有找到匹配的素材',
        startGameEmptyDesc: '换个关键词试试，或清空搜索继续浏览当前素材库。'
      }
    }
    return {
      startGameEmptyTitle: '当前没有可显示的素材',
      startGameEmptyDesc: '先清空筛选或回到发现页补充素材库，再回来开始。'
    }
  },

  showStartGameList() {
    if (!this.data.filteredGamesList.length && this.data.gamesList.length) {
      const filteredGamesList = this.filterStartGames(this.data.gameSearchQuery || '')
      this.setData({
        filteredGamesList,
        ...this.getStartGameEmptyState(this.data.gameSearchQuery || '', this.data.gamesList, filteredGamesList)
      })
    }
  },

  onGameSearchInput(e: any) {
    const query = e.detail.value || ''
    const filtered = this.filterStartGames(query)
    this.setData({
      gameSearchQuery: query,
      filteredGamesList: filtered,
      startGameSelectedId: filtered.some((game: Material) => game.id === this.data.startGameSelectedId) ? this.data.startGameSelectedId : '',
      ...this.getStartGameEmptyState(query, this.data.gamesList, filtered)
    })
  },

  clearGameSearch() {
    const filteredGamesList = this.filterStartGames('')
    this.setData({
      gameSearchQuery: '',
      filteredGamesList,
      startGameSelectedId: '',
      ...this.getStartGameEmptyState('', this.data.gamesList, filteredGamesList)
    })
  },

  selectGameToStart(e: any) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    const game = this.data.gamesList.find((g: Material) => g.id === id)
    this.setData({ 
      startGameSelectedId: id,
      gameSearchQuery: game ? game.title : this.data.gameSearchQuery
    })
  },

  startGameFromRecord() {
    const id = this.data.startGameSelectedId
    if (!id) {
      toast('请先选择一条素材')
      return
    }
    const game = this.data.gamesList.find((g: Material) => g.id === id)
    if (!game) return

    try {
      startMaterialSession({
        id: `session-${Date.now()}`,
        materialId: game.id,
        title: game.title,
        startTime: Date.now(),
        duration: 0,
        status: '进行中'
      })
      this.closeSheet()
      wx.navigateTo({ url: `/pages/game-detail/index?id=${game.id}` })
    } catch (e: any) {
      toast(e.message || '开启失败')
    }
  },

  updateStartForm(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  setDuration(event: WechatMiniprogram.TouchEvent) {
    const value = (event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value
    this.setData({ rehearsalDuration: value }, () => this.syncLocalState())
  },

  toggleGoal(event: WechatMiniprogram.TouchEvent) {
    const value = ((event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value) as string
    const exists = this.data.rehearsalGoals.includes(value)
    const rehearsalGoals = exists
      ? this.data.rehearsalGoals.filter((item: string) => item !== value)
      : this.data.rehearsalGoals.concat(value)
    this.setData({ rehearsalGoals }, () => this.syncLocalState())
  },

  setSource(event: WechatMiniprogram.TouchEvent) {
    const value = (event as WechatMiniprogram.CustomEvent<{ value: string }>).detail?.value || event.currentTarget.dataset.value
    this.setData({ rehearsalSource: value }, () => this.syncLocalState())
  },

  toggleCustomGoal() {
    this.setData({ customGoalVisible: !this.data.customGoalVisible })
  },

  updateCustomGoal(event: WechatMiniprogram.Input) {
    this.setData({ customGoalInput: String(event.detail.value || '').trim() })
  },

  resumeRehearsal() {
    wx.navigateTo({ url: '/pages/rehearsal-record/index' })
  },

  async startRehearsal() {
    const mutexError = getTaskMutexError('rehearsal')
    if (mutexError) {
      toast(mutexError)
      return
    }
    const state = getState()
    const shuffle = (array: any[]) => {
      const arr = [...array]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }
    const trainableMaterials = state.materials.filter((material: Material) => !material.referenceOnly)
    const recommendedPlan = shuffle(trainableMaterials).slice(0, 3).map((material) => material.id)
    const savedGames = trainableMaterials.filter((material) => state.savedMaterialIds.includes(material.id))
    if (this.data.rehearsalSource === 'saved' && savedGames.length === 0) {
      toast('还没有收藏可训练素材，先去发现页收藏几个再开始')
      return
    }
    const savedPlan = shuffle(savedGames).slice(0, 3).map((game) => game.id)
    const selectedPlan = this.data.rehearsalSource === 'saved'
      ? savedPlan
      : this.data.rehearsalSource === 'blank'
        ? []
        : recommendedPlan
    const rehearsalId = `rehearsal-${Date.now()}`
    
    let finalTeamName = this.data.teamName.trim()
    let finalTitle = ''
    if (!finalTeamName) {
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      finalTeamName = `我的排练 ${mm}-${dd}`
    }
    finalTitle = `${finalTeamName} · ${this.data.rehearsalDuration} 分钟`

    const mergedGoals = this.getMergedRehearsalGoals()
    const sourceLabel = this.data.rehearsalSource === 'saved'
      ? '随机 3 个收藏'
      : this.data.rehearsalSource === 'blank'
        ? '空白开始'
        : '使用推荐 3 个'
    const rehearsal = {
      id: rehearsalId,
      type: '排练',
      title: finalTitle,
      desc: mergedGoals.join(' → ') || '先开始再补充目标',
      teamName: finalTeamName,
      duration: this.data.rehearsalDuration,
      goals: mergedGoals,
      source: this.data.rehearsalSource,
      status: '进行中' as const,
      syncStatus: 'pending' as const,
      plan: selectedPlan.map((materialId) => ({ materialId, status: '未开始' as const, keep: '', try: '' })),
      meta: [`${selectedPlan.length || 0} 条素材`, sourceLabel]
    }
    startRehearsalStore(rehearsal)
    let synced = false
    try {
      await createRehearsal(rehearsal)
      synced = true
      const syncedRehearsal = Object.assign({}, rehearsal, { syncStatus: 'synced' as const })
      setCurrentRehearsal(syncedRehearsal)
      upsertRehearsalHistory(syncedRehearsal)
    } catch (error) {
      // Keep local rehearsal available even if cloud sync fails.
    }
    this.closeSheet()
    if (!synced) toast('排练已本地开启，待同步')
    wx.navigateTo({ url: '/pages/rehearsal-record/index' })
  },

  openToday(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind
    const state = getState()
    const items = kind === 'inspirations' ? state.todayInspirations : state.todayRehearsals
    openModal(this, {
      todayVisible: true,
      todayTitle: kind === 'inspirations' ? '今日灵感' : '今日排练记录',
      todayItems: items,
      todayEmptyTitle: kind === 'inspirations' ? '今天还没有灵感记录' : '今天还没有排练记录',
      todayEmptyDesc: kind === 'inspirations'
        ? '先在记录页写下一句刚刚闪过的想法。'
        : '需要时可以先快速开启一场排练，再回来查看今天的过程记录。'
    })
  },

  closeRecommend() {
    this.setData({ recommendVisible: false, recommendDismissed: true })
    toast('已关闭今日推荐')
  },

  openRecommend() {
    if (!this.data.recommendClickable) return
    const recommendGameId = this.data.recommendGameId
    if (!recommendGameId) {
      toast('当前还没有可推荐的素材')
      return
    }
    wx.navigateTo({ url: `/pages/game-detail/index?id=${recommendGameId}` })
  }
})
