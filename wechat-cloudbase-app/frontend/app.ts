import { getCloudEnvConfig } from './config/env'
import { restoreSessions } from './store/index'
import './store/index'

App({
  globalData: {
    cloudEnv: null as null | ReturnType<typeof getCloudEnvConfig>,
    privacyAuthorized: false,
    version: '1.0.0'
  },

  onLaunch() {
    if (!wx.cloud) return
    const cloudEnv = getCloudEnvConfig()
    this.globalData.cloudEnv = cloudEnv
    const initOptions: any = { traceUser: true }
    if (cloudEnv.envId) {
      initOptions.env = cloudEnv.envId
    }
    wx.cloud.init(initOptions)

    restoreSessions()

    if (wx.onNeedPrivacyAuthorization) {
      wx.onNeedPrivacyAuthorization((resolve, event) => {
        this.globalData.privacyAuthorized = false
        this._privacyResolve = resolve
        this._notifyPrivacyNeeded()
      })
    }

    if (wx.onNetworkStatusChange) {
      wx.onNetworkStatusChange((res) => {
        if (!res.isConnected) {
          wx.showToast?.({ title: '网络已断开', icon: 'none', duration: 3000 })
        }
      })
    }
  },

  _privacyResolve: null as ((type: string) => void) | null,
  _privacyListeners: [] as (() => void)[],

  _notifyPrivacyNeeded() {
    this._privacyListeners.forEach(listener => listener())
  },

  onPrivacyAgree() {
    this.globalData.privacyAuthorized = true
    if (this._privacyResolve) {
      this._privacyResolve('agree')
      this._privacyResolve = null
    }
  },

  onPrivacyRefuse() {
    if (this._privacyResolve) {
      this._privacyResolve('disagree')
      this._privacyResolve = null
    }
  },

  subscribePrivacy(listener: () => void) {
    this._privacyListeners.push(listener)
    return () => {
      const index = this._privacyListeners.indexOf(listener)
      if (index >= 0) this._privacyListeners.splice(index, 1)
    }
  }
})
