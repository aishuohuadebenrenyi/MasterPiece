const { subscribe, getThemeClass } = require('../../store/index')

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    visible: { type: Boolean, value: false }
  },

  data: {
    themeClass: 'theme-default'
  },

  lifetimes: {
    attached() {
      this.unsubscribeStore = subscribe(() => {
        const themeClass = getThemeClass()
        if (this.data.themeClass !== themeClass) {
          this.setData({ themeClass })
        }
      })
    },
    detached() {
      if (this.unsubscribeStore) {
        this.unsubscribeStore()
        this.unsubscribeStore = null
      }
    }
  },

  methods: {
    noop() {},

    onAgree() {
      this.triggerEvent('agree')
      this.setData({ visible: false })
    },

    onRefuse() {
      this.triggerEvent('refuse')
      this.setData({ visible: false })
    },

    openPrivacy() {
      wx.navigateTo({ url: '/pages/privacy/index' })
    }
  }
})
