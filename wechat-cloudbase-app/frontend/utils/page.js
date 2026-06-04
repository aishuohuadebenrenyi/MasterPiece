function toast(title) {
  wx.showToast({
    title,
    icon: 'none',
    duration: 1200
  })
}

function getRouteParam(options, key, fallback = '') {
  return options && options[key] ? decodeURIComponent(options[key]) : fallback
}

module.exports = {
  toast,
  getRouteParam
}
