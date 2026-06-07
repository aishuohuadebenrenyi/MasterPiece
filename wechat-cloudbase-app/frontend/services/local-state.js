const DEFAULT_STATE = {
  viewMode: 'list',
  games: [],
  savedGameIds: [],
  playedGameIds: [],
  pausedRehearsal: null,
  todayInspirations: [],
  todayRehearsals: [],
  methodCards: []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readLocalState() {
  const state = clone(DEFAULT_STATE)
  state.savedIds = state.savedGameIds
  state.playedIds = state.playedGameIds
  return state
}

function writeLocalState(patch) {
  if (patch.savedIds) patch.savedGameIds = patch.savedIds
  if (patch.playedIds) patch.playedGameIds = patch.playedIds
  const nextState = Object.assign(readLocalState(), patch)
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
