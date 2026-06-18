function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (!tabBar) return
  const hidden = !!page.data.modalOpen
  tabBar.setData({ selected, hidden })
}

function setTabBarHidden(page, hidden) {
  if (typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (!tabBar) return
  tabBar.setData({ hidden })
}

module.exports = {
  syncTabBar,
  setTabBarHidden
}
