const { toast } = require('../../utils/page')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { completeRehearsal } = require('../../services/rehearsal')
const { addMethodCard, finishCurrentRehearsal, getState, upsertRehearsalHistory , getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')

Page({
  data: {
    themeClass: 'theme-default',
    insightVisible: false,
    modalOpen: false,
    reviewTitle: '',
    methodTitle: '',
    keepValue: '',
    tryValue: '',
    reminderValue: '',
    selectedDirections: [],
    layoutStyle: ''
  },
  onShareAppMessage() {
    const current = getState().currentRehearsal
    return {
      title: current ? `排练复盘 — ${current.title}` : '排练复盘 — 即兴工具箱',
      path: '/pages/discover/index',
      imageUrl: '/assets/share/share-rehearsal.png'
    }
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },
  onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
    const current = getState().currentRehearsal
    if (current) {
      this.setData({
        reviewTitle: current.title,
        methodTitle: `${current.teamName || '当前排练'}的带领提醒`
      })
    }
  },
  back() {
    wx.navigateBack()
  },
  closeSheet() {
    closeModal(this, { insightVisible: false })
  },
  updateField(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },
  toggleDirection(event) {
    const value = event.currentTarget.dataset.value
    const exists = this.data.selectedDirections.includes(value)
    this.setData({
      selectedDirections: exists
        ? this.data.selectedDirections.filter((item) => item !== value)
        : this.data.selectedDirections.concat(value)
    })
  },
  async save() {
    const current = getState().currentRehearsal
    if (!current) {
      toast('没有可复盘的排练')
      return
    }
    this.closeSheet()
    try {
      const result = await completeRehearsal({
        id: current.id,
        patch: {
          status: '已完成',
          reviewKeep: this.data.keepValue,
          reviewTry: this.data.tryValue,
          reviewReminder: this.data.reminderValue,
          plan: current.plan,
          meta: this.data.selectedDirections
        }
      })
      finishCurrentRehearsal({
        desc: this.data.keepValue,
        meta: this.data.selectedDirections
      })
      upsertRehearsalHistory(result.rehearsal)
      toast('复盘已保存')
      wx.navigateTo({ url: '/pages/team-records/index' })
    } catch (error) {
      toast((error && error.message) || '保存失败，请重试')
    }
  },
  createMethodCard() {
    openModal(this, { insightVisible: true })
  },

  async saveMethodCard() {
    const item = {
      id: `method-${Date.now()}`,
      type: '带领提醒',
      title: this.data.methodTitle,
      desc: this.data.reminderValue,
      meta: ['排练复盘', '带领提醒'],
      sourceType: 'rehearsalReview'
    }
    try {
      const result = await createMethodCardRecord({
        id: item.id,
        sourceType: 'rehearsalReview',
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      addMethodCard(result.item)
      this.closeSheet()
      toast('已沉淀为方法卡')
    } catch (error) {
      toast('沉淀失败，请重试')
    }
  }
})
