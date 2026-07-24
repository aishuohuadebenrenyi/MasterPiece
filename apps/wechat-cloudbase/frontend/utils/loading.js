let loadingCount = 0

function showLoading(title = '加载中...') {
  if (loadingCount === 0) {
    wx.showLoading({ title, mask: true })
  }
  loadingCount++
}

function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    wx.hideLoading()
  }
}

module.exports = { showLoading, hideLoading }
