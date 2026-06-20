import type { Material, TodayItem, PracticeRecord } from '../../types/domain'
import { findLocalMaterial } from '../../services/material'
import { completePractice } from '../../services/practice-record'
import {
  addMethodCard,
  addPracticeRecord,
  getState,
  markPlayed,
  updateCurrentRehearsalPlan,
  getThemeClass
} from '../../store/index'
import { getRouteParam, toast } from '../../utils/page'
import { getLayoutStyle } from '../../utils/layout'

Page({
  data: {
    themeClass: 'theme-default',
    material: null as Material | null,
    linkedRehearsal: '',
    contextType: 'single',
    historicalRehearsals: [] as Array<{ id: string; title: string }>,
    selectedHistoricalRehearsalId: '',
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

  onShareAppMessage() {
    const material = this.data.material
    if (material) {
      const stripeMap: Record<string, string> = {
        orange: '/assets/share/share-material-orange.png',
        blue: '/assets/share/share-material-blue.png',
        mint: '/assets/share/share-material-mint.png'
      }
      return {
        title: `【${material.type}】${material.title} — 练习复盘`,
        path: `/pages/material-detail/index?id=${material.id}`,
        imageUrl: stripeMap[material.stripeTone] || '/assets/share/share-brand.png'
      }
    }
    return {
      title: '练习复盘 — 即兴工具箱',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-brand.png'
    }
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
      history: {
        title: '关联历史排练',
        desc: `只保存与「${linkedRehearsal}」的关联，不修改历史排练。`
      },
    }
    const nextSummary = summaryMap[this.data.contextType] || summaryMap.single
    this.setData({
      contextSummaryTitle: nextSummary.title,
      contextSummaryDesc: nextSummary.desc
    })
  },

  syncOptions() {
    const currentRehearsal = getState().currentRehearsal
    const hasHistorical = this.data.historicalRehearsals.length > 0
    this.setData({
      contextOptions: [
        { value: 'single', label: '单独记录' },
        ...(currentRehearsal ? [{ value: 'current', label: '加入当前排练' }] : []),
        ...(hasHistorical ? [{ value: 'history', label: '关联历史排练' }] : [])
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
    const material = state.materials.find((item) => item.id === id) || findLocalMaterial(id)
    if (!material) {
      toast('素材不存在')
      setTimeout(() => this.back(), 1500)
      return
    }

    const currentRehearsal = state.currentRehearsal
    const historicalRehearsals = (state.rehearsalHistory || [])
      .filter((item) => !currentRehearsal || item.id !== currentRehearsal.id)
      .map((item) => ({ id: item.id, title: item.title }))

    let durationText = ''
    if (duration > 0) {
      const m = Math.floor(duration / 60)
      const s = duration % 60
      durationText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    this.setData({
      material,
      duration,
      durationText,
      linkedRehearsal: currentRehearsal ? currentRehearsal.title : '单独记录',
      contextType: currentRehearsal ? 'current' : 'single',
      historicalRehearsals,
      selectedHistoricalRehearsalId: historicalRehearsals[0] ? historicalRehearsals[0].id : ''
    }, () => {
      this.syncContextSummary()
    })
    this.syncOptions()
  },

  onShow() {
    const currentRehearsal = getState().currentRehearsal
    const historical = this.data.historicalRehearsals.find((item) => item.id === this.data.selectedHistoricalRehearsalId)
    this.setData({
      themeClass: getThemeClass(),
      linkedRehearsal: this.data.contextType === 'single'
        ? '单独记录'
        : this.data.contextType === 'history'
          ? (historical ? historical.title : '历史排练')
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
    if (!this.data.material) return null
    return {
      id: `method-${Date.now()}`,
      type: '素材练习',
      title: `${this.data.material.title}的复盘`,
      desc: this.buildFeedbackSummary()
    }
  },

  setContextType(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as string
    const current = getState().currentRehearsal
    const nextType = value === 'current' && !current ? 'single' : value
    const historical = this.data.historicalRehearsals.find((item) => item.id === this.data.selectedHistoricalRehearsalId)
    this.setData({
      contextType: nextType,
      linkedRehearsal: nextType === 'single'
        ? '单独记录'
        : nextType === 'history'
          ? (historical ? historical.title : '历史排练')
          : (current ? current.title : '当前排练')
    }, () => {
      this.syncOptions()
      this.syncContextSummary()
    })
  },

  selectHistoricalRehearsal(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const index = Number(event.detail.value)
    const selected = this.data.historicalRehearsals[index]
    if (!selected) return
    this.setData({
      selectedHistoricalRehearsalId: selected.id,
      linkedRehearsal: selected.title
    }, () => this.syncContextSummary())
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
    if (!this.data.material || this.data.savingMode) return
    this.setData({ savingMode: options.createMethodCard ? 'method' : 'record' })
    const material = this.data.material
    const targetRehearsal = this.data.contextType === 'current'
      ? getState().currentRehearsal
      : this.data.contextType === 'history'
        ? this.data.historicalRehearsals.find((item) => item.id === this.data.selectedHistoricalRehearsalId) || null
        : null
    const practiceRecord: PracticeRecord = {
      id: `practiceRecord-${Date.now()}`,
      title: material.title,
      desc: this.data.keepValue || this.data.tryValue || this.data.reminderValue || '无反馈',
      materialId: material.id,
      materialTitle: material.title,
      rehearsalId: targetRehearsal ? targetRehearsal.id : '',
      rehearsalTitle: targetRehearsal ? targetRehearsal.title : '',
      effect: this.data.effectValue,
      keep: this.data.keepValue,
      try: this.data.tryValue,
      reminder: this.data.reminderValue,
      duration: this.data.duration,
      meta: [this.data.effectValue, this.data.attendanceText].filter(Boolean),
      createdAt: Date.now()
    }
    const methodCard = options.createMethodCard ? this.buildMethodCardItem() : null

    try {
      const result = await completePractice({
        practiceRecord: {
          id: practiceRecord.id,
          materialId: practiceRecord.materialId,
          materialTitle: practiceRecord.materialTitle,
          rehearsalId: practiceRecord.rehearsalId,
          rehearsalTitle: practiceRecord.rehearsalTitle,
          title: practiceRecord.title,
          desc: practiceRecord.desc,
          effect: practiceRecord.effect,
          keep: practiceRecord.keep,
          try: practiceRecord.try,
          reminder: practiceRecord.reminder,
          duration: practiceRecord.duration,
          meta: practiceRecord.meta
        },
        rehearsalPatch: targetRehearsal && this.data.contextType === 'current' ? {
          rehearsalId: targetRehearsal.id,
          materialId: material.id,
          status: '已完成',
          keep: this.data.keepValue,
          try: this.data.tryValue
        } : null,
        methodCard: methodCard ? {
          id: methodCard.id,
          sourceType: 'practiceRecord',
          sourceId: practiceRecord.id,
          sourceTitle: practiceRecord.title,
          type: '素材练习',
          title: methodCard.title,
          desc: methodCard.desc,
          meta: ['素材练习', material.title, this.data.effectValue]
        } : null
      })
      addPracticeRecord(result.practiceRecord)
      if (targetRehearsal && this.data.contextType === 'current') {
        updateCurrentRehearsalPlan(material.id, {
          status: '已完成',
          keep: this.data.keepValue,
          try: this.data.tryValue
        })
      }
      markPlayed(material.id)
      if (methodCard && result.methodCard) addMethodCard(result.methodCard as TodayItem)
      toast(options.createMethodCard ? '已保存并沉淀为方法卡' : '已保存练习记录')
      setTimeout(() => {
        wx.switchTab({ url: '/pages/discover/index' })
      }, 1500)
    } catch (error: any) {
      toast(error.message || '保存失败，请重试')
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
