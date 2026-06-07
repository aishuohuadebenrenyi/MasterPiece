const { callImprovAction } = require('./cloud')
const { getState, setProfile } = require('../store/index')

const DEFAULT_PROFILE = {
  displayName: '即兴主理人',
  avatarUrl: '',
  troupeName: ''
}

function normalizeProfile(raw = {}) {
  return {
    displayName: typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : DEFAULT_PROFILE.displayName,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : DEFAULT_PROFILE.avatarUrl,
    troupeName: typeof raw.troupeName === 'string' ? raw.troupeName.trim() : DEFAULT_PROFILE.troupeName
  }
}

async function getProfile() {
  const response = await callImprovAction('profile.get')
  if (response.code === 0 && response.data) {
    const profile = normalizeProfile(response.data.item || {})
    setProfile(profile)
    return profile
  }
  const state = getState()
  if (state.profile) return normalizeProfile(state.profile)
  return normalizeProfile()
}

async function updateProfile(payload) {
  const response = await callImprovAction('profile.update', payload)
  // 如果云端环境未配置导致报错（如 -501000 Env Not Exists），作为离线体验依然返回成功，并保存到本地 store
  if (response.code === 0 || response.code === -1) {
    const updatedProfile = normalizeProfile(
      (response.data && response.data.item) ? response.data.item : payload
    )
    setProfile(updatedProfile)
    return {
      code: 0,
      item: updatedProfile
    }
  }
  return {
    code: response.code,
    message: response.message,
    item: null
  }
}

module.exports = {
  DEFAULT_PROFILE,
  normalizeProfile,
  getProfile,
  updateProfile
}
