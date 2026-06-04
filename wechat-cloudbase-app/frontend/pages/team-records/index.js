Page({
  back() {
    wx.navigateBack()
  },
  openRecord() {
    wx.navigateTo({ url: '/pages/rehearsal-record/index' })
  }
})

