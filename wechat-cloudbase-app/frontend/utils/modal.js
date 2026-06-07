const { setTabBarHidden } = require('./tabbar')

function openModal(page, patch, afterOpen) {
  setTabBarHidden(page, true)
  page.setData(Object.assign({}, patch, { modalOpen: true }), () => {
    if (typeof afterOpen === 'function') afterOpen()
  })
}

function closeModal(page, patch, afterClose) {
  setTabBarHidden(page, false)
  page.setData(Object.assign({}, patch, { modalOpen: false }), () => {
    if (typeof afterClose === 'function') afterClose()
  })
}

module.exports = {
  openModal,
  closeModal
}
