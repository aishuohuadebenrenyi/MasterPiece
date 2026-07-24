const DEFAULT_PROD_ENV_ID = '' // 留空则使用默认云环境

const ENV_CONFIGS = {
  develop: {
    label: '开发环境',
    envId: ''
  },
  trial: {
    label: '体验环境',
    envId: ''
  },
  release: {
    label: '正式环境',
    envId: ''
  }
}

function getMiniProgramEnvVersion() {
  if (!wx.getAccountInfoSync) return 'release'
  try {
    const accountInfo = wx.getAccountInfoSync()
    const envVersion = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.envVersion : ''
    if (envVersion === 'develop' || envVersion === 'trial' || envVersion === 'release') return envVersion
  } catch (error) {
    console.warn('[improv-env] get env version failed', error)
  }
  return 'release'
}

function getCloudEnvConfig() {
  const envVersion = getMiniProgramEnvVersion()
  const config = ENV_CONFIGS[envVersion] || ENV_CONFIGS.release
  const envId = config.envId || DEFAULT_PROD_ENV_ID
  return {
    envVersion,
    label: config.label,
    envId,
    isFallback: !config.envId
  }
}

module.exports = {
  DEFAULT_PROD_ENV_ID,
  ENV_CONFIGS,
  getMiniProgramEnvVersion,
  getCloudEnvConfig
}
