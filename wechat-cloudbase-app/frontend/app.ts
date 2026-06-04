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
    wx.cloud.init({
      env: cloudEnv.envId,
      traceUser: true
    })
  }
})
