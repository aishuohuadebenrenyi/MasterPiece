const { toast } = require('../../utils/page')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { updateRehearsal } = require('../../services/rehearsal')
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
    let syncFailed = false
    const finished = finishCurrentRehearsal({
      desc: this.data.keepValue,
      syncStatus: 'pending',
      meta: this.data.selectedDirections
    })
    if (finished) {
      try {
        await updateRehearsal(finished.id, {
          status: '已完成',
          reviewKeep: this.data.keepValue,
          reviewTry: this.data.tryValue,
          reviewReminder: this.data.reminderValue,
          plan: finished.plan
        })
        upsertRehearsalHistory(Object.assign({}, finished, { syncStatus: 'synced' }))
      } catch (error) {
        syncFailed = true
      }
    }
    toast(syncFailed ? '复盘已本地保存，待同步' : '复盘已保存')
    wx.navigateTo({ url: '/pages/team-records/index' })
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
      await createMethodCardRecord({
        sourceType: 'rehearsalReview',
        title: item.title,
        desc: item.desc,
        meta: item.meta
      })
      addMethodCard(item)
      this.closeSheet()
      toast('已沉淀为方法卡')
    } catch (error) {
      addMethodCard(Object.assign({}, item, { syncStatus: 'pending' }))
      this.closeSheet()
      toast('已本地保存，待同步')
    }
  }
})
