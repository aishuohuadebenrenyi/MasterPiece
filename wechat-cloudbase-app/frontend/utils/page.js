function resolveToastTone(title) {
  if (title.includes('待同步')) return 'warm'
  if (/^(先|请|没有|当前还没有)/.test(title) || title.includes('失败')) return 'error'
  return 'default'
}

function toast(title) {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  if (!current || typeof current.setData !== 'function') {
    wx.showToast({ title, icon: 'none', duration: 1200 })
    return
  }
  if (current.__toastTimer) clearTimeout(current.__toastTimer)
  current.setData({
    appToastVisible: true,
    appToastTitle: title,
    appToastTone: resolveToastTone(title)
  })
  current.__toastTimer = setTimeout(() => {
    current.setData({ appToastVisible: false })
  }, 2000)
}

function getRouteParam(options, key, fallback = '') {
  return options && options[key] ? decodeURIComponent(options[key]) : fallback
}

module.exports = {
  toast,
  getRouteParam
}
