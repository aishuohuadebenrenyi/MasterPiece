const { setTabBarHidden } = require('./tabbar')

function openModal(page, patch, afterOpen) {
  page.setData(Object.assign({}, patch, { modalOpen: true }), () => {
    setTabBarHidden(page, true)
    if (typeof afterOpen === 'function') afterOpen()
  })
}

function closeModal(page, patch, afterClose) {
  page.setData(Object.assign({}, patch, { modalOpen: false }), () => {
    setTabBarHidden(page, false)
    if (typeof afterClose === 'function') afterClose()
  })
}

module.exports = {
  openModal,
  closeModal
}
