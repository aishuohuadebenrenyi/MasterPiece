import type { Game, TodayItem, RehearsalRecord, GameRecord } from '../../types/domain'
import { findLocalGame } from '../../services/game'
import { createGameRecord } from '../../services/game-record'
import { createMethodCard as createMethodCardRecord } from '../../services/method-card'
import { createRehearsal, updateGameStatus } from '../../services/rehearsal'
import {
  addMethodCard,
  addGameRecord,
  getState,
  getTaskMutexError,
  markPlayed,
  setCurrentRehearsal,
  setVoiceDraft,
  startRehearsal,
  updateCurrentRehearsalPlan,
  upsertRehearsalHistory,
  getThemeClass
} from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'
import { getLayoutStyle } from '../../utils/layout'
import { closeModal, openModal } from '../../utils/modal'

Page({
  data: {
    themeClass: 'theme-default',
    game: null as Game | null,
    insightVisible: false,
    recordType: '游戏实践',
    linkedRehearsal: '',
    contextType: 'single',
    attendanceText: '',
    effectValue: '一般',
    keepValue: '',
    tryValue: '',
    reminderValue: '',
    moreVisible: false,
    modalOpen: false,
    contextOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    effectOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    layoutStyle: '',
    duration: 0,
    durationText: '',
    feedbackText: ''
  },

  syncOptions() {
    const currentRehearsal = getState().currentRehearsal
    this.setData({
      contextOptions: [
        { value: 'single', label: '单独记录' },
        ...(currentRehearsal ? [{ value: 'current', label: '加入当前排练' }] : []),
        { value: 'new', label: '新建排练' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.contextType === item.value ? 'active' : ''
      })),
      effectOptions: [
        { value: '很有效', label: '很有效' },
        { value: '一般', label: '一般' },
        { value: '不适合', label: '不适合' }
      ].map((item) => Object.assign({}, item, {
        activeClass: this.data.effectValue === item.value ? 'active' : ''
      }))
    })
  },

  onLoad(options: Record<string, string>) {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const id = getRouteParam(options, 'id', '')
    const duration = parseInt(getRouteParam(options, 'duration', '0'), 10)

    if (!id) {
      toast('未找到游戏')
      setTimeout(() => this.back(), 1500)
      return
    }

    const state = getState()
    const game = state.games.find((item) => item.id === id) || findLocalGame(id)
    if (!game) {
      toast('游戏不存在')
      setTimeout(() => this.back(), 1500)
      return
    }

    const draft = state.voiceDraft
    const currentRehearsal = state.currentRehearsal
    let keepValue = ''
    if (draft && draft.linkedGameId === id) {
      keepValue = draft.summary
      // 消费完毕后清除草稿，避免污染后续操作
      setVoiceDraft(null)
    }

    let durationText = ''
    if (duration > 0) {
      const m = Math.floor(duration / 60)
      const s = duration % 60
      durationText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    this.setData({
      game,
      keepValue,
      duration,
      durationText,
      linkedRehearsal: currentRehearsal ? currentRehearsal.title : '单独记录',
      contextType: currentRehearsal ? 'current' : 'single',
    })
    this.syncOptions()
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  back() {
    wx.navigateBack()
  },

  openVoice() {
    const draft = getState().voiceDraft
    if (!draft) {
      toast('已打开语音速记')
      return
    }
    this.setData({
      keepValue: draft.summary,
      tryValue: this.data.tryValue
    })
    toast('已带入最近一条语音草稿')
  },

  closeSheet() {
    closeModal(this, { insightVisible: false })
  },

  setContextType(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as string
    const current = getState().currentRehearsal
    const nextType = value === 'current' && !current ? 'single' : value
    this.setData({
      contextType: nextType,
      linkedRehearsal: nextType === 'single'
        ? '单独记录'
        : nextType === 'new'
          ? `${this.data.game ? this.data.game.title : '本次游戏'} · 新排练`
          : (current ? current.title : '当前排练')
    }, () => this.syncOptions())
  },

  setEffect(event: WechatMiniprogram.TouchEvent) {
    this.setData({ effectValue: event.currentTarget.dataset.value }, () => this.syncOptions())
  },

  toggleMore() {
    this.setData({ moreVisible: !this.data.moreVisible })
  },

  updateField(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  openInsight() {
    this.setData({ insightVisible: true })
  },

  async saveMethodCard() {
    if (!this.data.game) return
    const item: TodayItem = {
      id: `method-${Date.now()}`,
      type: '游戏实践',
      title: `${this.data.game.title}的反馈`,
      desc: `Keep: ${this.data.keepValue || '无'}\nTry: ${this.data.tryValue || '无'}${this.data.reminderValue ? '\n提醒: ' + this.data.reminderValue : ''}`
    }
    try {
      await createMethodCardRecord({
        sourceType: 'gameRecord',
        type: '游戏实践',
        title: item.title,
        desc: item.desc,
        meta: ['游戏实践', this.data.game.title, this.data.effectValue]
      })
      addMethodCard(item)
      toast('已沉淀为方法卡')
    } catch (error) {
      addMethodCard(Object.assign({}, item, { syncStatus: 'pending' }))
      toast('已本地保存，待同步')
    }
    this.closeSheet()
  },

  async saveRecord() {
    if (!this.data.game) return
    this.closeSheet()
    let syncFailed = false
    let targetRehearsal = getState().currentRehearsal
    if (this.data.contextType === 'new') {
      const mutexError = getTaskMutexError('rehearsal')
      if (mutexError) {
        toast(mutexError)
        return
      }
      const rehearsal = {
        id: `rehearsal-${Date.now()}`,
        type: '排练',
        title: this.data.linkedRehearsal,
        desc: `${this.data.game.title} · ${this.data.effectValue}`,
        teamName: this.data.linkedRehearsal.replace(' · 新排练', '') || this.data.game.title,
        duration: '60',
        goals: ['游戏反馈'],
        source: 'feedback',
        status: '进行中' as const,
        syncStatus: 'pending' as const,
        plan: [{ gameId: this.data.game.id, status: '已完成' as const, keep: this.data.keepValue, try: this.data.tryValue }],
        meta: [this.data.attendanceText, '从反馈创建']
      }
      startRehearsal(rehearsal)
      upsertRehearsalHistory(rehearsal)
      targetRehearsal = rehearsal
      try {
        await createRehearsal(rehearsal)
        const syncedRehearsal = Object.assign({}, rehearsal, { syncStatus: 'synced' as const })
        setCurrentRehearsal(syncedRehearsal)
        upsertRehearsalHistory(syncedRehearsal)
        targetRehearsal = syncedRehearsal
      } catch (error) {
        syncFailed = true
      }
    }
    
    // 生成游戏记录
    const gameRecord: GameRecord = {
      id: `gameRecord-${Date.now()}`,
      title: this.data.game.title,
      desc: `${this.data.keepValue || this.data.tryValue || this.data.reminderValue || '无反馈'}`,
      gameId: this.data.game.id,
      rehearsalId: targetRehearsal ? targetRehearsal.id : '',
      effect: this.data.effectValue,
      keep: this.data.keepValue,
      try: this.data.tryValue,
      reminder: this.data.reminderValue,
      duration: this.data.duration,
      meta: [this.data.effectValue, this.data.attendanceText].filter(Boolean),
      syncStatus: 'pending' as const,
      createdAt: Date.now()
    }
    addGameRecord(gameRecord)
    
    try {
      await createGameRecord({
        gameId: gameRecord.gameId,
        rehearsalId: gameRecord.rehearsalId,
        title: gameRecord.title,
        effect: gameRecord.effect,
        keep: gameRecord.keep,
        try: gameRecord.try,
        reminder: gameRecord.reminder,
        duration: gameRecord.duration,
        meta: gameRecord.meta
      })
      // Success, we can ignore the local status update for now as a full refresh will fetch it
    } catch (error) {
      syncFailed = true
    }

    if (targetRehearsal && this.data.contextType !== 'single') {
      updateCurrentRehearsalPlan(this.data.game.id, {
        status: '已完成',
        keep: this.data.keepValue,
        try: this.data.tryValue
      })
      try {
        await updateGameStatus({
          rehearsalId: targetRehearsal.id,
          gameId: this.data.game.id,
          status: '已完成',
          keep: this.data.keepValue,
          try: this.data.tryValue
        })
      } catch (error) {
        syncFailed = true
      }
    }
    markPlayed(this.data.game.id)
    toast(syncFailed ? '已本地保存，待同步' : '已保存游戏记录')
    setTimeout(() => {
      wx.switchTab({ url: '/pages/discover/index' })
    }, 1500)
  }
})
