import type { AppState, Game, TodayItem } from '../types/domain'
import { games, methodCards, todayInspirations, todayRehearsals } from '../services/mock-data'

const KEY = 'improv_store_state'

type Listener = (state: AppState) => void

const listeners: Listener[] = []

const defaultState: AppState = {
  viewMode: 'list',
  games,
  savedGameIds: games.filter((game) => game.saved).map((game) => game.id),
  playedGameIds: games.filter((game) => game.played).map((game) => game.id),
  todayInspirations,
  todayRehearsals,
  methodCards,
  pausedRehearsal: null
}

let state: AppState = readInitialState()

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function readInitialState(): AppState {
  try {
    const stored = wx.getStorageSync(KEY)
    return Object.assign(clone(defaultState), stored || {})
  } catch (error) {
    return clone(defaultState)
  }
}

function persist() {
  try {
    wx.setStorageSync(KEY, state)
  } catch (error) {
    console.warn('[store] persist failed', error)
  }
}

function emit() {
  const snapshot = getState()
  listeners.slice().forEach((listener) => listener(snapshot))
}

export function getState(): AppState {
  return clone(state)
}

export function setState(patch: Partial<AppState>) {
  state = Object.assign({}, state, patch)
  persist()
  emit()
  return getState()
}

export function subscribe(listener: Listener) {
  listeners.push(listener)
  listener(getState())
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}

export function setGames(nextGames: Game[]) {
  const saved = new Set(state.savedGameIds)
  const played = new Set(state.playedGameIds)
  setState({
    games: nextGames.map((game) => Object.assign({}, game, {
      saved: game.saved || saved.has(game.id),
      played: game.played || played.has(game.id)
    })),
    savedGameIds: nextGames.filter((game) => game.saved || saved.has(game.id)).map((game) => game.id),
    playedGameIds: nextGames.filter((game) => game.played || played.has(game.id)).map((game) => game.id)
  })
}

export function toggleSaved(gameId: string, value?: boolean) {
  const ids = new Set(state.savedGameIds)
  const nextValue = typeof value === 'boolean' ? value : !ids.has(gameId)
  if (nextValue) ids.add(gameId)
  else ids.delete(gameId)
  setState({
    savedGameIds: Array.from(ids),
    games: state.games.map((game) => game.id === gameId ? Object.assign({}, game, { saved: nextValue }) : game)
  })
  return nextValue
}

export function markPlayed(gameId: string) {
  const ids = new Set(state.playedGameIds)
  ids.add(gameId)
  setState({
    playedGameIds: Array.from(ids),
    games: state.games.map((game) => game.id === gameId ? Object.assign({}, game, {
      played: true,
      playedCount: (game.playedCount || 0) + 1
    }) : game)
  })
}

export function addTodayItem(kind: 'todayInspirations' | 'todayRehearsals' | 'methodCards', item: TodayItem) {
  setState({ [kind]: [item].concat(state[kind] || []) } as Partial<AppState>)
}

export function resetStoreForSeed(nextGames = games) {
  state = Object.assign(clone(defaultState), {
    games: nextGames,
    savedGameIds: nextGames.filter((game) => game.saved).map((game) => game.id),
    playedGameIds: nextGames.filter((game) => game.played).map((game) => game.id)
  })
  persist()
  emit()
}
