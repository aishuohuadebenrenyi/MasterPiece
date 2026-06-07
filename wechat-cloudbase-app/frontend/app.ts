import { getCloudEnvConfig } from './config/env'
import './store/index'

App({
  globalData: {
    cloudEnv: null as null | ReturnType<typeof getCloudEnvConfig>
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
  }
})
