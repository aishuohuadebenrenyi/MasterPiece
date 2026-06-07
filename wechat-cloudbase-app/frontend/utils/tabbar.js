function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (!tabBar) return
  const hidden = !!page.data.modalOpen
  tabBar.setData({ selected, hidden })
  if (hidden) {
    wx.hideTabBar({ animation: false }).catch(() => {})
  } else {
    wx.showTabBar({ animation: false }).catch(() => {})
  }
}

function setTabBarHidden(page, hidden) {
  try {
    if (hidden) {
      const p = wx.hideTabBar({ animation: false })
      if (p && p.catch) p.catch(() => {})
    } else {
      const p = wx.showTabBar({ animation: false })
      if (p && p.catch) p.catch(() => {})
    }
  } catch (err) {}
  
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (!tabBar) return
  tabBar.setData({ hidden })
}

module.exports = {
  syncTabBar,
  setTabBarHidden
}
