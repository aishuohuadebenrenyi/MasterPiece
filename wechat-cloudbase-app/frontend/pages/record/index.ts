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
import { INSPIRATION_TITLE_MAX_LENGTH, REHEARSAL_PLAN_SIZE } from '../../config/constants'

Page({
  data: {
    themeClass: 'theme-default',
    inspirationText: '',
    pausedRehearsal: null,
    currentRehearsal: null as RehearsalRecord | null,
    currentMaterialSession: null as MaterialSession | null,
    materialSessionCard: null as any,
    rehearsalCard: null as null | {
      label: string
      title: string
      desc: string
      items: Array<{ indexLabel: string; text: string }>
    },
    recommendVisible: false,
    recommendDismissed: false,
    recommendClickable: false,
    recommendMaterialId: '',
    recommendTitle: '',
    recommendDesc: '',
    todayVisible: false,
    startRehearsalVisible: false,
    startPracticeVisible: false,
    startPracticeSelectedId: '',
    materialSearchQuery: '',
    filteredMaterialsList: [] as Material[],
    materialsList: [] as Material[],
    startPracticeEmptyTitle: '还没有可开始的素材',
    startPracticeEmptyDesc: '先去发现页添加几个常用素材，再回来快速开始。',
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
    customDurationVisible: false,
    customDurationSelected: false,
    customDurationInput: '',
    rehearsalGoals: [] as string[],
    customGoalVisible: false,
    customGoalSelected: false,
    customGoalInput: '',
    rehearsalSource: 'recommended',
    durationOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    goalOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    sourceOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    savedSourceUnavailable: false,
    rehearsalSourceHint: '',
    layoutStyle: '',
    privacyVisible: false,
    todayLoadError: ''
  },

  unsubscribeStore: null as null | (() => void),
  unsubscribePrivacy: null as null | (() => void),

  getMergedRehearsalGoals() {
    const customGoal = this.data.customGoalSelected ? String(this.data.customGoalInput || '').trim() : ''
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
    const recommendedMaterial = state.materials.find((material: Material) => material.id === state.recommendMaterialId) || state.materials.find((material: Material) => !material.referenceOnly) || null
    const recommendClickable = !!recommendedMaterial
    const recommendMaterialId = recommendedMaterial ? recommendedMaterial.id : ''
    const inspirationCount = state.todayInspirations.length
    const rehearsalCount = state.todayRehearsals.length
    const savedMaterialsCount = state.materials.filter((material: Material) => state.savedMaterialIds.includes(material.id) && !material.referenceOnly).length
    const savedSourceUnavailable = this.data.rehearsalSource === 'saved' && savedMaterialsCount === 0
    const rehearsalSourceHint = savedSourceUnavailable
      ? '还没有收藏可训练素材，先去发现页点亮几个爱心，再回来随机开启。'
      : ''

    const recommendTitle = recommendClickable
      ? recommendedMaterial.title
      : '慢下来，记录今天有触动的瞬间'
    const recommendDesc = recommendClickable
      ? (recommendedMaterial.desc || '当前有一张推荐素材卡')
      : '今天如果没有想练的素材，也可以先想想发生过的一个瞬间，把感受记下来。'
    const buildPlanText = (materialId: string, status: string) => {
      const material = state.materials.find((item: Material) => item.id === materialId)
      return `${material ? material.title : '未命名素材'} · ${status}`
    }
    let materialSessionCard: any = null
    const currentMaterialSession = state.currentMaterial || null
    if (currentMaterialSession) {
      const d = currentMaterialSession.duration || 0
      const m = Math.floor(d / 60)
      const s = d % 60
      materialSessionCard = {
        label: currentMaterialSession.status || '进行中',
        title: currentMaterialSession.title || '当前素材',
        durationText: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
    }

    const pausedSource = currentRehearsal && (currentRehearsal as RehearsalRecord).status === '暂停中' ? currentRehearsal as RehearsalRecord : null
    const rehearsalCard = !currentMaterialSession && pausedSource
      ? {
          label: '暂停中的排练',
          title: pausedSource.title,
          desc: pausedSource.desc,
          items: (pausedSource.plan || []).slice(0, 3).map((item: any, index: number) => ({
            indexLabel: String(index + 1),
            text: buildPlanText(item.materialId, item.status)
          }))
        }
      : null
    this.setData({
      pausedRehearsal: state.pausedRehearsal,
      currentRehearsal,
      currentMaterialSession,
      materialSessionCard,
      rehearsalCard,
      recommendVisible: !this.data.recommendDismissed,
      recommendClickable,
      recommendMaterialId,
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
        activeClass: !this.data.customDurationSelected && this.data.rehearsalDuration === item.value ? 'active' : ''
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

  onShareAppMessage() {
    return {
      title: '即兴工具箱 — 找素材·快记录·可沉淀',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
  },

  async onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    this.unsubscribeStore = subscribe(() => this.syncLocalState())
    const app = getApp()
    if (app.subscribePrivacy) {
      this.unsubscribePrivacy = app.subscribePrivacy(() => {
        this.setData({ privacyVisible: true })
      })
    }
    try {
      await fetchTodaySummary()
      this.setData({ todayLoadError: '' })
    } catch (error) {
      this.setData({ todayLoadError: '今日记录加载失败，当前数量可能不完整。' })
    }
    await this.refreshMaterials()
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
    syncTabBar(this, 1)
    this.syncLocalState()
  },

  onPageScroll(e: any) {
    if (this._lastScrollTop === undefined) this._lastScrollTop = 0
    const delta = e.scrollTop - this._lastScrollTop
    this._lastScrollTop = e.scrollTop
    if (Math.abs(delta) > 10) {
      const tabbar = this.getTabBar()
      if (tabbar && typeof (tabbar as any).setHidden === 'function') {
        (tabbar as any).setHidden(delta > 0)
      }
    }
  },

  onResize() {
    this.setData({ layoutStyle: getLayoutStyle() })
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

  async refreshMaterials() {
    try {
      const games = await listMaterials()
      setMaterials(games)
    } catch (error) {
      // 云端不可用时保留当前会话的素材列表
    }
  },

  resumeMaterialSessionCard() {
    const session = this.data.currentMaterialSession as any
    if (session) {
      wx.navigateTo({ url: `/pages/material-detail/index?id=${session.materialId || session.id}` })
    }
  },

  updateInspirationText(event: WechatMiniprogram.Input) {
    this.setData({ inspirationText: String(event.detail.value || '') })
  },

  closeSheet() {
    closeModal(this, {
      todayVisible: false,
      startRehearsalVisible: false,
      startPracticeVisible: false,
      startPracticeSelectedId: '',
      materialSearchQuery: '',
      filteredMaterialsList: [],
      teamName: '',
      rehearsalDuration: '90',
      customDurationVisible: false,
      customDurationSelected: false,
      customDurationInput: '',
      rehearsalGoals: [],
      customGoalVisible: false,
      customGoalSelected: false,
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
    const title = firstLine.length > INSPIRATION_TITLE_MAX_LENGTH ? `${firstLine.slice(0, INSPIRATION_TITLE_MAX_LENGTH)}...` : firstLine
    const item: InspirationItem = {
      id: `inspiration-${Date.now()}`,
      type: '灵感',
      title,
      desc: text,
      meta: ['快速记录', '待整理']
    }
    try {
      const result = await createInspiration({
        id: item.id,
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      addInspiration(result.item as InspirationItem)
      this.setData({ inspirationText: '' })
      toast('已保存灵感')
    } catch (error: any) {
      toast(error.message || '保存失败，请重试')
    }
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

  async openStartPractice() {
    const mutexError = getTaskMutexError('material')
    if (mutexError) {
      toast(mutexError)
      return
    }
    
    let materialsList = (getState().materials || []).filter((material: Material) => !material.referenceOnly)
    const startPracticeEmptyState = this.getStartPracticeEmptyState('', materialsList, materialsList)
    openModal(this, {
      startPracticeVisible: true,
      startPracticeSelectedId: '',
      materialSearchQuery: '',
      materialsList: materialsList,
      filteredMaterialsList: materialsList,
      ...startPracticeEmptyState
    })

    if (materialsList.length === 0) {
      try {
        const games = (await listMaterials()).filter((material: Material) => !material.referenceOnly)
        setMaterials(games)
        const query = this.data.materialSearchQuery || ''
        const lowerQuery = query.trim().toLowerCase()
        const filteredMaterialsList = games.filter((material: Material) => {
          const text = `${material.title} ${material.desc} ${material.type} ${material.tags.join(' ')} ${(material.abilities || []).join(' ')} ${material.meta.join(' ')}`.toLowerCase()
          return !lowerQuery || text.includes(lowerQuery)
        })
        this.setData({
          materialsList: games,
          filteredMaterialsList,
          ...this.getStartPracticeEmptyState(query, games, filteredMaterialsList)
        })
      } catch (e) {
        toast('加载素材失败')
      }
    }
  },

  filterStartPractices(query: string) {
    const lowerQuery = query.trim().toLowerCase()
    return this.data.materialsList.filter((material: Material) => {
      const text = `${material.title} ${material.desc} ${material.type} ${material.tags.join(' ')} ${(material.abilities || []).join(' ')} ${material.meta.join(' ')}`.toLowerCase()
      return !lowerQuery || text.includes(lowerQuery)
    })
  },

  getStartPracticeEmptyState(query: string, materialsList: Material[], filteredMaterialsList: Material[]) {
    if (filteredMaterialsList.length > 0) return { startPracticeEmptyTitle: '', startPracticeEmptyDesc: '' }
    if (!materialsList.length) {
      return {
        startPracticeEmptyTitle: '还没有可开始的素材',
        startPracticeEmptyDesc: '先去发现页添加几个常用素材，再回来快速开始。'
      }
    }
    if (query.trim()) {
      return {
        startPracticeEmptyTitle: '没有找到匹配的素材',
        startPracticeEmptyDesc: '换个关键词试试，或清空搜索继续浏览当前素材库。'
      }
    }
    return {
      startPracticeEmptyTitle: '当前没有可显示的素材',
      startPracticeEmptyDesc: '先清空筛选或回到发现页补充素材库，再回来开始。'
    }
  },

  showStartPracticeList() {
    if (!this.data.filteredMaterialsList.length && this.data.materialsList.length) {
      const filteredMaterialsList = this.filterStartPractices(this.data.materialSearchQuery || '')
      this.setData({
        filteredMaterialsList,
        ...this.getStartPracticeEmptyState(this.data.materialSearchQuery || '', this.data.materialsList, filteredMaterialsList)
      })
    }
  },

  onMaterialSearchInput(e: any) {
    const query = e.detail.value || ''
    const filtered = this.filterStartPractices(query)
    this.setData({
      materialSearchQuery: query,
      filteredMaterialsList: filtered,
      startPracticeSelectedId: filtered.some((material: Material) => material.id === this.data.startPracticeSelectedId) ? this.data.startPracticeSelectedId : '',
      ...this.getStartPracticeEmptyState(query, this.data.materialsList, filtered)
    })
  },

  clearMaterialSearch() {
    const filteredMaterialsList = this.filterStartPractices('')
    this.setData({
      materialSearchQuery: '',
      filteredMaterialsList,
      startPracticeSelectedId: '',
      ...this.getStartPracticeEmptyState('', this.data.materialsList, filteredMaterialsList)
    })
  },

  selectMaterialToStart(e: any) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    const material = this.data.materialsList.find((g: Material) => g.id === id)
    this.setData({ 
      startPracticeSelectedId: id,
      materialSearchQuery: material ? material.title : this.data.materialSearchQuery
    })
  },

  startPracticeFromRecord() {
    const id = this.data.startPracticeSelectedId
    if (!id) {
      toast('请先选择一条素材')
      return
    }
    const material = this.data.materialsList.find((g: Material) => g.id === id)
    if (!material) return

    try {
      startMaterialSession({
        id: `session-${Date.now()}`,
        materialId: material.id,
        title: material.title,
        startTime: Date.now(),
        duration: 0,
        status: '进行中'
      })
      this.closeSheet()
      wx.navigateTo({ url: `/pages/material-detail/index?id=${material.id}` })
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
    this.setData({
      rehearsalDuration: value,
      customDurationVisible: false,
      customDurationSelected: false
    }, () => this.syncLocalState())
  },

  toggleCustomDuration() {
    const alreadySelected = this.data.customDurationSelected
    const customValue = String(this.data.customDurationInput || '').trim()
    this.setData({
      customDurationSelected: true,
      customDurationVisible: alreadySelected ? !this.data.customDurationVisible : true,
      rehearsalDuration: customValue || this.data.rehearsalDuration
    }, () => this.syncLocalState())
  },

  updateCustomDuration(event: WechatMiniprogram.Input) {
    const value = String(event.detail.value || '').replace(/\D/g, '')
    this.setData({
      customDurationInput: value,
      customDurationSelected: true,
      rehearsalDuration: value || this.data.rehearsalDuration
    }, () => this.syncLocalState())
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
    const selected = !this.data.customGoalSelected
    this.setData({
      customGoalSelected: selected,
      customGoalVisible: selected
    })
  },

  updateCustomGoal(event: WechatMiniprogram.Input) {
    this.setData({
      customGoalInput: String(event.detail.value || '').trim(),
      customGoalSelected: true
    })
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
    if (this.data.customDurationSelected && !Number(this.data.customDurationInput)) {
      toast('请输入有效的排练时长')
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
    const recommendedPlan = shuffle(trainableMaterials).slice(0, REHEARSAL_PLAN_SIZE).map((material) => material.id)
    const savedMaterials = trainableMaterials.filter((material) => state.savedMaterialIds.includes(material.id))
    if (this.data.rehearsalSource === 'saved' && savedMaterials.length === 0) {
      toast('还没有收藏可训练素材，先去发现页收藏几个再开始')
      return
    }
    const savedPlan = shuffle(savedMaterials).slice(0, REHEARSAL_PLAN_SIZE).map((material) => material.id)
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
      plan: selectedPlan.map((materialId) => ({ materialId, status: '未开始' as const, keep: '', try: '' })),
      meta: [`${selectedPlan.length || 0} 条素材`, sourceLabel]
    }
    try {
      const result = await createRehearsal(rehearsal)
      const savedRehearsal = Object.assign({}, rehearsal, result.item)
      startRehearsalStore(savedRehearsal)
      setCurrentRehearsal(savedRehearsal)
      upsertRehearsalHistory(savedRehearsal)
      this.closeSheet()
      wx.navigateTo({ url: '/pages/rehearsal-record/index' })
    } catch (error: any) {
      toast(error.message || '开启失败，请重试')
    }
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
    const recommendMaterialId = this.data.recommendMaterialId
    if (!recommendMaterialId) {
      toast('当前还没有可推荐的素材')
      return
    }
    wx.navigateTo({ url: `/pages/material-detail/index?id=${recommendMaterialId}` })
  }
})
