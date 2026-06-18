import { callImprovAction } from './cloud'
import { getState, setProfile } from '../store/index'

interface ProfileData {
  displayName: string
  avatarUrl: string
  troupeName: string
}

const DEFAULT_PROFILE: ProfileData = {
  displayName: '即兴主理人',
  avatarUrl: '',
  troupeName: ''
}

export function normalizeProfile(raw: Partial<ProfileData> = {}): ProfileData {
  return {
    displayName: typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : DEFAULT_PROFILE.displayName,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : DEFAULT_PROFILE.avatarUrl,
    troupeName: typeof raw.troupeName === 'string' ? raw.troupeName.trim() : DEFAULT_PROFILE.troupeName
  }
}

export async function getProfile(): Promise<ProfileData> {
  const response = await callImprovAction<{ item: Partial<ProfileData> }>('profile.get')
  if (response.code === 0 && response.data) {
    const profile = normalizeProfile(response.data.item || {})
    setProfile(profile)
    return profile
  }
  const state = getState()
  if (state.profile) return normalizeProfile(state.profile)
  return normalizeProfile()
}

export async function updateProfile(payload: Partial<ProfileData>) {
  const response = await callImprovAction<{ item: Partial<ProfileData> }>('profile.update', payload as Record<string, unknown>)
  if (response.code === 0 && response.data && response.data.item) {
    const updatedProfile = normalizeProfile(response.data.item)
    setProfile(updatedProfile)
    return {
      code: 0,
      item: updatedProfile
    }
  }
  return {
    code: response.code,
    message: response.message || '保存失败',
    item: null
  }
}

export { DEFAULT_PROFILE }
