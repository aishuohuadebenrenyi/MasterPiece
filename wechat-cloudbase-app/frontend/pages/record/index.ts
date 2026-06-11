import type { Game, InspirationItem, RehearsalRecord, TodayItem, VoiceTarget, GameSession } from '../../types/domain'
import {
  addInspiration,
  clearVoiceDraft,
  getState,
  getTaskMutexError,
  setCurrentRehearsal,
  setGames,
  setVoiceDraft,
  startGameSession,
  startRehearsal as startRehearsalStore,
  subscribe,
  upsertInspiration,
  upsertRehearsalHistory,
  getThemeClass
} from '../../store/index'
import { fetchTodaySummary } from '../../services/today'
import { createRehearsal } from '../../services/rehearsal'
import { listGames } from '../../services/game'
import { createVoiceDraft } from '../../services/voice-draft'
import { createInspiration } from '../../services/inspiration'
import { toast } from '../../utils/page'
import { closeModal, openModal } from '../../utils/modal'
import { syncTabBar } from '../../utils/tabbar'
import { getLayoutStyle } from '../../utils/layout'

Page({
  data: {
    themeClass: 'theme-default',
    voiceVisible: false,
    elapsed: 0,
    timeText: '00:00',
    voiceSummary: '',
    recordingText: '录音中',
    timer: null as number | null,
    voiceTarget: 'inspiration' as VoiceTarget,
    activeContextName: '',
    pausedRehearsal: null,
    currentRehearsal: null as RehearsalRecord | null,
    currentGameSession: null as GameSession | null,
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
    recommendTitle: '',
    recommendDesc: '',
    todayVisible: false,
    startRehearsalVisible: false,
    startGameVisible: false,
    startGameSelectedId: '',
    gameSearchQuery: '',
    filteredGamesList: [] as Game[],
    gamesList: [] as Game[],
    startGameEmptyTitle: '还没有可开始的游戏',
    startGameEmptyDesc: '先去发现页添加几个常用游戏，再回来快速开始。',
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
    voiceTargets: [] as Array<{ value: VoiceTarget; label: string; activeClass: string }>,
    durationOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    goalOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    sourceOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    savedSourceUnavailable: false,
    rehearsalSourceHint: '',
    layoutStyle: ''
  },

  unsubscribeStore: null as null | (() => void),

  formatTime(seconds: number) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  },

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
    const targetOptions = [
      { value: 'inspiration' as VoiceTarget, label: '记录到：灵感' },
      { value: 'game_feedback' as VoiceTarget, label: '当前游戏' },
      { value: 'rehearsal' as VoiceTarget, label: '当前排练' }
    ]
    const currentRehearsal = state.currentRehearsal || state.pausedRehearsal
    const recommendedGame = state.games.find((game: Game) => game.id === state.recommendGameId) || state.games[0] || null
    const recommendClickable = !!recommendedGame
    const inspirationCount = state.todayInspirations.length
    const rehearsalCount = state.todayRehearsals.length
    const savedGamesCount = state.games.filter((game: Game) => state.savedGameIds.includes(game.id)).length
    const savedSourceUnavailable = this.data.rehearsalSource === 'saved' && savedGamesCount === 0
    const rehearsalSourceHint = savedSourceUnavailable
      ? '还没有收藏游戏，先去发现页点亮几个爱心，再回来随机开启。'
      : ''

    const recommendTitle = recommendClickable
      ? recommendedGame.title
      : '慢下来，记录今天有触动的瞬间'
    const recommendDesc = recommendClickable
      ? (recommendedGame.desc || '当前有一张推荐游戏卡')
      : '今天如果没有想玩的游戏，也可以先想想发生过的一个瞬间，把感受记下来。'
    const buildPlanText = (gameId: string, status: string) => {
      const game = state.games.find((item: Game) => item.id === gameId)
      return `${game ? game.title : '未命名游戏'} · ${status}`
    }
    let gameCard: any = null
    const currentGameSession = state.currentGame || null
    let activeContextName = ''
    if (currentGameSession) {
      const d = currentGameSession.duration || 0
      const m = Math.floor(d / 60)
      const s = d % 60
      activeContextName = `当前正在玩：${currentGameSession.title || '当前游戏'}`
      gameCard = {
        label: currentGameSession.status || '进行中',
        title: currentGameSession.title || '当前游戏',
        durationText: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
    } else if (currentRehearsal) {
      activeContextName = currentRehearsal.title || (currentRehearsal as RehearsalRecord).teamName + ' 的排练'
    }

    const pausedSource = currentRehearsal && (currentRehearsal as RehearsalRecord).status === '暂停中' ? currentRehearsal as RehearsalRecord : null
    const rehearsalCard = !currentGameSession && pausedSource
      ? {
          label: '暂停中的排练',
          title: pausedSource.title,
          desc: pausedSource.desc,
          items: (pausedSource.plan || []).slice(0, 3).map((item: any, index: number) => ({
            indexLabel: String(index + 1),
            text: buildPlanText(item.gameId, item.status)
          }))
        }
      : null
    this.setData({
      pausedRehearsal: state.pausedRehearsal,
      currentRehearsal,
      currentGameSession,
      gameCard,
      activeContextName,
      rehearsalCard,
      recommendVisible: !this.data.recommendDismissed,
      recommendClickable,
      recommendTitle,
      recommendDesc,
      inspirationCount,
      rehearsalCount,
      showTodaySummary: inspirationCount > 0 || rehearsalCount > 0,
      timeText: this.data.elapsed ? this.formatTime(this.data.elapsed) : '00:00',
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
    if (this.data.timer) clearInterval(this.data.timer)
    if (this.unsubscribeStore) this.unsubscribeStore()
  },

  resumeGameCard() {
    const session = this.data.currentGameSession as any
    if (session) {
      wx.navigateTo({ url: `/pages/game-detail/index?id=${session.gameId || session.id}` })
    }
  },

  openVoice() {
    const { currentRehearsal, currentGameSession } = this.data as any
    let activeContextName = ''
    if (currentGameSession) {
      activeContextName = `当前正在玩：${currentGameSession.title || '当前游戏'}`
    } else if (currentRehearsal) {
      activeContextName = `当前排练：${currentRehearsal.teamName}`
    }

    openModal(this, { voiceVisible: true, elapsed: 0, timeText: '00:00', recordingText: '录音中', voiceTarget: 'inspiration', activeContextName }, () => {
      this.syncLocalState()
    })
    this.startTimer()
  },

  startTimer() {
    if (this.data.timer) return
    const timer = setInterval(() => {
      const elapsed = this.data.elapsed + 1
      this.setData({ elapsed, timeText: this.formatTime(elapsed), recordingText: '录音中' })
    }, 1000) as unknown as number
    this.setData({ timer })
  },

  pauseVoice() {
    if (this.data.timer) clearInterval(this.data.timer)
    this.setData({ timer: null, recordingText: '继续录音' })
  },

  finishVoice() {
    if (this.data.timer) clearInterval(this.data.timer)
    const elapsed = this.data.elapsed || 36
    const draft = createVoiceDraft({
      durationSeconds: elapsed,
      target: this.data.voiceTarget,
      linkedRehearsalId: getState().currentRehearsal ? getState().currentRehearsal!.id : undefined
    })
    setVoiceDraft(draft)
    this.setData({
      timer: null,
      elapsed,
      timeText: this.formatTime(elapsed),
      recordingText: '重新录音',
      voiceSummary: draft.summary
    })
    toast('语音已生成摘要')
  },

  closeSheet() {
    if (this.data.timer) clearInterval(this.data.timer)
    closeModal(this, {
      voiceVisible: false,
      todayVisible: false,
      startRehearsalVisible: false,
      startGameVisible: false,
      startGameSelectedId: '',
      gameSearchQuery: '',
      filteredGamesList: [],
      timer: null,
      teamName: '',
      rehearsalDuration: '90',
      rehearsalGoals: [],
      customGoalVisible: false,
      customGoalInput: '',
      rehearsalSource: 'recommended'
    })
  },

  openArchiveOptions() {
    wx.showActionSheet({
      itemList: ['归档到游戏', '归档到排练'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.archiveToGame()
        } else if (res.tapIndex === 1) {
          this.archiveToRehearsal()
        }
      }
    })
  },

  archiveToGame() {
    const state = getState()
    const games = state.games
    if (!games || games.length === 0) {
      toast('暂无游戏数据')
      return
    }
    const itemList = games.slice(0, 6).map(g => g.title)
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedGame = games[res.tapIndex]
        const draft = getState().voiceDraft
        if (draft && selectedGame) {
          draft.linkedGameId = selectedGame.id
          setVoiceDraft(draft)
          this.closeSheet()
          wx.navigateTo({ url: `/pages/game-feedback/index?id=${selectedGame.id}` })
        }
      }
    })
  },

  archiveToRehearsal() {
    const state = getState()
    const history = state.rehearsalHistory
    if (!history || history.length === 0) {
      toast('暂无排练记录')
      return
    }
    const itemList = history.slice(0, 6).map(h => h.title || h.teamName + ' 的排练')
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedRehearsal = history[res.tapIndex]
        const draft = getState().voiceDraft
        if (draft && selectedRehearsal) {
          draft.linkedRehearsalId = selectedRehearsal.id
          setVoiceDraft(draft)
          this.closeSheet()
          wx.navigateTo({ url: '/pages/rehearsal-record/index' })
        }
      }
    })
  },

  archiveToCurrentContext() {
    const state = getState()
    const currentRehearsal = state.currentRehearsal || state.pausedRehearsal
    const currentGameSession = state.currentGame || null
    const draft = getState().voiceDraft

    if (draft) {
      if (currentGameSession) {
        draft.linkedGameId = currentGameSession.gameId || currentGameSession.id
        setVoiceDraft(draft)
        this.closeSheet()
        wx.navigateTo({ url: `/pages/game-feedback/index?id=${currentGameSession.gameId || currentGameSession.id}` })
      } else if (currentRehearsal) {
        draft.linkedRehearsalId = currentRehearsal.id
        setVoiceDraft(draft)
        this.closeSheet()
        wx.navigateTo({ url: '/pages/rehearsal-record/index' })
      }
    }
  },

  async saveVoiceAsInspiration() {
    let draft = getState().voiceDraft
    if (!draft) {
      const elapsed = this.data.elapsed || 36
      draft = createVoiceDraft({
        durationSeconds: elapsed,
        target: 'inspiration',
        linkedRehearsalId: getState().currentRehearsal ? getState().currentRehearsal!.id : undefined
      })
      setVoiceDraft(draft)
    }
    const item: InspirationItem = {
      id: `inspiration-${Date.now()}`,
      type: '灵感',
      title: draft.title,
      desc: draft.desc,
      syncStatus: 'pending',
      meta: ['语音速记', '待整理'],
      linkedGameId: draft.linkedGameId,
      linkedRehearsalId: draft.linkedRehearsalId
    }
    addInspiration(item)
    let synced = false
    try {
      await createInspiration({
        title: item.title,
        desc: item.desc,
        meta: item.meta,
        linkedGameId: item.linkedGameId,
        linkedRehearsalId: item.linkedRehearsalId,
        sourceType: 'voice'
      })
      synced = true
      upsertInspiration(Object.assign({}, item, { syncStatus: 'synced' as const }))
    } catch (error) {
      upsertInspiration(item)
    }
    clearVoiceDraft()
    this.closeSheet()
    toast(synced ? '已保存为灵感草稿' : '已保存到本地，待同步')
  },

  saveVoiceContext() {
    // Legacy function, replaced by archive methods
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
    const mutexError = getTaskMutexError('game')
    if (mutexError) {
      toast(mutexError)
      return
    }
    
    let gamesList = getState().games || []
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
        const games = await listGames()
        setGames(games)
        const query = this.data.gameSearchQuery || ''
        const lowerQuery = query.trim().toLowerCase()
        const filteredGamesList = games.filter((game: Game) => {
          const text = `${game.title} ${game.desc} ${game.tags.join(' ')} ${game.meta.join(' ')}`.toLowerCase()
          return !lowerQuery || text.includes(lowerQuery)
        })
        this.setData({
          gamesList: games,
          filteredGamesList,
          ...this.getStartGameEmptyState(query, games, filteredGamesList)
        })
      } catch (e) {
        toast('加载游戏失败')
      }
    }
  },

  filterStartGames(query: string) {
    const lowerQuery = query.trim().toLowerCase()
    return this.data.gamesList.filter((game: Game) => {
      const text = `${game.title} ${game.desc} ${game.tags.join(' ')} ${game.meta.join(' ')}`.toLowerCase()
      return !lowerQuery || text.includes(lowerQuery)
    })
  },

  getStartGameEmptyState(query: string, gamesList: Game[], filteredGamesList: Game[]) {
    if (filteredGamesList.length > 0) return { startGameEmptyTitle: '', startGameEmptyDesc: '' }
    if (!gamesList.length) {
      return {
        startGameEmptyTitle: '还没有可开始的游戏',
        startGameEmptyDesc: '先去发现页添加几个常用游戏，再回来快速开始。'
      }
    }
    if (query.trim()) {
      return {
        startGameEmptyTitle: '没有找到匹配的游戏',
        startGameEmptyDesc: '换个关键词试试，或清空搜索继续浏览当前游戏库。'
      }
    }
    return {
      startGameEmptyTitle: '当前没有可显示的游戏',
      startGameEmptyDesc: '先清空筛选或回到发现页补充游戏库，再回来开始。'
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
      startGameSelectedId: filtered.some((game: Game) => game.id === this.data.startGameSelectedId) ? this.data.startGameSelectedId : '',
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
    const game = this.data.gamesList.find((g: Game) => g.id === id)
    this.setData({ 
      startGameSelectedId: id,
      gameSearchQuery: game ? game.title : this.data.gameSearchQuery
    })
  },

  startGameFromRecord() {
    const id = this.data.startGameSelectedId
    if (!id) {
      toast('请先选择一个游戏')
      return
    }
    const game = this.data.gamesList.find((g: Game) => g.id === id)
    if (!game) return

    try {
      startGameSession({
        id: `session-${Date.now()}`,
        gameId: game.id,
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
    const recommendedPlan = shuffle(state.games).slice(0, 3).map((game) => game.id)
    const savedGames = state.games.filter((game) => state.savedGameIds.includes(game.id))
    if (this.data.rehearsalSource === 'saved' && savedGames.length === 0) {
      toast('还没有收藏游戏，先去发现页收藏几个再开始')
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
      plan: selectedPlan.map((gameId) => ({ gameId, status: '未开始' as const, keep: '', try: '' })),
      meta: [`${selectedPlan.length || 0} 个游戏`, sourceLabel]
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
        ? '先按一下中间的录音按钮，把刚刚闪过的想法留下来。'
        : '需要时可以先快速开启一场排练，再回来查看今天的过程记录。'
    })
  },

  closeRecommend() {
    this.setData({ recommendVisible: false, recommendDismissed: true })
    toast('已关闭今日推荐')
  },

  openRecommend() {
    if (!this.data.recommendClickable) return
    const state = getState()
    const recommendGameId = state.recommendGameId || (state.games[0] ? state.games[0].id : '')
    if (!recommendGameId) {
      toast('当前还没有可推荐的游戏')
      return
    }
    wx.navigateTo({ url: `/pages/game-detail/index?id=${recommendGameId}` })
  }
})
