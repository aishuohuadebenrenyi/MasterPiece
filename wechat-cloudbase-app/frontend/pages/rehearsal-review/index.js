const { toast } = require('../../utils/page')
const { createGameRecord } = require('../../services/game-record')
const { createMethodCard: createMethodCardRecord } = require('../../services/method-card')
const { updateRehearsal } = require('../../services/rehearsal')
const { addMethodCard, finishCurrentRehearsal, getState, upsertRehearsalHistory } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')

Page({
  data: {
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
  onLoad() {
    this.setData({ layoutStyle: getLayoutStyle() })
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
    try {
      await createGameRecord({
        type: 'rehearsalReview',
        rehearsalId: current.id,
        keep: this.data.keepValue,
        try: this.data.tryValue,
        reminder: this.data.reminderValue
      })
    } catch (error) {
      syncFailed = true
    }
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
    await createMethodCardRecord({
      sourceType: 'rehearsalReview',
      title: this.data.methodTitle,
      desc: this.data.reminderValue
    })
    addMethodCard({
      id: `method-${Date.now()}`,
      type: '带领提醒',
      title: this.data.methodTitle,
      desc: this.data.reminderValue,
      meta: ['排练复盘', '带领提醒'],
      sourceType: 'rehearsalReview'
    })
    this.closeSheet()
    toast('已沉淀为方法卡')
  }
})
