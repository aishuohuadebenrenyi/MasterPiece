function createVoiceDraft(payload = {}) {
  const durationSeconds = Number(payload.durationSeconds || 36)
  const target = payload.target || 'inspiration'
  const titleMap = {
    inspiration: '刚才的语音速记',
    game_feedback: '本轮游戏反馈草稿',
    rehearsal: '当前排练复盘草稿'
  }
  const descMap = {
    inspiration: '待整理的语音摘要',
    game_feedback: '待整理的游戏反馈摘要',
    rehearsal: '待整理的排练复盘摘要'
  }
  return {
    id: `voice-${Date.now()}`,
    title: payload.title || titleMap[target] || titleMap.inspiration,
    desc: payload.desc || descMap[target] || descMap.inspiration,
    summary: payload.summary || descMap[target] || descMap.inspiration,
    target,
    durationSeconds,
    linkedGameId: payload.linkedGameId,
    linkedRehearsalId: payload.linkedRehearsalId
  }
}

module.exports = {
  createVoiceDraft
}
