import type { Game } from '../types/domain'
import { callImprovAction } from './cloud'
import { getState } from '../store/index'

export function normalizeGame(raw: Partial<Game> & { _id?: string }): Game {
  const id = raw.id || raw._id || 'unknown-game'
  return Object.assign({
    id,
    title: '',
    desc: '',
    tags: [],
    meta: [],
    fit: [],
    verdict: '',
    avoid: '',
    lead: '',
    steps: [],
    tips: '',
    variant: '',
    issue: '',
    relatedGameId: '',
    stripeTone: 'orange',
    sortOrder: 999,
    saved: false,
    played: false,
    playedCount: 0
  }, raw, {
    id,
    relatedGameId: raw.relatedGameId || (raw as { related?: string }).related || ''
  }) as Game
}

export async function listGames(filters: Record<string, unknown> = {}) {
  const response = await callImprovAction<{ items: Game[] }>('game.list', filters, { silent: true })
  if (response.code === 0 && response.data && response.data.items) {
    return response.data.items.map(normalizeGame).sort((a, b) => a.sortOrder - b.sortOrder)
  }
  return []
}

export async function createGame(payload: Partial<Game>) {
  return callImprovAction<{ id: string }>('game.create', payload as Record<string, unknown>)
}

export async function updateGame(payload: Partial<Game>) {
  return callImprovAction<{ gameId: string }>('game.update', payload as Record<string, unknown>)
}

export async function deleteGame(id: string) {
  return callImprovAction<{ gameId: string }>('game.delete', { id })
}

export async function updateGameState(gameId: string, patch: { saved?: boolean; played?: boolean }) {
  return callImprovAction<{ gameId: string }>('game.updateState', { gameId, ...patch })
}

export async function updateSaved(gameId: string, value: boolean) {
  return updateGameState(gameId, { saved: value })
}

export async function updatePlayed(gameId: string, value: boolean) {
  if (!value) return updateGameState(gameId, { played: false })
  return updateGameState(gameId, { played: true })
}

export function findLocalGame(id: string): Game | null {
  return getState().games.find((game) => game.id === id) || null
}
