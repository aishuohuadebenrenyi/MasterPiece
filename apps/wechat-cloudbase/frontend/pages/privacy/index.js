const { getThemeClass } = require('../../store/index')
const { getLayoutStyle } = require('../../utils/layout')

Page({
  data: {
    layoutStyle: '',
    themeClass: 'theme-default'
  },

  onLoad() {
    this.setData({
      layoutStyle: getLayoutStyle(),
      themeClass: getThemeClass()
    })
  },

  onShow() {
    this.setData({ themeClass: getThemeClass() })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
