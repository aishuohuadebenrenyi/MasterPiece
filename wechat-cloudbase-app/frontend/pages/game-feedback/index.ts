import type { Material, TodayItem, RehearsalRecord, PracticeRecord } from '../../types/domain'
import { findLocalMaterial } from '../../services/material'
import { createPracticeRecord } from '../../services/practice-record'
import { createMethodCard as createMethodCardRecord } from '../../services/method-card'
import { createRehearsal, updateMaterialStatus } from '../../services/rehearsal'
import {
  addMethodCard,
  addPracticeRecord,
  getState,
  getTaskMutexError,
  markPlayed,
  setCurrentRehearsal,
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
    game: null as Material | null,
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
      toast('未找到素材')
      setTimeout(() => this.back(), 1500)
      return
    }

    const state = getState()
    const game = state.materials.find((item) => item.id === id) || findLocalMaterial(id)
    if (!game) {
      toast('素材不存在')
      setTimeout(() => this.back(), 1500)
      return
    }

    const currentRehearsal = state.currentRehearsal

    let durationText = ''
    if (duration > 0) {
      const m = Math.floor(duration / 60)
      const s = duration % 60
      durationText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    this.setData({
      game,
      duration,
      durationText,
      linkedRehearsal: currentRehearsal ? currentRehearsal.title : '单独记录',
      contextType: currentRehearsal ? 'current' : 'single',
    }, () => {
      this.syncContextSummary()
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
          ? `${this.data.game ? this.data.game.title : '本次练习'} · 新排练`
          : (currentRehearsal ? currentRehearsal.title : '当前排练')
    }, () => {
      this.syncOptions()
      this.syncContextSummary()
    })
  },

  back() {
    wx.navigateBack()
  },

  buildFeedbackSummary() {
    return `Keep: ${this.data.keepValue || '无'}\nTry: ${this.data.tryValue || '无'}${this.data.reminderValue ? '\n提醒: ' + this.data.reminderValue : ''}`
  },

  buildMethodCardItem(): TodayItem | null {
    if (!this.data.game) return null
    return {
      id: `method-${Date.now()}`,
      type: '素材练习',
      title: `${this.data.game.title}的复盘`,
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
          ? `${this.data.game ? this.data.game.title : '本次练习'} · 新排练`
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
          goals: ['素材练习'],
          source: 'feedback',
          status: '进行中',
          syncStatus: 'pending',
          plan: [{
            materialId: game.id,
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

      const gameRecord: PracticeRecord = {
        id: `practiceRecord-${Date.now()}`,
        title: game.title,
        desc: `${this.data.keepValue || this.data.tryValue || this.data.reminderValue || '无反馈'}`,
        materialId: game.id,
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
      addPracticeRecord(gameRecord)

      try {
        await createPracticeRecord({
          materialId: gameRecord.materialId,
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
          await updateMaterialStatus({
            rehearsalId: targetRehearsal.id,
            materialId: game.id,
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
              sourceType: 'practiceRecord',
              type: '素材练习',
              title: item.title,
              desc: item.desc,
              meta: ['素材练习', game.title, this.data.effectValue]
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
            : '已保存练习记录'
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
