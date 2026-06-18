Component({
  properties: {
    visible: { type: Boolean, value: false }
  },

  methods: {
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
