function getNetworkType() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => resolve(res.networkType),
      fail: () => resolve('unknown')
    })
  })
}

function isOffline(networkType) {
  return networkType === 'none'
}

function onNetworkStatusChange(callback) {
  wx.onNetworkStatusChange((res) => {
    callback({
      isConnected: res.isConnected,
      networkType: res.networkType
    })
  })
}

module.exports = { getNetworkType, isOffline, onNetworkStatusChange }
