import type { VoiceDraft, VoiceTarget } from '../types/domain'

export function createVoiceDraft(payload: Partial<VoiceDraft> & {
  target?: VoiceTarget
  durationSeconds?: number
} = {}): VoiceDraft {
  const durationSeconds = Number(payload.durationSeconds || 36)
  const target = payload.target || 'inspiration'
  const titleMap: Record<VoiceTarget, string> = {
    inspiration: '刚才的语音速记',
    game_feedback: '本轮游戏反馈草稿',
    rehearsal: '当前排练复盘草稿'
  }
  const descMap: Record<VoiceTarget, string> = {
    inspiration: '待整理的语音摘要',
    game_feedback: '待整理的游戏反馈摘要',
    rehearsal: '待整理的排练复盘摘要'
  }
  return {
    id: payload.id || `voice-${Date.now()}`,
    title: payload.title || titleMap[target],
    desc: payload.desc || descMap[target],
    summary: payload.summary || descMap[target],
    target,
    durationSeconds,
    linkedGameId: payload.linkedGameId,
    linkedRehearsalId: payload.linkedRehearsalId
  }
}
