type WindowInfo = {
  windowWidth: number
  windowHeight: number
  screenHeight?: number
  safeArea?: { bottom: number }
}

type MenuButtonRect = {
  top: number
  bottom: number
  height: number
}

function toRpx(px: number, windowWidth: number) {
  return Math.round((px / windowWidth) * 750)
}

function getWindowInfo(): WindowInfo {
  const wxApi = wx as any
  if (wxApi.getWindowInfo) return wxApi.getWindowInfo()
  return wx.getSystemInfoSync()
}

function getMenuButtonRect(): MenuButtonRect | null {
  const wxApi = wx as any
  if (!wxApi.getMenuButtonBoundingClientRect) return null
  const rect = wxApi.getMenuButtonBoundingClientRect()
  return rect && rect.top && rect.bottom && rect.height ? rect : null
}

export function getLayoutStyle() {
  const info = getWindowInfo()
  const windowWidth = info.windowWidth || 375
  const fallbackMenu = {
    top: 48,
    bottom: 80,
    height: 32
  }
  const menu = getMenuButtonRect() || fallbackMenu
  const safeBottomPx = info.safeArea && typeof info.safeArea.bottom === 'number'
    ? Math.max(0, (info.screenHeight || info.windowHeight) - info.safeArea.bottom)
    : 0
  const navRowTop = toRpx(menu.top, windowWidth)
  const navRowHeight = toRpx(menu.height, windowWidth)
  const contentSafeTop = toRpx(menu.bottom, windowWidth) + 24
  const pageBottom = toRpx(safeBottomPx, windowWidth) + 176

  return [
    `--nav-row-top: ${navRowTop}rpx`,
    `--nav-row-height: ${navRowHeight}rpx`,
    `--content-safe-top: ${contentSafeTop}rpx`,
    '--page-side: 40rpx',
    `--page-bottom: ${pageBottom}rpx`
  ].join(';')
}
