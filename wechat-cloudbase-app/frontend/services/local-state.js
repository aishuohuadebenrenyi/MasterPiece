const KEY = 'improv_store_state'

const DEFAULT_STATE = {
  viewMode: 'list',
  games: [],
  savedGameIds: ['status-swap'],
  playedGameIds: ['name-chain'],
  pausedRehearsal: null,
  todayInspirations: [
    {
      id: 'today-inspiration-1',
      type: '灵感',
      title: '一句话交换身份可以加限制词',
      desc: '每轮只允许推进一个关系信息，现场会更稳。'
    },
    {
      id: 'today-inspiration-2',
      type: '灵感',
      title: '开场不要解释太多',
      desc: '让大家先玩一轮，再补规则，理解会更快。'
    }
  ],
  todayRehearsals: [
    {
      id: 'today-rehearsal',
      title: '开心即兴团 · 90 分钟',
      desc: '身体到场 → 关系建立 → 小复盘',
      status: '进行中'
    }
  ],
  methodCards: []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readLocalState() {
  try {
    const state = Object.assign(clone(DEFAULT_STATE), wx.getStorageSync(KEY) || {})
    state.savedIds = state.savedGameIds || state.savedIds || []
    state.playedIds = state.playedGameIds || state.playedIds || []
    return state
  } catch (error) {
    const state = clone(DEFAULT_STATE)
    state.savedIds = state.savedGameIds
    state.playedIds = state.playedGameIds
    return state
  }
}

function writeLocalState(patch) {
  if (patch.savedIds) patch.savedGameIds = patch.savedIds
  if (patch.playedIds) patch.playedGameIds = patch.playedIds
  const nextState = Object.assign(readLocalState(), patch)
  wx.setStorageSync(KEY, nextState)
  return nextState
}

function setIdValue(key, id, value) {
  const realKey = key === 'savedIds' ? 'savedGameIds' : key === 'playedIds' ? 'playedGameIds' : key
  const state = readLocalState()
  const ids = new Set(state[realKey] || [])
  if (value) ids.add(id)
  else ids.delete(id)
  return writeLocalState({ [realKey]: Array.from(ids) })
}

function addTodayItem(key, item) {
  const state = readLocalState()
  const nextItems = [item].concat(state[key] || [])
  return writeLocalState({ [key]: nextItems })
}

module.exports = {
  addTodayItem,
  readLocalState,
  setIdValue,
  writeLocalState
}
