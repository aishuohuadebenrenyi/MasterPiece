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

Page({
  data: {
    themeClass: 'theme-default',
    game: null as Game | null,
    linkedRehearsal: '',
    contextType: 'single',
    contextSummaryTitle: '',
    contextSummaryDesc: '',
    attendanceText: '',
    effectValue: '一般',
    keepValue: '',
    tryValue: '',
    reminderValue: '',
    moreVisible: false,
    savingMode: '' as '' | 'record' | 'method',
    contextOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    effectOptions: [] as Array<{ value: string; label: string; activeClass: string }>,
    voiceHintTitle: '',
    voiceHintDesc: '',
    layoutStyle: '',
    duration: 0,
    durationText: ''
  },

  syncContextSummary() {
    const linkedRehearsal = this.data.linkedRehearsal || '单独记录'
    const summaryMap: Record<string, { title: string; desc: string }> = {
      single: {
        title: '单独记录',
        desc: '只保存这条反馈，不写入排练。'
      },
      current: {
        title: '加入当前排练',
        desc: `保存时会回写到「${linkedRehearsal}」的计划里。`
      },
      new: {
        title: '新建排练后保存',
        desc: `会先创建「${linkedRehearsal}」，再挂入这次反馈。`
      }
    }
    const nextSummary = summaryMap[this.data.contextType] || summaryMap.single
    this.setData({
      contextSummaryTitle: nextSummary.title,
      contextSummaryDesc: nextSummary.desc
    })
  },

  syncVoiceHint() {
    const draft = getState().voiceDraft
    const gameId = this.data.game ? this.data.game.id : ''
    if (!draft) {
      this.setData({
        voiceHintTitle: '暂无可导入语音',
        voiceHintDesc: '先去记录页生成一条语音摘要，再带回这里。'
      })
      return
    }
    if (draft.linkedGameId && draft.linkedGameId === gameId) {
      this.setData({
        voiceHintTitle: '可直接导入到 Keep',
        voiceHintDesc: '这是当前游戏最近的一条语音摘要。'
      })
      return
    }
    this.setData({
      voiceHintTitle: '有一条最近语音摘要',
      voiceHintDesc: '可以带入 Keep，保存前请确认内容是否属于当前游戏。'
    })
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
    }, () => {
      this.syncContextSummary()
      this.syncVoiceHint()
    })
    this.syncOptions()
  },

  onShow() {
    const currentRehearsal = getState().currentRehearsal
    this.setData({
      themeClass: getThemeClass(),
      linkedRehearsal: this.data.contextType === 'single'
        ? '单独记录'
        : this.data.contextType === 'new'
          ? `${this.data.game ? this.data.game.title : '本次游戏'} · 新排练`
          : (currentRehearsal ? currentRehearsal.title : '当前排练')
    }, () => {
      this.syncOptions()
      this.syncContextSummary()
      this.syncVoiceHint()
    })
  },

  back() {
    wx.navigateBack()
  },

  openVoice() {
    const draft = getState().voiceDraft
    if (!draft) {
      toast('暂无可带入的语音草稿')
      return
    }
    this.setData({
      keepValue: draft.summary
    })
    setVoiceDraft(null)
    this.syncVoiceHint()
    toast('已带入最近一条语音草稿')
  },

  buildFeedbackSummary() {
    return `Keep: ${this.data.keepValue || '无'}\nTry: ${this.data.tryValue || '无'}${this.data.reminderValue ? '\n提醒: ' + this.data.reminderValue : ''}`
  },

  buildMethodCardItem(): TodayItem | null {
    if (!this.data.game) return null
    return {
      id: `method-${Date.now()}`,
      type: '游戏实践',
      title: `${this.data.game.title}的反馈`,
      desc: this.buildFeedbackSummary()
    }
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
    }, () => {
      this.syncOptions()
      this.syncContextSummary()
    })
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

  async persistFeedbackRecord(options: { createMethodCard: boolean }) {
    if (!this.data.game || this.data.savingMode) return
    if (this.data.contextType === 'new') {
      const mutexError = getTaskMutexError('rehearsal')
      if (mutexError) {
        toast(mutexError)
        return
      }
    }

    this.setData({ savingMode: options.createMethodCard ? 'method' : 'record' })
    let syncFailed = false
    const game = this.data.game
    let targetRehearsal = getState().currentRehearsal

    try {
      if (this.data.contextType === 'new') {
        const rehearsal: RehearsalRecord = {
          id: `rehearsal-${Date.now()}`,
          type: '排练',
          title: this.data.linkedRehearsal,
          desc: `${game.title} · ${this.data.effectValue}`,
          teamName: this.data.linkedRehearsal.replace(' · 新排练', '') || game.title,
          duration: '60',
          goals: ['游戏反馈'],
          source: 'feedback',
          status: '进行中',
          syncStatus: 'pending',
          plan: [{
            gameId: game.id,
            status: '已完成',
            keep: this.data.keepValue,
            try: this.data.tryValue
          }],
          meta: [this.data.attendanceText, '从反馈创建'].filter(Boolean)
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

      const gameRecord: GameRecord = {
        id: `gameRecord-${Date.now()}`,
        title: game.title,
        desc: `${this.data.keepValue || this.data.tryValue || this.data.reminderValue || '无反馈'}`,
        gameId: game.id,
        rehearsalId: targetRehearsal ? targetRehearsal.id : '',
        effect: this.data.effectValue,
        keep: this.data.keepValue,
        try: this.data.tryValue,
        reminder: this.data.reminderValue,
        duration: this.data.duration,
        meta: [this.data.effectValue, this.data.attendanceText].filter(Boolean),
        syncStatus: 'pending',
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
      } catch (error) {
        syncFailed = true
      }

      if (targetRehearsal && this.data.contextType !== 'single') {
        updateCurrentRehearsalPlan(game.id, {
          status: '已完成',
          keep: this.data.keepValue,
          try: this.data.tryValue
        })
        try {
          await updateGameStatus({
            rehearsalId: targetRehearsal.id,
            gameId: game.id,
            status: '已完成',
            keep: this.data.keepValue,
            try: this.data.tryValue
          })
        } catch (error) {
          syncFailed = true
        }
      }

      markPlayed(game.id)

      if (options.createMethodCard) {
        const item = this.buildMethodCardItem()
        if (item) {
          try {
            await createMethodCardRecord({
              sourceType: 'gameRecord',
              type: '游戏实践',
              title: item.title,
              desc: item.desc,
              meta: ['游戏实践', game.title, this.data.effectValue]
            })
            addMethodCard(item)
          } catch (error) {
            syncFailed = true
            addMethodCard(Object.assign({}, item, { syncStatus: 'pending' as const }))
          }
        }
      }

      toast(
        syncFailed
          ? '已本地保存，待同步'
          : options.createMethodCard
            ? '已保存并沉淀为方法卡'
            : '已保存游戏记录'
      )
      setTimeout(() => {
        wx.switchTab({ url: '/pages/discover/index' })
      }, 1500)
    } finally {
      this.setData({ savingMode: '' })
    }
  },

  async saveRecord() {
    await this.persistFeedbackRecord({ createMethodCard: false })
  },

  async saveMethodCard() {
    await this.persistFeedbackRecord({ createMethodCard: true })
  }
})
