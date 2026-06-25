const { createFeedback } = require('../../services/feedback')
const { deleteAccount } = require('../../services/profile')
const { getThemeClass, setState, setThemeMode } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')
const { closeModal, openModal } = require('../../utils/modal')
const { toast } = require('../../utils/page')

const FEEDBACK_OPTIONS = [
  { value: 'bug', label: '功能问题' },
  { value: 'suggestion', label: '体验建议' },
  { value: 'content', label: '内容问题' },
  { value: 'other', label: '其他' }
]

function getVersionInfo() {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync()
    const miniProgram = accountInfo && accountInfo.miniProgram
    if (miniProgram) {
      const version = miniProgram.version || ''
      return {
        appVersion: version || 'release',
        versionLabel: version || '正式版'
      }
    }
  } catch (error) {
    console.warn('[settings] get version failed', error)
  }
  return { appVersion: 'release', versionLabel: '正式版' }
}

function buildFeedbackOptions(activeCategory = '') {
  return FEEDBACK_OPTIONS.map((item) => Object.assign({}, item, {
    activeClass: item.value === activeCategory ? 'active' : ''
  }))
}

Page({
  data: {
    layoutStyle: '',
    themeClass: 'theme-default',
    versionLabel: '',
    appVersion: '',
    modalOpen: false,
    feedbackVisible: false,
    feedbackCategory: '',
    feedbackContent: '',
    feedbackContact: '',
    feedbackSourcePage: '/pages/settings/index',
    feedbackOptions: buildFeedbackOptions(),
    feedbackSubmitting: false
  },

  onLoad(options = {}) {
    const version = getVersionInfo()
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass(),
      versionLabel: version.versionLabel,
      appVersion: version.appVersion
    })
    if (options.panel === 'feedback') {
      openModal(this, { feedbackVisible: true })
    }
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  openHelp() {
    wx.navigateTo({ url: '/pages/help/index' })
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index' })
  },

  openFeedback() {
    openModal(this, { feedbackVisible: true })
  },

  closeFeedback() {
    if (this.data.feedbackSubmitting) return
    closeModal(this, { feedbackVisible: false })
  },

  selectFeedbackCategory(event) {
    const category = event.currentTarget.dataset.category || ''
    this.setData({
      feedbackCategory: category,
      feedbackOptions: buildFeedbackOptions(category)
    })
  },

  updateFeedbackContent(event) {
    this.setData({ feedbackContent: event.detail.value || '' })
  },

  updateFeedbackContact(event) {
    this.setData({ feedbackContact: event.detail.value || '' })
  },

  async submitFeedback() {
    if (this.data.feedbackSubmitting) return
    const category = this.data.feedbackCategory
    const content = (this.data.feedbackContent || '').trim()
    const contact = (this.data.feedbackContact || '').trim()
    if (!category) {
      toast('请选择反馈类型')
      return
    }
    if (content.length < 10 || content.length > 500) {
      toast('反馈内容需为 10–500 字')
      return
    }
    if (contact.length > 100) {
      toast('联系方式不能超过 100 字')
      return
    }

    this.setData({ feedbackSubmitting: true })
    try {
      await createFeedback({
        category,
        content,
        contact,
        sourcePage: this.data.feedbackSourcePage,
        appVersion: this.data.appVersion
      })
      closeModal(this, {
        feedbackVisible: false,
        feedbackCategory: '',
        feedbackContent: '',
        feedbackContact: '',
        feedbackOptions: buildFeedbackOptions(),
        feedbackSubmitting: false
      })
      toast('反馈已提交')
    } catch (error) {
      this.setData({ feedbackSubmitting: false })
      toast((error && error.message) || '提交失败，请重试')
    }
  },

  setThemeModeByTap(event) {
    const mode = event.currentTarget.dataset.mode
    if (mode !== 'default' && mode !== 'vivid') return
    setThemeMode(mode)
    this.setData({ themeClass: getThemeClass() })
  },

  async deleteMyAccount() {
    const confirmed = await new Promise((resolve) => wx.showModal({
      title: '注销并删除数据',
      content: '将删除你的灵感、排练、练习记录、方法卡、自定义素材和反馈，且无法恢复。',
      confirmText: '确认注销',
      confirmColor: '#D64545',
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    }))
    if (!confirmed) return
    try {
      await deleteAccount()
      setState({
        todayInspirations: [],
        todayRehearsals: [],
        methodCards: [],
        rehearsalHistory: [],
        practiceRecordsHistory: [],
        currentRehearsal: null,
        pausedRehearsal: null,
        currentMaterial: null,
        savedMaterialIds: [],
        playedMaterialIds: [],
        profile: null
      })
      toast('账号数据已删除')
      setTimeout(() => wx.navigateBack({ delta: 1 }), 700)
    } catch (error) {
      toast((error && error.message) || '注销失败，请重试')
    }
  }
})
